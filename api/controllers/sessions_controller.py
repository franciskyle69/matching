from datetime import timedelta

from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.core.cache import cache
from django.utils import timezone

from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialToken
import requests

from matching.forms import SubjectForm
from matching.models import MentoringSession, MenteeMentorRequest, Notification, Subject, Topic
from profiles.models import MenteeProfile

from ..views import (
    _require_mentor,
    _serialize_session,
    audit_log,
    _serialize_subject,
    _serialize_topic,
    _serialize_mentee,
    _get_payload,
    _get_int,
    _get_str,
    _parse_datetime,
    _has_conflict,
    _maybe_send_due_session_reminders,
    _require_role,
    _require_staff,
    get_mentor_approved,
    get_mentee_approved,
    logger,
)


SESSION_LIST_CACHE_TTL = 60  # seconds
MENTORING_COMPLETION_HOURS = 12
TARGET_MINUTES = MENTORING_COMPLETION_HOURS * 60  # 720


def _invalidate_sessions_cache_for_user(user_id):
    cache.delete(f"sessions_list:{user_id}")


def _user_has_verified_email(user):
    if not getattr(user, "email", None):
        return False
    return EmailAddress.objects.filter(
        user=user, email=user.email, verified=True
    ).exists()


def _refresh_google_token(social_token):
    """
    Refresh Google OAuth access token using refresh_token. Updates social_token in place and returns new access_token, or None on failure.
    """
    if not social_token.token_secret:
        return None
    app = getattr(social_token, "app", None)
    if not app or not app.client_id or not app.secret:
        return None
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": app.client_id,
            "client_secret": app.secret,
            "refresh_token": social_token.token_secret,
            "grant_type": "refresh_token",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    if resp.status_code != 200:
        logger.warning(
            "google_token_refresh_failed",
            extra={"status_code": resp.status_code, "response": resp.text[:300]},
        )
        return None
    data = resp.json()
    access_token = data.get("access_token")
    if not access_token:
        return None
    expires_in = data.get("expires_in")
    social_token.token = access_token
    if expires_in:
        social_token.expires_at = timezone.now() + timedelta(seconds=int(expires_in))
    social_token.save(update_fields=["token", "expires_at"])
    return access_token


def _get_google_access_token(user):
    """
    Return a valid Google OAuth access token for the given user (refreshing if expired). Returns None if no token or refresh fails.
    """
    token = (
        SocialToken.objects.filter(account__user=user, account__provider="google")
        .select_related("app")
        .order_by("-id")
        .first()
    )
    if not token:
        return None
    # Use refresh token if access token is expired or expiring in under 5 minutes
    now = timezone.now()
    if token.expires_at:
        if (token.expires_at - now) < timedelta(minutes=5):
            new_token = _refresh_google_token(token)
            if new_token:
                return new_token
            # Fall back to stored token (might still work for a short window)
    return token.token


def _create_google_calendar_events_for_session(session: MentoringSession):
    """
    Create a Google Calendar event on each participant's calendar (mentor and mentee) so it appears for both.
    Uses clear title, date/time in description, and "Take meeting notes". Adds the other party as attendee when possible.
    """
    tz_name = timezone.get_current_timezone_name() or "UTC"
    start = timezone.localtime(session.scheduled_at)
    if timezone.is_naive(start):
        start = timezone.make_aware(start)
    end = start + timedelta(minutes=session.duration_minutes or 60)
    start_str = start.isoformat()
    end_str = end.isoformat()

    subject_name = session.subject.name if session.subject else "Mentoring session"
    topic_name = session.topic.name if session.topic else ""
    summary = f"Mentoring: {subject_name}" + (f" – {topic_name}" if topic_name else "")

    date_str = start.strftime("%A, %B %d, %Y")
    time_str = start.strftime("%I:%M %p").lstrip("0")
    end_time_str = end.strftime("%I:%M %p").lstrip("0")

    mentor_user = session.mentor.user
    mentee_user = session.mentee.user
    mentor_name = mentor_user.get_full_name() or mentor_user.username
    mentee_name = mentee_user.get_full_name() or mentee_user.username

    description_parts = [
        f"Mentoring session with {mentee_name} (mentee). Mentor: {mentor_name}.",
        "",
        date_str,
        f"{time_str} – {end_time_str}",
        "",
        "Take meeting notes: start a new document to capture notes.",
    ]
    description = "\n".join(description_parts)

    # Create event on each user's calendar so it appears for both
    for user in (mentor_user, mentee_user):
        if not _user_has_verified_email(user):
            logger.warning(
                "google_calendar_skip_no_verified_email user_id=%s session_id=%s",
                user.id, session.id,
            )
            continue
        access_token = _get_google_access_token(user)
        if not access_token:
            logger.warning(
                "google_calendar_skip_no_google_token user_id=%s session_id=%s (sign in with Google to get calendar events)",
                user.id, session.id,
            )
            continue

        # Other party as attendee (so event shows participant in popup)
        other_email = (mentee_user.email if user == mentor_user else mentor_user.email) or ""
        other_email = other_email.strip() if isinstance(other_email, str) else ""
        attendee_list = [{"email": other_email}] if other_email else []

        body = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start_str, "timeZone": tz_name},
            "end": {"dateTime": end_str, "timeZone": tz_name},
            "reminders": {"useDefault": True},
        }
        if attendee_list:
            body["attendees"] = attendee_list

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        try:
            resp = requests.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                headers=headers,
                json=body,
                timeout=10,
            )
            if resp.status_code >= 400:
                logger.warning(
                    "google_calendar_event_failed user_id=%s session_id=%s status=%s response=%s",
                    user.id, session.id, resp.status_code, resp.text[:400],
                )
            else:
                logger.info("google_calendar_event_created user_id=%s session_id=%s", user.id, session.id)
        except Exception:
            logger.exception("google_calendar_event_exception user_id=%s session_id=%s", user.id, session.id)


@login_required
@require_GET
def sessions_list(request):
    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)
    is_staff_only = request.user.is_staff and not mentor and not mentee

    if not is_staff_only:
        cache_key = f"sessions_list:{request.user.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return JsonResponse(cached)

    # Check for any due reminders whenever sessions list is loaded (skip when serving from cache)
    _maybe_send_due_session_reminders()

    if not mentor and not mentee and not request.user.is_staff:
        return JsonResponse({"error": "Mentor or mentee access required."}, status=403)

    if mentor and not get_mentor_approved(mentor) and not request.user.is_staff:
        return JsonResponse(
            {"error": "Mentor account pending approval by coordinator."}, status=403
        )
    if mentee and not get_mentee_approved(mentee) and not request.user.is_staff:
        return JsonResponse(
            {"error": "Mentee account pending approval by coordinator."}, status=403
        )

    qs = MentoringSession.objects.select_related(
        "mentor__user", "mentee__user", "subject", "topic"
    )
    if mentor:
        qs = qs.filter(mentor=mentor)
    elif mentee:
        qs = qs.filter(mentee=mentee)
    else:
        assert request.user.is_staff
        qs = qs.all()

    upcoming = qs.filter(status="scheduled").order_by("scheduled_at")
    history = qs.exclude(status="scheduled").order_by("-scheduled_at")

    if mentor:
        accepted_mentee_ids = MenteeMentorRequest.objects.filter(
            mentor=mentor, accepted=True
        ).values_list("mentee_id", flat=True).distinct()
        mentee_options = []
        for m in MenteeProfile.objects.filter(
            id__in=accepted_mentee_ids
        ).select_related("user"):
            item = _serialize_mentee(m)
            item["difficulty_subjects"] = (
                m.subjects
                if isinstance(m.subjects, list)
                else ([m.subjects] if m.subjects else [])
            )
            item["difficulty_topics"] = (
                m.topics
                if isinstance(m.topics, list)
                else ([m.topics] if m.topics else [])
            )
            item["difficulty_level"] = m.difficulty_level
            mentee_options.append(item)
    else:
        mentee_options = []

    # Progress toward 12h completion per mentoring pair (based on completed sessions only)
    progress_target_hours = MENTORING_COMPLETION_HOURS
    progress = None
    progress_by_mentee = []
    if mentor:
        for m in MenteeProfile.objects.filter(
            id__in=accepted_mentee_ids or []
        ).select_related("user"):
            total = (
                MentoringSession.objects.filter(
                    mentor=mentor, mentee=m, status="completed"
                ).aggregate(Sum("duration_minutes"))["duration_minutes__sum"]
                or 0
            )
            pct = min(100, round(100 * total / TARGET_MINUTES, 1))
            progress_by_mentee.append({
                "mentee_id": m.id,
                "mentee_username": m.user.username,
                "total_completed_minutes": total,
                "progress_percent": pct,
                "difficulty_subjects": (
                    m.subjects
                    if isinstance(m.subjects, list)
                    else ([m.subjects] if m.subjects else [])
                ),
                "difficulty_topics": (
                    m.topics
                    if isinstance(m.topics, list)
                    else ([m.topics] if m.topics else [])
                ),
                "difficulty_level": m.difficulty_level,
            })
    elif mentee:
        acc = MenteeMentorRequest.objects.filter(mentee=mentee, accepted=True).select_related("mentor").first()
        if acc:
            total = (
                MentoringSession.objects.filter(
                    mentor=acc.mentor, mentee=mentee, status="completed"
                ).aggregate(Sum("duration_minutes"))["duration_minutes__sum"]
                or 0
            )
            pct = min(100, round(100 * total / TARGET_MINUTES, 1))
            progress = {
                "total_completed_minutes": total,
                "progress_percent": pct,
                "target_hours": progress_target_hours,
            }
        else:
            progress = {"total_completed_minutes": 0, "progress_percent": 0, "target_hours": progress_target_hours}

    payload = {
        "upcoming": [_serialize_session(item) for item in upcoming],
        "history": [_serialize_session(item) for item in history],
        "options": {
            "mentees": mentee_options,
            "subjects": [_serialize_subject(s) for s in Subject.objects.order_by("name")],
            "topics": [
                _serialize_topic(t)
                for t in Topic.objects.select_related("subject")
            ],
        },
        "is_mentor": bool(mentor),
        "is_staff_view": bool(request.user.is_staff and not mentor and not mentee),
        "progress_target_hours": progress_target_hours,
        "progress": progress,
        "progress_by_mentee": progress_by_mentee,
    }
    if not is_staff_only:
        cache.set(f"sessions_list:{request.user.id}", payload, SESSION_LIST_CACHE_TTL)
    return JsonResponse(payload)


@login_required
@require_http_methods(["POST"])
def session_create(request):
    mentor_profile, error = _require_mentor(request)
    if error:
        return error
    if not get_mentor_approved(mentor_profile):
        return JsonResponse(
            {"error": "Mentor account pending approval."}, status=403
        )
    payload = _get_payload(request)
    mentee_id = _get_int(payload, "mentee_id") or _get_int(payload, "mentee")
    scheduled_at = _parse_datetime(payload.get("scheduled_at"))
    duration_minutes = _get_int(
        payload, "duration_minutes", default=60, min_value=15
    )
    notes = _get_str(payload, "notes")
    subject_id = _get_int(payload, "subject_id") or _get_int(payload, "subject")
    topic_id = _get_int(payload, "topic_id") or _get_int(payload, "topic")

    if not mentee_id or not scheduled_at or not duration_minutes:
        return JsonResponse(
            {"error": "mentee_id and scheduled_at are required."}, status=400
        )

    mentee = MenteeProfile.objects.filter(id=mentee_id).first()
    if not mentee:
        return JsonResponse({"error": "Mentee not found."}, status=404)
    if not MenteeMentorRequest.objects.filter(mentor=mentor_profile, mentee=mentee, accepted=True).exists():
        return JsonResponse(
            {"error": "You can only schedule sessions with mentees you have accepted in Matching."},
            status=403,
        )

    subject = Subject.objects.filter(id=subject_id).first() if subject_id else None
    topic = Topic.objects.filter(id=topic_id).first() if topic_id else None
    if topic and subject and topic.subject_id != subject.id:
        return JsonResponse(
            {"error": "Topic does not belong to the selected subject."}, status=400
        )

    session = MentoringSession(
        mentor=mentor_profile,
        mentee=mentee,
        subject=subject,
        topic=topic,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        notes=notes,
    )
    if _has_conflict(session, scheduled_at):
        return JsonResponse({"error": "Schedule conflict detected."}, status=400)

    session.save()
    audit_log(request.user, "create", "session", session.id)
    logger.info(
        "session_created",
        extra={
            "session_id": session.id,
            "mentor_id": mentor_profile.id,
            "mentee_id": mentee.id,
        },
    )
    Notification.objects.create(
        user=session.mentor.user,
        message=f"New mentoring session scheduled with {session.mentee.user.username}.",
        action_tab="sessions",
    )
    Notification.objects.create(
        user=session.mentee.user,
        message=f"New mentoring session scheduled with {session.mentor.user.username}.",
        action_tab="sessions",
    )
    from ..views import _send_session_scheduled_emails  # avoid circular import at top

    _send_session_scheduled_emails(session)
    _create_google_calendar_events_for_session(session)
    _invalidate_sessions_cache_for_user(request.user.id)
    _invalidate_sessions_cache_for_user(session.mentee.user_id)
    return JsonResponse({"session": _serialize_session(session)})


@login_required
@require_http_methods(["POST"])
def session_reschedule(request, session_id: int):
    mentor_profile, error = _require_mentor(request)
    if error:
        return error

    session = (
        MentoringSession.objects.select_related("mentor__user", "mentee__user")
        .filter(id=session_id)
        .first()
    )
    if not session:
        return JsonResponse({"error": "Session not found."}, status=404)
    if session.mentor_id != mentor_profile.id:
        return JsonResponse(
            {"error": "You can only reschedule your own sessions."}, status=403
        )
    if session.status != "scheduled":
        return JsonResponse(
            {"error": "Only scheduled sessions can be rescheduled."}, status=400
        )

    payload = _get_payload(request)
    scheduled_at = _parse_datetime(payload.get("scheduled_at")) or session.scheduled_at
    duration_minutes = _get_int(
        payload, "duration_minutes", default=session.duration_minutes, min_value=15
    )
    notes = _get_str(payload, "notes", default=session.notes)
    subject_id = _get_int(payload, "subject_id") or _get_int(payload, "subject")
    topic_id = _get_int(payload, "topic_id") or _get_int(payload, "topic")
    if not duration_minutes:
        return JsonResponse(
            {"error": "duration_minutes must be >= 15."}, status=400
        )

    subject = (
        Subject.objects.filter(id=subject_id).first()
        if subject_id
        else session.subject
    )
    topic = (
        Topic.objects.filter(id=topic_id).first() if topic_id else session.topic
    )
    if topic and subject and topic.subject_id != subject.id:
        return JsonResponse(
            {"error": "Topic does not belong to the selected subject."}, status=400
        )

    old_time = session.scheduled_at
    session.subject = subject
    session.topic = topic
    session.scheduled_at = scheduled_at
    session.duration_minutes = duration_minutes
    session.notes = notes

    if _has_conflict(session, scheduled_at):
        return JsonResponse({"error": "Schedule conflict detected."}, status=400)

    session.save()
    audit_log(request.user, "update", "session", session.id)

    if scheduled_at != old_time:
        Notification.objects.create(
            user=session.mentee.user,
            message=f"Your session with {session.mentor.user.username} was rescheduled.",
            action_tab="sessions",
        )
        Notification.objects.create(
            user=session.mentor.user,
            message=f"Session with {session.mentee.user.username} was rescheduled.",
            action_tab="sessions",
        )
        logger.info("session_rescheduled", extra={"session_id": session.id})
        from ..views import _send_session_scheduled_emails  # avoid circular import at top

        _send_session_scheduled_emails(session, is_reschedule=True)

    _invalidate_sessions_cache_for_user(request.user.id)
    _invalidate_sessions_cache_for_user(session.mentee.user_id)
    return JsonResponse({"session": _serialize_session(session)})


@login_required
@require_http_methods(["POST"])
def session_update_status(request, session_id: int):
    mentor_profile, error = _require_mentor(request)
    if error:
        return error

    session = (
        MentoringSession.objects.select_related("mentor__user", "mentee__user")
        .filter(id=session_id)
        .first()
    )
    if not session:
        return JsonResponse({"error": "Session not found."}, status=404)
    if session.mentor_id != mentor_profile.id:
        return JsonResponse(
            {"error": "You can only update your own sessions."}, status=403
        )

    payload = _get_payload(request)
    status = _get_str(payload, "status")
    if status not in ("completed", "cancelled"):
        return JsonResponse({"error": "Invalid status."}, status=400)

    session.status = status
    session.save()
    audit_log(request.user, "update", "session", session.id)
    logger.info(
        "session_status_updated",
        extra={"session_id": session.id, "status": status},
    )
    Notification.objects.create(
        user=session.mentee.user,
        message=f"Your session with {session.mentor.user.username} was marked {status}.",
        action_tab="sessions",
    )
    _invalidate_sessions_cache_for_user(request.user.id)
    _invalidate_sessions_cache_for_user(session.mentee.user_id)
    return JsonResponse({"session": _serialize_session(session)})


@login_required
@require_http_methods(["POST"])
def session_update_meeting_notes(request, session_id: int):
    """Update meeting notes for a session. Mentor or mentee can update."""
    session = (
        MentoringSession.objects.select_related("mentor__user", "mentee__user")
        .filter(id=session_id)
        .first()
    )
    if not session:
        return JsonResponse({"error": "Session not found."}, status=404)
    mentor_profile = getattr(request.user, "mentor_profile", None)
    mentee_profile = getattr(request.user, "mentee_profile", None)
    is_mentor = mentor_profile and get_mentor_approved(mentor_profile) and session.mentor_id == mentor_profile.id
    is_mentee = mentee_profile and get_mentee_approved(mentee_profile) and session.mentee_id == mentee_profile.id
    if not is_mentor and not is_mentee:
        return JsonResponse(
            {"error": "You can only update meeting notes for your own sessions."},
            status=403,
        )

    payload = _get_payload(request)
    meeting_notes = _get_str(payload, "meeting_notes", default="")
    session.meeting_notes = meeting_notes
    session.save(update_fields=["meeting_notes"])
    _invalidate_sessions_cache_for_user(session.mentor.user_id)
    _invalidate_sessions_cache_for_user(session.mentee.user_id)
    return JsonResponse({"session": _serialize_session(session)})

