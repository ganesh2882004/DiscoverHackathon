
from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q


class TimeStampedModel(models.Model):
    """Reusable creation and update timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


# Preserve the original starter-project models.
class Category(TimeStampedModel):
    """Reusable category for grouping records."""

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Record(TimeStampedModel):
    """Generic record for demonstrating CRUD functionality."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("active", "Active"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hackathon_records",
    )

    def __str__(self):
        return self.title


# ---------------------------------------------------------
# SURPLUSLINK MODELS
# ---------------------------------------------------------

ZONE_CHOICES = [
    ("NORTH", "North"),
    ("SOUTH", "South"),
    ("EAST", "East"),
    ("WEST", "West"),
]


class Donor(models.Model):
    """Restaurant or other food donor."""

    id = models.CharField(max_length=20, primary_key=True)
    name = models.CharField(max_length=150)
    zone = models.CharField(max_length=30)

    def __str__(self):
        return self.name


class Volunteer(models.Model):
    """Volunteer who collects surplus food."""

    id = models.CharField(max_length=20, primary_key=True)
    name = models.CharField(max_length=150)
    capacity_kg = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )

    def __str__(self):
        return self.name


class VolunteerZone(models.Model):
    """A zone in which a volunteer is permitted to collect."""

    volunteer = models.ForeignKey(
        Volunteer,
        on_delete=models.CASCADE,
        related_name="permitted_zones",
    )
    zone = models.CharField(max_length=30)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["volunteer", "zone"],
                name="unique_volunteer_zone",
            ),
        ]

    def __str__(self):
        return f"{self.volunteer.name} - {self.zone}"


class Donation(models.Model):
    """A quantity of surplus food offered for collection."""

    STATUS_CANCELLED = "CANCELLED"
    STATUS_EXPIRED = "EXPIRED"
    STATUS_FULLY_CLAIMED = "FULLY_CLAIMED"
    STATUS_OPEN = "OPEN"

    STATUS_CHOICES = [
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_FULLY_CLAIMED, "Fully claimed"),
        (STATUS_OPEN, "Open"),
    ]

    id = models.CharField(max_length=20, primary_key=True)
    donor = models.ForeignKey(
        Donor,
        on_delete=models.PROTECT,
        related_name="donations",
    )
    description = models.CharField(max_length=255)
    quantity_kg = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )
    pickup_from = models.DateTimeField()
    pickup_until = models.DateTimeField()
    is_cancelled = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity_kg__gte=1),
                name="donation_quantity_at_least_one",
            ),
            models.CheckConstraint(
                condition=Q(pickup_from__lt=models.F("pickup_until")),
                name="donation_pickup_start_before_end",
            ),
        ]
        indexes = [
            models.Index(fields=["pickup_until"]),
            models.Index(fields=["donor"]),
        ]

    @property
    def remaining_kg(self):
        """Original quantity minus all claims except CANCELLED claims."""
        claimed_kg = self.claims.exclude(
            status=Claim.STATUS_CANCELLED
        ).aggregate(total=models.Sum("quantity_kg"))["total"] or 0

        return self.quantity_kg - claimed_kg

    @property
    def status(self):
        """Calculate status dynamically in the required priority order."""
        if self.is_cancelled:
            return self.STATUS_CANCELLED

        simulated_now = SimulatedClock.objects.values_list(
            "current_time", flat=True
        ).first()

        if simulated_now is None:
            raise RuntimeError(
                "SurplusLink simulated clock has not been initialized."
            )

        if simulated_now > self.pickup_until:
            return self.STATUS_EXPIRED

        if self.remaining_kg == 0:
            return self.STATUS_FULLY_CLAIMED

        return self.STATUS_OPEN

    def __str__(self):
        return f"{self.id}: {self.description}"


class Claim(models.Model):
    """A volunteer's reservation for part of a donation."""

    STATUS_ACTIVE = "ACTIVE"
    STATUS_COLLECTED = "COLLECTED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_MISSED = "MISSED"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_COLLECTED, "Collected"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_MISSED, "Missed"),
    ]

    donation = models.ForeignKey(
        Donation,
        on_delete=models.PROTECT,
        related_name="claims",
    )
    volunteer = models.ForeignKey(
        Volunteer,
        on_delete=models.PROTECT,
        related_name="claims",
    )
    quantity_kg = models.PositiveIntegerField(
        validators=[MinValueValidator(1)]
    )
    planned_pickup_at = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity_kg__gte=1),
                name="claim_quantity_at_least_one",
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=[
                        "ACTIVE",
                        "COLLECTED",
                        "CANCELLED",
                        "MISSED",
                    ]
                ),
                name="claim_status_valid",
            ),
        ]
        indexes = [
            models.Index(fields=["donation", "status"]),
            models.Index(fields=["volunteer", "status"]),
            models.Index(fields=["planned_pickup_at"]),
        ]

    def __str__(self):
        return (
            f"Claim {self.pk}: {self.quantity_kg} kg "
            f"for {self.volunteer.name}"
        )


class SimulatedClock(models.Model):
    """Persistent simulated local time for SurplusLink."""

    id = models.PositiveSmallIntegerField(
        primary_key=True,
        default=1,
        editable=False,
    )
    current_time = models.DateTimeField()

    def __str__(self):
        return self.current_time.strftime("%Y-%m-%dT%H:%M")
