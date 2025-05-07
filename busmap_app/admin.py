from django.contrib import admin
from .models import BusStop

@admin.register(BusStop)
class BusStopAdmin(admin.ModelAdmin):
    list_display = ('stop_id', 'stop_name', 'route_number', 'latitude', 'longitude')
    search_fields = ('stop_name', 'route_number')
    list_filter = ('route_number',)
