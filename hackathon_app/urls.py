from django.urls import path
from .views import home, health_check

urlpatterns = [
    path("", home, name="home"),
    path("health/", health_check, name="health_check"),
]