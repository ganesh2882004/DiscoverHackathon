from datetime import datetime

from django.db import transaction
from django.shortcuts import get_object_or_404, render

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import (
    Category,
    Record,
    Donor,
    Volunteer,
    VolunteerZone,
    Donation,
    Claim,
    SimulatedClock,
)

from .serializers import (
    CategorySerializer,
    RecordSerializer,
    DonorSerializer,
    VolunteerSerializer,
    DonationSerializer,
    ClaimSerializer,
)


# ============================================================
# HOME PAGE
# ============================================================

def home(request):
    return render(request, "home.html")


# ============================================================
# HEALTH CHECK
# ============================================================

@api_view(["GET"])
def health_check(request):
    return Response({
        "status": "success",
        "message": "Backend is running",
    })


# ============================================================
# CATEGORY APIs
# ============================================================

@api_view(["GET", "POST"])
def category_list_create(request):
    if request.method == "GET":
        categories = Category.objects.all().order_by("name")
        return Response(
            CategorySerializer(categories, many=True).data
        )

    serializer = CategorySerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def category_detail(request, pk):
    category = get_object_or_404(Category, pk=pk)

    if request.method == "GET":
        return Response(CategorySerializer(category).data)

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


# ============================================================
# RECORD APIs
# ============================================================

@api_view(["GET", "POST"])
def record_list_create(request):
    if request.method == "GET":
        records = (
            Record.objects
            .select_related("category")
            .order_by("-created_at")
        )

        return Response(
            RecordSerializer(records, many=True).data
        )

    serializer = RecordSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def record_detail(request, pk):
    record = get_object_or_404(Record, pk=pk)

    if request.method == "GET":
        return Response(RecordSerializer(record).data)

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


# ============================================================
# SURPLUSLINK: PEOPLE API
# ============================================================

@api_view(["GET"])
def people_list(request):
    donors = Donor.objects.all().order_by("name")
    volunteers = Volunteer.objects.all().order_by("name")

    return Response({
        "donors": DonorSerializer(donors, many=True).data,
        "volunteers": VolunteerSerializer(volunteers, many=True).data,
    })


# ============================================================
# COMMON API ERROR RESPONSE
# ============================================================

def api_error(code, message, details=None):
    return Response(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "reasons": [],
            }
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


# ============================================================
# SURPLUSLINK: SIMULATED CLOCK API
# ============================================================

@api_view(["GET", "PATCH"])
def clock_detail(request):
    clock = SimulatedClock.objects.filter(pk=1).first()

    if clock is None:
        return Response(
            {
                "error": {
                    "code": "CLOCK_NOT_INITIALIZED",
                    "message": (
                        "The simulated clock is not initialized."
                    ),
                    "details": {},
                    "reasons": [],
                }
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if request.method == "GET":
        return Response({
            "current_time": clock.current_time.strftime(
                "%Y-%m-%dT%H:%M"
            )
        })

    raw_time = request.data.get("current_time")

    if not isinstance(raw_time, str):
        return api_error(
            "VALIDATION_ERROR",
            "The request could not be processed.",
            {
                "current_time": [
                    "This field is required as YYYY-MM-DDTHH:MM."
                ]
            },
        )

    try:
        new_time = datetime.strptime(
            raw_time,
            "%Y-%m-%dT%H:%M",
        )
    except ValueError:
        return api_error(
            "VALIDATION_ERROR",
            "The request could not be processed.",
            {
                "current_time": [
                    "Use the format YYYY-MM-DDTHH:MM."
                ]
            },
        )

    with transaction.atomic():
        clock = SimulatedClock.objects.select_for_update().get(pk=1)
        previous_time = clock.current_time

        if new_time < previous_time:
            return Response(
                {
                    "error": {
                        "code": "CLOCK_CANNOT_MOVE_BACKWARD",
                        "message": (
                            "The simulated clock cannot move backwards."
                        ),
                        "details": {
                            "current_time": [
                                "Choose the current time or a later time."
                            ]
                        },
                        "reasons": [],
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        clock.current_time = new_time
        clock.save(update_fields=["current_time"])

        # Active claims become MISSED only after pickup_until.
        missed_claims_updated = Claim.objects.filter(
            status=Claim.STATUS_ACTIVE,
            donation__pickup_until__lt=new_time,
        ).update(status=Claim.STATUS_MISSED)

    return Response({
        "previous_time": previous_time.strftime("%Y-%m-%dT%H:%M"),
        "current_time": new_time.strftime("%Y-%m-%dT%H:%M"),
        "missed_claims_updated": missed_claims_updated,
    })


# ============================================================
# SURPLUSLINK: DONATION LIST API
# ============================================================

@api_view(["GET"])
def donation_list(request):
    donations = (
        Donation.objects
        .select_related("donor")
        .order_by("id")
    )

    donation_status = request.query_params.get("status")
    donor_id = request.query_params.get("donor_id")
    zone = request.query_params.get("zone")

    valid_statuses = {
        Donation.STATUS_CANCELLED,
        Donation.STATUS_EXPIRED,
        Donation.STATUS_FULLY_CLAIMED,
        Donation.STATUS_OPEN,
    }

    if donation_status and donation_status not in valid_statuses:
        return Response(
            {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid donation status filter.",
                    "details": {
                        "status": [
                            (
                                "Use OPEN, EXPIRED, FULLY_CLAIMED, "
                                "or CANCELLED."
                            )
                        ]
                    },
                    "reasons": [],
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if donor_id:
        donations = donations.filter(donor_id=donor_id)

    if zone:
        donations = donations.filter(donor__zone=zone)

    results = []

    for donation in donations:
        current_status = donation.status

        # Exclude cancelled donations unless explicitly requested.
        if (
            current_status == Donation.STATUS_CANCELLED
            and donation_status != Donation.STATUS_CANCELLED
        ):
            continue

        if donation_status and current_status != donation_status:
            continue

        results.append(DonationSerializer(donation).data)

    return Response(results)


# ============================================================
# SURPLUSLINK: DONATION DETAIL API
# ============================================================

@api_view(["GET"])
def donation_detail(request, donation_id):
    donation = get_object_or_404(
        Donation.objects.select_related("donor"),
        pk=donation_id,
    )

    claims = Claim.objects.filter(
        donation=donation
    ).order_by("id")

    return Response({
        **DonationSerializer(donation).data,
        "claims": ClaimSerializer(claims, many=True).data,
    })

# ============================================================
# SURPLUSLINK: CLAIM VALIDATION HELPERS
# ============================================================

def get_simulated_time():
    clock = SimulatedClock.objects.filter(pk=1).first()
    return clock.current_time if clock else None


def claim_reasons(donation, volunteer, quantity, planned_time, now):
    reasons = []
    remaining = donation.remaining_kg

    def add(code, rule, message):
        reasons.append({
            "code": code,
            "rule": rule,
            "message": message,
        })

    if donation.is_cancelled:
        add("DONATION_CANCELLED", "donation_available",
            "This donation has been cancelled.")

    if now > donation.pickup_until:
        add("DONATION_EXPIRED", "donation_available",
            "The donation pickup window has expired.")

    if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity < 1:
        add("INVALID_QUANTITY", "quantity_valid",
            "Quantity must be a positive whole number.")
    else:
        if quantity > volunteer.capacity_kg:
            add("CAPACITY_EXCEEDED", "volunteer_capacity",
                "Quantity exceeds the volunteer's capacity.")
        if quantity > remaining:
            add("INSUFFICIENT_REMAINING", "donation_remaining",
                "Quantity exceeds the donation's remaining quantity.")

    if not VolunteerZone.objects.filter(
        volunteer=volunteer,
        zone=donation.donor.zone,
    ).exists():
        add("ZONE_NOT_PERMITTED", "permitted_zone",
            "The volunteer is not permitted to collect in this zone.")

    if planned_time is None:
        add("INVALID_PICKUP_TIME", "pickup_time_valid",
            "Use planned_pickup_at in YYYY-MM-DDTHH:MM format.")
    else:
        if planned_time < donation.pickup_from or planned_time > donation.pickup_until:
            add("OUTSIDE_PICKUP_WINDOW", "pickup_window",
                "Planned pickup must be within the donation pickup window.")
        if planned_time < now:
            add("PICKUP_IN_PAST", "pickup_not_in_past",
                "Planned pickup cannot be before the simulated current time.")

        existing_claims = Claim.objects.filter(
            volunteer=volunteer,
            status__in=[
                Claim.STATUS_ACTIVE,
                Claim.STATUS_COLLECTED,
            ],
        )

        for existing in existing_claims:
            difference = abs(
                (planned_time - existing.planned_pickup_at).total_seconds()
            )
            if difference < 3600:
                add("VOLUNTEER_TIME_CONFLICT", "volunteer_spacing",
                    "Pickups for this volunteer must be at least 60 minutes apart.")
                break

    return reasons


def parse_planned_pickup(value):
    if not isinstance(value, str):
        return None

    try:
        parsed = datetime.strptime(value, "%Y-%m-%dT%H:%M")
    except ValueError:
        return None

    # Reject alternate formats that strptime might otherwise accept.
    if parsed.strftime("%Y-%m-%dT%H:%M") != value:
        return None

    return parsed


def claim_error(reasons):
    return Response(
        {
            "error": {
                "code": "CLAIM_VALIDATION_FAILED",
                "message": "The claim could not be accepted.",
                "details": {},
                "reasons": reasons,
            }
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


def evaluate_claim_request(data):
    required = [
        "donation_id",
        "volunteer_id",
        "quantity_kg",
        "planned_pickup_at",
    ]
    missing = [field for field in required if field not in data]

    if missing:
        return None, None, None, None, None, [
            {
                "code": "MISSING_FIELDS",
                "rule": "required_fields",
                "message": "Missing required fields: " + ", ".join(missing),
            }
        ]

    donation = Donation.objects.filter(pk=data["donation_id"]).select_related(
        "donor"
    ).first()
    volunteer = Volunteer.objects.filter(pk=data["volunteer_id"]).first()

    if donation is None:
        return None, None, None, None, None, [{
            "code": "DONATION_NOT_FOUND",
            "rule": "donation_exists",
            "message": "The specified donation does not exist.",
        }]

    if volunteer is None:
        return None, None, None, None, None, [{
            "code": "VOLUNTEER_NOT_FOUND",
            "rule": "volunteer_exists",
            "message": "The specified volunteer does not exist.",
        }]

    now = get_simulated_time()
    if now is None:
        return None, None, None, None, None, [{
            "code": "CLOCK_NOT_INITIALIZED",
            "rule": "simulated_clock",
            "message": "The simulated clock is not initialized.",
        }]

    quantity = data["quantity_kg"]
    planned_time = parse_planned_pickup(data["planned_pickup_at"])

    reasons = claim_reasons(
        donation, volunteer, quantity, planned_time, now
    )

    return donation, volunteer, quantity, planned_time, now, reasons


# ============================================================
# SURPLUSLINK: CLAIM ELIGIBILITY PREVIEW
# POST /api/claims/eligibility-preview/
# ============================================================

@api_view(["POST"])
def claim_eligibility_preview(request):
    donation, volunteer, quantity, planned_time, now, reasons = (
        evaluate_claim_request(request.data)
    )

    if donation is None:
        return Response({
            "eligible": False,
            "reasons": reasons,
            "remaining_kg": None,
        })

    return Response({
        "eligible": len(reasons) == 0,
        "reasons": reasons,
        "remaining_kg": donation.remaining_kg,
    })


# ============================================================
# SURPLUSLINK: CREATE CLAIM
# POST /api/claims/
# ============================================================

@api_view(["POST"])
def claim_create(request):
    with transaction.atomic():
        donation, volunteer, quantity, planned_time, now, reasons = (
            evaluate_claim_request(request.data)
        )

        if reasons:
            return claim_error(reasons)

        # Recheck remaining quantity while holding the donation row lock.
        donation = Donation.objects.select_for_update().select_related(
            "donor"
        ).get(pk=donation.pk)

        now = get_simulated_time()
        reasons = claim_reasons(
            donation, volunteer, quantity, planned_time, now
        )

        if reasons:
            return claim_error(reasons)

        claim = Claim.objects.create(
            donation=donation,
            volunteer=volunteer,
            quantity_kg=quantity,
            planned_pickup_at=planned_time,
            status=Claim.STATUS_ACTIVE,
        )

        return Response(
            ClaimSerializer(claim).data,
            status=status.HTTP_201_CREATED,
        )


# ============================================================
# SURPLUSLINK: COLLECT CLAIM
# POST /api/claims/<claim_id>/collect/
# ============================================================

@api_view(["POST"])
def claim_collect(request, claim_id):
    with transaction.atomic():
        claim = get_object_or_404(
            Claim.objects.select_for_update().select_related("donation"),
            pk=claim_id,
        )

        now = get_simulated_time()

        if now is None:
            return Response({
                "error": {
                    "code": "CLOCK_NOT_INITIALIZED",
                    "message": "The simulated clock is not initialized.",
                    "details": {},
                    "reasons": [],
                }
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        reasons = []

        if claim.status != Claim.STATUS_ACTIVE:
            reasons.append({
                "code": "CLAIM_NOT_ACTIVE",
                "rule": "claim_active",
                "message": "Only ACTIVE claims can be collected.",
            })

        if not (
            claim.donation.pickup_from
            <= now
            <= claim.donation.pickup_until
        ):
            reasons.append({
                "code": "OUTSIDE_PICKUP_WINDOW",
                "rule": "pickup_window",
                "message": "Collection must occur within the pickup window.",
            })

        if reasons:
            return claim_error(reasons)

        claim.status = Claim.STATUS_COLLECTED
        claim.save(update_fields=["status"])

        return Response(ClaimSerializer(claim).data)


# ============================================================
# SURPLUSLINK: CANCEL CLAIM
# POST /api/claims/<claim_id>/cancel/
# ============================================================

@api_view(["POST"])
def claim_cancel(request, claim_id):
    with transaction.atomic():
        claim = get_object_or_404(
            Claim.objects.select_for_update(),
            pk=claim_id,
        )

        now = get_simulated_time()

        if now is None:
            return Response({
                "error": {
                    "code": "CLOCK_NOT_INITIALIZED",
                    "message": "The simulated clock is not initialized.",
                    "details": {},
                    "reasons": [],
                }
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        reasons = []

        if claim.status != Claim.STATUS_ACTIVE:
            reasons.append({
                "code": "CLAIM_NOT_ACTIVE",
                "rule": "claim_active",
                "message": "Only ACTIVE claims can be cancelled.",
            })

        if now >= claim.planned_pickup_at:
            reasons.append({
                "code": "CANCELLATION_TOO_LATE",
                "rule": "cancel_before_planned_time",
                "message": "A claim must be cancelled before its planned pickup time.",
            })

        if reasons:
            return claim_error(reasons)

        claim.status = Claim.STATUS_CANCELLED
        claim.save(update_fields=["status"])

        return Response(ClaimSerializer(claim).data)


# ============================================================
# SURPLUSLINK: CANCEL DONATION
# POST /api/donations/<donation_id>/cancel/
# ============================================================

@api_view(["POST"])
def donation_cancel(request, donation_id):
    with transaction.atomic():
        donation = get_object_or_404(
            Donation.objects.select_for_update(),
            pk=donation_id,
        )

        reasons = []

        # The frontend sends donor_id for the currently selected donor.
        # This is a demo-level ownership check; authenticated user identity
        # is required for production-grade authorization.
        requested_donor_id = request.data.get("donor_id")
        if (
            requested_donor_id is None
            or str(requested_donor_id) != str(donation.donor_id)
        ):
            return Response(
                {
                    "error": {
                        "code": "DONATION_NOT_OWNED_BY_DONOR",
                        "message": "Only the donor who created this donation can cancel it.",
                        "details": {"donor_id": ["This donation belongs to another donor."]},
                        "reasons": [{
                            "code": "DONATION_NOT_OWNED_BY_DONOR",
                            "rule": "donation_owner",
                            "message": "Only the donor who created this donation can cancel it.",
                        }],
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if donation.status != Donation.STATUS_OPEN:
            reasons.append({
                "code": "DONATION_NOT_OPEN",
                "rule": "donation_open",
                "message": "Only OPEN donations can be cancelled.",
            })

        has_live_claims = Claim.objects.filter(
            donation=donation,
            status__in=[
                Claim.STATUS_ACTIVE,
                Claim.STATUS_COLLECTED,
            ],
        ).exists()

        if has_live_claims:
            reasons.append({
                "code": "DONATION_HAS_LIVE_CLAIMS",
                "rule": "no_active_or_collected_claims",
                "message": "A donation with ACTIVE or COLLECTED claims cannot be cancelled.",
            })

        if reasons:
            return claim_error(reasons)

        donation.is_cancelled = True
        donation.save(update_fields=["is_cancelled"])

        return Response({
            "id": donation.id,
            "status": Donation.STATUS_CANCELLED,
            "message": "Donation cancelled successfully.",
        })
