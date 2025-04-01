document.addEventListener('DOMContentLoaded', function () {
    // Khởi tạo bản đồ
    var map = L.map('map').setView([10.8447, 106.6640], 14);

    // Thêm lớp tile từ OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Lấy dữ liệu từ window.mapData
    var stopsData = window.mapData && window.mapData.stopsData ? window.mapData.stopsData : [];
    console.log('Stops Data in map.js:', stopsData);

    if (!stopsData.length) {
        console.error('No stops data available!');
        return;
    }

    // Tùy chỉnh icon cho marker (sử dụng staticUrl từ map.html)
    var busIcon = window.mapData && window.mapData.staticUrl ? L.icon({
        iconUrl: window.mapData.staticUrl('images/bus-icon.png'),
        iconSize: [30, 30], // Điều chỉnh kích thước icon
        iconAnchor: [15, 15] // Căn giữa icon
    }): L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    }); 

    // Hàm vẽ marker cho trạm dừng
    function addMarkers() {
        var bounds = L.latLngBounds();
        stopsData.forEach(function (stop) {
            var marker = L.marker([stop.Latitude, stop.Longitude], { icon: busIcon })
                .addTo(map)
                .bindPopup(`Trạm: ${stop.Stop_Name}<br>Tuyến: ${stop.Route_Number}`);
            bounds.extend([stop.Latitude, stop.Longitude]);
        });
        map.fitBounds(bounds); // Tự động căn bản đồ
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

    // Gọi các hàm
    addMarkers();
    drawRoutes();
    window.locateUser = locateUser; // Định nghĩa locateUser như hàm global
});