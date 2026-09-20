"""
Shared helpers used by both api.views and api.controllers.
"""
import json
import logging

from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.core.cache import cache
from accounts.models import get_user_display_name
from matching.models import AuditLog, Competency, Notification, Subject, Topic
from profiles.models import MenteeProfile

logger = logging.getLogger(__name__)


def _user_display_name(user):
    name = get_user_display_name(user)
    if name:
        return name
    if getattr(user, "email", ""):
        return user.email
    return getattr(user, "username", "") or ""


def _avatar_url(request, path_or_url):
    """Convert a relative or absolute path to a fully-qualified avatar URL.
    
    Args:
        request: Django request object for building absolute URIs.
        path_or_url: Path or URL string to process.
    
    Returns:
        Fully-qualified URL string, or empty string if input is empty.
    """
    if not path_or_url:
        return ""
    s = (path_or_url or "").strip()
    if s.startswith("http://") or s.startswith("https://"):
        return s
    if s.startswith("/"):
        return request.build_absolute_uri(s)
    return request.build_absolute_uri("/" + s.lstrip("/"))


def _serialize_mentor_for_matching(m, request=None):
    """Serialize a MentorProfile into a dictionary for matching/API responses.
    
    Args:
        m: MentorProfile instance or None.
        request: Optional Django request for avatar URL resolution.
    
    Returns:
        Dictionary with mentor data (id, username, subjects, topics, role, etc.).
    """
    if not m:
        return {}
    subs = m.subjects if isinstance(m.subjects, list) else ([m.subjects] if m.subjects else [])
    tops = m.topics if isinstance(m.topics, list) else ([m.topics] if m.topics else [])
    competency_levels = {
        item.competency_id: int(item.proficiency_level)
        for item in getattr(m, "competency_levels", []).all()
    } if hasattr(m, "competency_levels") else {}
    out = {
        "id": m.id,
        "user_id": m.user_id,
        "username": m.user.username,
        "email": m.user.email or "",
        "display_name": _user_display_name(m.user),
        "subjects": subs or [],
        "topics": tops or [],
        "competency_ids": [c.id for c in getattr(m, "competencies", []).all()] if hasattr(m, "competencies") else [],
        "competency_levels": competency_levels,
        "role": m.role or "",
        "program": getattr(m, "program", "") or "",
        "year_level": getattr(m, "year_level", None) or 0,
        "expertise_level": m.expertise_level,
        "years_experience": getattr(m, "years_experience", None),
        "teaching_experience_years": getattr(m, "teaching_experience_years", None),
        "capacity": getattr(m, "capacity", None) or 0,
        "gender": getattr(m, "gender", "") or "",
        "bio": getattr(m, "bio", "") or "",
        "availability": m.availability if isinstance(getattr(m, "availability", []), list) else [],
    }
    if request and getattr(m, "avatar_url", None):
        out["avatar_url"] = _avatar_url(request, m.avatar_url)
    else:
        out["avatar_url"] = getattr(m, "avatar_url", "") or ""
    return out


def _serialize_mentee_for_matching(e, request=None):
    """Serialize a MenteeProfile into a dictionary for matching/API responses.
    
    Args:
        e: MenteeProfile instance or None.
        request: Optional Django request for avatar URL resolution.
    
    Returns:
        Dictionary with mentee data (id, username, subjects, topics, difficulty_level, etc.).
    """
    if not e:
        return {}
    subs = e.subjects if isinstance(e.subjects, list) else ([e.subjects] if e.subjects else [])
    tops = e.topics if isinstance(e.topics, list) else ([e.topics] if e.topics else [])
    competency_needs = {
        item.competency_id: int(item.need_level)
        for item in getattr(e, "competency_needs", []).all()
    } if hasattr(e, "competency_needs") else {}
    out = {
        "id": e.id,
        "username": e.user.username,
        "email": e.user.email or "",
        "display_name": _user_display_name(e.user),
        "subjects": subs or [],
        "topics": tops or [],
        "competency_ids": [c.id for c in getattr(e, "competencies", []).all()] if hasattr(e, "competencies") else [],
        "competency_needs": competency_needs,
        "difficulty_level": e.difficulty_level,
        "preferred_learning_style": getattr(e, "preferred_learning_style", "") or "",
        "program": getattr(e, "program", "") or "",
        "year_level": getattr(e, "year_level", None) or 0,
        "bio": getattr(e, "bio", "") or "",
        "availability": e.availability if isinstance(getattr(e, "availability", []), list) else [],
    }
    if request and getattr(e, "avatar_url", None):
        out["avatar_url"] = _avatar_url(request, e.avatar_url)
    else:
        out["avatar_url"] = getattr(e, "avatar_url", "") or ""
    return out


def _json_body(request):
    """Parse JSON request body, returning an empty dict if parsing fails.
    
    Args:
        request: Django request object to parse.
    
    Returns:
        Parsed JSON dict, or empty dict on decoding error or multipart data.
    """
    content_type = getattr(request, "content_type", "") or request.META.get("CONTENT_TYPE", "")
    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        return {}
    try:
        if not request.body:
            return {}
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _resolve_account_role(user):
    """PeerLink account role used for portal sign-in (mentor, mentee, staff)."""
    if hasattr(user, "mentor_profile"):
        return "mentor"
    if hasattr(user, "mentee_profile"):
        return "mentee"
    if user.is_staff:
        return "staff"
    return None


def _get_role_flags(user):
    """Check if user has mentor and/or mentee profiles.
    
    Args:
        user: Django User object.
    
    Returns:
        Dict with 'is_mentor' and 'is_mentee' boolean flags.
    """
    return {
        "is_mentor": hasattr(user, "mentor_profile"),
        "is_mentee": hasattr(user, "mentee_profile"),
    }


def _validate_role(role):
    """Validate that role is either 'mentor' or 'mentee'.
    
    Args:
        role: String role to validate.
    
    Returns:
        True if role is valid, False otherwise.
    """
    return role in ("mentor", "mentee")


def _client_ip(request):
    """Best-effort client IP, honoring the first X-Forwarded-For hop on Render."""
    forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return (request.META.get("REMOTE_ADDR") or "unknown").strip() or "unknown"


def _rate_limit(key, limit, window_seconds):
    """Implement bucket-based rate limiting using cache.
    
    Args:
        key: Unique rate-limit key (e.g., user_id or IP).
        limit: Maximum number of requests allowed per window.
        window_seconds: Time window in seconds.
    
    Returns:
        True if request is allowed, False if rate limit exceeded.
    """
    # Bucket-based rate limit (simple and cache-friendly), with a small
    # safeguard around bucket boundaries to avoid edge cases.
    now = int(timezone.now().timestamp())
    bucket = now // window_seconds
    elapsed_in_bucket = now % window_seconds

    current_key = f"rl:{key}:{bucket}"
    current = cache.get(current_key, 0)

    # If we're very close to a bucket boundary, include the previous bucket
    # count so "last attempt crosses into next minute" doesn't incorrectly
    # drop the counter.
    total = current
    # How far into the bucket we still consider the previous bucket for
    # boundary-crossing attempts. Higher values make rate-limiting more
    # robust during slow tests.
    if elapsed_in_bucket <= 20 and window_seconds >= 10:
        prev_key = f"rl:{key}:{bucket - 1}"
        total += cache.get(prev_key, 0)

    if total >= limit:
        return False

    cache.set(current_key, current + 1, timeout=window_seconds)
    return True


def audit_log(user, action, model_name, object_id=""):
    """Record an audit entry (who did what to which object)."""
    try:
        AuditLog.objects.create(
            user=user,
            action=action,
            model_name=model_name,
            object_id=str(object_id),
        )
    except Exception:
        logger.exception("audit_log_create_failed")


def _require_mentor(request):
    """Ensure user has a mentor profile, return profile or error response.
    
    Args:
        request: Django request object.
    
    Returns:
        Tuple of (mentor_profile, error_response). If mentor exists, error_response is None.
    """
    mentor_profile = getattr(request.user, "mentor_profile", None)
    if not mentor_profile:
        return None, JsonResponse({"error": "Mentor access required."}, status=403)
    return mentor_profile, None


def _require_mentee(request):
    """Ensure user has a mentee profile, return profile or error response.
    
    Args:
        request: Django request object.
    
    Returns:
        Tuple of (mentee_profile, error_response). If mentee exists, error_response is None.
    """
    mentee_profile = getattr(request.user, "mentee_profile", None)
    if not mentee_profile:
        return None, JsonResponse({"error": "Mentee access required."}, status=403)
    return mentee_profile, None


def _require_role(request):
    role_flags = _get_role_flags(request.user)
    if not (role_flags["is_mentor"] or role_flags["is_mentee"] or request.user.is_staff):
        return JsonResponse({"error": "Profile not found for this account."}, status=403)
    return None


def _get_payload(request):
    """Extract JSON body or POST data from request.
    
    Args:
        request: Django request object.
    
    Returns:
        Dict from parsed JSON or request.POST.
    """
    return _json_body(request) or request.POST


def _get_int(payload, key, default=None, min_value=None):
    """Extract an integer value from payload with optional min_value validation.
    
    Args:
        payload: Dict to extract from.
        key: Dictionary key.
        default: Default value if key not found or parsing fails.
        min_value: Optional minimum acceptable value.
    
    Returns:
        Parsed integer, or default if invalid.
    """
    if key not in payload or payload.get(key) in (None, ""):
        return default
    try:
        value = int(payload.get(key))
    except (TypeError, ValueError):
        return default
    if min_value is not None and value < min_value:
        return default
    return value


def _get_str(payload, key, default=""):
    """Extract and strip a string value from payload.
    
    Args:
        payload: Dict to extract from.
        key: Dictionary key.
        default: Default value if key not found.
    
    Returns:
        Stripped string value, or default.
    """
    value = payload.get(key)
    if value is None:
        return default
    return str(value).strip()


def _infer_notification_category(message: str, action_tab: str) -> str:
    lower = (message or "").lower()
    tab = (action_tab or "").lower()
    if "session" in lower and any(
        word in lower for word in ("scheduled", "upcoming", "booked")
    ):
        return "session_scheduled"
    if "session" in lower and any(
        word in lower for word in ("completed", "finished", "ended")
    ):
        return "session_completed"
    if tab == "announcements" or "announcement" in lower:
        return "announcement"
    if tab in ("matching", "mentees") or any(
        word in lower for word in ("paired", "pairing", "mentor", "mentee")
    ):
        return "matching"
    if tab == "newsfeed" or "message" in lower or "comment" in lower:
        return "message"
    return "general"


def _find_user_for_notification_actor(name_or_username: str):
    from django.contrib.auth import get_user_model
    from django.db.models import Q

    token = (name_or_username or "").strip()
    if not token:
        return None
    User = get_user_model()
    user = User.objects.filter(username__iexact=token).first()
    if user:
        return user
    parts = token.split()
    if len(parts) >= 2:
        user = User.objects.filter(
            first_name__iexact=parts[0],
            last_name__iexact=" ".join(parts[1:]),
        ).first()
        if user:
            return user
    return User.objects.filter(
        Q(first_name__iexact=token) | Q(last_name__iexact=token)
    ).first()


def _notification_actor_payload(user, request):
    from profiles.models import MentorProfile

    avatar = ""
    for profile_cls in (MentorProfile, MenteeProfile):
        profile = profile_cls.objects.filter(user=user).first()
        if profile and getattr(profile, "avatar_url", None):
            avatar = _avatar_url(request, profile.avatar_url)
            break
    return {
        "actor_username": user.username,
        "actor_display_name": _user_display_name(user),
        "actor_avatar_url": avatar,
    }


def _notification_actor_from_message(message: str, request):
    import re

    if not message:
        return {}
    username_match = re.search(r"\b(mentor\d+|mentee\d+)\b", message, re.I)
    if username_match:
        user = _find_user_for_notification_actor(username_match.group(1))
        if user:
            return _notification_actor_payload(user, request)
    paired = re.search(r"paired with ([^.]+)\.", message, re.I)
    if paired:
        user = _find_user_for_notification_actor(paired.group(1).strip())
        if user:
            return _notification_actor_payload(user, request)
    chosen = re.search(r"^([^.]+) has chosen you", message, re.I)
    if chosen:
        user = _find_user_for_notification_actor(chosen.group(1).strip())
        if user:
            return _notification_actor_payload(user, request)
    return {}


def _format_notification_message(message: str, actor: dict) -> str:
    import re

    text = message or ""
    username = (actor or {}).get("actor_username") or ""
    display = (actor or {}).get("actor_display_name") or ""
    if username and display and username.lower() != display.lower():
        text = re.sub(re.escape(username), display, text, flags=re.I)
    return text


def _serialize_notification(item: Notification, request=None):
    message = item.message or ""
    category = _infer_notification_category(message, item.action_tab or "")
    actor = _notification_actor_from_message(message, request) if request else {}
    payload = {
        "id": item.id,
        "message": message,
        "formatted_message": _format_notification_message(message, actor),
        "is_read": item.is_read,
        "action_tab": item.action_tab or "",
        "created_at": item.created_at.isoformat(),
        "category": category,
        "actor_username": actor.get("actor_username", ""),
        "actor_display_name": actor.get("actor_display_name", ""),
        "actor_avatar_url": actor.get("actor_avatar_url", ""),
    }
    return payload


def _serialize_subject(subject: Subject):
    topics = getattr(subject, "topics", None)
    topic_items = []
    if topics is not None:
        topic_items = [_serialize_topic(topic) for topic in topics.all().order_by("name")]
    category = getattr(subject, "category", Subject.CATEGORY_MAJOR) or Subject.CATEGORY_MAJOR
    return {
        "id": subject.id,
        "name": subject.name,
        "code": getattr(subject, "code", "") or "",
        "category": category,
        "category_label": dict(Subject.CATEGORY_CHOICES).get(category, category),
        "is_minor": category != Subject.CATEGORY_MAJOR,
        "description": subject.description,
        "topics": topic_items,
    }


def _serialize_topic(topic: Topic):
    return {
        "id": topic.id,
        "name": topic.name,
        "subject_id": topic.subject_id,
        "status": getattr(topic, "status", Topic.STATUS_ACTIVE),
        "is_active": getattr(topic, "status", Topic.STATUS_ACTIVE) == Topic.STATUS_ACTIVE,
        "created_at": topic.created_at.isoformat() if getattr(topic, "created_at", None) else None,
        "updated_at": topic.updated_at.isoformat() if getattr(topic, "updated_at", None) else None,
    }


def _serialize_competency(competency: Competency):
    topic = getattr(competency, "topic", None)
    return {
        "id": competency.id,
        "name": competency.name,
        "description": competency.description,
        "topic_id": competency.topic_id,
        "topic_name": getattr(topic, "name", "") or "",
        "subject_id": getattr(topic, "subject_id", None),
        "subject_name": getattr(getattr(topic, "subject", None), "name", "") or "",
    }


def _serialize_mentee(mentee: MenteeProfile):
    return {
        "id": mentee.id,
        "user_id": mentee.user_id,
        "username": mentee.user.username,
        "display_name": _user_display_name(mentee.user),
    }


def get_subjects_list(include_inactive_topics=False):
    """Return serialized subjects list, cached for faster access."""
    suffix = "all" if include_inactive_topics else "active"
    cache_key = f"subjects:list:{suffix}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    subjects = Subject.objects.prefetch_related("topics").order_by("name")
    items = []
    for item in subjects:
        data = _serialize_subject(item)
        if not include_inactive_topics:
            data["topics"] = [
                topic for topic in data.get("topics", []) if topic.get("is_active")
            ]
        items.append(data)
    cache.set(cache_key, items, timeout=600)
    return items


def invalidate_subjects_cache():
    cache.delete("subjects:list:active")
    cache.delete("subjects:list:all")


def _parse_datetime(value):
    if not value:
        return None
    dt = parse_datetime(value)
    if not dt:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _require_staff(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "Staff access required."}, status=403)
    return None


# User approval status cache (mentor/mentee approved flag)
APPROVAL_CACHE_TTL = 3600  # 1 hour
APPROVAL_LIST_CACHE_TTL = 60  # 1 minute
APPROVAL_LIST_CACHE_VERSION_KEY = "user_approval:pending_list:version"


def get_approval_list_cache_key(staff_user_id):
    """Return versioned cache key for pending approvals list per staff user."""
    version = cache.get(APPROVAL_LIST_CACHE_VERSION_KEY)
    if version is None:
        version = 1
        cache.set(APPROVAL_LIST_CACHE_VERSION_KEY, version, timeout=None)
    try:
        version = int(version)
    except (TypeError, ValueError):
        version = 1
        cache.set(APPROVAL_LIST_CACHE_VERSION_KEY, version, timeout=None)
    return f"user_approval:pending_list:v{version}:staff:{staff_user_id}"


def bump_approval_list_cache_version():
    """Invalidate all pending approvals list cache entries by bumping version."""
    current = cache.get(APPROVAL_LIST_CACHE_VERSION_KEY)
    if current is None:
        cache.set(APPROVAL_LIST_CACHE_VERSION_KEY, 2, timeout=None)
        return
    try:
        cache.incr(APPROVAL_LIST_CACHE_VERSION_KEY)
    except Exception:
        try:
            next_version = int(current) + 1
        except (TypeError, ValueError):
            next_version = 2
        cache.set(APPROVAL_LIST_CACHE_VERSION_KEY, next_version, timeout=None)


def get_mentor_approved(mentor_profile):
    """Return mentor approval status, using cache when possible."""
    if mentor_profile is None:
        return False
    cache_key = f"user_approval:mentor:{mentor_profile.id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return bool(cached)
    val = mentor_profile.approved
    cache.set(cache_key, val, APPROVAL_CACHE_TTL)
    return val


def get_mentee_approved(mentee_profile):
    """Return mentee approval status, using cache when possible."""
    if mentee_profile is None:
        return False
    cache_key = f"user_approval:mentee:{mentee_profile.id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return bool(cached)
    val = getattr(mentee_profile, "approved", False)
    cache.set(cache_key, val, APPROVAL_CACHE_TTL)
    return val


def invalidate_approval_cache_mentor(mentor_profile_id):
    cache.delete(f"user_approval:mentor:{mentor_profile_id}")
    bump_approval_list_cache_version()


def invalidate_approval_cache_mentee(mentee_profile_id):
    cache.delete(f"user_approval:mentee:{mentee_profile_id}")
    bump_approval_list_cache_version()
