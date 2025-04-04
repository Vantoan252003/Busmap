import json
import csv
import math

# Đọc dữ liệu JSON
# Giả sử dữ liệu JSON đã được lưu trong file 'bus_stops.json'
# Nếu bạn có dữ liệu trực tiếp, có thể thay bằng: json_data = {...}
with open('overpass.json', 'r', encoding='utf-8') as file:
    json_data = json.load(file)

# Lấy danh sách các trạm từ phần "elements"
stops = json_data['elements']

# Định nghĩa các cột cho file CSV
csv_columns = [
    'Stop_ID',
    'Stop_Name',
    'Latitude',
    'Longitude',
    'Route_Number',
    'Address',
    'Additional_Info'
]

# Chuyển dữ liệu thành danh sách các dòng cho CSV
csv_data = []
for stop in stops:
    # Kiểm tra và xử lý các giá trị
    stop_id = stop.get('id', '')
    
    # Lấy tên trạm từ tags.name, nếu không có thì để trống
    stop_name = stop.get('tags', {}).get('name', '')
    
    # Lấy Latitude và Longitude, kiểm tra NaN
    latitude = stop.get('lat', 0)
    if isinstance(latitude, float) and math.isnan(latitude):
        latitude = 0  # Thay NaN bằng 0
    longitude = stop.get('lon', 0)
    if isinstance(longitude, float) and math.isnan(longitude):
        longitude = 0  # Thay NaN bằng 0
    
    # Route_Number không có trong dữ liệu, gán mặc định là "Unknown"
    route_number = "Unknown"
    
    # Address không có trong dữ liệu, để trống
    address = ""
    
    # Additional_Info: Ưu tiên lấy từ tags.shelter, nếu không có thì lấy tags.public_transport
    tags = stop.get('tags', {})
    additional_info = tags.get('shelter', tags.get('public_transport', ''))
    
    # Tạo dòng dữ liệu
    row = {
        'Stop_ID': stop_id,
        'Stop_Name': stop_name,
        'Latitude': latitude,
        'Longitude': longitude,
        'Route_Number': route_number,
        'Address': address,
        'Additional_Info': additional_info
    }
    csv_data.append(row)

# Ghi dữ liệu vào file CSV
csv_file_path = 'bus_stops.csv'
with open(csv_file_path, 'w', encoding='utf-8', newline='') as csvfile:
    writer = csv.DictWriter(csvfile, fieldnames=csv_columns)
    writer.writeheader()
    for row in csv_data:
        writer.writerow(row)

print(f"Đã tạo file CSV tại: {csv_file_path}")