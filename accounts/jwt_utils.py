import datetime
from typing import Optional

import jwt
from django.conf import settings
from django.utils import timezone


def _jwt_secret() -> str:
    return getattr(settings, "JWT_SECRET_KEY", settings.SECRET_KEY)


def issue_access_token(user) -> str:
    now = timezone.now()
    ttl = int(getattr(settings, "JWT_ACCESS_TTL_SECONDS", 1800))
    payload = {
        "typ": "access",
        "uid": user.id,
        "username": user.username,
        "iat": int(now.timestamp()),
        "exp": int((now + datetime.timedelta(seconds=ttl)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def issue_refresh_token(user) -> str:
    now = timezone.now()
    ttl = int(getattr(settings, "JWT_REFRESH_TTL_SECONDS", 60 * 60 * 24 * 14))
    payload = {
        "typ": "refresh",
        "uid": user.id,
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
    return payload
