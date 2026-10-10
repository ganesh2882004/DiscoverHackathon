SurplusLink 🍲

Surplus Food Donation and Collection Management System

SurplusLink is a web application developed for the Discover Dollar Technologies Hackathon. It connects food donors with volunteers to help redistribute surplus food before it expires, reducing food waste and supporting communities in need.

📌 Problem Statement

Restaurants and other food providers may have surplus food that goes unused, while people and communities need food. Without an organized system, coordinating donations and pickups can be difficult. SurplusLink provides a centralized platform to manage food donations, volunteer claims, and pickup timelines.

💡 Solution

SurplusLink provides a structured workflow where donors can list surplus food and volunteers can claim eligible donations for collection. The application uses a simulated clock to manage pickup deadlines and donation expiry.

✨ Key Features

👤 Donor

- Create and publish surplus food donations.
- Specify donation quantity, location zone, and pickup time window.
- View donation information and status.
- Cancel eligible donations.

🚚 Volunteer

- View available donations.
- Preview claim eligibility.
- Claim available quantities of food.
- Collect donations and update claim status.
- Cancel eligible claims.

⏰ Donation and Claim Management

- Track donation statuses: "OPEN", "EXPIRED", "FULLY_CLAIMED", and "CANCELLED".
- Track claim statuses: "ACTIVE", "COLLECTED", "CANCELLED", and "MISSED".
- Use a simulated clock to evaluate pickup deadlines and expiry.
- Track remaining donation quantities and collection progress.

📊 Dashboard

- View donation and claim information.
- Track food collection progress and donation status.

🛠️ Technology Stack

Component| Technology
Frontend| HTML5, CSS3, JavaScript
Backend| Python, Django
API| Django REST Framework
Database| SQLite
API Testing| Postman
Version Control| Git and GitHub

🏗️ Project Structure

DiscoverHackathon/
├── discoverhackathon/
│   └── settings.py
├── hackathon_app/
│   ├── migrations/
│   ├── management/
│   │   └── commands/
│   │       └── load_seed.py
│   ├── models.py
│   ├── serializers.py
│   ├── urls.py
│   └── views.py
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js
│       └── app.js
├── templates/
│   ├── base.html
│   └── home.html
├── SurplusLink_seed.json
└── manage.py

⚙️ Installation and Setup

Prerequisites

- Python 3.13 or a compatible Python version
- Git
- pip

1. Clone the repository

git clone https://github.com/ganesh2882004/DiscoverHackathon.git
cd DiscoverHackathon

2. Create a virtual environment

python -m venv venv

3. Activate the virtual environment

Windows PowerShell:

.\venv\Scripts\Activate.ps1

If PowerShell blocks activation, use Command Prompt:

venv\Scripts\activate.bat

4. Install dependencies

python -m pip install django djangorestframework

If the repository contains a "requirements.txt" file, install the listed dependencies with:

pip install -r requirements.txt

5. Apply database migrations

python manage.py migrate

6. Load seed data (optional)

If you want to initialize the supplied demo data, run:

python manage.py load_seed

7. Start the development server

python manage.py runserver

Open the application at:

http://127.0.0.1:8000/

🔌 API Overview

The Django REST API supports the application's donation and collection workflows.

Method| Endpoint| Purpose
GET| "/api/people/"| Retrieve donor and volunteer information
GET, PATCH| "/api/clock/"| Read or update the simulated clock
GET, POST| "/api/donations/"| List or create donations
POST| "/api/donations/<donation_id>/cancel/"| Request donation cancellation
GET, POST| "/api/claims/"| List or create claims
POST| "/api/claims/eligibility-preview/"| Preview claim eligibility
POST| "/api/claims/<claim_id>/collect/"| Mark a claim as collected
POST| "/api/claims/<claim_id>/cancel/"| Request claim cancellation

🧠 How It Works

1. A donor creates a food donation with its quantity and pickup window.
2. A volunteer views available donations.
3. The system evaluates whether the volunteer's claim is eligible.
4. The volunteer claims an available quantity.
5. The donation's remaining quantity and status are updated.
6. The volunteer records collection, or the claim is handled according to its status and pickup deadline.
7. The simulated clock helps determine whether a donation has expired.

🎯 Project Objective

The objective of SurplusLink is to demonstrate how a web application can organize surplus food donations, coordinate volunteers, manage pickup deadlines, and improve visibility into food collection.

🔗 Repository

GitHub: https://github.com/ganesh2882004/DiscoverHackathon

👨‍💻 Developed For

Discover Dollar Technologies Hackathon

Project: SurplusLink — Surplus Food Donation and Collection Management System
