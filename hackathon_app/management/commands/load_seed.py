
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from hackathon_app.models import (
    Claim,
    Donation,
    Donor,
    SimulatedClock,
    Volunteer,
    VolunteerZone,
)


class Command(BaseCommand):
    help = "Load SurplusLink seed data only when the database has no saved state."

    def handle(self, *args, **options):
        seed_path = Path("SurplusLink_seed.json")

        if not seed_path.exists():
            raise CommandError(
                "SurplusLink_seed.json was not found in the project root."
            )

        try:
            with seed_path.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f"Could not read seed file: {exc}") from exc

        with transaction.atomic():
            has_existing_state = any([
                Donor.objects.exists(),
                Volunteer.objects.exists(),
                VolunteerZone.objects.exists(),
                Donation.objects.exists(),
                Claim.objects.exists(),
                SimulatedClock.objects.exists(),
            ])

            if has_existing_state:
                self.stdout.write(
                    self.style.WARNING(
                        "Seed loading skipped: existing SurplusLink data found."
                    )
                )
                return

            try:
                current_time = parse_datetime(data["clock"])
                if current_time is None:
                    raise ValueError("Invalid clock datetime.")

                for item in data["donors"]:
                    Donor.objects.create(
                        id=item["id"],
                        name=item["name"],
                        zone=item["zone"],
                    )

                for item in data["volunteers"]:
                    volunteer = Volunteer.objects.create(
                        id=item["id"],
                        name=item["name"],
                        capacity_kg=item["capacity_kg"],
                    )

                    for zone in item["zones"]:
                        VolunteerZone.objects.create(
                            volunteer=volunteer,
                            zone=zone,
                        )

                for item in data["donations"]:
                    pickup_from = parse_datetime(item["pickup_from"])
                    pickup_until = parse_datetime(item["pickup_until"])

                    if pickup_from is None or pickup_until is None:
                        raise ValueError(
                            f"Invalid pickup datetime for {item['id']}."
                        )

                    Donation.objects.create(
                        id=item["id"],
                        donor_id=item["donor_id"],
                        description=item["description"],
                        quantity_kg=item["quantity_kg"],
                        pickup_from=pickup_from,
                        pickup_until=pickup_until,
                    )

                SimulatedClock.objects.create(
                    id=1,
                    current_time=current_time,
                )

            except (KeyError, TypeError, ValueError) as exc:
                raise CommandError(f"Invalid seed data: {exc}") from exc

        self.stdout.write(
            self.style.SUCCESS(
                "Seed loaded successfully: 5 donors, 6 volunteers, "
                "5 donations, and the simulated clock."
            )
        )
