import datetime
import secrets
from typing import Optional

import jwt
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.utils import timezone


def _jwt_secret() -> str:
    return getattr(settings, "JWT_SECRET_KEY", settings.SECRET_KEY)


def _refresh_ttl() -> int:
    return int(getattr(settings, "JWT_REFRESH_TTL_SECONDS", 60 * 60 * 24 * 14))


def _refresh_cookie_name() -> str:
    return getattr(settings, "JWT_REFRESH_COOKIE_NAME", "pl_refresh")


def _refresh_cookie_path() -> str:
    return getattr(settings, "JWT_REFRESH_COOKIE_PATH", "/api/auth/")


def issue_access_token(user) -> str:
    now = timezone.now()
    ttl = int(getattr(settings, "JWT_ACCESS_TTL_SECONDS", 1800))
    from accounts.models import get_user_profile
    profile = get_user_profile(user)
    role = profile.role if profile else ("COORDINATOR" if user.is_staff else "MENTEE")
    approval_status = profile.approval_status if profile else ("ACTIVE" if user.is_staff else "ACTIVE")
    is_onboarded = bool(profile.is_onboarded if profile else False)
    payload = {
        "typ": "access",
        "id": user.id,
        "user_id": user.id,
        "uid": user.id,
        "email": user.email,
        "username": user.username,
        "role": role,
        "is_onboarded": is_onboarded,
        "approval_status": approval_status,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(seconds=ttl)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def issue_refresh_token(user) -> str:
    now = timezone.now()
    ttl = _refresh_ttl()
    from accounts.models import get_user_profile
    profile = get_user_profile(user)
    role = profile.role if profile else ("COORDINATOR" if user.is_staff else "MENTEE")
    approval_status = profile.approval_status if profile else ("ACTIVE" if user.is_staff else "ACTIVE")
    is_onboarded = bool(profile.is_onboarded if profile else False)
    payload = {
        "typ": "refresh",
        "user_id": user.id,
        "uid": user.id,
        "email": user.email,
        "role": role,
        "is_onboarded": is_onboarded,
        "approval_status": approval_status,
        "jti": secrets.token_urlsafe(24),
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(seconds=ttl)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("typ") != "access":
        return None
    return payload


def decode_refresh_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("typ") != "refresh":
        return None
    jti = payload.get("jti")
    if not jti or cache.get(f"jwt:revoked:{jti}"):
        return None
    return payload


def revoke_refresh_payload(payload: Optional[dict]) -> None:
    if not payload:
        return
    jti = payload.get("jti")
    exp = payload.get("exp")
    if not jti:
        return
    ttl = 1
    if exp:
        ttl = max(int(exp) - int(timezone.now().timestamp()), 1)
    cache.set(f"jwt:revoked:{jti}", 1, ttl)


def _cookie_kwargs() -> dict:
    return {
        "httponly": True,
        "secure": not bool(getattr(settings, "DEBUG", False)),
        "samesite": "Lax",
        "path": _refresh_cookie_path(),
        "max_age": _refresh_ttl(),
    }


def set_refresh_cookie(response: HttpResponse, token: str) -> None:
    response.set_cookie(_refresh_cookie_name(), token, **_cookie_kwargs())


def clear_refresh_cookie(response: HttpResponse) -> None:
    response.delete_cookie(
        _refresh_cookie_name(),
        path=_refresh_cookie_path(),
        samesite="Lax",
    )


def read_refresh_token(request, payload_token: str = "") -> str:
    if payload_token:
        return payload_token
    return (request.COOKIES.get(_refresh_cookie_name()) or "").strip()
