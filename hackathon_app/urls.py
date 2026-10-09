
from django.urls import path

from .views import (
    home,
    health_check,
    category_list_create,
    category_detail,
    record_list_create,
    record_detail,
)

urlpatterns = [
    path("", home, name="home"),
    path("health/", health_check, name="health-check"),

    path("api/categories/", category_list_create, name="category-list-create"),
    path("api/categories/<int:pk>/", category_detail, name="category-detail"),

    path("api/records/", record_list_create, name="record-list-create"),
    path("api/records/<int:pk>/", record_detail, name="record-detail"),
]
