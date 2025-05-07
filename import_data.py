import os
import django
import pandas as pd

# Thiết lập môi trường Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'busmap.settings')
django.setup()

from busmap_app.models import BusStop

def import_data():
    print("Bắt đầu import dữ liệu từ CSV vào PostgreSQL...")
    
    # Xóa dữ liệu cũ
    BusStop.objects.all().delete()
    
    # Đọc file CSV
    data = pd.read_csv('bus_stops_govap.csv')
    
    # Thay thế NaN bằng None
    data = data.fillna('')
    
    # Import dữ liệu vào database
    counter = 0
    for _, row in data.iterrows():
        BusStop.objects.create(
            stop_id=row['Stop_ID'],
            stop_name=row['Stop_Name'],
            latitude=float(row['Latitude']),
            longitude=float(row['Longitude']),
            route_number=row['Route_Number'],
            address=row['Address'] if row['Address'] else None,
            additional_info=row['Additional_Info'] if row['Additional_Info'] else None
        )
        counter += 1
    
    print(f"Đã import thành công {counter} trạm xe buýt vào cơ sở dữ liệu.")

if __name__ == "__main__":
    import_data()