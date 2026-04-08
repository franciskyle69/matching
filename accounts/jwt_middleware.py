from django.contrib.auth.models import AnonymousUser, User
from django.core.cache import cache

from .jwt_utils import decode_access_token


class JWTAuthenticationMiddleware:
    """Optional bearer-token auth for API routes to reduce repeated session checks."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth_header = request.headers.get("Authorization", "")
        if (
            request.path.startswith("/api/")
            and auth_header.startswith("Bearer ")
        ):
            token = auth_header[7:].strip()
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("uid")
                cache_key = f"jwt:user:{user_id}"
                user = cache.get(cache_key)
                if user is None:
                    try:
                        user = User.objects.only("id", "username", "email", "is_staff", "is_active").get(id=user_id)
                    except User.DoesNotExist:
                        user = AnonymousUser()
                    cache.set(cache_key, user, 300)
                if getattr(user, "is_authenticated", False) and getattr(user, "is_active", False):
                    request.user = user
                    request.jwt_authenticated = True
                    # Bearer tokens are not CSRF-bound like cookie sessions.
                    request._dont_enforce_csrf_checks = True

        return self.get_response(request)
