# Django templates

**Main UI:** The primary interface is the React dashboard at **`/app/`**. It is served by `capstone_site.views.react_app` and loads static assets from `/static/` (see `STATICFILES_DIRS` in `capstone_site/settings.py`).

These template directories are still used for server-rendered flows:

- **`registration/`** — Django auth: login, registration, password reset. Used when users follow email links or hit `/accounts/login/`, etc.
- **`account/`** — django-allauth: email verification, account settings.
- **`matching/`** — Legacy matching/session/subject pages. All `/matching/*` URLs now redirect to the React app at `/app/#<tab>`; these templates may still be referenced by old links or emails.
- **`profiles/`** — Mentor and mentee questionnaire pages (e.g. `/profiles/mentor/questionnaire/`).

To change the main dashboard UI, edit the frontend in `frontend/dashboard/`, not these templates.
