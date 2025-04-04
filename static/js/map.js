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
            if (stop.Latitude && stop.Longitude && !isNaN(stop.Latitude) && !isNaN(stop.Longitude)) {
                var popupContent = `
                    <b>Trạm:</b> ${stop.Stop_Name || 'Chưa có thông tin'}<br>
                    <b>Địa chỉ:</b> ${stop.Address || 'Chưa có thông tin'}<br>
                    <b>Số tuyến:</b> ${stop.Route_Number || 'Chưa có'}<br>
                    <b>Thông tin thêm:</b> ${stop.Additional_Info || 'Chưa có thông tin'}
                `;
                var marker = L.marker([parseFloat(stop.Latitude), parseFloat(stop.Longitude)], { icon: busIcon })
                    .addTo(map)
                    .bindPopup(popupContent);
                bounds.extend([parseFloat(stop.Latitude), parseFloat(stop.Longitude)]);
            } else {
                console.warn(`Bỏ qua trạm ${stop.Stop_Name} do tọa độ không hợp lệ: Lat=${stop.Latitude}, Lon=${stop.Longitude}`);
            }
        });
        if (bounds.isValid()) {
            map.fitBounds(bounds);
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
            timeout: 100000
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

    // Tìm kiếm địa chỉ với OpenCage API
    function searchAddress(query) {
        const apiKey = '3074843eec1148f5a9a501822f6af088'; 
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=1`;
        fetch(url)
            .then(response => {
                console.log(`Search request to ${url} - Status: ${response.status}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.results && data.results.length > 0) {
                    var lat = data.results[0].geometry.lat;
                    var lng = data.results[0].geometry.lng;
                    var displayName = data.results[0].formatted;

                    if (searchMarker) map.removeLayer(searchMarker);
                    searchMarker = L.marker([lat, lng]).addTo(map)
                        .bindPopup(`<b>Địa chỉ:</b> ${displayName}`).openPopup();
                    map.setView([lat, lng], 16);
                } else {
                    alert('Không tìm thấy địa chỉ!');
                }
            })
            .catch(error => {
                console.error('Error fetching address:', error);
                alert('Có lỗi khi tìm kiếm địa chỉ. Vui lòng kiểm tra kết nối.');
            });
    }

    // Logic tìm kiếm thủ công
    const searchInput = document.getElementById('search');
    const suggestionsContainer = document.getElementById('search-suggestions');

    if (!searchInput || !suggestionsContainer) {
        console.error('Search input or suggestions container not found!');
        return;
    }

    let debounceTimeout;
    searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            const query = this.value.trim();
            if (query.length < 2) {
                suggestionsContainer.style.display = 'none';
                suggestionsContainer.innerHTML = '';
                return;
            }

            const apiKey = '3074843eec1148f5a9a501822f6af088'; 
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=5`;
            fetch(url)
                .then(response => {
                    console.log(`Request to ${url} - Status: ${response.status}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    suggestionsContainer.innerHTML = '';
                    if (data && data.results && data.results.length > 0) {
                        suggestionsContainer.style.display = 'block';
                        data.results.forEach(item => {
                            const suggestion = document.createElement('div');
                            suggestion.textContent = item.formatted;
                            suggestion.addEventListener('click', () => {
                                searchAddress(item.formatted);
                                suggestionsContainer.style.display = 'none';
                                searchInput.value = item.formatted;
                            });
                            suggestionsContainer.appendChild(suggestion);
                        });
                    } else {
                        suggestionsContainer.style.display = 'none';
                    }
                })
                .catch(error => {
                    console.error('Error fetching suggestions:', error);
                    suggestionsContainer.style.display = 'none';
                });
        }, 500); // Chờ 0.5 giây trước khi gửi yêu cầu
    });

    // Ẩn gợi ý khi click ra ngoài
    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Tìm kiếm khi nhấn Enter
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchAddress(this.value);
            suggestionsContainer.style.display = 'none';
        }
    });

    // Hàm toàn màn hình thủ công
    window.toggleFullscreen = function () {
        var mapContainer = document.querySelector('.map-container');
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen().then(() => {
                map.invalidateSize();
                document.getElementById('fullscreen-button').textContent = 'Thoát toàn màn hình';
            }).catch(err => {
                console.error('Error entering fullscreen:', err);
                alert('Không thể chuyển sang toàn màn hình.');
            });
        } else {
            document.exitFullscreen().then(() => {
                map.invalidateSize();
                document.getElementById('fullscreen-button').textContent = 'Toàn màn hình';
            }).catch(err => console.error('Error exiting fullscreen:', err));
        }
    };

    // Gọi các hàm
    if (stopsData.length) {
        addMarkers();
    }

    // Sử dụng Bootstrap để toggle sidebar
    var sidebar = new bootstrap.Offcanvas(document.getElementById('sidebar'), { backdrop: false });
    document.getElementById('sidebar-toggle').addEventListener('click', function () {
        sidebar.toggle();
    });

    window.locateUser = locateUser;
});