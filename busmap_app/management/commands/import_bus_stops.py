import csv
from django.core.management.base import BaseCommand
from busmap_app.models import BusStop

class Command(BaseCommand):
    help = 'Import bus stops data from CSV file to PostgreSQL database'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')

    def handle(self, *args, **kwargs):
        csv_file_path = kwargs['csv_file']
        counter = 0
        
        # Xóa dữ liệu cũ (tùy chọn)
        self.stdout.write('Deleting old data...')
        BusStop.objects.all().delete()
        
        # Đọc dữ liệu từ file CSV và lưu vào database
        self.stdout.write(f'Importing data from {csv_file_path}...')
        try:
            with open(csv_file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
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
                    
            self.stdout.write(self.style.SUCCESS(f'Successfully imported {counter} bus stops'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error importing data: {str(e)}'))