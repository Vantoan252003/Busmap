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
            routeItem.textContent = `${route}`;
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

    function findNearestStop() {
        if (!userLocation) {
            alert('Vui lòng lấy vị trí của bạn trước!');
            return;
        }
    
        let minDistance = Infinity;
        nearestStop = null;
    
        stopsData.forEach(stop => {
            if (stop.Latitude && stop.Longitude && !isNaN(stop.Latitude) && !isNaN(stop.Longitude)) {
                const lat = parseFloat(stop.Latitude);
                const lon = parseFloat(stop.Longitude);
                const stopLocation = L.latLng(lat, lon);
                const distance = userLocation.distanceTo(stopLocation);
    
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestStop = { lat, lon, name: stop.Stop_Name, distance };
                }
            }
        });
    
        if (nearestStop) {
            const popupContent = `
                <b>Trạm gần nhất:</b> ${nearestStop.name}<br>
                <b>Khoảng cách:</b> ${(nearestStop.distance / 1000).toFixed(2)} km<br>
                <button onclick="findRouteTo(${nearestStop.lat}, ${nearestStop.lon}, '${nearestStop.name}')">Tìm đường đến đây</button>
            `;
            L.marker([nearestStop.lat, nearestStop.lon], { icon: busIcon })
                .addTo(map)
                .bindPopup(popupContent)
                .openPopup();
            map.setView([nearestStop.lat, nearestStop.lon], 16);
        } else {
            alert('Không tìm thấy trạm xe buýt nào gần đây.');
        }
    }

    var sidebar = new bootstrap.Offcanvas(document.getElementById('sidebar'), { backdrop: false });
    document.getElementById('sidebar-toggle').addEventListener('click', function () {
        sidebar.toggle();
        document.body.classList.toggle('sidebar-active');
    });
    document.getElementById('sidebar').addEventListener('shown.bs.offcanvas', function () {
        document.body.classList.add('sidebar-active');
    });
    document.getElementById('sidebar').addEventListener('hidden.bs.offcanvas', function () {
        document.body.classList.remove('sidebar-active');
    });

    // Gọi các hàm khởi tạo
    if (stopsData.length) {
        addMarkers();
        populateRouteList();
    }
    locateUser();
    window.locateUser = locateUser;
});