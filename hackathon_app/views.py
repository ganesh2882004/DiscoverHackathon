from django.http import JsonResponse
from django.shortcuts import render
from rest_framework.decorators import api_view


def home(request):
    return render(request, "home.html")


@api_view(["GET"])
def health_check(request):
    return JsonResponse({
        "status": "success",
        "message": "DiscoverHackathon backend is running",
    })