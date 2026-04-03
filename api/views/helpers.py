"""
Shared helpers used by both api.views and api.controllers.
"""
import json
import logging

from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.core.cache import cache
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from matching.models import AuditLog, MentoringSession, Notification, Subject, Topic
from profiles.models import MenteeProfile

logger = logging.getLogger(__name__)


def _send_session_scheduled_emails(session: MentoringSession, is_reschedule: bool = False):
    """Send session schedule details by email to mentee and mentor."""
    mentor_username = session.mentor.user.username
    mentee_username = session.mentee.user.username
    subject_name = session.subject.name if session.subject else ""
    topic_name = session.topic.name if session.topic else ""
    scheduled_at_str = timezone.localtime(session.scheduled_at).strftime("%A, %B %d, %Y at %I:%M %p")
    duration_minutes = session.duration_minutes or 60
    notes = (session.notes or "").strip()

    context = {
        "mentor_username": mentor_username,
        "mentee_username": mentee_username,
        "subject_name": subject_name,
        "topic_name": topic_name,
        "scheduled_at": scheduled_at_str,
        "duration_minutes": duration_minutes,
        "notes": notes,
    }
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or settings.EMAIL_HOST_USER
    if not from_email:
        logger.warning("session_scheduled_email_skipped", extra={"reason": "no_from_email"})
        return

    subject_prefix = "Mentoring session rescheduled – " if is_reschedule else "Mentoring session scheduled – "
    for recipient_user, recipient_name in [
        (session.mentee.user, mentee_username),
        (session.mentor.user, mentor_username),
    ]:
        email_addr = getattr(recipient_user, "email", None) or ""
        if not email_addr:
            logger.warning(
                "session_scheduled_email_skipped",
                extra={"reason": "no_email", "user_id": recipient_user.id},
            )
            continue
        context["recipient_name"] = recipient_name
        subject = subject_prefix + scheduled_at_str
        text_message = render_to_string("matching/session_scheduled_email.txt", context)
        html_message = render_to_string("matching/session_scheduled_email.html", context)
        msg = EmailMultiAlternatives(subject, text_message, from_email, [email_addr])
        msg.attach_alternative(html_message, "text/html")
        try:
            msg.send()
            logger.info(
                "session_scheduled_email_sent",
                extra={"session_id": session.id, "to": email_addr},
            )
        except Exception:
            logger.exception("session_scheduled_email_failed", extra={"session_id": session.id, "to": email_addr})


def _send_session_reminder_emails(session: MentoringSession, window_label: str):
    """Send reminder emails (e.g. 24h / 1h before) for a session."""
    mentor_username = session.mentor.user.username
    mentee_username = session.mentee.user.username
    subject_name = session.subject.name if session.subject else ""
    topic_name = session.topic.name if session.topic else ""
    scheduled_at_str = timezone.localtime(session.scheduled_at).strftime("%A, %B %d, %Y at %I:%M %p")
    duration_minutes = session.duration_minutes or 60
    notes = (session.notes or "").strip()

    context = {
        "mentor_username": mentor_username,
        "mentee_username": mentee_username,
        "subject_name": subject_name,
        "topic_name": topic_name,
        "scheduled_at": scheduled_at_str,
        "duration_minutes": duration_minutes,
        "notes": notes,
    }
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or settings.EMAIL_HOST_USER
    if not from_email:
        logger.warning("session_reminder_email_skipped", extra={"reason": "no_from_email"})
        return

    subject_prefix = f"Reminder ({window_label}) – mentoring session at "
    for recipient_user, recipient_name in [
        (session.mentee.user, mentee_username),
        (session.mentor.user, mentor_username),
    ]:
        email_addr = getattr(recipient_user, "email", None) or ""
        if not email_addr:
            logger.warning(
                "session_reminder_email_skipped",
                extra={"reason": "no_email", "user_id": recipient_user.id},
            )
            continue
        context["recipient_name"] = recipient_name
        subject = subject_prefix + scheduled_at_str
        text_message = render_to_string("matching/session_scheduled_email.txt", context)
        html_message = render_to_string("matching/session_scheduled_email.html", context)
        msg = EmailMultiAlternatives(subject, text_message, from_email, [email_addr])
        msg.attach_alternative(html_message, "text/html")
        try:
            msg.send()
            logger.info(
                "session_reminder_email_sent",
                extra={"session_id": session.id, "to": email_addr, "window": window_label},
            )
        except Exception:
            logger.exception(
                "session_reminder_email_failed",
                extra={"session_id": session.id, "to": email_addr, "window": window_label},
            )


def _maybe_send_due_session_reminders():
    """Send in-app + email reminders for upcoming sessions (24h and 1h windows)."""
    now = timezone.now()
    upcoming = MentoringSession.objects.filter(status="scheduled")

    soon_24h = upcoming.filter(
        reminder_24h_sent=False,
        scheduled_at__lte=now + timezone.timedelta(hours=24),
        scheduled_at__gt=now,
    )
    for session in soon_24h:
        Notification.objects.create(
            user=session.mentor.user,
            message=f"Reminder: mentoring session with {session.mentee.user.username} is within 24 hours.",
            action_tab="sessions",
        )
        Notification.objects.create(
            user=session.mentee.user,
            message=f"Reminder: mentoring session with {session.mentor.user.username} is within 24 hours.",
            action_tab="sessions",
        )
        _send_session_reminder_emails(session, "24 hours")
        session.reminder_24h_sent = True
        session.save(update_fields=["reminder_24h_sent"])

    soon_1h = upcoming.filter(
        reminder_1h_sent=False,
        scheduled_at__lte=now + timezone.timedelta(hours=1),
        scheduled_at__gt=now,
    )
    for session in soon_1h:
        Notification.objects.create(
            user=session.mentor.user,
            message=f"Reminder: mentoring session with {session.mentee.user.username} starts in less than 1 hour.",
            action_tab="sessions",
        )
        Notification.objects.create(
            user=session.mentee.user,
            message=f"Reminder: mentoring session with {session.mentor.user.username} starts in less than 1 hour.",
            action_tab="sessions",
        )
        _send_session_reminder_emails(session, "1 hour")
        session.reminder_1h_sent = True
        session.save(update_fields=["reminder_1h_sent"])


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
    out = {
        "id": m.id,
        "user_id": m.user_id,
        "username": m.user.username,
        "subjects": subs or [],
        "topics": tops or [],
        "role": m.role or "",
        "expertise_level": m.expertise_level,
        "capacity": getattr(m, "capacity", None) or 0,
        "gender": getattr(m, "gender", "") or "",
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
    out = {
        "id": e.id,
        "username": e.user.username,
        "subjects": subs or [],
        "topics": tops or [],
        "difficulty_level": e.difficulty_level,
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
        Parsed JSON dict, or empty dict on decoding error.
    """
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


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


def _serialize_session(session: MentoringSession):
    """Serialize a MentoringSession into a dictionary for API responses.
    
    Args:
        session: MentoringSession instance.
    
    Returns:
        Dictionary with session data (id, mentor, mentee, subject, status, etc).
    """
    return {
        "id": session.id,
        "mentor_id": session.mentor_id,
        "mentor_username": session.mentor.user.username,
        "mentee_id": session.mentee_id,
        "mentee_username": session.mentee.user.username,
        "subject": session.subject.name if session.subject else None,
        "subject_id": session.subject_id,
        "topic": session.topic.name if session.topic else None,
        "topic_id": session.topic_id,
        "scheduled_at": session.scheduled_at.isoformat(),
        "duration_minutes": session.duration_minutes,
        "notes": session.notes,
        "meeting_notes": getattr(session, "meeting_notes", "") or "",
        "status": session.status,
    }


def _serialize_notification(item: Notification):
    return {
        "id": item.id,
        "message": item.message,
        "is_read": item.is_read,
        "action_tab": item.action_tab or "",
        "created_at": item.created_at.isoformat(),
    }


def _serialize_subject(subject: Subject):
    return {"id": subject.id, "name": subject.name, "description": subject.description}


def _serialize_topic(topic: Topic):
    return {"id": topic.id, "name": topic.name, "subject_id": topic.subject_id}


def _serialize_mentee(mentee: MenteeProfile):
    return {"id": mentee.id, "username": mentee.user.username}


def get_subjects_list():
    """Return the serialized subjects list, cached for faster access."""
    cache_key = "subjects:list"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    subjects = Subject.objects.order_by("name")
    items = [_serialize_subject(item) for item in subjects]
    cache.set(cache_key, items, timeout=600)
    return items


def invalidate_subjects_cache():
    cache.delete("subjects:list")


def _parse_datetime(value):
    if not value:
        return None
    dt = parse_datetime(value)
    if not dt:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt


def _has_conflict(session: MentoringSession, scheduled_at):
    start = scheduled_at
    end = start + timezone.timedelta(minutes=session.duration_minutes)

    def overlaps(existing_start, existing_end):
        return existing_start < end and start < existing_end

    mentor_sessions = MentoringSession.objects.filter(
        status="scheduled", mentor=session.mentor
    )
    mentee_sessions = MentoringSession.objects.filter(
        status="scheduled", mentee=session.mentee
    )
    for s in list(mentor_sessions) + list(mentee_sessions):
        if s.id == session.id:
            continue
        existing_start = s.scheduled_at
        existing_end = existing_start + timezone.timedelta(minutes=s.duration_minutes)
        if overlaps(existing_start, existing_end):
            return True
    return False


def _require_staff(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required."}, status=401)
    if not request.user.is_staff:
        return JsonResponse({"error": "Staff access required."}, status=403)
    return None


# User approval status cache (mentor/mentee approved flag)
APPROVAL_CACHE_TTL = 3600  # 1 hour


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


def invalidate_approval_cache_mentee(mentee_profile_id):
    cache.delete(f"user_approval:mentee:{mentee_profile_id}")
