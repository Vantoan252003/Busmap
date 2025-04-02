from django.shortcuts import render
import pandas as pd
import json

def map_view(request):
    # Đọc dữ liệu từ file CSV
    data = pd.read_csv('bus_stops_govap.csv')
    
    # Thay thế các giá trị NaN bằng chuỗi rỗng
    data = data.fillna('')
    
    # Chuyển dữ liệu thành định dạng JSON để dùng trong JavaScript
    stops_data = data.to_dict(orient='records')
    
    # Truyền dữ liệu vào template
    return render(request, 'busmap_app/map.html', {'stops_data': json.dumps(stops_data)})