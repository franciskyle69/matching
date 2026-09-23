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


def _progress_key(username: str | None) -> str:
    """Generate cache key for lockout progress tracking.
    
    Args:
        username: Username to track (case-insensitive).
    
    Returns:
        Cache key string for storing lockout stage and marker.
    """
    normalized = str(username or "").strip().lower()
    return f"auth:lockout:progress:{normalized}"


def _penalty_for_stage(stage: int | None) -> int:
    """Get lockout penalty in minutes for a given stage.
    
    Args:
        stage: Lockout stage (0, 1, or higher).
    
    Returns:
        Penalty in minutes (from PENALTY_MINUTES tuple).
    """
    idx = max(0, min(int(stage or 0), len(PENALTY_MINUTES) - 1))
    return PENALTY_MINUTES[idx]


def _get_stage_for_lock(username: str | None, marker: str) -> int:
    """Get current lockout stage and update cache on lock change.
    
    Args:
        username: Username to track.
        marker: Identifier for current lock event (e.g., attempt count + timestamp).
    
    Returns:
        Current lockout stage (integer).
    """
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
    """Get lockout state and remaining cooldown time for the provided username."""
    failure_limit = getattr(settings, "AXES_FAILURE_LIMIT", 5)
    cooloff_time = getattr(settings, "AXES_COOLOFF_TIME", timedelta(minutes=15))
    if isinstance(cooloff_time, (int, float)):
        cooloff_time = timedelta(seconds=cooloff_time)

    normalized_username = str(username or "").strip()
    normalized_ip = str(ip_address or "").strip()

    if not normalized_username and not normalized_ip:
        return {
            "is_locked": False,
            "attempts": 0,
            "failure_limit": failure_limit,
            "locked_until": None,
            "unlock_time": None,
            "cooloff_seconds": 0,
            "remaining_minutes": None,
            "penalty_minutes": None,
            "message": "No user specified",
        }

    try:
        user_obj = None
        if normalized_username:
            if "@" in normalized_username:
                user_obj = User.objects.filter(email__iexact=normalized_username).first()
            if not user_obj:
                user_obj = User.objects.filter(username__iexact=normalized_username).first()

        query = Q()
        if user_obj:
            query = Q(username__iexact=user_obj.username)
            if user_obj.email:
                query |= Q(username__iexact=user_obj.email)
            if normalized_username not in (user_obj.username, user_obj.email):
                query |= Q(username__iexact=normalized_username)
        elif normalized_username:
            query = Q(username__iexact=normalized_username)
        elif normalized_ip:
            query = Q(ip_address=normalized_ip)

        latest_attempt = (
            AccessAttempt.objects.filter(query).order_by("-attempt_time", "-id").first()
        )
        attempts = int(getattr(latest_attempt, "failures_since_start", 0) or 0)

        if latest_attempt and attempts >= int(failure_limit or 5):
            now = timezone.now()
            locked_at = getattr(latest_attempt, "attempt_time", None) or now
            locked_until = locked_at + cooloff_time

            # Unlock once the cooloff duration has elapsed.
            if now >= locked_until:
                AccessAttempt.objects.filter(query).delete()
                return {
                    "is_locked": False,
                    "attempts": 0,
                    "failure_limit": failure_limit,
                    "locked_until": None,
                    "unlock_time": None,
                    "cooloff_seconds": 0,
                    "remaining_minutes": None,
                    "penalty_minutes": None,
                    "message": "",
                }

            remaining_seconds = max(0, int(math.ceil((locked_until - now).total_seconds())))
            remaining_minutes = max(1, int(math.ceil(remaining_seconds / 60.0)))
            unlock_time_iso = locked_until.strftime("%Y-%m-%dT%H:%M:%SZ")

            return {
                "is_locked": True,
                "attempts": attempts,
                "failure_limit": failure_limit,
                "locked_until": unlock_time_iso,
                "unlock_time": unlock_time_iso,
                "cooloff_seconds": remaining_seconds,
                "remaining_minutes": remaining_minutes,
                "penalty_minutes": remaining_minutes,
                "message": "Too many failed login attempts. Account locked.",
            }
    except Exception:
        pass

    return {
        "is_locked": False,
        "attempts": attempts if "attempts" in locals() else 0,
        "failure_limit": failure_limit,
        "locked_until": None,
        "unlock_time": None,
        "cooloff_seconds": 0,
        "remaining_minutes": None,
        "penalty_minutes": None,
        "message": "",
    }


def create_lockout_response(username, ip_address=None):
    """Create an HTTP 429 response payload for a locked account."""
    lockout_info = get_lockout_info(username, ip_address=ip_address)
    cooloff_seconds = lockout_info.get("cooloff_seconds")
    if cooloff_seconds is None or cooloff_seconds <= 0:
        default_cooloff = getattr(settings, "AXES_COOLOFF_TIME", timedelta(minutes=15))
        cooloff_seconds = int(default_cooloff.total_seconds()) if hasattr(default_cooloff, "total_seconds") else 900

    unlock_time = lockout_info.get("unlock_time") or (
        timezone.now() + timedelta(seconds=cooloff_seconds)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    remaining_minutes = lockout_info.get("remaining_minutes") or max(1, int(math.ceil(cooloff_seconds / 60.0)))

    return JsonResponse(
        {
            "error": "account_locked",
            "message": "Too many failed login attempts. Account locked.",
            "cooloff_seconds": cooloff_seconds,
            "unlock_time": unlock_time,
            # Backward-compatible fields
            "detail": "Too many failed login attempts. Account locked.",
            "locked_until": unlock_time,
            "remaining_minutes": remaining_minutes,
            "penalty_minutes": remaining_minutes,
            "attempts": lockout_info.get("attempts", 5),
            "failure_limit": lockout_info.get("failure_limit", 5),
        },
        status=429,
    )


def axes_lockout_response(request, original_response=None, credentials=None):
    """Return a structured JSON 429 response when Axes intercepts a request."""
    credentials = credentials or getattr(request, "axes_credentials", {}) or {}
    username = (
        credentials.get("username")
        or credentials.get("identifier")
        or getattr(request, "axes_username", None)
        or request.POST.get("username")
        or request.POST.get("identifier")
        or ""
    )
    if not username and hasattr(request, "body"):
        try:
            import json
            payload = json.loads(request.body)
            username = payload.get("identifier") or payload.get("username") or payload.get("email") or ""
        except Exception:
            pass

    return create_lockout_response(
        username,
        ip_address=request.META.get("REMOTE_ADDR"),
    )
