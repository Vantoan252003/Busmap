from django.urls import path
from . import views

urlpatterns = [
    path('', views.map_view, name='map_view'),
    path('home/', views.home, name='home'),
    path('contact/', views.contact, name='contact'),
    path('about/', views.about, name='about'),
]
