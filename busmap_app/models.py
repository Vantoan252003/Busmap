from django.db import models

class BusStop(models.Model):
    stop_id = models.CharField(max_length=20, primary_key=True)
    stop_name = models.CharField(max_length=200)
    latitude = models.FloatField()
    longitude = models.FloatField()
    route_number = models.CharField(max_length=100)
    address = models.CharField(max_length=255, blank=True, null=True)
    additional_info = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'bus_stops'  # Chỉ định tên bảng cụ thể trong PostgreSQL
        managed = False  # Chỉ ra rằng Django không quản lý bảng này (không tạo/sửa/xóa)

    def __str__(self):
        return self.stop_name
