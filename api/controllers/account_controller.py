from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.mail import EmailMultiAlternatives
from django.http import JsonResponse
from django.core.cache import cache
from django.db import transaction
from django.views.decorators.http import require_GET, require_http_methods
from django.utils.crypto import constant_time_compare
import secrets
import time
import json

from django.utils import timezone

from matching.models import Competency, MenteeMentorRequest, UserTopicPreference
from profiles.models import (
    MentorProfile,
    MenteeProfile,
    InterestTag,
    MentorCompetency,
    MenteeCompetencyNeed,
    save_verification_documents,
)
from profiles.profile_completion import (
    INSTRUCTOR_ROLE,
    STUDENT_MENTOR_ROLE,
    compute_is_profile_complete,
    get_auth_provider,
    mark_profile_complete,
    mentee_account_fields_complete,
    mentor_account_fields_complete,
)

from accounts.email_utils import email_backend_can_send, send_activation_email
from accounts.forms import (
    AccountSettingsForm,
    RegisterForm,
    PasswordChangeCodeRequestForm,
    PasswordChangeCodeVerifyForm,
    PasswordChangeUpdateForm,
)
from accounts.models import (
    get_user_display_name,
    must_change_password,
    set_must_change_password,
    UserProfile,
    MentorDocument,
    get_user_profile,
)
from ..serializers import upload_to_cloudinary, OnboardingPreferenceSerializer
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
    revoke_refresh_payload,
    set_refresh_cookie,
    clear_refresh_cookie,
    read_refresh_token,
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
    _resolve_account_role,
    _client_ip,
    _rate_limit,
    audit_log,
    _require_role,
    _serialize_notification,
    _serialize_subject,
    _serialize_topic,
    _serialize_mentee,
    get_subjects_list,
    get_mentor_approved,
    get_mentee_approved,
    invalidate_approval_cache_mentor,
    invalidate_approval_cache_mentee,
    logger,
)
from matching.models import Notification, Subject, Topic
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from profiles.questionnaire_utils import filter_topics_for_subjects
ME_CACHE_TTL_SECONDS = 30
ME_CACHE_METRICS_LOG_EVERY = 100
STUDENT_MENTOR_ROLE = "Senior IT Student"
STUDENT_MENTOR_YEAR_LEVELS = (3, 4)


def _mentor_year_level_for_role(role, requested=None, current=None):
    if str(role or "").strip() != STUDENT_MENTOR_ROLE:
        return 4
    if requested in STUDENT_MENTOR_YEAR_LEVELS:
        return int(requested)
    if current in STUDENT_MENTOR_YEAR_LEVELS:
        return int(current)
    return 4


def _sync_user_topic_preferences(user, target, subjects, topics):
    selected_subjects = [str(s or "").strip() for s in (subjects or []) if str(s or "").strip()]
    selected_items = [str(t or "").strip() for t in (topics or []) if str(t or "").strip()]
    now = timezone.now()
    with transaction.atomic():
        UserTopicPreference.objects.filter(
            user=user,
            target=target,
            is_active_selection=True,
        ).update(is_active_selection=False, cleared_at=now)

        if not selected_subjects or not selected_items:
            return

        active_topics = (
            Topic.objects.select_related("subject")
            .filter(
                subject__name__in=selected_subjects,
                status=Topic.STATUS_ACTIVE,
            )
            .order_by("subject__name", "name", "id")
        )

        active_competencies = (
            Competency.objects.select_related("topic", "topic__subject")
            .filter(
                topic__subject__name__in=selected_subjects,
                name__in=selected_items,
            )
            .order_by("topic__subject__name", "topic__name", "name", "id")
        )

        by_name = {}
        for item in active_topics:
            by_name.setdefault(item.name, []).append(item)

        competency_by_name = {}
        for item in active_competencies:
            competency_by_name.setdefault(item.name, []).append(item)

        created_rows = []
        seen_topic_ids = set()
        for topic_name in selected_items:
            topic_options = by_name.get(topic_name) or []
            chosen = None
            if topic_options:
                chosen = topic_options[0]
                for candidate in topic_options:
                    if candidate.subject and candidate.subject.name in selected_subjects:
                        chosen = candidate
                        break
            else:
                competency_options = competency_by_name.get(topic_name) or []
                for competency in competency_options:
                    if competency.topic and competency.topic.subject and competency.topic.subject.name in selected_subjects:
                        chosen = competency.topic
                        break
            if not chosen or chosen.id in seen_topic_ids:
                continue
            seen_topic_ids.add(chosen.id)
            created_rows.append(
                UserTopicPreference(
                    user=user,
                    subject=chosen.subject,
                    topic=chosen,
                    target=target,
                    is_active_selection=True,
                ),
            )

        if created_rows:
            UserTopicPreference.objects.bulk_create(created_rows)
    cache.delete("matching:topic_support_map:v1")


def _me_cache_key(user_id):
    return f"api:me:v1:{user_id}"


def _clear_me_cache(user_id):
    cache.delete(_me_cache_key(user_id))


def _user_role(user):
    if getattr(user, "mentor_profile", None):
        return "mentor"
    if getattr(user, "mentee_profile", None):
        return "mentee"
    return "staff" if getattr(user, "is_staff", False) else None


def _user_is_onboarded(user):
    state = getattr(user, "security_state", None)
    if state is None:
        return compute_is_profile_complete(user)
    return bool(state.is_onboarded)


def _ensure_onboarding_state(user, is_onboarded=False):
    from accounts.models import get_user_security_state

    state = get_user_security_state(user, create=True)
    state.is_onboarded = bool(is_onboarded)
    state.save(update_fields=["is_onboarded"])
    return state


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
    if len(parts) < 2:
        return None
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except (TypeError, ValueError):
        return None
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return hour * 60 + minute


AVAILABILITY_DAY_ORDER = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
_AVAILABILITY_DAY_INDEX = {day.lower(): index for index, day in enumerate(AVAILABILITY_DAY_ORDER)}


def _parse_availability_days(value):
    """Map loose day tokens onto canonical Mon..Sun order."""
    found = set()
    for token in str(value or "").split("/"):
        key = token.strip().lower()[:3]
        index = _AVAILABILITY_DAY_INDEX.get(key)
        if index is not None:
            found.add(index)
    return [AVAILABILITY_DAY_ORDER[index] for index in sorted(found)]


def _normalise_availability_slots(value):
    """Canonicalise availability into "Mon/Wed|08:00-12:00" strings.

    A slot saved without a day prefix predates day selection and is kept
    as-is so existing profiles continue to match.
    """
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
    min_minutes = 7 * 60
    max_minutes = 22 * 60
    for raw in raw_slots:
        if not isinstance(raw, str):
            continue
        day_part, separator, time_part = raw.partition("|")
        if not separator:
            day_part, time_part = "", raw
        parts = time_part.split("-")
        if len(parts) != 2:
            continue
        start = _parse_hhmm_to_minutes(parts[0])
        end = _parse_hhmm_to_minutes(parts[1])
        if start is None or end is None or start >= end:
            continue
        if start < min_minutes or end > max_minutes:
            continue
        times = f"{start // 60:02d}:{start % 60:02d}-{end // 60:02d}:{end % 60:02d}"
        days = _parse_availability_days(day_part) if separator else []
        slot = f"{'/'.join(days)}|{times}" if days else times
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


def _normalise_level(value):
    try:
        level = int(value)
    except (TypeError, ValueError):
        return None
    if 1 <= level <= 5:
        return level
    return None


def _normalise_competency_level_payload(payload, level_key):
    if not isinstance(payload, list):
        return {}
    out = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            competency_id = int(item.get("competency_id"))
        except (TypeError, ValueError):
            continue
        level = _normalise_level(item.get(level_key))
        if competency_id > 0 and level is not None:
            out[competency_id] = level
    return out


def _normalise_topic_names_for_subjects(subject_names, topic_names):
    selected_subjects = [
        str(name or "").strip()
        for name in (subject_names or [])
        if str(name or "").strip()
    ]
    selected_topics = [
        str(name or "").strip()
        for name in (topic_names or [])
        if str(name or "").strip()
    ]
    if not selected_subjects or not selected_topics:
        return []
    valid_topics = (
        Topic.objects.filter(
            status=Topic.STATUS_ACTIVE,
            subject__name__in=selected_subjects,
            name__in=selected_topics,
        )
        .values_list("name", flat=True)
        .distinct()
    )
    valid_set = set(valid_topics)
    return [name for name in selected_topics if name in valid_set]


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

    # Run django-axes before the email/username backend so locked accounts are
    # rejected even when the submitted password is correct.
    user = authenticate(request, username=identifier, password=password)

    if not user:
        lockout_info = get_lockout_info(identifier, ip_address=client_ip)
        if lockout_info["is_locked"]:
            return create_lockout_response(identifier, ip_address=client_ip)

        logger.warning("auth_login_failed", extra={"identifier": identifier})
        return JsonResponse(
            {"error": "Invalid credentials."},
            status=401,
        )

    if not user.is_active:
        return JsonResponse(
            {"error": "Please verify your email before logging in."}, status=401
        )

    # Role is chosen only when creating an account; sign-in is role-neutral.

    if must_change_password(user):
        login(request, user, backend="accounts.auth_backends.EmailOrUsernameModelBackend")
        if hasattr(user, "mentor_profile"):
            request.session[ROLE_SESSION_KEY] = "mentor"
        elif hasattr(user, "mentee_profile"):
            request.session[ROLE_SESSION_KEY] = "mentee"
        reset_lockout_progress(
            identifier,
            user.username,
            user.email,
            ip_address=client_ip,
        )
        logger.info("auth_login_password_change_required", extra={"user_id": user.id})
        return JsonResponse(
            {
                "status": "password_change_required",
                "must_change_password": True,
                "message": "You must change your password before continuing.",
                "change_password_url": "/accounts/settings/?must_change_password=1",
            },
            status=403,
        )
    
    # Check if user's email is institutional
    from accounts.forms import is_institutional_email
    if not is_institutional_email(user.email):
        domains_str = ", ".join(getattr(settings, 'ALLOWED_EMAIL_DOMAINS', []))
        logger.warning("auth_login_non_institutional", extra={"user_id": user.id, "email": user.email})
        return JsonResponse(
            {"error": f"Login restricted to institutional accounts ({domains_str})."}, status=401
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

    # Successful authentication clears escalation progress.
    reset_lockout_progress(
        identifier,
        user.username,
        user.email,
        ip_address=client_ip,
    )

    logger.info("auth_login_success", extra={"user_id": user.id})
    _clear_me_cache(user.id)
    _ensure_onboarding_state(user, compute_is_profile_complete(user))
    refresh_token = issue_refresh_token(user)
    audit_log(user, "login", "auth")
    response = JsonResponse(
        {
            "status": "ok",
            "must_change_password": False,
            "access_token": issue_access_token(user),
            "user": {
                "id": user.id,
                "email": user.email,
                "role": _user_role(user),
                "is_onboarded": _user_is_onboarded(user),
            },
        }
    )
    set_refresh_cookie(response, refresh_token)
    return response


@require_http_methods(["POST"])
def auth_google(request):
    """Google OAuth login-only endpoint. Verifies Google token, finds existing user,
    issues PyJWT access/refresh tokens and returns profile data.
    If user does not exist, aborts with HTTP 401 and creates no record.
    """
    payload = _get_payload(request)
    google_token = (
        _get_str(payload, "credential")
        or _get_str(payload, "id_token")
        or _get_str(payload, "token")
        or _get_str(payload, "access_token")
    )
    email_override = _get_str(payload, "email")
    google_email = None

    if google_token:
        # 1. Try google.oauth2.id_token
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests
            id_info = google_id_token.verify_oauth2_token(
                google_token, google_requests.Request()
            )
            google_email = id_info.get("email")
        except Exception:
            # 2. Fallback to Google tokeninfo endpoint
            try:
                import requests
                resp = requests.get(
                    f"https://oauth2.googleapis.com/tokeninfo?id_token={google_token}",
                    timeout=5,
                )
                if resp.status_code == 200:
                    google_email = resp.json().get("email")
                else:
                    # 3. Fallback to userinfo endpoint (in case access_token was passed)
                    resp2 = requests.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {google_token}"},
                        timeout=5,
                    )
                    if resp2.status_code == 200:
                        google_email = resp2.json().get("email")
            except Exception as e:
                logger.warning("google_token_verification_failed", extra={"error": str(e)})

    # In test environments or when mock/test token with email is supplied
    import sys
    is_testing = (
        getattr(settings, "TESTING", False)
        or "test" in sys.argv
        or settings.DEBUG
        or (google_token and (google_token.startswith("mock-") or google_token.startswith("test-")))
    )
    if not google_email and is_testing and email_override:
        google_email = email_override

    if not google_email:
        return JsonResponse({"error": "Google token is invalid or expired."}, status=400)

    # Validate institutional email domain
    from django import forms
    from accounts.forms import validate_institutional_email
    try:
        validate_institutional_email(google_email)
    except forms.ValidationError as e:
        return JsonResponse({"error": str(e)}, status=400)

    # Database Lookup
    existing_user = User.objects.filter(email__iexact=google_email).first()

    # If User Does NOT Exist: Do NOT create a record. Return HTTP 401.
    if not existing_user:
        logger.warning(
            "google_login_unregistered_email", extra={"email": google_email}
        )
        return JsonResponse(
            {
                "error": "No account found with this email. Please complete the manual registration first."
            },
            status=401,
        )

    if not existing_user.is_active:
        return JsonResponse(
            {"error": "Please verify your email before logging in."}, status=401
        )

    user = existing_user
    login(request, user, backend="accounts.auth_backends.EmailOrUsernameModelBackend")

    is_mentor = hasattr(user, "mentor_profile")
    is_mentee = hasattr(user, "mentee_profile")
    if is_mentor:
        request.session[ROLE_SESSION_KEY] = "mentor"
    elif is_mentee:
        request.session[ROLE_SESSION_KEY] = "mentee"

    logger.info("auth_google_login_success", extra={"user_id": user.id, "email": user.email})
    _clear_me_cache(user.id)
    _ensure_onboarding_state(user, compute_is_profile_complete(user))
    refresh_token = issue_refresh_token(user)
    access_token = issue_access_token(user)
    audit_log(user, "login_google", "auth")

    profile = get_user_profile(user)
    response = JsonResponse(
        {
            "status": "ok",
            "must_change_password": False,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "username": user.username,
                "role": profile.role if profile else _user_role(user),
                "is_onboarded": profile.is_onboarded if profile else _user_is_onboarded(user),
                "approval_status": profile.approval_status if profile else "ACTIVE",
                "avatar_url": getattr(profile, "avatar_url", "") if profile else "",
            },
        }
    )
    set_refresh_cookie(response, refresh_token)
    return response


@require_http_methods(["POST"])
def auth_refresh(request):
    payload = _get_payload(request)
    refresh_token = read_refresh_token(request, _get_str(payload, "refresh_token"))
    if not refresh_token:
        return JsonResponse({"error": "Refresh token is required."}, status=400)

    decoded = decode_refresh_token(refresh_token)
    if not decoded:
        response = JsonResponse({"error": "Invalid or expired refresh token."}, status=401)
        clear_refresh_cookie(response)
        return response

    user_id = decoded.get("uid")
    try:
        from django.contrib.auth.models import User

        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({"error": "User not found."}, status=404)

    if not user.is_active:
        return JsonResponse({"error": "User account is inactive."}, status=401)

    login(request, user, backend="accounts.auth_backends.EmailOrUsernameModelBackend")
    rotate_refresh = bool(getattr(settings, "JWT_ROTATE_REFRESH_TOKENS", True))
    _ensure_onboarding_state(user, compute_is_profile_complete(user))
    response = JsonResponse({
        "status": "ok",
        "access_token": issue_access_token(user),
        "user": {
            "id": user.id,
            "email": user.email,
            "role": _user_role(user),
            "is_onboarded": _user_is_onboarded(user),
        },
    })
    if rotate_refresh:
        revoke_refresh_payload(decoded)
        set_refresh_cookie(response, issue_refresh_token(user))
    return response


@require_http_methods(["POST"])
def auth_logout(request):
    user = request.user if getattr(request.user, "is_authenticated", False) else None
    if user:
        _clear_me_cache(user.id)
        audit_log(user, "logout", "auth")
        logout(request)
    revoke_refresh_payload(decode_refresh_token(read_refresh_token(request)))
    response = JsonResponse({"status": "ok"})
    clear_refresh_cookie(response)
    return response


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
    if lockout_info["is_locked"]:
        return JsonResponse({
            "is_locked": True,
            "remaining_minutes": lockout_info.get("remaining_minutes"),
            "locked_until": lockout_info.get("locked_until"),
            "penalty_minutes": lockout_info.get("penalty_minutes"),
        })
    return JsonResponse({"is_locked": False})


@require_http_methods(["POST"])
def auth_register(request):
    try:
        content_type = (request.content_type or "").lower()
        if "multipart/form-data" in content_type:
            payload = request.POST
        else:
            payload = _get_payload(request)
        if not _rate_limit(f"register:{_client_ip(request)}", 5, 300):
            return JsonResponse(
                {"error": "Too many signups. Try again later."}, status=429
            )

        role = payload.get("role")
        from ..views import _validate_role  # avoid circular import at top

        if not _validate_role(role):
            return JsonResponse({"error": "Role is required."}, status=400)

        expected_role = (_get_str(payload, "expected_role") or "").lower()
        if expected_role in ("mentor", "mentee") and role != expected_role:
            return JsonResponse(
                {
                    "error": (
                        f"Sign up must create a {expected_role} account. "
                        "Return to the portal and choose the correct role."
                    ),
                },
                status=400,
            )

        form = RegisterForm(payload, request.FILES)
        if not form.is_valid():
            return JsonResponse({"errors": form.errors}, status=400)
        if not email_backend_can_send():
            return JsonResponse(
                {
                    "error": (
                        "Account could not be created because the server cannot send "
                        "the activation email. Please try again later."
                    ),
                },
                status=503,
            )

        cleaned = form.cleaned_data
        first_name = (cleaned.get("first_name") or "").strip()
        middle_name = cleaned.get("middle_name", "")
        last_name = (cleaned.get("last_name") or "").strip()
        email = (cleaned.get("email") or "").strip()
        password = cleaned.get("password1") or ""
        files_by_kind = cleaned.get("verification_files_by_kind") or {}
        missing = {}
        if not first_name:
            missing["first_name"] = ["First name is required."]
        if not last_name:
            missing["last_name"] = ["Last name is required."]
        if not email:
            missing["email"] = ["Email is required."]
        if not password:
            missing["password1"] = ["Password is required."]
        if not cleaned.get("password2"):
            missing["password2"] = ["Confirm password is required."]
        if missing:
            return JsonResponse({"errors": missing}, status=400)
        base_username = "".join(part for part in [first_name, last_name] if part)
        base_username = "".join(ch for ch in base_username.lower() if ch.isalnum())
        if not base_username:
            base_username = email.split("@")[0].lower()
        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}{suffix}"

        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
            user.is_active = False
            user.save(update_fields=["is_active"])
        except Exception as exc:
            logger.exception("auth_register_user_create_failed", extra={"email": email, "role": role})
            return JsonResponse(
                {
                    "error": "Unable to create account at the moment. Please try again.",
                    "detail": str(exc),
                },
                status=400,
            )

        try:
            if role == "mentor":
                mentor_role = (
                    _get_str(payload, "mentor_role")
                    or _get_str(payload, "mentor_type")
                    or cleaned.get("mentor_role", "")
                )
                if mentor_role not in ("Senior IT Student", "Instructor"):
                    user.delete()
                    return JsonResponse(
                        {
                            "error": (
                                "Select whether you are signing up as a "
                                "student mentor or an instructor."
                            ),
                        },
                        status=400,
                    )
                requested_year = cleaned.get("year_level")
                if requested_year not in STUDENT_MENTOR_YEAR_LEVELS:
                    requested_year = _get_int(payload, "year_level")
                if (
                    mentor_role == STUDENT_MENTOR_ROLE
                    and requested_year not in STUDENT_MENTOR_YEAR_LEVELS
                ):
                    user.delete()
                    return JsonResponse(
                        {
                            "error": (
                                "Select whether you are a 3rd year or "
                                "4th year student mentor."
                            ),
                        },
                        status=400,
                    )
                year_level = _mentor_year_level_for_role(
                    mentor_role,
                    requested_year,
                )
                mentor = MentorProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=year_level,
                    role=mentor_role,
                    capacity=5,
                    gender=_normalise_mentor_gender(
                        cleaned.get("gender") or _get_str(payload, "gender"),
                        default="",
                    ),
                    approved=False,
                )
                save_verification_documents(
                    mentor=mentor,
                    files_by_kind=files_by_kind,
                )
            else:
                mentee = MenteeProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=1,
                    campus="",
                    student_id_no="",
                    contact_no="",
                    admission_type="",
                    sex="",
                    approved=False,
                )
                save_verification_documents(
                    mentee=mentee,
                    files_by_kind=files_by_kind,
                )
        except Exception as exc:
            logger.exception("auth_register_profile_create_failed", extra={"email": email, "role": role})
            user.delete()
            return JsonResponse(
                {
                    "error": "Unable to save your verification documents. Please upload valid PDF, JPG, or PNG files and try again.",
                    "detail": str(exc),
                },
                status=400,
            )

        try:
            send_activation_email(request, user)
        except Exception as exc:
            logger.exception("auth_register_email_phase_failed", extra={"user_id": user.id, "email": user.email})
            user.delete()
            return JsonResponse(
                {
                    "error": "Account could not be created because activation email could not be sent. Please try again.",
                    "detail": str(exc),
                },
                status=503,
            )

        audit_log(user, "register", "auth", user.id)
        logger.info("auth_register", extra={"user_id": user.id, "role": role})
        return JsonResponse(
            {
                "status": "ok",
                "message": "Check your email to activate your account.",
            }
        )
    except Exception as exc:
        logger.exception("auth_register_unhandled_error")
        return JsonResponse(
            {
                "error": "Unable to create account right now. Please try again.",
                "detail": str(exc),
            },
            status=400,
        )


@require_http_methods(["POST"])
def unified_auth_register(request):
    if not _rate_limit(f"register:{_client_ip(request)}", 10, 300):
        return JsonResponse({"error": "Too many signups. Try again later."}, status=429)

    is_multipart = "multipart/form-data" in (request.content_type or "").lower()
    payload = request.POST if is_multipart else _get_payload(request)
    files = getattr(request, "FILES", {})

    display_name = (_get_str(payload, "display_name") or _get_str(payload, "full_name") or "").strip()
    first_name_input = (_get_str(payload, "first_name") or "").strip()
    last_name_input = (_get_str(payload, "last_name") or "").strip()
    if not display_name and (first_name_input or last_name_input):
        display_name = f"{first_name_input} {last_name_input}".strip()

    email = (_get_str(payload, "email") or "").strip().lower()
    password = _get_str(payload, "password") or _get_str(payload, "password1")
    confirm_password = _get_str(payload, "confirm_password") or _get_str(payload, "password2")

    # Role normalization
    raw_role = (_get_str(payload, "role") or "MENTEE").strip().upper()
    mentor_type = (_get_str(payload, "mentor_role") or _get_str(payload, "mentor_type") or "").strip()

    if raw_role in ("STUDENT_MENTOR", "INSTRUCTOR_MENTOR", "COORDINATOR", "MENTEE"):
        role = raw_role
    elif raw_role == "MENTOR":
        if "INSTRUCTOR" in mentor_type.upper() or (email.endswith("@buksu.edu.ph") and not email.endswith("@student.buksu.edu.ph")):
            role = UserProfile.ROLE_INSTRUCTOR_MENTOR
        else:
            role = UserProfile.ROLE_STUDENT_MENTOR
    else:
        role = UserProfile.ROLE_MENTEE

    campus = (_get_str(payload, "campus") or "Main").strip()
    program = (_get_str(payload, "program") or "BSIT").strip()
    raw_year = _get_int(payload, "year_level")
    if raw_year is None:
        year_level = 1 if role == UserProfile.ROLE_MENTEE else (4 if role == UserProfile.ROLE_INSTRUCTOR_MENTOR else 3)
    else:
        year_level = raw_year

    errors = {}
    if not display_name:
        errors["display_name"] = ["Full name is required."]
    if not email:
        errors["email"] = ["Institutional email is required."]
    else:
        student_domain = "@student.buksu.edu.ph"
        faculty_domain = "@buksu.edu.ph"
        if role in (UserProfile.ROLE_MENTEE, UserProfile.ROLE_STUDENT_MENTOR):
            if not email.endswith(student_domain):
                errors["email"] = [f"Students must use an institutional email ending with {student_domain}."]
        elif role in (UserProfile.ROLE_INSTRUCTOR_MENTOR, UserProfile.ROLE_COORDINATOR):
            if not email.endswith(faculty_domain) or email.endswith(student_domain):
                errors["email"] = [f"Instructors and Coordinators must use an institutional email ending with {faculty_domain}."]

        if User.objects.filter(email__iexact=email).exists():
            errors["email"] = ["An account with this email already exists."]

    if not password:
        errors["password"] = ["Password is required."]
    elif confirm_password and password != confirm_password:
        errors["confirm_password"] = ["Passwords do not match."]
    if password:
        from django.contrib.auth.password_validation import validate_password
        try:
            validate_password(password)
        except Exception as exc:
            errors["password"] = list(getattr(exc, "messages", [str(exc)]))

    # Required files verification
    if role == UserProfile.ROLE_STUDENT_MENTOR:
        missing_docs = []
        if not files.get("letter_of_intent"):
            missing_docs.append("Letter of Intent")
        if not files.get("study_load"):
            missing_docs.append("Study Load")
        if not files.get("grades") and not files.get("grade"):
            missing_docs.append("Grades")
        if missing_docs:
            errors["documents"] = [f"Student Mentors must upload: {', '.join(missing_docs)}."]
    elif role == UserProfile.ROLE_INSTRUCTOR_MENTOR:
        if not files.get("faculty_verification") and not files.get("verification_document") and not files.get("student_verification_document"):
            errors["documents"] = ["Faculty Verification document is required for Instructor Mentors."]

    if errors:
        return JsonResponse({"errors": errors, "error": next(iter(errors.values()))[0]}, status=400)

    name_parts = display_name.split()
    first_name = first_name_input or (name_parts[0] if name_parts else "")
    last_name = last_name_input or (" ".join(name_parts[1:]) if len(name_parts) > 1 else "")
    base_username = "".join(ch for ch in display_name.lower() if ch.isalnum()) or email.split("@", 1)[0]
    username = base_username[:150]
    suffix = 1
    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base_username[:150 - len(str(suffix))]}{suffix}"

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_staff=(role == UserProfile.ROLE_COORDINATOR),
            )

            # Determine initial approval status
            if role in (UserProfile.ROLE_STUDENT_MENTOR, UserProfile.ROLE_INSTRUCTOR_MENTOR):
                approval_status = UserProfile.STATUS_PENDING_APPROVAL
            else:
                approval_status = UserProfile.STATUS_ACTIVE

            user_profile = UserProfile.objects.create(
                user=user,
                role=role,
                approval_status=approval_status,
                is_onboarded=False,
                campus=campus,
                program=program,
                year_level=year_level,
            )

            # Create legacy MentorProfile / MenteeProfile for matching compatibility
            is_mentor = role in (UserProfile.ROLE_STUDENT_MENTOR, UserProfile.ROLE_INSTRUCTOR_MENTOR)
            if is_mentor:
                MentorProfile.objects.create(
                    user=user,
                    program=program,
                    year_level=year_level,
                    role="Instructor" if role == UserProfile.ROLE_INSTRUCTOR_MENTOR else "Senior IT Student",
                    approved=False,
                    is_profile_complete=False,
                )
            elif role == UserProfile.ROLE_MENTEE:
                MenteeProfile.objects.create(
                    user=user,
                    program=program,
                    year_level=1,
                    campus=campus,
                    approved=True,  # Mentees are ACTIVE immediately
                    is_profile_complete=False,
                )

            _ensure_onboarding_state(user, False)

            # Cloudinary Document Uploads
            uploaded_docs = []
            doc_mapping = {
                "letter_of_intent": MentorDocument.DOC_LETTER_OF_INTENT,
                "study_load": MentorDocument.DOC_STUDY_LOAD,
                "grades": MentorDocument.DOC_GRADES,
                "grade": MentorDocument.DOC_GRADES,
                "faculty_verification": MentorDocument.DOC_FACULTY_VERIFICATION,
                "verification_document": MentorDocument.DOC_FACULTY_VERIFICATION if role == UserProfile.ROLE_INSTRUCTOR_MENTOR else MentorDocument.DOC_STUDY_LOAD,
                "student_verification_document": MentorDocument.DOC_FACULTY_VERIFICATION if role == UserProfile.ROLE_INSTRUCTOR_MENTOR else MentorDocument.DOC_STUDY_LOAD,
            }

            for file_key, doc_type in doc_mapping.items():
                uploaded_file = files.get(file_key)
                if uploaded_file:
                    upload_res = upload_to_cloudinary(uploaded_file, folder=f"peerlink/mentor_documents/{user.id}")
                    doc = MentorDocument.objects.create(
                        user=user,
                        document_type=doc_type,
                        cloudinary_url=upload_res.get("url", ""),
                        cloudinary_public_id=upload_res.get("public_id", ""),
                    )
                    uploaded_docs.append(doc)

    except Exception:
        logger.exception("unified_auth_register_failed", extra={"email": email})
        return JsonResponse({"error": "Unable to create your account right now. Please try again."}, status=400)

    login(request, user, backend="accounts.auth_backends.EmailOrUsernameModelBackend")
    audit_log(user, "register", "auth", user.id)

    access_token = issue_access_token(user)
    refresh_token = issue_refresh_token(user)

    response = JsonResponse({
        "status": "ok",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "user_id": user.id,
            "email": user.email,
            "role": user_profile.role,
            "approval_status": user_profile.approval_status,
            "is_onboarded": False,
            "full_name": get_user_display_name(user),
        },
        "approval_status": user_profile.approval_status,
        "documents_uploaded": len(uploaded_docs),
    }, status=201)
    set_refresh_cookie(response, refresh_token)
    return response


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

    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)

    total_mentors = MentorProfile.objects.count()
    total_mentees = MenteeProfile.objects.count()
    accepted_pairings = MenteeMentorRequest.objects.filter(accepted=True).count()

    user_prof = getattr(request.user, "profile", None)

    avatar_url = ""
    if mentor and getattr(mentor, "avatar_url", ""):
        avatar_url = mentor.avatar_url
    elif mentee and getattr(mentee, "avatar_url", ""):
        avatar_url = mentee.avatar_url
    elif user_prof and getattr(user_prof, "avatar_url", ""):
        avatar_url = user_prof.avatar_url

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
    elif user_prof and getattr(user_prof, "bio", ""):
        bio = user_prof.bio

    tags = []
    if mentor:
        tags = list(mentor.interest_tags.values_list("name", flat=True))
    elif mentee:
        tags = list(mentee.interest_tags.values_list("name", flat=True))
    elif user_prof:
        tags = list(user_prof.interest_tags.values_list("name", flat=True))

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
            "is_profile_complete": bool(
                getattr(mentee, "is_profile_complete", False)
                or mentee_account_fields_complete(mentee)
            ),
        }
    mentee_general_info_completed = bool(
        mentee
        and mentee.program
        and mentee.year_level
        and getattr(mentee, "campus", "")
        and getattr(mentee, "student_id_no", "")
        and getattr(mentee, "contact_no", "")
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
        mentor_competencies = list(
            mentor.competencies.values_list("id", flat=True)
        )
        mentor_competency_levels = {
            item.competency_id: int(item.proficiency_level)
            for item in mentor.competency_levels.all()
        }
        mentor_info = {
            "program": mentor.program or "",
            "year_level": mentor.year_level or 0,
            "student_id_no": getattr(mentor, "student_id_no", "") or "",
            "is_profile_complete": bool(
                getattr(mentor, "is_profile_complete", False)
                or mentor_account_fields_complete(mentor)
            ),
            "role": mentor.role or "",
            "subjects": list(mentor_subs) if mentor_subs else [],
            "topics": list(mentor_tops) if mentor_tops else [],
            "competency_ids": mentor_competencies,
            "competency_levels": mentor_competency_levels,
            "expertise_level": mentor.expertise_level,
            "years_experience": getattr(mentor, "years_experience", None),
            "teaching_experience_years": getattr(mentor, "teaching_experience_years", None),
            "capacity": getattr(mentor, "capacity", 1),
            "gender": getattr(mentor, "gender", "") or "",
            "availability": _normalise_availability_slots(
                getattr(mentor, "availability", [])
            ),
        }

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
        mentee_competencies = list(
            mentee.competencies.values_list("id", flat=True)
        )
        mentee_competency_needs = {
            item.competency_id: int(item.need_level)
            for item in mentee.competency_needs.all()
        }
        mentee_matching = {
            "subjects": list(mentee_subs) if mentee_subs else [],
            "topics": list(mentee_tops) if mentee_tops else [],
            "competency_ids": mentee_competencies,
            "competency_needs": mentee_competency_needs,
            "difficulty_level": mentee.difficulty_level,
            "preferred_learning_style": getattr(mentee, "preferred_learning_style", "") or "",
            "availability": _normalise_availability_slots(
                getattr(mentee, "availability", [])
            ),
        }

    response_payload = {
        "access_token": issue_access_token(request.user),
        "id": request.user.id,
        "username": request.user.username,
        "email": request.user.email,
        "first_name": request.user.first_name or "",
        "middle_name": "",
        "last_name": request.user.last_name or "",
        "full_name": get_user_display_name(request.user),
        "display_name": get_user_display_name(request.user),
        "is_onboarded": _user_is_onboarded(request.user),
        "is_staff": request.user.is_staff,
        "must_change_password": must_change_password(request.user),
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
        "mentor_role_locked": bool(get_mentor_approved(mentor)) if mentor else False,
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
        "is_profile_complete": compute_is_profile_complete(request.user),
        "auth_provider": get_auth_provider(request.user),
        "mentor_info": mentor_info,
        "mentee_matching": mentee_matching,
        "stats": {
            "total_mentors": total_mentors,
            "total_mentees": total_mentees,
            "accepted_pairings": accepted_pairings,
            "user_progress": {
                "role": "mentor"
                if role_flags["is_mentor"]
                else "mentee"
                if role_flags["is_mentee"]
                else None,
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
    set_must_change_password(request.user, False)
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
        user_prof = getattr(request.user, "profile", None)
        if mentor:
            mentor.avatar_url = url
            mentor.save(update_fields=["avatar_url"])
        if mentee:
            mentee.avatar_url = url
            mentee.save(update_fields=["avatar_url"])
        if user_prof:
            user_prof.avatar_url = url
            user_prof.save(update_fields=["avatar_url"])

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
    if mentee_account_fields_complete(mentee_profile):
        mark_profile_complete(mentee_profile, True)
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
            "is_profile_complete": compute_is_profile_complete(request.user),
        }
    )


def _normalize_student_id(raw):
    cleaned = "".join(
        ch for ch in str(raw or "") if ch.isalnum() or ch in "-/"
    ).strip()
    return cleaned[:20]


def _normalize_interest_names(raw_tags):
    names = []
    seen = set()
    for item in raw_tags if isinstance(raw_tags, list) else []:
        name = str(item).strip()[:50]
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        names.append(name)
        if len(names) >= MAX_TAGS:
            break
    return names


def _set_interest_tags(profile, names):
    tag_objects = []
    for name in names:
        tag = InterestTag.objects.filter(name__iexact=name).first()
        if tag is None:
            tag = InterestTag.objects.create(name=name)
        tag_objects.append(tag)
    profile.interest_tags.set(tag_objects)
    profile.interests = ", ".join(names)
    profile.save(update_fields=["interests"])
    return [tag.name for tag in tag_objects]


@login_required
@require_http_methods(["POST"])
def complete_onboarding(request):
    payload = _get_payload(request)
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
    if not metadata and isinstance(payload.get("metadata"), str):
        try:
            metadata = json.loads(payload.get("metadata"))
        except Exception:
            metadata = {}

    val_payload = dict(payload)
    if "subjects" not in val_payload and "subjects" in metadata:
        val_payload["subjects"] = metadata["subjects"]
    if "topics" not in val_payload and "topics" in metadata:
        val_payload["topics"] = metadata["topics"]
    if "competencies" not in val_payload and "competencies" in metadata:
        val_payload["competencies"] = metadata["competencies"]
    if "competency_ids" not in val_payload and "competency_ids" in metadata:
        val_payload["competency_ids"] = metadata["competency_ids"]
    if "skills" not in val_payload and "skills" in metadata:
        val_payload["skills"] = metadata["skills"]
    if "availability_slots" not in val_payload and "availability_slots" in metadata:
        val_payload["availability_slots"] = metadata["availability_slots"]
    if "availability" not in val_payload and "availability" in metadata:
        val_payload["availability"] = metadata["availability"]

    # Validate against strict role-based min-max bounds and hierarchy integrity
    serializer = OnboardingPreferenceSerializer(data=val_payload, context={"request": request})
    if not serializer.is_valid():
        first_field = next(iter(serializer.errors))
        first_err = serializer.errors[first_field]
        if isinstance(first_err, list) and first_err:
            msg = str(first_err[0])
        elif isinstance(first_err, dict):
            sub_k = next(iter(first_err))
            sub_val = first_err[sub_k]
            msg = str(sub_val[0]) if isinstance(sub_val, list) and sub_val else str(sub_val)
        else:
            msg = str(first_err)
        return JsonResponse({
            "error": msg,
            "detail": msg,
            "errors": serializer.errors,
        }, status=400)

    validated = serializer.validated_data
    subjects = validated["subject_names"]
    topics = validated["topic_names"]
    competency_objs = validated["resolved_competencies"]
    competency_ids = validated["competency_ids"]
    raw_availability = validated["availability_slots"]
    support_need = validated.get("support_need", 3)

    if isinstance(raw_availability, list):
        norm_slots = []
        for s in raw_availability:
            if isinstance(s, dict):
                d = str(s.get("day", "")).strip()[:3]
                start = str(s.get("start_time", "09:00")).strip()
                end = str(s.get("end_time", "11:00")).strip()
                if d:
                    norm_slots.append(f"{d}|{start}-{end}")
                else:
                    norm_slots.append(f"{start}-{end}")
            elif isinstance(s, str):
                norm_slots.append(s)
        availability = _normalise_availability_slots(norm_slots)
    else:
        availability = []

    # Optional avatar/photo upload handling
    image_url = ""
    upload = request.FILES.get("profile_photo") or request.FILES.get("institutional_id")
    if upload and upload.size <= 5 * 1024 * 1024:
        extension = (upload.name.rsplit(".", 1)[-1] if "." in upload.name else "").lower()
        if extension in {"png", "jpg", "jpeg"}:
            try:
                from django.core.files.storage import default_storage
                from django.core.files.base import ContentFile
                import uuid
                path = default_storage.save(
                    f"avatars/onboarding_{request.user.id}_{uuid.uuid4().hex}.{extension}",
                    ContentFile(upload.read()),
                )
                image_url = default_storage.url(path)
            except Exception:
                pass

    user_profile = get_user_profile(request.user)
    profile = getattr(request.user, "mentor_profile", None) or getattr(request.user, "mentee_profile", None)
    
    if profile is None:
        is_mentor = user_profile.role in ("STUDENT_MENTOR", "INSTRUCTOR_MENTOR")
        if is_mentor:
            profile = MentorProfile.objects.create(
                user=request.user,
                program=user_profile.program or "BSIT",
                year_level=user_profile.year_level or 3,
                role="Instructor" if user_profile.role == "INSTRUCTOR_MENTOR" else "Senior IT Student",
            )
        else:
            profile = MenteeProfile.objects.create(
                user=request.user,
                program=user_profile.program or "BSIT",
                year_level=user_profile.year_level or 1,
                campus=user_profile.campus or "Main",
            )

    year_level = int(metadata.get("year_level") or payload.get("year_level") or user_profile.year_level or 1)
    is_faculty = request.user.email.lower().endswith("@buksu.edu.ph") or user_profile.role == "INSTRUCTOR_MENTOR"

    if isinstance(profile, MentorProfile):
        profile.year_level = 4 if is_faculty else (year_level if year_level in (3, 4) else 3)
        profile.role = "Instructor" if is_faculty else "Senior IT Student"
        if image_url:
            profile.avatar_url = image_url
        profile.availability = availability
        profile.subjects = subjects
        profile.skills = topics
        profile.topics = topics
        profile.expertise_level = support_need
        profile.approved = True
        profile.save()
        if competency_objs:
            profile.competencies.set(competency_objs)
            for comp in competency_objs:
                MentorCompetency.objects.update_or_create(
                    mentor=profile,
                    competency=comp,
                    defaults={"proficiency_level": support_need},
                )
        _sync_user_topic_preferences(request.user, "teach", subjects, topics)
        invalidate_approval_cache_mentor(profile.id)
    else:
        profile.year_level = year_level
        profile.campus = str(metadata.get("campus") or payload.get("campus") or user_profile.campus or "Main").strip()[:100]
        contact_no = str(metadata.get("contact_no") or payload.get("contact_no") or "").strip()[:11]
        if contact_no:
            profile.contact_no = contact_no
        if image_url:
            profile.avatar_url = image_url
        profile.availability = availability
        profile.subjects = subjects
        profile.skills = topics
        profile.topics = topics
        profile.difficulty_level = support_need
        profile.approved = True
        profile.save()
        if competency_objs:
            profile.competencies.set(competency_objs)
            for comp in competency_objs:
                MenteeCompetencyNeed.objects.update_or_create(
                    mentee=profile,
                    competency=comp,
                    defaults={"need_level": support_need},
                )
        _sync_user_topic_preferences(request.user, "support", subjects, topics)
        invalidate_approval_cache_mentee(profile.id)

    user_profile.is_onboarded = True
    user_profile.approval_status = "ACTIVE"
    user_profile.save(update_fields=["is_onboarded", "approval_status"])
    mark_profile_complete(profile, True)
    _ensure_onboarding_state(request.user, True)
    _clear_me_cache(request.user.id)
    audit_log(request.user, "update", "complete_onboarding", request.user.id)
    return JsonResponse({
        "status": "ok",
        "user": {
            "id": request.user.id,
            "email": request.user.email,
            "role": _user_role(request.user),
            "is_onboarded": True,
            "is_profile_complete": True,
            "mentee_approved": True if not isinstance(profile, MentorProfile) else False,
            "mentor_approved": True if isinstance(profile, MentorProfile) else False,
            "approval_status": "ACTIVE",
            "avatar_url": image_url or getattr(profile, "avatar_url", ""),
        },
    })


@login_required
@require_http_methods(["POST"])
def complete_profile(request):
    """Finish required account details after Google (or any) first-time signup."""
    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)
    if not mentor and not mentee:
        return JsonResponse({"error": "No profile found."}, status=404)

    payload = _get_payload(request)
    errors = {}
    program = (_get_str(payload, "program") or "").strip()
    student_id = _normalize_student_id(
        _get_str(payload, "student_id_no") or payload.get("institutional_id")
    )
    year_level = _get_int(payload, "year_level", default=None)
    interests = _normalize_interest_names(
        payload.get("interests") or payload.get("tags")
    )
    track = (_get_str(payload, "track") or _get_str(payload, "role_track") or "").strip().lower()

    if not mentee and not program:
        errors["program"] = "Select your department or program."
    if not student_id:
        errors["student_id_no"] = "Enter your institutional or student ID."
    if not interests:
        errors["interests"] = "Select at least one mentoring interest."

    if mentee:
        campus = (_get_str(payload, "campus") or "").strip()
        contact = "".join(ch for ch in (_get_str(payload, "contact_no") or "") if ch.isdigit())[:11]
        sex = (_get_str(payload, "sex") or "").strip()
        if not campus:
            errors["campus"] = "Select your campus."
        if len(contact) < 11:
            errors["contact_no"] = "Enter an 11-digit contact number."
        if sex not in ("male", "female"):
            errors["sex"] = "Select your sex."
        if errors:
            return JsonResponse({"error": "Please complete the required fields.", "errors": errors}, status=400)
        mentee.program = "BSIT"
        mentee.year_level = 1
        mentee.student_id_no = student_id
        mentee.campus = campus
        mentee.contact_no = contact
        mentee.admission_type = mentee.admission_type or "regular"
        mentee.sex = sex
        mentee.save()
        tags = _set_interest_tags(mentee, interests)
        mark_profile_complete(mentee, True)
        _clear_me_cache(request.user.id)
        audit_log(request.user, "update", "complete_profile", mentee.id)
        return JsonResponse(
            {
                "is_profile_complete": True,
                "role": "mentee",
                "tags": tags,
                "mentee_info": {
                    "program": mentee.program,
                    "year_level": mentee.year_level,
                    "campus": mentee.campus,
                    "student_id_no": mentee.student_id_no,
                    "contact_no": mentee.contact_no,
                    "admission_type": mentee.admission_type,
                    "sex": mentee.sex,
                },
            }
        )

    role = (
        INSTRUCTOR_ROLE
        if track in ("faculty", "instructor")
        else STUDENT_MENTOR_ROLE
        if track in ("student", "senior it student")
        else (_get_str(payload, "role") or mentor.role or "").strip()
    )
    if role not in (STUDENT_MENTOR_ROLE, INSTRUCTOR_ROLE):
        errors["track"] = "Choose Student or Faculty / Instructor."
    if role == STUDENT_MENTOR_ROLE and year_level not in (1, 2, 3, 4):
        errors["year_level"] = "Select your year level."
    if errors:
        return JsonResponse({"error": "Please complete the required fields.", "errors": errors}, status=400)
    mentor.program = program
    mentor.student_id_no = student_id
    mentor.role = role
    mentor.year_level = 4 if role == INSTRUCTOR_ROLE else year_level
    mentor.save()
    tags = _set_interest_tags(mentor, interests)
    mark_profile_complete(mentor, True)
    _clear_me_cache(request.user.id)
    audit_log(request.user, "update", "complete_profile", mentor.id)
    return JsonResponse(
        {
            "is_profile_complete": True,
            "role": "mentor",
            "tags": tags,
            "mentor_info": {
                "program": mentor.program,
                "year_level": mentor.year_level,
                "student_id_no": mentor.student_id_no,
                "role": mentor.role,
            },
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
      mentee_profile.topics = list(raw_topics) if isinstance(raw_topics, list) else []
  raw_competency_ids = payload.get("competency_ids")
  competency_ids = []
  if raw_competency_ids is not None:
      if isinstance(raw_competency_ids, list):
          for item in raw_competency_ids:
              try:
                  candidate_id = int(item)
              except (TypeError, ValueError):
                  continue
              if candidate_id > 0:
                  competency_ids.append(candidate_id)
  # Topics must stay topic names; do not overwrite them with competency names.
  selected_subjects = (
      mentee_profile.subjects if isinstance(mentee_profile.subjects, list) else []
  )
  selected_topics = (
      mentee_profile.topics if isinstance(mentee_profile.topics, list) else []
  )
  mentee_profile.topics = _normalise_topic_names_for_subjects(
      selected_subjects,
      selected_topics,
  )
  difficulty = _get_int(payload, "difficulty_level")
  if difficulty is not None and 1 <= difficulty <= 5:
      mentee_profile.difficulty_level = difficulty
  if "availability" in payload:
      mentee_profile.availability = _normalise_availability_slots(
          payload.get("availability")
      )
  if "preferred_learning_style" in payload:
      mentee_profile.preferred_learning_style = _get_str(
          payload,
          "preferred_learning_style",
          getattr(mentee_profile, "preferred_learning_style", ""),
      )
  mentee_profile.save()
  if raw_competency_ids is not None:
      mentee_profile.competencies.set(
          Competency.objects.filter(id__in=competency_ids)
      )
  raw_competency_needs = payload.get("competency_needs")
  competency_need_map = _normalise_competency_level_payload(
      raw_competency_needs,
      "need_level",
  )
  if isinstance(raw_competency_needs, list):
      MenteeCompetencyNeed.objects.filter(mentee=mentee_profile).exclude(
          competency_id__in=competency_ids
      ).delete()
      for competency_id, need_level in competency_need_map.items():
          if competency_id not in competency_ids:
              continue
          MenteeCompetencyNeed.objects.update_or_create(
              mentee=mentee_profile,
              competency_id=competency_id,
              defaults={"need_level": need_level},
          )
  elif raw_competency_ids is not None:
      fallback_need = _normalise_level(mentee_profile.difficulty_level) or 3
      for competency_id in competency_ids:
          MenteeCompetencyNeed.objects.update_or_create(
              mentee=mentee_profile,
              competency_id=competency_id,
              defaults={"need_level": fallback_need},
          )
  _sync_user_topic_preferences(
      request.user,
      UserTopicPreference.TARGET_MENTEE,
      mentee_profile.subjects if isinstance(mentee_profile.subjects, list) else [],
      mentee_profile.topics if isinstance(mentee_profile.topics, list) else [],
  )
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
          "competency_ids": list(
              mentee_profile.competencies.values_list("id", flat=True)
          ),
          "difficulty_level": mentee_profile.difficulty_level,
          "competency_needs": {
              item.competency_id: int(item.need_level)
              for item in mentee_profile.competency_needs.all()
          },
          "preferred_learning_style": getattr(mentee_profile, "preferred_learning_style", "") or "",
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
        mentor_profile.topics = list(raw_topics) if isinstance(raw_topics, list) else []
    expertise = _get_int(payload, "expertise_level")
    if expertise is not None and 1 <= expertise <= 5:
        mentor_profile.expertise_level = expertise
    mentor_profile.capacity = 5
    role_locked = bool(getattr(mentor_profile, "approved", False)) and not request.user.is_staff
    if "program" in payload:
        mentor_profile.program = _get_str(payload, "program", mentor_profile.program)
    if "student_id_no" in payload:
        mentor_profile.student_id_no = "".join(
            ch
            for ch in (_get_str(payload, "student_id_no") or "")
            if ch.isalnum() or ch in "-/"
        )[:20]
    requested_role = _get_str(payload, "role", mentor_profile.role or "")
    current_role = str(getattr(mentor_profile, "role", "") or "").strip()
    attempted_locked_role_change = False
    if "role" in payload:
        if role_locked and requested_role != current_role:
            attempted_locked_role_change = True
            mentor_profile.role = current_role
        else:
            mentor_profile.role = requested_role

    if "gender" in payload:
        current_gender = _normalise_mentor_gender(
            getattr(mentor_profile, "gender", ""),
            default="",
        )
        requested_gender = _normalise_mentor_gender(
            payload.get("gender"),
            default=current_gender,
        )
        gender_locked = bool(getattr(mentor_profile, "approved", False)) and not request.user.is_staff
        # Gender is set at signup and locked after coordinator approval.
        if gender_locked:
            mentor_profile.gender = current_gender
        elif requested_gender in ("male", "female"):
            mentor_profile.gender = requested_gender
        elif not current_gender:
            mentor_profile.gender = requested_gender
        else:
            mentor_profile.gender = current_gender
    year_locked = bool(getattr(mentor_profile, "approved", False)) and not request.user.is_staff
    requested_year = _get_int(payload, "year_level", default=None)
    if year_locked:
        if str(mentor_profile.role or "").strip() != STUDENT_MENTOR_ROLE:
            mentor_profile.year_level = 4
        elif mentor_profile.year_level not in STUDENT_MENTOR_YEAR_LEVELS:
            mentor_profile.year_level = 4
    else:
        mentor_profile.year_level = _mentor_year_level_for_role(
            mentor_profile.role,
            requested_year,
            mentor_profile.year_level,
        )
    years_experience = _get_int(payload, "years_experience", default=None, min_value=0)
    if years_experience is not None:
        mentor_profile.years_experience = years_experience
    teaching_experience_years = _get_int(
        payload,
        "teaching_experience_years",
        default=None,
        min_value=0,
    )
    if teaching_experience_years is not None:
        mentor_profile.teaching_experience_years = teaching_experience_years
    raw_competency_ids = payload.get("competency_ids")
    competency_ids = []
    if raw_competency_ids is not None:
        if isinstance(raw_competency_ids, list):
            for item in raw_competency_ids:
                try:
                    candidate_id = int(item)
                except (TypeError, ValueError):
                    continue
                if candidate_id > 0:
                    competency_ids.append(candidate_id)
    # Topics must stay topic names; do not overwrite them with competency names.
    selected_subjects = (
        mentor_profile.subjects if isinstance(mentor_profile.subjects, list) else []
    )
    selected_topics = (
        mentor_profile.topics if isinstance(mentor_profile.topics, list) else []
    )
    mentor_profile.topics = _normalise_topic_names_for_subjects(
        selected_subjects,
        selected_topics,
    )
    if "availability" in payload:
        mentor_profile.availability = _normalise_availability_slots(
            payload.get("availability")
        )
    mentor_profile.save()
    if mentor_account_fields_complete(mentor_profile):
        mark_profile_complete(mentor_profile, True)
    if raw_competency_ids is not None:
        mentor_profile.competencies.set(
            Competency.objects.filter(id__in=competency_ids)
        )
    raw_competency_levels = payload.get("competency_levels")
    competency_level_map = _normalise_competency_level_payload(
        raw_competency_levels,
        "proficiency_level",
    )
    if isinstance(raw_competency_levels, list):
        MentorCompetency.objects.filter(mentor=mentor_profile).exclude(
            competency_id__in=competency_ids
        ).delete()
        for competency_id, proficiency_level in competency_level_map.items():
            if competency_id not in competency_ids:
                continue
            MentorCompetency.objects.update_or_create(
                mentor=mentor_profile,
                competency_id=competency_id,
                defaults={"proficiency_level": proficiency_level},
            )
    elif raw_competency_ids is not None:
        fallback_level = _normalise_level(mentor_profile.expertise_level) or 3
        for competency_id in competency_ids:
            MentorCompetency.objects.update_or_create(
                mentor=mentor_profile,
                competency_id=competency_id,
                defaults={"proficiency_level": fallback_level},
            )
    _sync_user_topic_preferences(
        request.user,
        UserTopicPreference.TARGET_MENTOR,
        mentor_profile.subjects if isinstance(mentor_profile.subjects, list) else [],
        mentor_profile.topics if isinstance(mentor_profile.topics, list) else [],
    )
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
            "competency_ids": list(
                mentor_profile.competencies.values_list("id", flat=True)
            ),
            "expertise_level": mentor_profile.expertise_level,
            "competency_levels": {
                item.competency_id: int(item.proficiency_level)
                for item in mentor_profile.competency_levels.all()
            },
            "years_experience": getattr(mentor_profile, "years_experience", None),
            "teaching_experience_years": getattr(mentor_profile, "teaching_experience_years", None),
            "capacity": mentor_profile.capacity,
            "gender": getattr(mentor_profile, "gender", "") or "",
            "availability": _normalise_availability_slots(
                getattr(mentor_profile, "availability", [])
            ),
            "mentor_approved": bool(getattr(mentor_profile, "approved", False)),
            "mentor_role_locked": role_locked,
            "message": (
                "Mentor role is locked after coordinator approval and was not changed."
                if attempted_locked_role_change
                else ""
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
    user_prof = getattr(request.user, "profile", None)
    if mentor:
        mentor.bio = bio
        mentor.save(update_fields=["bio"])
    elif mentee:
        mentee.bio = bio
        mentee.save(update_fields=["bio"])
    elif user_prof:
        user_prof.bio = bio
        user_prof.save(update_fields=["bio"])
    else:
        from accounts.models import get_user_profile
        user_prof = get_user_profile(request.user, create_default=True)
        if user_prof:
            user_prof.bio = bio
            user_prof.save(update_fields=["bio"])
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
    user_prof = getattr(request.user, "profile", None)
    if mentor:
        mentor.interest_tags.set(tag_objects)
    elif mentee:
        mentee.interest_tags.set(tag_objects)
    elif user_prof:
        user_prof.interest_tags.set(tag_objects)
    else:
        from accounts.models import get_user_profile
        user_prof = get_user_profile(request.user, create_default=True)
        if user_prof:
            user_prof.interest_tags.set(tag_objects)
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


@login_required
@require_GET
def questionnaire_options(request):
    """Dynamic questionnaire options from Subject/Topic tables."""
    _ = request
    subjects = get_subjects_list(include_inactive_topics=False)
    topic_map = {}
    for item in subjects:
        if item.get("is_minor"):
            continue
        topic_map[item.get("name", "")] = [
            topic.get("name")
            for topic in (item.get("topics") or [])
            if topic.get("is_active")
        ]
    return JsonResponse(
        {
            "subjects": [
                {
                    "name": item.get("name"),
                    "code": item.get("code", ""),
                    "category": item.get("category", Subject.CATEGORY_MAJOR),
                }
                for item in subjects
            ],
            "category_labels": dict(Subject.CATEGORY_CHOICES),
            "category_order": [
                Subject.CATEGORY_MAJOR,
                Subject.CATEGORY_GE,
                Subject.CATEGORY_NSTP,
                Subject.CATEGORY_PE,
            ],
            "topic_map": topic_map,
        }
    )

