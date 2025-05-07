from django.shortcuts import render
import json
from .models import BusStop

def map_view(request):
    # Lấy dữ liệu từ database thay vì từ file CSV
    bus_stops = BusStop.objects.all()
    
    # Chuyển đổi queryset thành list dictionary để dễ dàng serialize thành JSON
    stops_data = []
    for stop in bus_stops:
        stops_data.append({
            'Stop_ID': stop.stop_id,
            'Stop_Name': stop.stop_name,
            'Latitude': stop.latitude,
            'Longitude': stop.longitude,
            'Route_Number': stop.route_number,
            'Address': stop.address if stop.address else '',
            'Additional_Info': stop.additional_info if stop.additional_info else ''
        })
    
    # Truyền dữ liệu vào template
    return render(request, 'busmap_app/map.html', {'stops_data': json.dumps(stops_data)})

def home(request):
    return render(request, 'busmap_app/home.html')

def contact(request):
    return render(request, 'busmap_app/contact.html')

def about(request):
    return render(request, 'busmap_app/about.html')