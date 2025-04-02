document.addEventListener('DOMContentLoaded', function () {
    // Khởi tạo bản đồ
    var map = L.map('map', {
        fullscreenControl: true, 
        fullscreenControlOptions: {
            position: 'topleft' 
        }
    }).setView([10.8447, 106.6640], 14);
    // Thêm lớp tile từ OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Lấy dữ liệu từ window.mapData
    var stopsData = window.mapData && window.mapData.stopsData ? window.mapData.stopsData : [];
    console.log('Stops Data in map.js:', stopsData);

    // Tùy chỉnh icon cho marker
    var busIcon = window.mapData && window.mapData.staticUrl ? L.icon({
        iconUrl: window.mapData.staticUrl('images/bus-icon.png'),
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    }) : L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    });

    // Marker cho vị trí tìm kiếm
    var searchMarker;

    // Hàm vẽ marker cho trạm dừng
    function addMarkers() {
        var bounds = L.latLngBounds();
        stopsData.forEach(function (stop) {
            var marker = L.marker([stop.Latitude, stop.Longitude], { icon: busIcon })
                .addTo(map)
                .bindPopup(`<b>Trạm:</b> ${stop.Stop_Name}<br><b>Tuyến:</b> ${stop.Route_Number}`);
            bounds.extend([stop.Latitude, stop.Longitude]);
        });
        if (stopsData.length) map.fitBounds(bounds);
    }

    // Hàm vẽ các tuyến đường
    function drawRoutes() {
        var routes = {
            '18': { color: 'red' },
            '07': { color: 'green' },
            '148': { color: 'blue' }
        };

        for (var routeNum in routes) {
            var routeData = stopsData.filter(stop => stop.Route_Number === routeNum);
            if (routeData.length > 1) {
                var latlngs = routeData.map(stop => [stop.Latitude, stop.Longitude]);
                L.polyline(latlngs, {
                    color: routes[routeNum].color,
                    weight: 2.5,
                    opacity: 0.8
                }).addTo(map);
            }
        }
    }

    // Hàm lấy vị trí người dùng
    window.locateUser = function() {
        if (!navigator.geolocation) {
            alert('Trình duyệt không hỗ trợ định vị.');
            return;
        }
        map.locate({
            setView: true,
            enableHighAccuracy: true,
            maxZoom: 16,
            timeout: 20000
        });
        map.on('locationfound', function (e) {
            console.log('Location found:', e.latlng);
            L.marker(e.latlng).bindPopup('<b>Bạn đang ở đây!</b>').addTo(map);
            L.circle(e.latlng, e.accuracy / 2, {
                weight: 2,
                color: 'red',
                fillColor: 'red',
                fillOpacity: 0.1
            }).addTo(map);
        });

        map.on('locationerror', function (e) {
            console.error('Location error:', e.message);
            alert('Không thể lấy vị trí. Vui lòng cho phép truy cập vị trí.');
        });
    };
    // toàn màn hình
    window.toggleFullscreen = function() {
        var mapContainer = document.querySelector('.map-container');
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen().then(function() {
                map.invalidateSize(); // Cập nhật kích thước bản đồ
                document.querySelector('.fullscreen-button').textContent = 'Thoát toàn màn hình';
            }).catch(function(err) {
                console.error('Error entering fullscreen:', err);
                alert('Không thể chuyển sang chế độ toàn màn hình. Vui lòng kiểm tra trình duyệt.');
            });
        } else {
            document.exitFullscreen().then(function() {
                map.invalidateSize(); // Cập nhật kích thước bản đồ
                document.querySelector('.fullscreen-button').textContent = 'Toàn màn hình';
            }).catch(function(err) {
                console.error('Error exiting fullscreen:', err);
            });
        }
    };
    // Tìm kiếm địa chỉ với Nominatim
    function searchAddress(query) {
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    var lat = parseFloat(data[0].lat);
                    var lon = parseFloat(data[0].lon);
                    var displayName = data[0].display_name;

                    // Xóa marker cũ nếu có
                    if (searchMarker) map.removeLayer(searchMarker);

                    // Thêm marker mới
                    searchMarker = L.marker([lat, lon]).addTo(map)
                        .bindPopup(`<b>Địa chỉ:</b> ${displayName}`).openPopup();

                    // Zoom vào vị trí
                    map.setView([lat, lon], 16);
                } else {
                    alert('Không tìm thấy địa chỉ!');
                }
            })
            .catch(error => {
                console.error('Error fetching address:', error);
                alert('Có lỗi khi tìm kiếm địa chỉ.');
            });
    }

    // Khởi tạo Autocomplete
    try {
        new Autocomplete({
            selector: '#search',
            minChars: 2,
            source: function(term, suggest) {
                fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(term)}&format=json&limit=5`)
                    .then(response => response.json())
                    .then(data => {
                        var suggestions = data.map(item => item.display_name);
                        suggest(suggestions);
                    })
                    .catch(error => console.error('Error:', error));
            },
            onSelect: function(e, term, item) {
                searchAddress(term);
            }
        });
    } catch (error) {
        console.error('Error initializing Autocomplete:', error);
    }

    // Gọi các hàm
    if (stopsData.length) {
        addMarkers();
        drawRoutes();
    }

    // Xử lý tìm kiếm khi nhấn Enter
    var searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchAddress(this.value);
            }
        });
    } else {
        console.error('Search input not found!');
    }
});