
from rest_framework import serializers

from .models import Category, Record


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class RecordSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = Record
        fields = [
            "id",
            "title",
            "description",
            "category",
            "category_name",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_at",
            "updated_at",
        ]

# SurplusLink serializers

from .models import (
    Donor,
    Volunteer,
    VolunteerZone,
    Donation,
    Claim,
    SimulatedClock,
)


class DonorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Donor
        fields = ["id", "name", "zone"]


class VolunteerSerializer(serializers.ModelSerializer):
    zones = serializers.SerializerMethodField()

    class Meta:
        model = Volunteer
        fields = ["id", "name", "capacity_kg", "zones"]

    def get_zones(self, obj):
        return list(
            obj.permitted_zones.values_list("zone", flat=True)
        )


class DonationSerializer(serializers.ModelSerializer):
    donor_id = serializers.CharField(read_only=True)
    donor_name = serializers.CharField(
        source="donor.name",
        read_only=True,
    )
    zone = serializers.CharField(
        source="donor.zone",
        read_only=True,
    )
    remaining_kg = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Donation
        fields = [
            "id",
            "donor_id",
            "donor_name",
            "zone",
            "description",
            "quantity_kg",
            "remaining_kg",
            "pickup_from",
            "pickup_until",
            "status",
        ]

    def get_remaining_kg(self, obj):
        return obj.remaining_kg

    def get_status(self, obj):
        return obj.status


class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = [
            "id",
            "donation_id",
            "volunteer_id",
            "quantity_kg",
            "planned_pickup_at",
            "status",
        ]
        read_only_fields = ["id", "status"]


class SimulatedClockSerializer(serializers.ModelSerializer):
    class Meta:
        model = SimulatedClock
        fields = ["current_time"]
