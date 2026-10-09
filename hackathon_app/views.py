
from django.shortcuts import get_object_or_404, render
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Category, Record
from .serializers import CategorySerializer, RecordSerializer


def home(request):
    return render(request, "home.html")


@api_view(["GET"])
def health_check(request):
    return Response({
        "status": "success",
        "message": "Backend is running",
    })


# CATEGORY APIs

@api_view(["GET", "POST"])
def category_list_create(request):
    if request.method == "GET":
        categories = Category.objects.all().order_by("name")
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)

    serializer = CategorySerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def category_detail(request, pk):
    category = get_object_or_404(Category, pk=pk)

    if request.method == "GET":
        serializer = CategorySerializer(category)
        return Response(serializer.data)

    if request.method in ["PUT", "PATCH"]:
        serializer = CategorySerializer(
            category,
            data=request.data,
            partial=request.method == "PATCH",
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    category.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# RECORD APIs

@api_view(["GET", "POST"])
def record_list_create(request):
    if request.method == "GET":
        records = Record.objects.select_related("category").order_by(
            "-created_at"
        )
        serializer = RecordSerializer(records, many=True)
        return Response(serializer.data)

    serializer = RecordSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def record_detail(request, pk):
    record = get_object_or_404(Record, pk=pk)

    if request.method == "GET":
        serializer = RecordSerializer(record)
        return Response(serializer.data)

    if request.method in ["PUT", "PATCH"]:
        serializer = RecordSerializer(
            record,
            data=request.data,
            partial=request.method == "PATCH",
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST,
        )

    record.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
