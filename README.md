# Capstone — Mentor–Mentee Matching

A Django web app for matching mentors and mentees with XGBoost-based compatibility scoring, session scheduling, and a React dashboard.

## Features

- **Matching**: Mentor–mentee recommendations with gender/time preferences and capacity-aware filtering
- **Sessions**: Schedule and manage mentoring sessions (12-hour completion goal per pair)
- **Dashboard**: React frontend for mentees and mentors (matching, sessions, notifications, settings)
- **Auth**: Email/password and optional Google OAuth via django-allauth

## Requirements

- Python 3.10+
- Node.js 18+ (for frontend)
- PostgreSQL (optional; SQLite supported for local dev)

## Setup

### 1. Clone and enter the project

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 2. Python backend

```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
```

### 3. Environment variables

Copy the example env file and fill in your values:

```bash
copy .env.example .env
# Edit .env with your secret key, DB, email, and optional Google OAuth settings.
```

**Key environment variables:**

- **Django**
  - `SECRET_KEY` — Django secret key (generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`)
  - `DEBUG` — Set to `False` in production; `True` for local dev
  - `ALLOWED_HOSTS` — Comma-separated list of allowed domains

- **Database**
  - `DATABASE_URL` — PostgreSQL connection string (e.g., `postgresql://user:password@localhost/dbname`)
  - `FORCE_SQLITE` — Set to `True` to use SQLite instead of PostgreSQL (for local dev only)

- **Email (SMTP)**
  - `EMAIL_HOST` — SMTP server (e.g., `smtp.gmail.com`)
  - `EMAIL_PORT` — SMTP port (usually 587 for TLS or 465 for SSL)
  - `EMAIL_HOST_USER` — Sender email address
  - `EMAIL_HOST_PASSWORD` — SMTP password or app-specific password
  - `DEFAULT_FROM_EMAIL` — From address for automated emails

- **Google OAuth** (optional)
  - `SOCIALACCOUNT_PROVIDERS` — JSON configuration for Google OAuth (see `.env.example` for format)
  - Google Cloud Console: Create OAuth 2.0 credentials and add `http://127.0.0.1:8000/accounts/google/login/callback/` to authorized redirect URIs

- **Media / File Storage** (optional)
  - `CLOUDINARY_URL` — For profile images (if using Cloudinary instead of local storage)
  - `GOOGLE_DRIVE_FOLDER_ID` — For backup/media storage via Google Drive API

See `.env.example` for complete variable list and descriptions.

### 4. Database

```bash
python manage.py migrate
python manage.py runserver
```

For local dev without PostgreSQL, you can use SQLite (see `.env.example` for `FORCE_SQLITE`).

### Demo accounts (optional)

Seed demo users `mentor1..mentor50` and `mentee1..mentee50`:

```bash
python manage.py seed_demo_users --mentors 50 --mentees 50
```

Passwords are the same as the username (e.g. username `mentee5` password `mentee5`).

### 5. Frontend dashboard (optional)

To build or run the React dashboard:

```bash
cd frontend/dashboard
npm install
npm run build
```

Django serves the built files from the dashboard `dist` (or configured static path). For development, you can run Vite separately and point the app at it if configured.

## Running the app

```bash
# From project root, with venv activated
python manage.py runserver
```

Open http://127.0.0.1:8000/ in your browser.

## Project structure

- `api/` — REST API (sessions, matching, account, approvals, etc.)
- `matching/` — Matching logic, XGBoost scoring, models (sessions, requests, notifications)
- `profiles/` — Mentor and mentee profiles
- `accounts/` — Auth (allauth)
- `frontend/dashboard/` — React dashboard (Vite + React)
- `capstone_site/` — Django settings and root URLs
- `templates/` — Server-rendered templates

## Tests

- **Backend**: `python manage.py test`
- **Frontend**: `cd frontend/dashboard && npm run test`

## License

Private / educational use.
