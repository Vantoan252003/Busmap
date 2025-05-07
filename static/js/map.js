document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', {
        fullscreenControl: true,
        fullscreenControlOptions: { position: 'topleft' }
    }).setView([10.8447, 106.6640], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const stopsData = window.mapData?.stopsData || [];
    console.log('Stops Data in map.js:', stopsData);
    if (!stopsData.length) {
        console.error('No stops data available!');
        return;
    }

    const busIcon = window.mapData?.staticUrl
        ? L.icon({ iconUrl: window.mapData.staticUrl('images/bus-icon.png'), iconSize: [30, 30], iconAnchor: [15, 15] })
        : L.icon({ iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png', iconSize: [25, 41], iconAnchor: [12, 41] });

    let searchMarker;
    let userLocation = null;
    let searchLocation = null;
    let routingControl = null;
    let selectedStops = [];
    let nearestStop = null;
    let userMarker = null; // Lưu marker của vị trí người dùng
    let userCircle = null; // Lưu vòng tròn của vị trí người dùng

    const markers = L.layerGroup().addTo(map);
    const ZOOM_THRESHOLD = 16;

    function addMarkers() {
        markers.clearLayers();
        const zoomLevel = map.getZoom();
        if (zoomLevel < ZOOM_THRESHOLD) return;

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

        // Xóa marker và vòng tròn cũ nếu có
        if (userMarker) map.removeLayer(userMarker);
        if (userCircle) map.removeLayer(userCircle);

        map.locate({ setView: true, enableHighAccuracy: true, maxZoom: 16, timeout: 10000 });
    }

    // Thêm sự kiện locationfound và locationerror một lần duy nhất
    map.on('locationfound', e => {
        userLocation = e.latlng;

        // Xóa marker và vòng tròn cũ nếu có (đề phòng trường hợp sự kiện được gọi từ nơi khác)
        if (userMarker) map.removeLayer(userMarker);
        if (userCircle) map.removeLayer(userCircle);

        // Thêm marker và vòng tròn mới
        userMarker = L.marker(e.latlng).addTo(map).bindPopup('Bạn đang ở đây').openPopup();
        userCircle = L.circle(e.latlng, e.accuracy / 2, {
            weight: 2,
            color: 'red',
            fillColor: 'red',
            fillOpacity: 0.1
        }).addTo(map);
    });

    map.on('locationerror', e => alert('Không thể lấy vị trí: ' + e.message));

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
                <button class="select-stop" onclick="selectStop(${nearestStop.lat}, ${nearestStop.lon}, '${nearestStop.name}'); map.closePopup();">Chọn trạm này</button>
                <button class="find-route" onclick="findRouteTo(${nearestStop.lat}, ${nearestStop.lon}, '${nearestStop.name}'); map.closePopup();">Tìm đường đến đây</button>
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

    window.selectStop = function (lat, lon, stopName) {
        if (selectedStops.length < 2) {
            selectedStops.push({ lat, lon, name: stopName });
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
                createMarker: () => null
            }).addTo(map);

            alert(`Đường đi từ ${selectedStops[0].name} đến ${selectedStops[1].name} đã được hiển thị.`);
            document.getElementById('clear-route').style.display = 'block';
            selectedStops = [];
        }
    };

    window.findRouteTo = function (lat, lon, stopName) {
        const startLocation = searchLocation || userLocation;
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
            createMarker: () => null
        }).addTo(map);

        document.getElementById('clear-route').style.display = 'block';
    };

    document.getElementById('clear-route').addEventListener('click', () => {
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
            selectedStops = [];
            document.getElementById('clear-route').style.display = 'none';
        }
    });

    async function fetchWithRetry(url, options, retries = 3, timeout = 10000) {
        for (let i = 0; i < retries; i++) {
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), timeout);
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(id);
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return await response.json();
            } catch (error) {
                if (i === retries - 1) throw error;
                console.warn(`Retrying fetch (${i + 1}/${retries}) due to error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    async function searchAddress(query) {
        const apiKey = '3074843eec1148f5a9a501822f6af088';
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=1&bounds=106.5,10.5,107.0,11.0`;
        try {
            const data = await fetchWithRetry(url);
            if (data.results && data.results.length > 0) {
                const lat = data.results[0].geometry.lat;
                const lng = data.results[0].geometry.lng;
                const displayName = data.results[0].formatted;

                if (searchMarker) map.removeLayer(searchMarker);
                searchLocation = L.latLng(lat, lng);
                searchMarker = L.marker([lat, lng]).addTo(map)
                    .bindPopup(`<b>Địa chỉ:</b> ${displayName}`).openPopup();
                map.setView([lat, lng], 16);
            } else {
                alert('Không tìm thấy địa chỉ!');
            }
        } catch (error) {
            console.error('Error fetching address:', error);
            alert('Có lỗi khi tìm kiếm địa chỉ: ' + error.message);
        }
    }

    async function fetchSuggestions(query, container, inputElement) {
        const apiKey = '3074843eec1148f5a9a501822f6af088';
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=5&bounds=106.5,10.5,107.0,11.0`;
        try {
            const data = await fetchWithRetry(url);
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
            console.error('Error fetching suggestions:', error);
            container.style.display = 'none';
        }
    }

    const searchInput = document.getElementById('search');
    const suggestionsContainer = document.getElementById('search-suggestions');
    let debounceTimeout;

    if (searchInput && suggestionsContainer) {
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
    }

    const startInput = document.getElementById('start-point');
    const startSuggestions = document.getElementById('start-suggestions');
    let startDebounceTimeout;
    let startLatLng = null;

    if (startInput && startSuggestions) {
        startInput.addEventListener('input', function () {
            clearTimeout(startDebounceTimeout);
            const query = this.value.trim();
            if (query.length < 2) {
                startSuggestions.style.display = 'none';
                startSuggestions.innerHTML = '';
                return;
            }
            startDebounceTimeout = setTimeout(async () => {
                const apiKey = '3074843eec1148f5a9a501822f6af088';
                const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=5&bounds=106.5,10.5,107.0,11.0`;
                try {
                    const data = await fetchWithRetry(url);
                    startSuggestions.innerHTML = '';
                    if (data.results && data.results.length > 0) {
                        startSuggestions.style.display = 'block';
                        data.results.forEach(item => {
                            const suggestion = document.createElement('div');
                            suggestion.textContent = item.formatted;
                            suggestion.addEventListener('click', () => {
                                startLatLng = L.latLng(item.geometry.lat, item.geometry.lng);
                                startInput.value = item.formatted;
                                startSuggestions.style.display = 'none';
                            });
                            startSuggestions.appendChild(suggestion);
                        });
                    } else {
                        startSuggestions.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error fetching start suggestions:', error);
                    startSuggestions.style.display = 'none';
                }
            }, 500);
        });

        startInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                startSuggestions.style.display = 'none';
                findRouteBetweenPoints();
            }
        });
    }

    const endInput = document.getElementById('end-point');
    const endSuggestions = document.getElementById('end-suggestions');
    let endDebounceTimeout;
    let endLatLng = null;

    if (endInput && endSuggestions) {
        endInput.addEventListener('input', function () {
            clearTimeout(endDebounceTimeout);
            const query = this.value.trim();
            if (query.length < 2) {
                endSuggestions.style.display = 'none';
                endSuggestions.innerHTML = '';
                return;
            }
            endDebounceTimeout = setTimeout(async () => {
                const apiKey = '3074843eec1148f5a9a501822f6af088';
                const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=5&bounds=106.5,10.5,107.0,11.0`;
                try {
                    const data = await fetchWithRetry(url);
                    endSuggestions.innerHTML = '';
                    if (data.results && data.results.length > 0) {
                        endSuggestions.style.display = 'block';
                        data.results.forEach(item => {
                            const suggestion = document.createElement('div');
                            suggestion.textContent = item.formatted;
                            suggestion.addEventListener('click', () => {
                                endLatLng = L.latLng(item.geometry.lat, item.geometry.lng);
                                endInput.value = item.formatted;
                                endSuggestions.style.display = 'none';
                            });
                            endSuggestions.appendChild(suggestion);
                        });
                    } else {
                        endSuggestions.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error fetching end suggestions:', error);
                    endSuggestions.style.display = 'none';
                }
            }, 500);
        });

        endInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                endSuggestions.style.display = 'none';
                findRouteBetweenPoints();
            }
        });
    }

    document.addEventListener('click', e => {
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

    window.findRouteBetweenPoints = async function () {
        const startInputValue = startInput.value.trim();
        const endInputValue = endInput.value.trim();

        if (!startInputValue || !endInputValue) {
            alert('Vui lòng nhập cả điểm bắt đầu và điểm kết thúc!');
            return;
        }

        if (!startLatLng || !endLatLng) {
            alert('Vui lòng chọn địa chỉ từ danh sách gợi ý!');
            return;
        }

        try {
            if (routingControl) {
                map.removeControl(routingControl);
            }

            routingControl = L.Routing.control({
                waypoints: [
                    startLatLng,
                    endLatLng
                ],
                routeWhileDragging: true,
                show: true,
                addWaypoints: false,
                fitSelectedRoutes: true,
                showAlternatives: false,
                lineOptions: {
                    styles: [{ color: 'purple', weight: 4 }]
                },
                createMarker: () => null
            }).addTo(map);

            document.getElementById('clear-route').style.display = 'block';
            alert(`Đường đi từ "${startInputValue}" đến "${endInputValue}" đã được hiển thị.`);
        } catch (error) {
            alert('Có lỗi khi tìm đường: ' + error.message);
        }
    };

    function populateRouteList() {
        const routeList = document.getElementById('route-list');
        const uniqueRoutes = [...new Set(stopsData.map(stop => stop.Route_Number))].filter(route => route && route !== 'Unknown');

        if (uniqueRoutes.length === 0) {
            routeList.innerHTML = '<p>Không có thông tin tuyến xe nào.</p>';
            return;
        }

        uniqueRoutes.forEach(route => {
            const routeItem = document.createElement('div');
            routeItem.className = 'route-item';
            routeItem.textContent = `${route}`;
            routeItem.addEventListener('click', () => {
                map.eachLayer(layer => {
                    if (layer instanceof L.Marker) map.removeLayer(layer);
                });
                const routeStops = stopsData.filter(stop => stop.Route_Number === route);
                routeStops.forEach(stop => {
                    const popupContent = `
                        <b>Trạm:</b> ${stop.Stop_Name}<br>
                        <b>Số tuyến:</b> ${stop.Route_Number}<br>
                        <button class="select-stop" onclick="selectStop(${stop.Latitude}, ${stop.Longitude}, '${stop.Stop_Name}'); map.closePopup();">Chọn trạm này</button>
                        <button class="find-route" onclick="findRouteTo(${stop.Latitude}, ${stop.Longitude}, '${stop.Stop_Name}'); map.closePopup();">Tìm đường đến đây</button>
                    `;
                    L.marker([parseFloat(stop.Latitude), parseFloat(stop.Longitude)], { icon: busIcon })
                        .addTo(map)
                        .bindPopup(popupContent);
                });
                const sidebar = bootstrap.Offcanvas.getInstance(document.getElementById('sidebar'));
                sidebar.hide();
            });
            routeList.appendChild(routeItem);
        });
    }

    map.on('moveend zoomend', addMarkers);
    if (stopsData.length) {
        addMarkers();
        populateRouteList();
    }
    locateUser();

    window.locateUser = locateUser;
    window.findNearestStop = findNearestStop;

    const sidebar = new bootstrap.Offcanvas(document.getElementById('sidebar'), { backdrop: false });
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        sidebar.toggle();
        document.body.classList.toggle('sidebar-active');
    });
    document.getElementById('sidebar').addEventListener('shown.bs.offcanvas', () => {
        document.body.classList.add('sidebar-active');
    });
    document.getElementById('sidebar').addEventListener('hidden.bs.offcanvas', () => {
        document.body.classList.remove('sidebar-active');
    });

    window.toggleFullscreen = function () {
        const mapContainer = document.querySelector('.map-container');
        const fullscreenButton = document.getElementById('fullscreen-button');

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
});