"""Utilities for login lockout information and API responses."""

from datetime import timedelta
import math

from axes.models import AccessAttempt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone

User = get_user_model()

# Progressive penalties for each lock cycle: 1 minute, then 5 minutes, then 15 minutes.
PENALTY_MINUTES = (1, 5, 15)
PROGRESS_TTL_SECONDS = 24 * 60 * 60


def _progress_key(username):
    normalized = str(username or "").strip().lower()
    return f"auth:lockout:progress:{normalized}"


def _penalty_for_stage(stage):
    idx = max(0, min(int(stage or 0), len(PENALTY_MINUTES) - 1))
    return PENALTY_MINUTES[idx]


def _get_stage_for_lock(username, marker):
    key = _progress_key(username)
    progress = cache.get(key) or {"stage": 0, "lock_marker": None}
    current_stage = int(progress.get("stage", 0))
    previous_marker = progress.get("lock_marker")

    if previous_marker != marker:
        if previous_marker is not None:
            current_stage = min(current_stage + 1, len(PENALTY_MINUTES) - 1)
        cache.set(
            key,
            {"stage": current_stage, "lock_marker": marker},
            timeout=PROGRESS_TTL_SECONDS,
        )

    return current_stage


def reset_lockout_progress(*identifiers, ip_address=None):
    """Reset progressive lockout stage and axes counters after successful login."""
    cleaned = {
        str(value).strip()
        for value in identifiers
        if value is not None and str(value).strip()
    }
    normalized = {value.lower() for value in cleaned}

    if ip_address:
        ip_value = str(ip_address).strip()
        if ip_value:
            normalized.add(f"ip:{ip_value}")

    for key_part in normalized:
        cache.delete(_progress_key(key_part))

    filters = Q()
    for value in cleaned:
        filters |= Q(username__iexact=value)
    if ip_address:
        ip_value = str(ip_address).strip()
        if ip_value:
            filters |= Q(ip_address=ip_value)

    if filters:
        AccessAttempt.objects.filter(filters).update(failures_since_start=0)


def get_lockout_info(username=None, ip_address=None):
    """Get lockout state and remaining time for the provided username."""
    failure_limit = getattr(settings, "AXES_FAILURE_LIMIT", 5)

    normalized_username = str(username or "").strip()
    normalized_ip = str(ip_address or "").strip()

    if not normalized_username and not normalized_ip:
        return {
            "is_locked": False,
            "attempts": 0,
            "failure_limit": failure_limit,
            "locked_until": None,
            "remaining_minutes": None,
            "penalty_minutes": None,
            "message": "No user specified",
        }

    try:
        if normalized_username:
            query = Q(username__iexact=normalized_username)
            stage_identity = normalized_username
        else:
            query = Q(ip_address=normalized_ip)
            stage_identity = f"ip:{normalized_ip}"

        latest_attempt = (
            AccessAttempt.objects.filter(query).order_by("-id").first()
        )
        attempts = int(getattr(latest_attempt, "failures_since_start", 0) or 0)

        if latest_attempt and attempts >= int(failure_limit or 5):
            now = timezone.now()
            locked_at = getattr(latest_attempt, "attempt_time", None) or now
            marker = (
                f"{latest_attempt.pk}:{locked_at.isoformat()}:{attempts}"
            )
            stage = _get_stage_for_lock(stage_identity, marker)
            penalty_minutes = _penalty_for_stage(stage)
            locked_until = locked_at + timedelta(minutes=penalty_minutes)

            # Unlock once this stage penalty has elapsed.
            if now >= locked_until:
                AccessAttempt.objects.filter(query).update(failures_since_start=0)
                return {
                    "is_locked": False,
                    "attempts": 0,
                    "failure_limit": failure_limit,
                    "locked_until": None,
                    "remaining_minutes": None,
                    "penalty_minutes": None,
                    "message": "",
                }

            remaining_seconds = max(0.0, (locked_until - now).total_seconds())
            remaining_minutes = max(1, int(math.ceil(remaining_seconds / 60.0)))

            return {
                "is_locked": True,
                "attempts": attempts,
                "failure_limit": failure_limit,
                "locked_until": locked_until.isoformat(),
                "remaining_minutes": remaining_minutes,
                "penalty_minutes": penalty_minutes,
                "message": "Account locked due to too many failed login attempts.",
            }
    except Exception:
        pass

    return {
        "is_locked": False,
        "attempts": attempts if "attempts" in locals() else 0,
        "failure_limit": failure_limit,
        "locked_until": None,
        "remaining_minutes": None,
        "penalty_minutes": None,
        "message": "",
    }


def create_lockout_response(username, ip_address=None):
    """Create a 429 response payload for a locked account."""
    lockout_info = get_lockout_info(username, ip_address=ip_address)

    return JsonResponse(
        {
            "error": "Account locked",
            "detail": lockout_info["message"],
            "attempts": lockout_info["attempts"],
            "failure_limit": lockout_info["failure_limit"],
            "locked_until": lockout_info["locked_until"],
            "remaining_minutes": lockout_info["remaining_minutes"],
            "penalty_minutes": lockout_info["penalty_minutes"],
        },
        status=429,
    )
