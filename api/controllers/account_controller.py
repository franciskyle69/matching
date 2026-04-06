from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.contrib.auth.decorators import login_required
from django.core.mail import EmailMultiAlternatives
from django.http import JsonResponse
from django.core.cache import cache
from django.views.decorators.http import require_GET, require_http_methods
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from django.utils import timezone

from matching.models import MentoringSession, MenteeMentorRequest
from profiles.models import MentorProfile, MenteeProfile, InterestTag

from accounts.forms import AccountSettingsForm, RegisterForm
from accounts.views import ROLE_SESSION_KEY
from accounts.auth_backends import EmailOrUsernameModelBackend
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
from profiles.questionnaire_utils import filter_topics_for_subjects


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


@require_http_methods(["GET"])
def csrf(request):
    return JsonResponse({"csrfToken": get_token(request)})


@require_http_methods(["POST"])
def auth_login(request):
    payload = _get_payload(request)
    username = _get_str(payload, "username")
    password = _get_str(payload, "password")
    client_ip = request.META.get("REMOTE_ADDR")
    if not username or not password:
        return JsonResponse(
            {"error": "Username and password are required."}, status=400
        )

    # Allow valid credentials to sign in and reset limits immediately.
    backend = EmailOrUsernameModelBackend()
    user = backend.authenticate(request, username=username, password=password)

    if not user:
        # Trigger axes tracking/backoff path for failed credentials.
        authenticate(request, username=username, password=password)
        lockout_info = get_lockout_info(username, ip_address=client_ip)
        if lockout_info["is_locked"]:
            return create_lockout_response(username, ip_address=client_ip)

        logger.warning("auth_login_failed", extra={"username": username})
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
        username,
        user.username,
        user.email,
        ip_address=client_ip,
    )

    logger.info("auth_login_success", extra={"user_id": user.id})
    audit_log(user, "login", "auth")
    return JsonResponse({"status": "ok"})


@login_required
@require_http_methods(["POST"])
def auth_logout(request):
    user = request.user
    logout(request)
    audit_log(user, "logout", "auth")
    return JsonResponse({"status": "ok"})


@require_http_methods(["POST"])
def check_lockout(request):
    """Check if a user's account is currently locked (for auto-polling lockout status)."""
    payload = _get_payload(request)
    username = _get_str(payload, "username")
    if not username:
        return JsonResponse(
            {"error": "Username is required."}, status=400
        )
    
    lockout_info = get_lockout_info(
        username,
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

    user = form.save(commit=False)
    user.is_active = False
    user.save()

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

    # Fire-and-forget check for any due session reminders whenever user hits /api/me/
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

    return JsonResponse(
        {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
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
    )


@login_required
@require_http_methods(["POST"])
def update_account(request):
    raw = _get_payload(request)
    if not raw or not isinstance(raw, dict):
        return JsonResponse(
            {
                "errors": {
                    "__all__": [
                        "Request body must be JSON with username and email."
                    ]
                }
            },
            status=400,
        )
    # Merge with current user so partial updates (e.g. username only) don't clear email
    payload = {
        "username": raw.get("username")
        if raw.get("username") is not None
        else request.user.username,
        "email": raw.get("email")
        if raw.get("email") is not None
        else (request.user.email or ""),
    }
    form = AccountSettingsForm(payload, instance=request.user)
    if not form.is_valid():
        errors = {k: list(v) for k, v in form.errors.items()}
        return JsonResponse({"errors": errors}, status=400)
    form.save()
    audit_log(request.user, "update", "account", request.user.id)
    logger.info("account_updated", extra={"user_id": request.user.id})
    return JsonResponse(
        {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
        }
    )


@login_required
@require_http_methods(["POST"])
def change_password(request):
    payload = _get_payload(request)
    current_password = _get_str(payload, "current_password")
    new_password1 = _get_str(payload, "new_password1")
    new_password2 = _get_str(payload, "new_password2")

    if not current_password or not new_password1 or not new_password2:
        return JsonResponse(
            {"error": "Current password and new password fields are required."},
            status=400,
        )

    if new_password1 != new_password2:
        return JsonResponse({"error": "New passwords do not match."}, status=400)

    if len(new_password1) < 8:
        return JsonResponse(
            {"error": "New password must be at least 8 characters long."},
            status=400,
        )

    user = request.user
    if not user.has_usable_password():
        return JsonResponse(
            {
                "error": "This account does not have a usable password set. Contact an administrator."
            },
            status=400,
        )

    if not user.check_password(current_password):
        return JsonResponse({"error": "Current password is incorrect."}, status=401)

    user.set_password(new_password1)
    user.save(update_fields=["password"])
    update_session_auth_hash(request, user)

    audit_log(user, "update", "password", user.id)
    logger.info("password_changed", extra={"user_id": user.id})
    return JsonResponse({"status": "ok"})


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

