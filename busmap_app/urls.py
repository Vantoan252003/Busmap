from django.urls import path
from . import views

urlpatterns = [
    path('', views.map_view, name='map_view'),
    path('home/', views.home, name='home'),
]
