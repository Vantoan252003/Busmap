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
    var userLocation = null; // Lưu vị trí hiện tại của người dùng
    var searchLocation = null; // Lưu vị trí từ thanh tìm kiếm
    var routingControl = null; // Lưu đối tượng định tuyến
    var selectedStops = []; // Lưu trữ hai trạm được chọn để tìm đường đi

    const markers = L.layerGroup().addTo(map); // Nhóm các marker để dễ quản lý
    const ZOOM_THRESHOLD = 16; // Ngưỡng zoom để hiển thị marker

    function addMarkers() {
        markers.clearLayers(); // Xóa các marker cũ
        const zoomLevel = map.getZoom();
    
        if (zoomLevel < ZOOM_THRESHOLD) return; // Không hiển thị marker nếu zoom nhỏ hơn ngưỡng
    
        stopsData.forEach(stop => {
            if (stop.Latitude && stop.Longitude && !isNaN(stop.Latitude) && !isNaN(stop.Longitude)) {
                const lat = parseFloat(stop.Latitude);
                const lon = parseFloat(stop.Longitude);
                const popupContent = `
                    <b>Trạm:</b> ${stop.Stop_Name || 'Chưa có thông tin'}<br>
                    <b>Địa chỉ:</b> ${stop.Address || 'Chưa có thông tin'}<br>
                    <b>Số tuyến:</b> ${stop.Route_Number || 'Chưa có'}<br>
                    <b>Thông tin thêm:</b> ${stop.Additional_Info || 'Chưa có thông tin'}<br>
                    <button class="select-stop" onclick="selectStop(${lat}, ${lon}, '${stop.Stop_Name}'); map.closePopup();">Chọn trạm này</button>
                    <button class="find-route" onclick="findRouteTo(${lat}, ${lon}, '${stop.Stop_Name}'); map.closePopup();">Tìm đường đến đây</button>
                `;
                L.marker([lat, lon], { icon: busIcon })
                    .bindPopup(popupContent)
                    .addTo(markers);
            }
        });
    }

    function locateUser() {
        if (!navigator.geolocation) {
            alert('Trình duyệt không hỗ trợ định vị.');
            return;
        }

        map.locate({ setView: true, enableHighAccuracy: true, maxZoom: 16, timeout: 10000 });

        map.on('locationfound', e => {
            userLocation = e.latlng;
            L.marker(e.latlng).addTo(map).bindPopup('Bạn đang ở đây :)').openPopup();
            L.circle(e.latlng, e.accuracy / 2, {
                weight: 2,
                color: 'red',
                fillColor: 'red',
                fillOpacity: 0.1
            }).addTo(map);
        });

        map.on('locationerror', e => alert('Không thể lấy vị trí: ' + e.message));
    }

    // Cập nhật marker khi bản đồ thay đổi (zoom hoặc di chuyển)
    map.on('moveend zoomend', addMarkers);
    addMarkers();
    // Hiển thị danh sách tuyến xe trong sidebar
    function populateRouteList() {
        var routeList = document.getElementById('route-list');
        var uniqueRoutes = [...new Set(stopsData.map(stop => stop.Route_Number))].filter(route => route && route !== 'Unknown');
    
        if (uniqueRoutes.length === 0) {
            routeList.innerHTML = '<p>Không có thông tin tuyến xe nào.</p>';
            return;
        }
    
        uniqueRoutes.forEach(function (route) {
            var routeItem = document.createElement('div');
            routeItem.className = 'route-item';
            routeItem.textContent = `Tuyến ${route}`;
            routeItem.addEventListener('click', function () {
                map.eachLayer(function (layer) {
                    if (layer instanceof L.Marker) map.removeLayer(layer);
                });
                var routeStops = stopsData.filter(stop => stop.Route_Number === route);
                routeStops.forEach(function (stop) {
                    var popupContent = `
                        <b>Trạm:</b> ${stop.Stop_Name}<br>
                        <b>Số tuyến:</b> ${stop.Route_Number}<br>
                        <button class="select-stop" onclick="selectStop(${stop.Latitude}, ${stop.Longitude}, '${stop.Stop_Name}'); map.closePopup();">Chọn trạm này</button>
                        <button class="find-route" onclick="findRouteTo(${stop.Latitude}, ${stop.Longitude}, '${stop.Stop_Name}'); map.closePopup();">Tìm đường đến đây</button>
                    `;
                    L.marker([parseFloat(stop.Latitude), parseFloat(stop.Longitude)], { icon: busIcon })
                        .addTo(map)
                        .bindPopup(popupContent);
                });
                var sidebar = bootstrap.Offcanvas.getInstance(document.getElementById('sidebar'));
                sidebar.hide();
            });
            routeList.appendChild(routeItem);
        });
    }

    // Chọn trạm để tìm đường đi giữa hai trạm
    window.selectStop = function (lat, lon, stopName) {
        if (selectedStops.length < 2) {
            selectedStops.push({ lat: lat, lon: lon, name: stopName });
            alert(`Đã chọn: ${stopName}`);
        }

        if (selectedStops.length === 2) {
            if (routingControl) {
                map.removeControl(routingControl);
            }
            routingControl = L.Routing.control({
                waypoints: [
                    L.latLng(selectedStops[0].lat, selectedStops[0].lon),
                    L.latLng(selectedStops[1].lat, selectedStops[1].lon)
                ],
                routeWhileDragging: true,
                show: true,
                addWaypoints: false,
                fitSelectedRoutes: true,
                showAlternatives: false,
                lineOptions: {
                    styles: [{ color: 'green', weight: 4 }]
                },
                createMarker: function () { return null; }
            }).addTo(map);

            alert(`Đường đi từ ${selectedStops[0].name} đến ${selectedStops[1].name} đã được hiển thị.`);
            document.getElementById('clear-route').style.display = 'block';
            selectedStops = [];
        }
    };

    // Tìm đường từ vị trí người dùng hoặc vị trí tìm kiếm đến trạm
    window.findRouteTo = function (lat, lon, stopName) {
        var startLocation = searchLocation || userLocation;
        if (!startLocation) {
            alert('Vui lòng tìm vị trí của bạn hoặc nhập địa chỉ trên thanh tìm kiếm trước khi tìm đường!');
            return;
        }

        if (routingControl) {
            map.removeControl(routingControl);
        }

        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(startLocation.lat, startLocation.lng),
                L.latLng(lat, lon)
            ],
            routeWhileDragging: true,
            show: true,
            addWaypoints: false,
            fitSelectedRoutes: true,
            showAlternatives: false,
            lineOptions: {
                styles: [{ color: 'blue', weight: 4 }]
            },
            createMarker: function () { return null; }
        }).addTo(map);

        document.getElementById('clear-route').style.display = 'block';
    };

    // Xóa đường đi
    document.getElementById('clear-route').addEventListener('click', function () {
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
            this.style.display = 'none';
            selectedStops = [];
        }
    });

    // Định vị người dùng
    function locateUser() {
        if (!navigator.geolocation) {
            alert('Trình duyệt không hỗ trợ định vị.');
            return;
        }

        map.locate({
            setView: true,
            enableHighAccuracy: true,
            maxZoom: 64,
            timeout: 10000
        });

        map.on('locationfound', function (e) {
            userLocation = e.latlng;
            L.marker(e.latlng).addTo(map).bindPopup('Bạn đang ở đây :)').openPopup();
            L.circle(e.latlng, e.accuracy / 2, {
                weight: 2,
                color: 'red',
                fillColor: 'red',
                fillOpacity: 0.1
            }).addTo(map);
        });

        map.on('locationerror', function (e) {
            alert('Không thể lấy vị trí: ' + e.message);
        });
    }

    // Tìm kiếm địa chỉ với OpenCage API
    async function searchAddress(query) {
        const apiKey = '3074843eec1148f5a9a501822f6af088';
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=1`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                var lat = data.results[0].geometry.lat;
                var lng = data.results[0].geometry.lng;
                var displayName = data.results[0].formatted;

                if (searchMarker) map.removeLayer(searchMarker);
                searchLocation = { lat: lat, lng: lng };
                searchMarker = L.marker([lat, lng]).addTo(map)
                    .bindPopup(`<b>Địa chỉ:</b> ${displayName}</br>
                         <button class="find-route" onclick="findRouteTo(${lat}, ${lng}, '${stop.Stop_Name}'); map.closePopup();">Tìm đường đến đây</button>`).openPopup(); 
                map.setView([lat, lng], 16);
            } else {
                alert('Không tìm thấy địa chỉ!');
            }
        } catch (error) {
            alert('Có lỗi khi tìm kiếm địa chỉ: ' + error.message);
        }
    }

    // Hàm lấy gợi ý địa chỉ từ OpenCage
    async function fetchSuggestions(query, container, inputElement) {
        const apiKey = '3074843eec1148f5a9a501822f6af088';
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=5&bounds=106.5,10.5,107.0,11.0`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            container.innerHTML = '';
            if (data.results && data.results.length > 0) {
                container.style.display = 'block';
                data.results.forEach(item => {
                    const suggestion = document.createElement('div');
                    suggestion.textContent = item.formatted;
                    suggestion.addEventListener('click', () => {
                        inputElement.value = item.formatted;
                        container.style.display = 'none';
                    });
                    container.appendChild(suggestion);
                });
            } else {
                container.style.display = 'none';
            }
        } catch (error) {
            console.error('Lỗi khi lấy gợi ý:', error);
            container.style.display = 'none';
        }
    }

    // Logic tìm kiếm chính
    const searchInput = document.getElementById('search');
    const suggestionsContainer = document.getElementById('search-suggestions');
    let debounceTimeout;

    searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimeout);
        const query = this.value.trim();
        if (query.length < 2) {
            suggestionsContainer.style.display = 'none';
            suggestionsContainer.innerHTML = '';
            return;
        }
        debounceTimeout = setTimeout(() => fetchSuggestions(query, suggestionsContainer, searchInput), 500);
    });

    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            searchAddress(this.value);
            suggestionsContainer.style.display = 'none';
        }
    });

    // Logic gợi ý cho "Điểm bắt đầu"
    const startInput = document.getElementById('start-point');
    const startSuggestions = document.getElementById('start-suggestions');
    let startDebounceTimeout;

    startInput.addEventListener('input', function () {
        clearTimeout(startDebounceTimeout);
        const query = this.value.trim();
        if (query.length < 2) {
            startSuggestions.style.display = 'none';
            startSuggestions.innerHTML = '';
            return;
        }
        startDebounceTimeout = setTimeout(() => fetchSuggestions(query, startSuggestions, startInput), 500);
    });

    startInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            startSuggestions.style.display = 'none';
            findRouteBetweenPoints();
        }
    });

    // Logic gợi ý cho "Điểm kết thúc"
    const endInput = document.getElementById('end-point');
    const endSuggestions = document.getElementById('end-suggestions');
    let endDebounceTimeout;

    endInput.addEventListener('input', function () {
        clearTimeout(endDebounceTimeout);
        const query = this.value.trim();
        if (query.length < 2) {
            endSuggestions.style.display = 'none';
            endSuggestions.innerHTML = '';
            return;
        }
        endDebounceTimeout = setTimeout(() => fetchSuggestions(query, endSuggestions, endInput), 500);
    });

    endInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            endSuggestions.style.display = 'none';
            findRouteBetweenPoints();
        }
    });

    // Ẩn gợi ý khi click ra ngoài
    document.addEventListener('click', function (e) {
        if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
        if (!startInput.contains(e.target) && !startSuggestions.contains(e.target)) {
            startSuggestions.style.display = 'none';
        }
        if (!endInput.contains(e.target) && !endSuggestions.contains(e.target)) {
            endSuggestions.style.display = 'none';
        }
    });

    // Hàm tìm đường giữa hai điểm
    window.findRouteBetweenPoints = async function () {
        const startInput = document.getElementById('start-point').value.trim();
        const endInput = document.getElementById('end-point').value.trim();

        console.log('Địa chỉ nhập vào - Start:', startInput, 'End:', endInput);

        if (!startInput || !endInput) {
            alert('Vui lòng nhập cả điểm bắt đầu và điểm kết thúc!');
            return;
        }

        const apiKey = '3074843eec1148f5a9a501822f6af088';

        async function getCoordinates(query) {
            const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=5&bounds=106.5,10.5,107.0,11.0`;
            const response = await fetch(url);
            const data = await response.json();
            console.log('Phản hồi API cho', query, ':', data.results);
            if (data.results && data.results.length > 0) {
                const result = data.results.find(r => r.components.city === 'Ho Chi Minh City') || data.results[0];
                return {
                    lat: result.geometry.lat,
                    lng: result.geometry.lng
                };
            }
            return null;
        }

        try {
            const startCoords = await getCoordinates(startInput);
            const endCoords = await getCoordinates(endInput);

            console.log('Tọa độ - Start:', startCoords, 'End:', endCoords);

            if (!startCoords || !endCoords) {
                alert('Không thể tìm thấy một hoặc cả hai địa điểm. Vui lòng kiểm tra lại.');
                return;
            }

            if (routingControl) {
                map.removeControl(routingControl);
            }

            routingControl = L.Routing.control({
                waypoints: [
                    L.latLng(startCoords.lat, startCoords.lng),
                    L.latLng(endCoords.lat, endCoords.lng)
                ],
                routeWhileDragging: true,
                show: true,
                addWaypoints: false,
                fitSelectedRoutes: true,
                showAlternatives: false,
                lineOptions: {
                    styles: [{ color: 'purple', weight: 4 }]
                },
                createMarker: function () { return null; }
            }).addTo(map);

            document.getElementById('clear-route').style.display = 'block';
            alert(`Đường đi từ "${startInput}" đến "${endInput}" đã được hiển thị.`);
        } catch (error) {
            alert('Có lỗi khi tìm đường: ' + error.message);
        }
    };

    // Toàn màn hình
    window.toggleFullscreen = function () {
        var mapContainer = document.querySelector('.map-container');
        var fullscreenButton = document.getElementById('fullscreen-button');
        
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen().then(() => {
                map.invalidateSize();
                fullscreenButton.innerHTML = '<i class="fa fa-compress"></i>'; 
            }).catch(err => {
                alert('Không thể chuyển sang toàn màn hình: ' + err);
            });
        } else {
            document.exitFullscreen().then(() => {
                map.invalidateSize(); 
                fullscreenButton.innerHTML = '<i class="fa fa-expand"></i>'; 
            }).catch(err => {
                console.error(err);
            });
        }
    };

    // Toggle sidebar
    var sidebar = new bootstrap.Offcanvas(document.getElementById('sidebar'), { backdrop: false });
    document.getElementById('sidebar-toggle').addEventListener('click', function () {
        sidebar.toggle();
    });

    // Gọi các hàm khởi tạo
    if (stopsData.length) {
        addMarkers();
        populateRouteList();
    }
    locateUser();
    window.locateUser = locateUser;
});