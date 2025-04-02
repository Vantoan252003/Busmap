import json
import pandas as pd

# Đọc file JSON
with open('overpass.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Trích xuất dữ liệu
stops = []
for element in data['elements']:
    if element['type'] == 'node':
        stop = {
            'Stop_ID': element['id'],
            'Stop_Name': element['tags'].get('name', 'Unknown'),
            'Latitude': element['lat'],
            'Longitude': element['lon'],
            'Route_Number': element['tags'].get('ref', 'Unknown'),  # Số tuyến nếu có
            'Address': '',  # Cần bổ sung thủ công
            'Additional_Info': element['tags'].get('shelter', '') or element['tags'].get('public_transport', '') or 'Chưa có'
        }
        stops.append(stop)

# Lưu thành CSV
df = pd.DataFrame(stops)
df.to_csv('bus_stops_govap.csv', index=False, encoding='utf-8-sig')
print("Dữ liệu đã được lưu vào bus_stops_govap.csv")