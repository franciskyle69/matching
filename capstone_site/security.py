"""Security headers, CSP nonces, and API authentication gating."""

from __future__ import annotations

import secrets

from django.http import HttpResponseForbidden, JsonResponse

PUBLIC_API_PATHS = {
    "/api/health/",
    "/api/csrf/",
    "/api/auth/login/",
    "/api/auth/google/",
    "/api/auth/google/login/",
    "/api/auth/register/",
    "/api/auth/forgot-password/",
    "/api/auth/refresh/",
    "/api/auth/logout/",
    "/api/auth/check-lockout/",
}


def csp_nonce_context(request):
    return {"csp_nonce": getattr(request, "csp_nonce", "")}


def csrf_failure(request, reason="", **kwargs):
    """Return JSON for API CSRF failures so the signup UI can show a real error."""
    path = request.path or ""
    message = "Your session expired. Refresh the page and try again."
    if path.startswith("/api/"):
        return JsonResponse({"error": message, "code": "csrf"}, status=403)
    return HttpResponseForbidden(message)


def _normalize_path(path: str) -> str:
    if not path.endswith("/"):
        return path + "/"
    return path


def _csp_header(nonce: str, debug: bool) -> str:
    parts = [
        "default-src 'self'",
        f"script-src 'self' 'nonce-{nonce}' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self' https://accounts.google.com",
    ]
    if not debug:
        parts.append("upgrade-insecure-requests")
    return "; ".join(parts) + ";"


class SecurityHeadersMiddleware:
    """Attach a CSP nonce and standard hardening headers to every response."""

    _site_synced = False

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.csp_nonce = secrets.token_urlsafe(16)
        self._sync_site_domain(request)
        response = self.get_response(request)
        from django.conf import settings

        response.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")

        admin_prefix = "/" + getattr(settings, "ADMIN_URL", "admin/")
        if (request.path or "").startswith(admin_prefix):
            return response

        response.setdefault(
            "Content-Security-Policy",
            _csp_header(request.csp_nonce, bool(settings.DEBUG)),
        )
        return response

    @classmethod
    def _sync_site_domain(cls, request):
        if cls._site_synced:
            return
        try:
            from capstone_site.site_utils import sync_site_from_env, public_host
            from django.conf import settings
            from django.contrib.sites.models import Site

            sync_site_from_env()
            host = public_host(request)
            if host and host not in {"localhost", "127.0.0.1", "testserver"}:
                Site.objects.update_or_create(
                    pk=getattr(settings, "SITE_ID", 1),
                    defaults={"domain": host, "name": "PeerLink"},
                )
            cls._site_synced = True
        except Exception:
            pass


class ApiAuthenticationMiddleware:
    """Require authentication on /api/* except a small public allowlist."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = _normalize_path(request.path or "")
        if path.startswith("/api/") and path not in PUBLIC_API_PATHS:
            user = getattr(request, "user", None)
            if not getattr(user, "is_authenticated", False):
                return JsonResponse({"error": "Authentication required."}, status=401)
        return self.get_response(request)
