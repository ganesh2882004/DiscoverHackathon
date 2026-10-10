from django.urls import path

from .views import (
    home,
    health_check,
    category_list_create,
    category_detail,
    record_list_create,
    record_detail,
    people_list,
    clock_detail,
    donation_list,
    donation_detail,
    claim_eligibility_preview,
    claim_create,
    claim_collect,
    claim_cancel,
    donation_cancel,
)

urlpatterns = [
    # Home and health
    path("", home, name="home"),
    path("health/", health_check, name="health-check"),

    # Category APIs
    path(
        "api/categories/",
        category_list_create,
        name="category-list-create",
    ),
    path(
        "api/categories/<int:pk>/",
        category_detail,
        name="category-detail",
    ),

    # Record APIs
    path(
        "api/records/",
        record_list_create,
        name="record-list-create",
    ),
    path(
        "api/records/<int:pk>/",
        record_detail,
        name="record-detail",
    ),

    # People and simulated clock
    path("api/people/", people_list, name="people-list"),
    path("api/clock/", clock_detail, name="clock-detail"),

    # Donations
    path("api/donations/", donation_list, name="donation-list"),
    path(
        "api/donations/<str:donation_id>/",
        donation_detail,
        name="donation-detail",
    ),
    path(
        "api/donations/<str:donation_id>/cancel/",
        donation_cancel,
        name="donation-cancel",
    ),

    # Claims
    path(
        "api/claims/eligibility-preview/",
        claim_eligibility_preview,
        name="claim-eligibility-preview",
    ),
    path(
        "api/claims/",
        claim_create,
        name="claim-create",
    ),
    path(
        "api/claims/<int:claim_id>/collect/",
        claim_collect,
        name="claim-collect",
    ),
    path(
        "api/claims/<int:claim_id>/cancel/",
        claim_cancel,
        name="claim-cancel",
    ),
]