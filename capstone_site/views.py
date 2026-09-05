from pathlib import Path

from django.http import HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.views.decorators.csrf import ensure_csrf_cookie

from accounts.models import must_change_password

CSP_NONCE_PLACEHOLDER = "__CSP_NONCE__"


def _html_file_response(path: Path, request, extra_headers=None) -> HttpResponse:
    html = path.read_text(encoding="utf-8")
    nonce = getattr(request, "csp_nonce", "")
    html = html.replace(CSP_NONCE_PLACEHOLDER, nonce)
    response = HttpResponse(html)
    if extra_headers:
        for key, value in extra_headers.items():
            response[key] = value
    return response


def _matching_redirect(request, default_tab="matching"):
    """Redirect old /matching/* Django pages to React app with appropriate hash."""
    path = (request.path or "").strip("/").lower()
    if path.startswith("matching/"):
        path = path[9:]  # after "matching/"
    if path.startswith("subjects"):
        tab = "subjects"
    elif path.startswith("notifications"):
        tab = "notifications"
    else:
        tab = default_tab  # legacy /matching/* paths fall back to matching tab
    return HttpResponseRedirect(f"/app/#{tab}")


@ensure_csrf_cookie
def react_app(request):
    if request.user.is_authenticated and must_change_password(request.user):
        return HttpResponseRedirect("/accounts/settings/?must_change_password=1")
    index_path = Path(__file__).resolve().parent.parent / "frontend" / "dashboard" / "index.html"
    if not index_path.exists():
        return HttpResponseNotFound(
            "React build not found. Run `npm install` and `npm run build:client` in material-shadcn-1.0.0."
        )
    return _html_file_response(
        index_path,
        request,
        extra_headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, private",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


def _read_landing_html(request, filename: str) -> HttpResponse:
    index_path = Path(__file__).resolve().parent.parent / "frontend" / "landing" / filename
    if not index_path.exists():
        return HttpResponseNotFound(f"Landing page not found: {filename}")
    return _html_file_response(index_path, request)


@ensure_csrf_cookie
def landing_page(request):
    if request.user.is_authenticated:
        if must_change_password(request.user):
            return HttpResponseRedirect("/accounts/settings/?must_change_password=1")
        return HttpResponseRedirect("/app/")
    return _read_landing_html(request, "index.html")


@ensure_csrf_cookie
def portal_page(request):
    return _read_landing_html(request, "portal.html")


@ensure_csrf_cookie
def public_landing_page(request):
    return _read_landing_html(request, "index.html")
