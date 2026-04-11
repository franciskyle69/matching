from pathlib import Path

from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect

from accounts.models import must_change_password


def _matching_redirect(request, default_tab="sessions"):
    """Redirect old /matching/* Django pages to React app with appropriate hash."""
    path = (request.path or "").strip("/").lower()
    if path.startswith("matching/"):
        path = path[9:]  # after "matching/"
    if path.startswith("subjects"):
        tab = "subjects"
    elif path.startswith("notifications"):
        tab = "notifications"
    else:
        tab = default_tab  # sessions, sessions/add, sessions/<id>/reschedule, etc.
    return HttpResponseRedirect(f"/app/#{tab}")


def react_app(request):
    if request.user.is_authenticated and must_change_password(request.user):
        return HttpResponseRedirect("/accounts/settings/?must_change_password=1")
    index_path = Path(__file__).resolve().parent.parent / "frontend" / "dashboard" / "index.html"
    if not index_path.exists():
        return HttpResponseNotFound(
            "React build not found. Run `npm install` and `npm run build:client` in material-shadcn-1.0.0."
        )
    response = HttpResponse(index_path.read_text(encoding="utf-8"))
    # Avoid restoring sensitive authenticated SPA state from browser history cache.
    response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0, private"
    response["Pragma"] = "no-cache"
    response["Expires"] = "0"
    return response


def landing_page(request):
    if request.user.is_authenticated:
        if must_change_password(request.user):
            return HttpResponseRedirect("/accounts/settings/?must_change_password=1")
        return HttpResponseRedirect("/app/")
    index_path = Path(__file__).resolve().parent.parent / "frontend" / "landing" / "index.html"
    if not index_path.exists():
        return HttpResponseNotFound("Landing page not found. Move Agentix into frontend/landing.")
    return HttpResponse(index_path.read_text(encoding="utf-8"))


def public_landing_page(request):
    index_path = Path(__file__).resolve().parent.parent / "frontend" / "landing" / "index.html"
    if not index_path.exists():
        return HttpResponseNotFound("Landing page not found. Move Agentix into frontend/landing.")
    return HttpResponse(index_path.read_text(encoding="utf-8"))
