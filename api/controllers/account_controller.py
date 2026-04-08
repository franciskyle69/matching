from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.contrib.auth.decorators import login_required
from django.core.mail import EmailMultiAlternatives
from django.http import JsonResponse
from django.core.cache import cache
from django.views.decorators.http import require_GET, require_http_methods
from django.template.loader import render_to_string
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
import secrets
import time

from django.utils import timezone

from matching.models import MentoringSession, MenteeMentorRequest
from profiles.models import MentorProfile, MenteeProfile, InterestTag

from accounts.forms import (
    AccountSettingsForm,
    RegisterForm,
    PasswordChangeCodeRequestForm,
    PasswordChangeCodeVerifyForm,
    PasswordChangeUpdateForm,
)
from accounts.models import get_user_display_name
from accounts.views import (
    ROLE_SESSION_KEY,
    PASSWORD_CHANGE_CODE_SESSION_KEY,
    PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY,
    PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY,
    PASSWORD_CHANGE_CODE_VERIFIED_SESSION_KEY,
    PASSWORD_CHANGE_CODE_EMAIL_SESSION_KEY,
    PASSWORD_CHANGE_CODE_TTL_SECONDS,
    PASSWORD_CHANGE_MAX_ATTEMPTS,
)
from accounts.auth_backends import EmailOrUsernameModelBackend
from accounts.jwt_utils import (
    issue_access_token,
    issue_refresh_token,
    decode_refresh_token,
)
from accounts.lockout_utils import (
    get_lockout_info,
    create_lockout_response,
    reset_lockout_progress,
)

from ..views import (
    _get_payload,
    _get_int,
    _get_str,
    _get_role_flags,
    _rate_limit,
    audit_log,
    _require_role,
    _serialize_session,
    _serialize_notification,
    _serialize_subject,
    _serialize_topic,
    _serialize_mentee,
    _maybe_send_due_session_reminders,
    get_mentor_approved,
    get_mentee_approved,
    logger,
)
from matching.models import Notification, Subject, Topic
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from profiles.questionnaire_utils import filter_topics_for_subjects


ME_CACHE_TTL_SECONDS = 30
REMINDER_SWEEP_COOLDOWN_SECONDS = 300
ME_CACHE_METRICS_LOG_EVERY = 100


def _me_cache_key(user_id):
    return f"api:me:v1:{user_id}"


def _clear_me_cache(user_id):
    cache.delete(_me_cache_key(user_id))


def _record_me_cache_metric(hit: bool):
    key = "api:me:cache:hits" if hit else "api:me:cache:misses"
    other_key = "api:me:cache:misses" if hit else "api:me:cache:hits"
    total_key = "api:me:cache:total"

    cache.add(key, 0, None)
    cache.add(other_key, 0, None)
    cache.add(total_key, 0, None)

    try:
        cache.incr(key)
        total = cache.incr(total_key)
    except Exception:
        # Some cache backends may not support atomic incr.
        return

    if total % ME_CACHE_METRICS_LOG_EVERY != 0:
        return

    hits = cache.get("api:me:cache:hits", 0) or 0
    misses = cache.get("api:me:cache:misses", 0) or 0
    requests = hits + misses
    hit_rate = round((hits / requests) * 100, 2) if requests else 0.0
    logger.info(
        "me_cache_metrics",
        extra={
            "hits": hits,
            "misses": misses,
            "requests": requests,
            "hit_rate_pct": hit_rate,
        },
    )


def _parse_hhmm_to_minutes(value):
    text = str(value or "").strip()
    parts = text.split(":")
    if len(parts) != 2:
        return None
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except (TypeError, ValueError):
        return None
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return hour * 60 + minute


def _normalise_availability_slots(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        raw_slots = list(value)
    elif isinstance(value, str):
        raw_slots = [part.strip() for part in value.split(",") if part.strip()]
    else:
        return []

    out = []
    seen = set()
    min_minutes = 8 * 60
    max_minutes = 20 * 60
    for raw in raw_slots:
        if not isinstance(raw, str):
            continue
        parts = raw.split("-")
        if len(parts) != 2:
            continue
        start = _parse_hhmm_to_minutes(parts[0])
        end = _parse_hhmm_to_minutes(parts[1])
        if start is None or end is None or start >= end:
            continue
        if start < min_minutes or end > max_minutes:
            continue
        slot = f"{start // 60:02d}:{start % 60:02d}-{end // 60:02d}:{end % 60:02d}"
        if slot in seen:
            continue
        seen.add(slot)
        out.append(slot)
    return out


def _normalise_mentor_gender(value, default=""):
    text = str(value or "").strip().lower()
    if text in ("male", "female"):
        return text
    return default


@require_http_methods(["GET"])
def health(request):
    return JsonResponse({"status": "ok"})


@ensure_csrf_cookie
@require_http_methods(["GET"])
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_http_methods(["POST"])
def auth_login(request):
    payload = _get_payload(request)
    identifier = (
        _get_str(payload, "identifier")
        or _get_str(payload, "username")
        or _get_str(payload, "email")
    )
    password = _get_str(payload, "password")
    client_ip = request.META.get("REMOTE_ADDR")
    if not identifier or not password:
        return JsonResponse(
            {"error": "Email/username and password are required."}, status=400
        )

    # Allow valid credentials to sign in and reset limits immediately.
    backend = EmailOrUsernameModelBackend()
    user = backend.authenticate(request, identifier=identifier, password=password)

    if not user:
        # Trigger axes tracking/backoff path for failed credentials.
        authenticate(request, identifier=identifier, password=password)
        lockout_info = get_lockout_info(identifier, ip_address=client_ip)
        if lockout_info["is_locked"]:
            return create_lockout_response(identifier, ip_address=client_ip)

        logger.warning("auth_login_failed", extra={"identifier": identifier})
        return JsonResponse(
            {
                "error": "Invalid credentials.",
                "attempts": lockout_info.get("attempts", 0),
                "failure_limit": lockout_info.get("failure_limit", 5),
            },
            status=401,
        )

    if not user.is_active:
        return JsonResponse(
            {"error": "Please verify your email before logging in."}, status=401
        )

    # No longer call django.authenticate for successful login; use explicit backend.
    # This guarantees valid credentials can reset lockout state.
    login(request, user, backend="accounts.auth_backends.EmailOrUsernameModelBackend")

    is_mentor = hasattr(user, "mentor_profile")
    is_mentee = hasattr(user, "mentee_profile")
    if is_mentor:
        request.session[ROLE_SESSION_KEY] = "mentor"
    elif is_mentee:
        request.session[ROLE_SESSION_KEY] = "mentee"

    # Allow immediate dashboard access during testing/development.
    # The dashboard gates access on mentor_profile.approved / mentee_profile.approved.
    mentor_profile = getattr(user, "mentor_profile", None)
    mentee_profile = getattr(user, "mentee_profile", None)
    if mentor_profile is not None and not getattr(mentor_profile, "approved", False):
        mentor_profile.approved = True
        mentor_profile.save(update_fields=["approved"])
    if mentee_profile is not None and not getattr(mentee_profile, "approved", False):
        mentee_profile.approved = True
        mentee_profile.save(update_fields=["approved"])

    # Successful authentication clears escalation progress.
    reset_lockout_progress(
        identifier,
        user.username,
        user.email,
        ip_address=client_ip,
    )

    logger.info("auth_login_success", extra={"user_id": user.id})
    _clear_me_cache(user.id)
    access_token = issue_access_token(user)
    refresh_token = issue_refresh_token(user)
    audit_log(user, "login", "auth")
    return JsonResponse(
        {
            "status": "ok",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": int(getattr(settings, "JWT_ACCESS_TTL_SECONDS", 1800)),
        }
    )


@require_http_methods(["POST"])
def auth_refresh(request):
    payload = _get_payload(request)
    refresh_token = _get_str(payload, "refresh_token")
    if not refresh_token:
        return JsonResponse({"error": "Refresh token is required."}, status=400)

    decoded = decode_refresh_token(refresh_token)
    if not decoded:
        return JsonResponse({"error": "Invalid or expired refresh token."}, status=401)

    user_id = decoded.get("uid")
    try:
        user = request.user if getattr(request.user, "is_authenticated", False) else None
        if not user or user.id != user_id:
            from django.contrib.auth.models import User

            user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    if not user.is_active:
        return JsonResponse({"error": "User account is inactive."}, status=401)

    access_token = issue_access_token(user)
    rotate_refresh = bool(getattr(settings, "JWT_ROTATE_REFRESH_TOKENS", False))
    response = {
        "status": "ok",
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": int(getattr(settings, "JWT_ACCESS_TTL_SECONDS", 1800)),
    }
    if rotate_refresh:
        response["refresh_token"] = issue_refresh_token(user)
    return JsonResponse(response)


@login_required
@require_http_methods(["POST"])
def auth_logout(request):
    user = request.user
    _clear_me_cache(user.id)
    logout(request)
    audit_log(user, "logout", "auth")
    return JsonResponse({"status": "ok"})


@require_http_methods(["POST"])
def check_lockout(request):
    """Check if a user's account is currently locked (for auto-polling lockout status)."""
    payload = _get_payload(request)
    identifier = (
        _get_str(payload, "identifier")
        or _get_str(payload, "username")
        or _get_str(payload, "email")
    )
    if not identifier:
        return JsonResponse(
            {"error": "Email or username is required."}, status=400
        )
    
    lockout_info = get_lockout_info(
        identifier,
        ip_address=request.META.get("REMOTE_ADDR"),
    )
    return JsonResponse({
        "is_locked": lockout_info["is_locked"],
        "remaining_minutes": lockout_info.get("remaining_minutes"),
        "locked_until": lockout_info.get("locked_until"),
        "penalty_minutes": lockout_info.get("penalty_minutes"),
        "attempts": lockout_info.get("attempts", 0),
        "failure_limit": lockout_info.get("failure_limit", 5),
    })


@require_http_methods(["POST"])
def auth_register(request):
    payload = _get_payload(request)
    if not _rate_limit(f"register:{request.META.get('REMOTE_ADDR')}", 5, 300):
        return JsonResponse(
            {"error": "Too many signups. Try again later."}, status=429
        )

    role = payload.get("role")
    from ..views import _validate_role  # avoid circular import at top

    if not _validate_role(role):
        return JsonResponse({"error": "Role is required."}, status=400)

    form = RegisterForm(payload)
    if not form.is_valid():
        return JsonResponse({"errors": form.errors}, status=400)

    cleaned = form.cleaned_data
    first_name = cleaned.get("first_name", "")
    middle_name = cleaned.get("middle_name", "")
    last_name = cleaned.get("last_name", "")
    email = cleaned.get("email", "")
    password = cleaned.get("password1", "")
    base_username = "".join(part for part in [first_name, last_name] if part)
    base_username = "".join(ch for ch in base_username.lower() if ch.isalnum())
    if not base_username:
        base_username = email.split("@")[0].lower()
    username = base_username
    suffix = 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base_username}{suffix}"

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    user.is_active = False
    user.save(update_fields=["is_active"])

    if role == "mentor":
        MentorProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=4,
            approved=True,
        )
    else:
        MenteeProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=1,
            campus="",
            student_id_no="",
            contact_no="",
            admission_type="",
            sex="",
            approved=True,
        )

    current_site = get_current_site(request)
    subject = "Activate your account"
    text_message = render_to_string(
        "registration/activation_email.txt",
        {
            "user": user,
            "domain": current_site.domain,
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": default_token_generator.make_token(user),
            "protocol": "https" if request.is_secure() else "http",
        },
    )
    html_message = render_to_string(
        "registration/activation_email.html",
        {
            "user": user,
            "domain": current_site.domain,
            "uid": urlsafe_base64_encode(force_bytes(user.pk)),
            "token": default_token_generator.make_token(user),
            "protocol": "https" if request.is_secure() else "http",
        },
    )
    email = EmailMultiAlternatives(subject, text_message, to=[user.email])
    email.attach_alternative(html_message, "text/html")
    email.send()

    audit_log(user, "register", "auth", user.id)
    logger.info("auth_register", extra={"user_id": user.id, "role": role})
    return JsonResponse(
        {
            "status": "ok",
            "message": "Check your email to activate your account.",
        }
    )


@login_required
@require_GET
def me(request):
    role_error = _require_role(request)
    if role_error:
        return role_error

    role_flags = _get_role_flags(request.user)

    force_refresh = str(request.GET.get("force", "")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if not force_refresh:
        cached_payload = cache.get(_me_cache_key(request.user.id))
        if cached_payload is not None:
            _record_me_cache_metric(hit=True)
            return JsonResponse(cached_payload)

    _record_me_cache_metric(hit=False)

    # Avoid running heavy reminder sweeps on every /api/me/ request.
    if cache.add("api:me:due-reminders:sweep", "1", REMINDER_SWEEP_COOLDOWN_SECONDS):
        _maybe_send_due_session_reminders()
    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)

    # Global stats
    total_mentors = MentorProfile.objects.count()
    total_mentees = MenteeProfile.objects.count()
    total_sessions = MentoringSession.objects.count()
    completed_sessions = MentoringSession.objects.filter(status="completed").count()
    completion_rate = 0
    if total_sessions > 0:
        completion_rate = round((completed_sessions / total_sessions) * 100)

    now = timezone.now()
    # Define "this week" as Monday 00:00 -> now
    start_of_week = now - timezone.timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    week_sessions_qs = MentoringSession.objects.filter(scheduled_at__gte=start_of_week)
    week_sessions = week_sessions_qs.count()
    week_completed_sessions = week_sessions_qs.filter(status="completed").count()

    # Simple academic term heuristic: Aug 1 for Aug–Dec, Jan 1 for Jan–Jul
    if now.month >= 8:
        term_start = timezone.datetime(
            now.year, 8, 1, tzinfo=timezone.get_current_timezone()
        )
    else:
        term_start = timezone.datetime(
            now.year, 1, 1, tzinfo=timezone.get_current_timezone()
        )
    term_qs = MentoringSession.objects.filter(scheduled_at__gte=term_start)
    term_sessions = term_qs.count()
    term_completed_sessions = term_qs.filter(status="completed").count()

    avatar_url = ""
    if mentor and getattr(mentor, "avatar_url", ""):
        avatar_url = mentor.avatar_url
    elif mentee and getattr(mentee, "avatar_url", ""):
        avatar_url = mentee.avatar_url

    cover_url = ""
    if mentor and getattr(mentor, "cover_url", ""):
        cover_url = mentor.cover_url
    elif mentee and getattr(mentee, "cover_url", ""):
        cover_url = mentee.cover_url

    bio = ""
    if mentor and getattr(mentor, "bio", ""):
        bio = mentor.bio
    elif mentee and getattr(mentee, "bio", ""):
        bio = mentee.bio

    tags = []
    if mentor:
        tags = list(mentor.interest_tags.values_list("name", flat=True))
    elif mentee:
        tags = list(mentee.interest_tags.values_list("name", flat=True))

    # Questionnaire completion flags: treat questionnaire as completed when
    # key preference fields have been filled out.
    mentor_q_completed = False
    if mentor:
        mentor_subj = (
            mentor.subjects
            if isinstance(mentor.subjects, list)
            else ([mentor.subjects] if mentor.subjects else [])
        )
        mentor_topics = (
            mentor.topics
            if isinstance(mentor.topics, list)
            else ([mentor.topics] if mentor.topics else [])
        )
        mentor_q_completed = bool(
            mentor_subj or mentor_topics or mentor.expertise_level is not None
        )

    mentee_q_completed = False
    if mentee:
        mentee_subj = (
            mentee.subjects
            if isinstance(mentee.subjects, list)
            else ([mentee.subjects] if mentee.subjects else [])
        )
        mentee_topics = (
            mentee.topics
            if isinstance(mentee.topics, list)
            else ([mentee.topics] if mentee.topics else [])
        )
        mentee_q_completed = bool(
            mentee_subj or mentee_topics or mentee.difficulty_level is not None
        )

    mentee_info = {}
    if mentee:
        mentee_info = {
            "program": mentee.program,
            "year_level": mentee.year_level,
            "campus": getattr(mentee, "campus", ""),
            "student_id_no": getattr(mentee, "student_id_no", ""),
            "contact_no": getattr(mentee, "contact_no", ""),
            "admission_type": getattr(mentee, "admission_type", ""),
            "sex": getattr(mentee, "sex", ""),
        }
    mentee_general_info_completed = bool(
        mentee
        and mentee.program
        and mentee.year_level
        and getattr(mentee, "campus", "")
        and getattr(mentee, "student_id_no", "")
        and getattr(mentee, "contact_no", "")
        and getattr(mentee, "admission_type", "")
        and getattr(mentee, "sex", "")
    )

    mentor_info = {}
    if mentor:
        mentor_subs = (
            mentor.subjects
            if isinstance(mentor.subjects, list)
            else ([mentor.subjects] if mentor.subjects else [])
        )
        mentor_tops = (
            mentor.topics
            if isinstance(mentor.topics, list)
            else ([mentor.topics] if mentor.topics else [])
        )
        mentor_info = {
            "program": mentor.program or "",
            "year_level": mentor.year_level or 0,
            "role": mentor.role or "",
            "subjects": list(mentor_subs) if mentor_subs else [],
            "topics": list(mentor_tops) if mentor_tops else [],
            "expertise_level": mentor.expertise_level,
            "capacity": getattr(mentor, "capacity", 1),
            "gender": getattr(mentor, "gender", "") or "",
            "availability": _normalise_availability_slots(
                getattr(mentor, "availability", [])
            ),
        }

    # Per-user progress stats (for mentors/mentees)
    user_sessions = MentoringSession.objects.none()
    if mentor:
        user_sessions = MentoringSession.objects.filter(mentor=mentor)
    elif mentee:
        user_sessions = MentoringSession.objects.filter(mentee=mentee)

    user_completed_sessions = user_sessions.filter(status="completed").count()
    user_upcoming_sessions = user_sessions.filter(
        status="scheduled", scheduled_at__gte=now
    ).count()

    first_session = user_sessions.order_by("scheduled_at").first()
    days_to_first_session = None
    if first_session:
        delta = first_session.scheduled_at - request.user.date_joined
        # Guard against negative values if old data has sessions before signup
        days_to_first_session = max(delta.days, 0)

    # Streak: how many consecutive calendar weeks (including current)
    # have at least one completed session for this user.
    completed_dates = [
        s.scheduled_at for s in user_sessions.filter(status="completed").only("scheduled_at")
    ]
    week_keys = {
        (d.isocalendar()[0], d.isocalendar()[1]) for d in completed_dates
    }
    current_streak_weeks = 0
    if week_keys:
        year, week, _ = now.isocalendar()
        tz = timezone.get_current_timezone()
        while (year, week) in week_keys:
            current_streak_weeks += 1
            # Go to previous week
            monday_this_week = timezone.datetime.fromisocalendar(year, week, 1).replace(
                tzinfo=tz
            )
            prev_monday = monday_this_week - timezone.timedelta(days=7)
            year, week, _ = prev_monday.isocalendar()

    mentee_matching = {}
    if mentee:
        mentee_subs = (
            mentee.subjects
            if isinstance(mentee.subjects, list)
            else ([mentee.subjects] if mentee.subjects else [])
        )
        mentee_tops = (
            mentee.topics
            if isinstance(mentee.topics, list)
            else ([mentee.topics] if mentee.topics else [])
        )
        mentee_matching = {
            "subjects": list(mentee_subs) if mentee_subs else [],
            "topics": list(mentee_tops) if mentee_tops else [],
            "difficulty_level": mentee.difficulty_level,
            "availability": _normalise_availability_slots(
                getattr(mentee, "availability", [])
            ),
        }

    response_payload = {
        "id": request.user.id,
        "username": request.user.username,
        "email": request.user.email,
        "first_name": request.user.first_name or "",
        "middle_name": "",
        "last_name": request.user.last_name or "",
        "full_name": get_user_display_name(request.user),
        "display_name": get_user_display_name(request.user),
        "is_staff": request.user.is_staff,
        "role": "mentor"
        if role_flags["is_mentor"]
        else "mentee"
        if role_flags["is_mentee"]
        else "staff"
        if request.user.is_staff
        else None,
        "avatar_url": avatar_url,
        "cover_url": cover_url,
        "bio": bio,
        "tags": tags,
        "mentor_approved": get_mentor_approved(mentor) if mentor else None,
        "mentee_approved": get_mentee_approved(mentee) if mentee else None,
        "mentor_questionnaire_completed": mentor_q_completed if mentor else None,
        "mentee_questionnaire_completed": mentee_q_completed if mentee else None,
        "questionnaire_completed": mentor_q_completed
        if role_flags["is_mentor"]
        else mentee_q_completed
        if role_flags["is_mentee"]
        else False,
        "mentee_info": mentee_info,
        "mentee_general_info_completed": mentee_general_info_completed,
        "mentor_info": mentor_info,
        "mentee_matching": mentee_matching,
        "stats": {
            "total_mentors": total_mentors,
            "total_mentees": total_mentees,
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "completion_rate": completion_rate,
            "week": {
                "start": start_of_week.isoformat(),
                "sessions": week_sessions,
                "completed_sessions": week_completed_sessions,
            },
            "term": {
                "start": term_start.isoformat(),
                "sessions": term_sessions,
                "completed_sessions": term_completed_sessions,
            },
            "user_progress": {
                "role": "mentor"
                if role_flags["is_mentor"]
                else "mentee"
                if role_flags["is_mentee"]
                else None,
                "sessions_completed": user_completed_sessions,
                "sessions_upcoming": user_upcoming_sessions,
                "days_to_first_session": days_to_first_session,
                "current_streak_weeks": current_streak_weeks,
                "mentees_count": MenteeMentorRequest.objects.filter(
                    mentor=mentor, accepted=True
                )
                .values("mentee_id")
                .distinct()
                .count()
                if role_flags["is_mentor"] and mentor
                else None,
                "has_mentor": bool(
                    MenteeMentorRequest.objects.filter(
                        mentee=mentee, accepted=True
                    ).exists()
                )
                if role_flags["is_mentee"] and mentee
                else False,
            },
        },
        "unread_notifications": Notification.objects.filter(
            user=request.user, is_read=False
        ).count(),
    }

    cache.set(_me_cache_key(request.user.id), response_payload, ME_CACHE_TTL_SECONDS)
    return JsonResponse(response_payload)


@login_required
@require_http_methods(["POST"])
def update_account(request):
    raw = _get_payload(request)
    if not raw or not isinstance(raw, dict):
        return JsonResponse(
            {
                "errors": {
                    "__all__": [
                        "Request body must be JSON with email."
                    ]
                }
            },
            status=400,
        )
    # Merge with current user so partial updates don't clear email.
    payload = {
        "email": raw.get("email")
        if raw.get("email") is not None
        else (request.user.email or ""),
    }
    form = AccountSettingsForm(payload, instance=request.user)
    if not form.is_valid():
        errors = {k: list(v) for k, v in form.errors.items()}
        return JsonResponse({"errors": errors}, status=400)
    form.save()
    _clear_me_cache(request.user.id)
    audit_log(request.user, "update", "account", request.user.id)
    logger.info("account_updated", extra={"user_id": request.user.id})
    return JsonResponse(
        {
            "id": request.user.id,
            "email": request.user.email,
            "full_name": get_user_display_name(request.user),
            "display_name": get_user_display_name(request.user),
        }
    )


def _clear_password_change_code_session(request):
    for key in (
        PASSWORD_CHANGE_CODE_SESSION_KEY,
        PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY,
        PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY,
        PASSWORD_CHANGE_CODE_VERIFIED_SESSION_KEY,
        PASSWORD_CHANGE_CODE_EMAIL_SESSION_KEY,
    ):
        request.session.pop(key, None)


@login_required
@require_http_methods(["POST"])
def send_password_change_code(request):
    payload = _get_payload(request)
    form = PasswordChangeCodeRequestForm(payload, user=request.user)
    if not form.is_valid():
        errors = {k: list(v) for k, v in form.errors.items()}
        return JsonResponse({"errors": errors}, status=400)

    if not request.user.email:
        return JsonResponse(
            {"error": "Add an email address first before changing password."},
            status=400,
        )

    verification_code = f"{secrets.randbelow(1000000):06d}"
    request.session[PASSWORD_CHANGE_CODE_SESSION_KEY] = verification_code
    request.session[PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY] = int(time.time()) + PASSWORD_CHANGE_CODE_TTL_SECONDS
    request.session[PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY] = 0
    request.session[PASSWORD_CHANGE_CODE_VERIFIED_SESSION_KEY] = False
    request.session[PASSWORD_CHANGE_CODE_EMAIL_SESSION_KEY] = form.cleaned_data["email"]

    subject = "Your password change verification code"
    body = (
        f"Hello {request.user.get_username()},\n\n"
        f"Your verification code is: {verification_code}\n"
        f"This code expires in 10 minutes.\n\n"
        "If you did not request this, you can ignore this email."
    )

    try:
        EmailMultiAlternatives(subject, body, to=[request.user.email]).send()
    except Exception:
        _clear_password_change_code_session(request)
        return JsonResponse(
            {"error": "Unable to send verification code right now. Please try again."},
            status=500,
        )

    return JsonResponse(
        {
            "status": "ok",
            "message": "Verification code sent to your email.",
            "cooldown_seconds": 60,
        }
    )


@login_required
@require_http_methods(["POST"])
def verify_password_change_code(request):
    payload = _get_payload(request)
    form = PasswordChangeCodeVerifyForm(payload)
    if not form.is_valid():
        errors = {k: list(v) for k, v in form.errors.items()}
        return JsonResponse({"errors": errors}, status=400)

    stored_code = str(request.session.get(PASSWORD_CHANGE_CODE_SESSION_KEY, ""))
    expires_at = int(request.session.get(PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY, 0) or 0)
    attempts = int(request.session.get(PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY, 0) or 0)

    if not stored_code or not expires_at:
        return JsonResponse({"error": "Request a verification code first."}, status=400)

    if int(time.time()) > expires_at:
        _clear_password_change_code_session(request)
        return JsonResponse({"error": "Verification code expired. Request a new one."}, status=400)

    if attempts >= PASSWORD_CHANGE_MAX_ATTEMPTS:
        _clear_password_change_code_session(request)
        return JsonResponse(
            {"error": "Too many incorrect attempts. Request a new verification code."},
            status=429,
        )

    entered_code = form.cleaned_data["verification_code"]
    if not constant_time_compare(entered_code, stored_code):
        next_attempts = attempts + 1
        request.session[PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY] = next_attempts
        remaining_attempts = max(PASSWORD_CHANGE_MAX_ATTEMPTS - next_attempts, 0)
        return JsonResponse(
            {
                "error": "Invalid verification code.",
                "remaining_attempts": remaining_attempts,
            },
            status=400,
        )

    request.session[PASSWORD_CHANGE_CODE_VERIFIED_SESSION_KEY] = True
    return JsonResponse(
        {
            "status": "ok",
            "message": "Code verified. You can now set a new password.",
        }
    )


@login_required
@require_http_methods(["POST"])
def change_password_with_code(request):
    payload = _get_payload(request)
    form = PasswordChangeUpdateForm(payload, user=request.user)
    if not form.is_valid():
        errors = {k: list(v) for k, v in form.errors.items()}
        return JsonResponse({"errors": errors}, status=400)

    verified = bool(request.session.get(PASSWORD_CHANGE_CODE_VERIFIED_SESSION_KEY, False))
    stored_email = str(request.session.get(PASSWORD_CHANGE_CODE_EMAIL_SESSION_KEY, "") or "").strip().lower()
    current_email = str(request.user.email or "").strip().lower()
    expires_at = int(request.session.get(PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY, 0) or 0)
    if not verified:
        return JsonResponse({"error": "Verify your code before updating the password."}, status=400)

    if not current_email or not stored_email or current_email != stored_email:
        _clear_password_change_code_session(request)
        return JsonResponse({"error": "Request a new verification code for your current email."}, status=400)

    if int(time.time()) > expires_at:
        _clear_password_change_code_session(request)
        return JsonResponse({"error": "Verification code expired. Request a new one."}, status=400)

    request.user.set_password(form.cleaned_data["new_password2"])
    request.user.save(update_fields=["password"])
    update_session_auth_hash(request, request.user)
    _clear_password_change_code_session(request)
    audit_log(request.user, "update", "password", request.user.id)
    return JsonResponse({"status": "ok", "message": "Password changed successfully."})


@login_required
@require_http_methods(["POST"])
def upload_avatar(request):
    """Handle profile picture upload and return its URL."""
    import os
    import uuid
    from io import BytesIO

    from django.core.files.storage import default_storage
    from django.core.files.base import ContentFile
    from PIL import Image

    from ..views import _avatar_url

    file = request.FILES.get("avatar")
    if not file:
        return JsonResponse({"error": "No file uploaded."}, status=400)

    # Limit basic file types by extension
    name, ext = os.path.splitext(file.name)
    ext = ext.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        return JsonResponse({"error": "Unsupported file type."}, status=400)

    try:
        # Compress / resize image before saving (aim for < 2MB)
        try:
            img = Image.open(file)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            img.thumbnail((512, 512))
            buffer = BytesIO()
            save_format = (
                "JPEG" if ext in [".jpg", ".jpeg", ".png"] else img.format or "JPEG"
            )
            img.save(buffer, format=save_format, quality=80, optimize=True)
            image_bytes = buffer.getvalue()
        except Exception:
            return JsonResponse(
                {"error": "Could not process image. Please upload a valid picture."},
                status=400,
            )

        max_bytes = 2 * 1024 * 1024
        if len(image_bytes) > max_bytes:
            return JsonResponse(
                {"error": "Image is too large even after compression. Please choose a smaller file."},
                status=400,
            )

        filename = f"avatars/user_{request.user.id}_{uuid.uuid4().hex}.jpg"
        saved_path = default_storage.save(filename, ContentFile(image_bytes))
        url = default_storage.url(saved_path)

        mentor = getattr(request.user, "mentor_profile", None)
        mentee = getattr(request.user, "mentee_profile", None)
        if mentor:
            mentor.avatar_url = url
            mentor.save(update_fields=["avatar_url"])
        if mentee:
            mentee.avatar_url = url
            mentee.save(update_fields=["avatar_url"])

        _clear_me_cache(request.user.id)
        audit_log(request.user, "update", "avatar", request.user.id)
        return JsonResponse({"avatar_url": url})
    except Exception as e:
        return JsonResponse(
            {"error": f"Profile picture upload failed: {str(e)}"},
            status=500,
        )


@login_required
@require_http_methods(["POST"])
def upload_cover(request):
    """Handle cover photo upload and return its URL."""
    import os
    import uuid
    from io import BytesIO

    from django.core.files.storage import default_storage
    from django.core.files.base import ContentFile
    from PIL import Image

    file = request.FILES.get("cover")
    if not file:
        return JsonResponse({"error": "No file uploaded."}, status=400)

    name, ext = os.path.splitext(file.name)
    ext = ext.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        return JsonResponse({"error": "Unsupported file type."}, status=400)

    try:
        img = Image.open(file)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.thumbnail((1920, 600))
        buffer = BytesIO()
        save_format = "JPEG" if ext in [".jpg", ".jpeg", ".png"] else img.format or "JPEG"
        img.save(buffer, format=save_format, quality=82, optimize=True)
        image_bytes = buffer.getvalue()
    except Exception:
        return JsonResponse({"error": "Could not process image."}, status=400)

    if len(image_bytes) > 5 * 1024 * 1024:
        return JsonResponse({"error": "Cover image too large."}, status=400)

    filename = f"covers/user_{request.user.id}_{uuid.uuid4().hex}.jpg"
    try:
        saved_path = default_storage.save(filename, ContentFile(image_bytes))
        url = default_storage.url(saved_path)
    except Exception as e:
        return JsonResponse(
            {"error": f"Storage upload failed: {str(e)}"},
            status=500,
        )

    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)
    if mentor:
        mentor.cover_url = url
        mentor.save(update_fields=["cover_url"])
    if mentee:
        mentee.cover_url = url
        mentee.save(update_fields=["cover_url"])

    _clear_me_cache(request.user.id)
    audit_log(request.user, "update", "cover", request.user.id)
    return JsonResponse({"cover_url": url})


@login_required
@require_http_methods(["POST"])
def update_mentee_profile(request):
    from ..views import _require_mentee  # avoid circular import at top

    mentee_profile, error = _require_mentee(request)
    if error:
        return error
    payload = _get_payload(request)
    mentee_profile.program = _get_str(payload, "program", mentee_profile.program)
    year_level = _get_int(payload, "year_level", mentee_profile.year_level)
    mentee_profile.year_level = year_level or mentee_profile.year_level
    mentee_profile.campus = _get_str(
        payload, "campus", getattr(mentee_profile, "campus", "")
    )
    raw_student_id = _get_str(
        payload, "student_id_no", getattr(mentee_profile, "student_id_no", "")
    )
    raw_contact = _get_str(
        payload, "contact_no", getattr(mentee_profile, "contact_no", "")
    )
    student_id_digits = "".join(c for c in raw_student_id if c.isdigit())[:10]
    contact_digits = "".join(c for c in raw_contact if c.isdigit())[:11]
    if raw_student_id and not student_id_digits:
        return JsonResponse(
            {"error": "Student ID must contain only numbers (max 10 digits)."},
            status=400,
        )
    if raw_contact and not contact_digits:
        return JsonResponse(
            {"error": "Contact number must contain only numbers (max 11 digits)."},
            status=400,
        )
    mentee_profile.student_id_no = student_id_digits
    mentee_profile.contact_no = contact_digits
    mentee_profile.admission_type = _get_str(
        payload, "admission_type", getattr(mentee_profile, "admission_type", "")
    )
    mentee_profile.sex = _get_str(
        payload, "sex", getattr(mentee_profile, "sex", "")
    )
    mentee_profile.save()
    _clear_me_cache(request.user.id)
    audit_log(request.user, "update", "mentee_profile", mentee_profile.id)

    return JsonResponse(
        {
            "program": mentee_profile.program,
            "year_level": mentee_profile.year_level,
            "campus": mentee_profile.campus,
            "student_id_no": mentee_profile.student_id_no,
            "contact_no": mentee_profile.contact_no,
            "admission_type": mentee_profile.admission_type,
            "sex": mentee_profile.sex,
        }
    )


@login_required
@require_http_methods(["POST"])
def update_mentee_matching_profile(request):
  from ..views import _require_mentee  # avoid circular import at top

  mentee_profile, error = _require_mentee(request)
  if error:
      return error
  payload = _get_payload(request)
  raw_subjects = payload.get("subjects")
  if raw_subjects is not None:
      mentee_profile.subjects = (
          list(raw_subjects) if isinstance(raw_subjects, list) else []
      )
  raw_topics = payload.get("topics")
  if raw_topics is not None:
      mentee_profile.topics = filter_topics_for_subjects(
          raw_subjects if isinstance(raw_subjects, list) else mentee_profile.subjects,
          raw_topics if isinstance(raw_topics, list) else [],
      )
  difficulty = _get_int(payload, "difficulty_level")
  if difficulty is not None and 1 <= difficulty <= 5:
      mentee_profile.difficulty_level = difficulty
  if "availability" in payload:
      mentee_profile.availability = _normalise_availability_slots(
          payload.get("availability")
      )
  mentee_profile.save()
  _clear_me_cache(request.user.id)
  audit_log(request.user, "update", "mentee_matching", mentee_profile.id)

  mentee_subs = (
      mentee_profile.subjects
      if isinstance(mentee_profile.subjects, list)
      else ([mentee_profile.subjects] if mentee_profile.subjects else [])
  )
  mentee_tops = (
      mentee_profile.topics
      if isinstance(mentee_profile.topics, list)
      else ([mentee_profile.topics] if mentee_profile.topics else [])
  )
  return JsonResponse(
      {
          "subjects": list(mentee_subs),
          "topics": list(mentee_tops),
          "difficulty_level": mentee_profile.difficulty_level,
          "availability": _normalise_availability_slots(
              getattr(mentee_profile, "availability", [])
          ),
      }
  )


@login_required
@require_http_methods(["POST"])
def update_mentor_profile(request):
    from ..views import _require_mentor

    mentor_profile, error = _require_mentor(request)
    if error:
        return error
    payload = _get_payload(request)
    raw_subjects = payload.get("subjects")
    if raw_subjects is not None:
        mentor_profile.subjects = (
            list(raw_subjects) if isinstance(raw_subjects, list) else []
        )
    raw_topics = payload.get("topics")
    if raw_topics is not None:
        mentor_profile.topics = filter_topics_for_subjects(
            raw_subjects if isinstance(raw_subjects, list) else mentor_profile.subjects,
            raw_topics if isinstance(raw_topics, list) else [],
        )
    expertise = _get_int(payload, "expertise_level")
    if expertise is not None and 1 <= expertise <= 5:
        mentor_profile.expertise_level = expertise
    capacity = _get_int(payload, "capacity", default=None, min_value=1)
    if capacity is not None:
        mentor_profile.capacity = capacity
    if "gender" in payload:
        mentor_profile.gender = _normalise_mentor_gender(
            payload.get("gender"),
            default=getattr(mentor_profile, "gender", ""),
        )
    if "availability" in payload:
        mentor_profile.availability = _normalise_availability_slots(
            payload.get("availability")
        )
    mentor_profile.save()
    _clear_me_cache(request.user.id)
    audit_log(request.user, "update", "mentor_profile", mentor_profile.id)

    mentor_subs = (
        mentor_profile.subjects
        if isinstance(mentor_profile.subjects, list)
        else ([mentor_profile.subjects] if mentor_profile.subjects else [])
    )
    mentor_tops = (
        mentor_profile.topics
        if isinstance(mentor_profile.topics, list)
        else ([mentor_profile.topics] if mentor_profile.topics else [])
    )
    return JsonResponse(
        {
            "program": mentor_profile.program,
            "year_level": mentor_profile.year_level,
            "role": mentor_profile.role,
            "subjects": list(mentor_subs),
            "topics": list(mentor_tops),
            "expertise_level": mentor_profile.expertise_level,
            "capacity": mentor_profile.capacity,
            "gender": getattr(mentor_profile, "gender", "") or "",
            "availability": _normalise_availability_slots(
                getattr(mentor_profile, "availability", [])
            ),
        }
    )


POPULAR_TAGS = [
    "Python", "JavaScript", "Web Dev", "UI/UX", "Data Science",
    "Machine Learning", "Java", "C++", "Mobile Dev", "React",
    "HTML/CSS", "Git", "Database", "Algorithms", "Networking",
    "Cloud Computing", "Cybersecurity", "Game Dev", "DevOps", "AI",
]
MAX_TAGS = 8


@login_required
@require_http_methods(["POST"])
def update_bio(request):
    payload = _get_payload(request)
    bio = (_get_str(payload, "bio") or "").strip()
    if len(bio) > 200:
        return JsonResponse({"error": "Bio must be 200 characters or less."}, status=400)

    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)
    if mentor:
        mentor.bio = bio
        mentor.save(update_fields=["bio"])
    elif mentee:
        mentee.bio = bio
        mentee.save(update_fields=["bio"])
    else:
        return JsonResponse({"error": "No profile found."}, status=404)

    _clear_me_cache(request.user.id)
    audit_log(request.user, "update", "bio", request.user.id)
    return JsonResponse({"bio": bio})


@login_required
@require_http_methods(["POST"])
def update_tags(request):
    payload = _get_payload(request)
    raw_tags = payload.get("tags")
    if not isinstance(raw_tags, list):
        return JsonResponse({"error": "tags must be a list of strings."}, status=400)

    tag_names = []
    seen = set()
    for t in raw_tags:
        name = str(t).strip()[:50]
        if not name:
            continue
        lower = name.lower()
        if lower in seen:
            continue
        seen.add(lower)
        tag_names.append(name)
        if len(tag_names) >= MAX_TAGS:
            break

    tag_objects = []
    for name in tag_names:
        tag, _ = InterestTag.objects.get_or_create(
            name__iexact=name,
            defaults={"name": name},
        )
        tag_objects.append(tag)

    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)
    if mentor:
        mentor.interest_tags.set(tag_objects)
    elif mentee:
        mentee.interest_tags.set(tag_objects)
    else:
        return JsonResponse({"error": "No profile found."}, status=404)

    _clear_me_cache(request.user.id)
    audit_log(request.user, "update", "interest_tags", request.user.id)
    return JsonResponse({"tags": [t.name for t in tag_objects]})


@login_required
@require_GET
def tag_suggestions(request):
    q = request.GET.get("q", "").strip().lower()
    if q:
        db_tags = list(
            InterestTag.objects.filter(name__icontains=q)
            .values_list("name", flat=True)[:20]
        )
        popular_matches = [t for t in POPULAR_TAGS if q in t.lower() and t not in db_tags]
        suggestions = db_tags + popular_matches
    else:
        suggestions = list(POPULAR_TAGS)
    return JsonResponse({"suggestions": suggestions[:20]})

