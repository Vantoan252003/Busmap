document.addEventListener('DOMContentLoaded', function () {
    // Khởi tạo bản đồ
    var map = L.map('map').setView([10.8447, 106.6640], 14);

    // Thêm lớp tile từ OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

   

    var stopsData = window.mapData && window.mapData.stopsData ? window.mapData.stopsData : [];
    console.log('Stops Data in map.js:', stopsData);

    if (!stopsData.length) {
        console.error('No stops data available!');
        return;
    }

    var busIcon = window.mapData && window.mapData.staticUrl ? L.icon({
        iconUrl: window.mapData.staticUrl('images/bus-icon.png'),
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    }) : L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    });

    var searchMarker;

    function addMarkers() {
        var bounds = L.latLngBounds();
        stopsData.forEach(function (stop) {
            var popupContent = `
                <b>Trạm:</b> ${stop.Stop_Name}<br>
                <b>Địa chỉ:</b> ${stop.Address || 'Chưa có thông tin'}<br>
                <b>Số tuyến:</b> ${stop.Route_Number}<br>
                <b>Thông tin thêm:</b> ${stop.Additional_Info || 'Chưa có thông tin'}
            `;
            var marker = L.marker([stop.Latitude, stop.Longitude], { icon: busIcon })
                .addTo(map)
                .bindPopup(popupContent);
            bounds.extend([stop.Latitude, stop.Longitude]);
        });
        map.fitBounds(bounds);
    }

    function drawRoutes() {
        var routes = {};
        stopsData.forEach(function (stop) {
            if (!routes[stop.Route_Number]) {
                routes[stop.Route_Number] = { color: getRouteColor(stop.Route_Number), points: [] };
            }
            routes[stop.Route_Number].points.push([stop.Latitude, stop.Longitude]);
        });

        for (var routeNum in routes) {
            if (routes[routeNum].points.length > 1) {
                L.polyline(routes[routeNum].points, {
                    color: routes[routeNum].color,
                    weight: 2.5,
                    opacity: 0.8
                }).addTo(map);
            }
        }
    }

    function getRouteColor(routeNum) {
        const colors = {
            '18': 'red',
            '07': 'green',
            '148': 'blue'
        };
        return colors[routeNum] || 'gray';
    }

    function populateRouteList() {
        var routeList = document.getElementById('route-list');
        var uniqueRoutes = [...new Set(stopsData.map(stop => stop.Route_Number))];
        uniqueRoutes.forEach(function (routeNum) {
            var routeItem = document.createElement('div');
            routeItem.className = 'route-item list-group-item';
            routeItem.innerHTML = `Tuyến ${routeNum}`;
            routeItem.onclick = function () {
                highlightRoute(routeNum);
            };
            routeList.appendChild(routeItem);
        });
    }

    function highlightRoute(routeNum) {
        map.eachLayer(function (layer) {
            if (layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });
        var routeData = stopsData.filter(stop => stop.Route_Number === routeNum);
        if (routeData.length > 1) {
            var latlngs = routeData.map(stop => [stop.Latitude, stop.Longitude]);
            L.polyline(latlngs, {
                color: getRouteColor(routeNum),
                weight: 4,
                opacity: 1
            }).addTo(map);
            map.fitBounds(latlngs);
        }
    }

    function locateUser() {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by this browser.');
            alert('Trình duyệt không hỗ trợ định vị.');
            return;
        }

        map.locate({
            setView: true,
            enableHighAccuracy: true,
            maxZoom: 16,
            timeout: 10000
        });

        map.on('locationfound', function (e) {
            console.log('Location found:', e.latlng);
            var marker = L.marker(e.latlng).bindPopup('Bạn đang ở đây :)').addTo(map);
            var circle = L.circle(e.latlng, e.accuracy / 2, {
                weight: 2,
                color: 'red',
                fillColor: 'red',
                fillOpacity: 0.1
            }).addTo(map);
        });

        map.on('locationerror', function (e) {
            console.error('Location error:', e.message);
            alert('Không thể lấy vị trí. Vui lòng cho phép truy cập vị trí hoặc kiểm tra kết nối.');
        });
    }

    // Tìm kiếm địa chỉ với Nominatim
    function searchAddress(query) {
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    var lat = parseFloat(data[0].lat);
                    var lon = parseFloat(data[0].lon);
                    var displayName = data[0].display_name;

                    if (searchMarker) map.removeLayer(searchMarker);
                    searchMarker = L.marker([lat, lon]).addTo(map)
                        .bindPopup(`<b>Địa chỉ:</b> ${displayName}`).openPopup();
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
        new Autocomplete('search', {
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

    // Gọi các hàm
    if (stopsData.length) {
        addMarkers();
        drawRoutes();
    }
    populateRouteList();

    // Sử dụng Bootstrap để toggle sidebar
    var sidebar = new bootstrap.Offcanvas(document.getElementById('sidebar'), { backdrop: false });
    document.getElementById('sidebar-toggle').addEventListener('click', function () {
        sidebar.toggle();
    });
    window.locateUser = locateUser;
});