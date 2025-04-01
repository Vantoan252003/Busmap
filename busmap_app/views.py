from django.shortcuts import render
import pandas as pd
# Create your views here.
def map_view(request):
    # Đọc dữ liệu từ file CSV
    data = pd.read_csv('bus_stops_govap.csv')
    # Chuyển dữ liệu thành định dạng JSON để dùng trong JavaScript
    stops_data = data.to_dict(orient='records')
    return render(request, 'busmap_app/map.html', {'stops_data': stops_data})