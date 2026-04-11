import secrets

from django.contrib.auth.models import User
from django.core.mail import EmailMultiAlternatives
from django.contrib.sites.shortcuts import get_current_site
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods, require_GET
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.template.loader import render_to_string

from ..views import (
    _get_payload,
    _get_str,
    _require_staff,
    audit_log,
    logger,
)
from accounts.forms import CoordinatorCreateUserForm
from accounts.models import set_must_change_password
from accounts.models import get_user_display_name
from profiles.models import MentorProfile, MenteeProfile
from matching.models import MenteeMentorRequest


def _parse_bool_query(value):
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y", "on"}:
        return True
    if text in {"0", "false", "no", "n", "off"}:
        return False
    return None


def _parse_int_query(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed


def _serialize_user(user):
    """Serialize a User object with profile info"""
    mentor = getattr(user, 'mentor_profile', None)
    mentee = getattr(user, 'mentee_profile', None)
    
    role = None
    if mentor and mentee:
        role = "both"
    elif mentor:
        role = "mentor"
    elif mentee:
        role = "mentee"
    elif user.is_staff:
        role = "staff"
    else:
        role = "none"
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "full_name": get_user_display_name(user),
        "display_name": get_user_display_name(user),
        "is_staff": user.is_staff,
        "is_active": user.is_active,
        "must_change_password": bool(getattr(getattr(user, "security_state", None), "must_change_password", False)),
        "date_joined": user.date_joined.isoformat(),
        "role": role,
        "mentor_approved": mentor.approved if mentor else None,
        "mentee_approved": mentee.approved if mentee else None,
    }


def _generate_temp_password(length=14):
    specials = "!@#$%^&*"
    while True:
        password = [
            secrets.choice("abcdefghijklmnopqrstuvwxyz"),
            secrets.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
            secrets.choice("0123456789"),
            secrets.choice(specials),
        ]
        alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" + specials
        password.extend(secrets.choice(alphabet) for _ in range(max(0, length - len(password))))
        secrets.SystemRandom().shuffle(password)
        candidate = "".join(password)
        if any(ch.islower() for ch in candidate) and any(ch.isupper() for ch in candidate) and any(ch.isdigit() for ch in candidate) and any(ch in specials for ch in candidate):
            return candidate


@login_required
@require_GET
def users_list(request):
    """List users with search, filter, and pagination"""
    err = _require_staff(request)
    if err:
        return err
    try:
        params = request.GET

        # Pagination
        page = max(1, _parse_int_query(params.get("page"), 1))
        page_size = _parse_int_query(params.get("page_size"), 20)
        if page_size < 1:
            page_size = 20
        if page_size > 100:
            page_size = 100

        # Search
        search = str(params.get("search", "")).strip()

        # Filters
        is_active = _parse_bool_query(params.get("is_active"))
        is_staff = _parse_bool_query(params.get("is_staff"))
        role_filter = str(params.get("role", "")).strip().lower()
        sort_by = str(params.get("sort_by", "date_joined")).strip().lower()
        sort_dir = str(params.get("sort_dir", "desc")).strip().lower()
        descending = sort_dir == "desc"

        # Build query
        query = User.objects.all().select_related('mentor_profile', 'mentee_profile')

        # Search filter
        if search:
            query = query.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        # Active filter
        if is_active is not None:
            query = query.filter(is_active=is_active)

        # Staff filter
        if is_staff is not None:
            query = query.filter(is_staff=is_staff)

        # Role filter
        if role_filter == "mentor":
            query = query.filter(mentor_profile__isnull=False)
        elif role_filter == "mentee":
            query = query.filter(mentee_profile__isnull=False)
        elif role_filter == "both":
            query = query.filter(mentor_profile__isnull=False, mentee_profile__isnull=False)
        elif role_filter == "none":
            query = query.filter(mentor_profile__isnull=True, mentee_profile__isnull=True)

        # Order by (server-side sorting)
        sort_prefix = "-" if descending else ""
        if sort_by == "name":
            if descending:
                query = query.order_by("-first_name", "-last_name", "-username")
            else:
                query = query.order_by("first_name", "last_name", "username")
        elif sort_by in {"email", "username", "is_active", "is_staff", "date_joined"}:
            query = query.order_by(f"{sort_prefix}{sort_by}")
        else:
            query = query.order_by("-date_joined")

        # Get total count before pagination
        total_count = query.count()

        # Pagination
        offset = (page - 1) * page_size
        users = list(query[offset:offset + page_size])

        # Serialize
        users_data = [_serialize_user(user) for user in users]

        total_pages = (total_count + page_size - 1) // page_size

        return JsonResponse({
            "ok": True,
            "users": users_data,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            # Tabulator remote pagination compatibility
            "data": users_data,
            "last_page": total_pages,
        })
    except Exception as e:
        logger.exception(f"Error in users_list: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def user_create(request):
    err = _require_staff(request)
    if err:
        return err
    try:
        payload = _get_payload(request)
        form = CoordinatorCreateUserForm(payload)
        if not form.is_valid():
            return JsonResponse({"ok": False, "errors": form.errors}, status=400)

        cleaned = form.cleaned_data
        first_name = cleaned.get("first_name", "")
        last_name = cleaned.get("last_name", "")
        email = cleaned.get("email", "")
        role = cleaned.get("role", "mentor")
        if role == "staff":
            user.is_staff = True
            user.save(update_fields=["is_staff"])

        base_username = "".join(part for part in [first_name, last_name] if part)
        base_username = "".join(ch for ch in base_username.lower() if ch.isalnum())
        if not base_username:
            base_username = email.split("@")[0].lower()

        username = base_username
        suffix = 1
        while User.objects.filter(username=username).exists():
            suffix += 1
            username = f"{base_username}{suffix}"

        temp_password = _generate_temp_password()
        user = User.objects.create_user(
            username=username,
            email=email,
            password=temp_password,
            first_name=first_name,
            last_name=last_name,
        )
        user.is_active = True
        user.save(update_fields=["is_active"])

        if role == "mentor":
            MentorProfile.objects.create(
                user=user,
                program="BSIT",
                year_level=4,
                verification_document="",
                approved=False,
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
                verification_document="",
                approved=False,
            )

        set_must_change_password(user, True)

        current_site = get_current_site(request)
        context = {
            "user": user,
            "domain": current_site.domain,
            "protocol": "https" if request.is_secure() else "http",
            "password": temp_password,
            "role": role,
        }
        subject = "Your account has been created"
        text_message = render_to_string("registration/coordinator_user_created_email.txt", context)
        html_message = render_to_string("registration/coordinator_user_created_email.html", context)
        email_message = EmailMultiAlternatives(subject, text_message, to=[user.email])
        email_message.attach_alternative(html_message, "text/html")
        email_message.send()

        audit_log(request.user, "user_create", f"Created user: {user.username}", "success")
        return JsonResponse({
            "ok": True,
            "message": "User created and password emailed.",
            "user": _serialize_user(user),
        })
    except Exception as e:
        logger.exception(f"Error in user_create: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
@require_GET
def user_detail(request, user_id):
    """Get details of a specific user"""
    err = _require_staff(request)
    if err:
        return err
    try:
        try:
            user = User.objects.select_related('mentor_profile', 'mentee_profile').get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({"ok": False, "error": "User not found"}, status=404)
        
        user_data = _serialize_user(user)
        
        # Add profile details
        mentor = getattr(user, 'mentor_profile', None)
        mentee = getattr(user, 'mentee_profile', None)
        
        if mentor:
            user_data["mentor_profile"] = {
                "program": mentor.program,
                "year_level": mentor.year_level,
                "gpa": str(mentor.gpa) if mentor.gpa else None,
                "bio": mentor.bio,
                "capacity": mentor.capacity,
                "approved": mentor.approved,
                "subjects": mentor.subjects,
                "topics": mentor.topics,
                "verification_document_url": mentor.verification_document.url if mentor.verification_document else "",
                "verification_document_name": mentor.verification_document.name.split("/")[-1] if mentor.verification_document else "",
            }

            mentor_connections = MenteeMentorRequest.objects.filter(
                mentor=mentor,
                accepted=True,
            ).select_related("mentee__user")
            user_data["mentor_connections"] = [
                {
                    "user_id": relation.mentee.user_id,
                    "username": relation.mentee.user.username,
                    "display_name": get_user_display_name(relation.mentee.user),
                    "accepted_at": relation.accepted_at.isoformat() if relation.accepted_at else None,
                }
                for relation in mentor_connections
            ]
        
        if mentee:
            user_data["mentee_profile"] = {
                "program": mentee.program,
                "year_level": mentee.year_level,
                "gpa": str(mentee.gpa) if mentee.gpa else None,
                "bio": mentee.bio,
                "campus": mentee.campus,
                "student_id_no": mentee.student_id_no,
                "contact_no": mentee.contact_no,
                "approved": mentee.approved,
                "subjects": mentee.subjects,
                "topics": mentee.topics,
                "verification_document_url": mentee.verification_document.url if mentee.verification_document else "",
                "verification_document_name": mentee.verification_document.name.split("/")[-1] if mentee.verification_document else "",
            }

            mentee_connections = MenteeMentorRequest.objects.filter(
                mentee=mentee,
                accepted=True,
            ).select_related("mentor__user")
            user_data["mentee_connections"] = [
                {
                    "user_id": relation.mentor.user_id,
                    "username": relation.mentor.user.username,
                    "display_name": get_user_display_name(relation.mentor.user),
                    "accepted_at": relation.accepted_at.isoformat() if relation.accepted_at else None,
                }
                for relation in mentee_connections
            ]
        
        return JsonResponse({
            "ok": True,
            "user": user_data,
        })
    except Exception as e:
        logger.exception(f"Error in user_detail: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def user_update(request, user_id):
    """Update user information"""
    err = _require_staff(request)
    if err:
        return err
    try:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({"ok": False, "error": "User not found"}, status=404)
        
        payload = _get_payload(request)
        
        # Update basic user info
        if "first_name" in payload:
            user.first_name = _get_str(payload, "first_name", default="")
        if "last_name" in payload:
            user.last_name = _get_str(payload, "last_name", default="")
        if "email" in payload:
            user.email = _get_str(payload, "email", default="")
        if "is_staff" in payload:
            user.is_staff = bool(payload.get("is_staff", False))
        
        user.save()
        
        audit_log(
            request.user,
            "user_update",
            f"Updated user {user.username}",
            "success"
        )
        
        user_data = _serialize_user(user)
        return JsonResponse({
            "ok": True,
            "user": user_data,
        })
    except Exception as e:
        logger.exception(f"Error in user_update: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def user_activate_deactivate(request, user_id):
    """Activate or deactivate a user"""
    err = _require_staff(request)
    if err:
        return err
    try:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({"ok": False, "error": "User not found"}, status=404)
        
        payload = _get_payload(request)
        is_active = payload.get("is_active", True)
        
        user.is_active = bool(is_active)
        user.save()
        
        action = "activated" if user.is_active else "deactivated"
        audit_log(
            request.user,
            "user_activate_deactivate",
            f"User {action}: {user.username}",
            "success"
        )
        
        user_data = _serialize_user(user)
        return JsonResponse({
            "ok": True,
            "user": user_data,
        })
    except Exception as e:
        logger.exception(f"Error in user_activate_deactivate: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def user_delete(request, user_id):
    """Delete a user (soft delete - deactivate)"""
    err = _require_staff(request)
    if err:
        return err
    try:
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({"ok": False, "error": "User not found"}, status=404)
        
        # Don't allow deleting the requesting user
        if user.id == request.user.id:
            return JsonResponse({"ok": False, "error": "Cannot delete your own account"}, status=400)
        
        # Soft delete - deactivate instead of hard delete
        user.is_active = False
        user.save()
        
        audit_log(
            request.user,
            "user_delete",
            f"Deleted user: {user.username}",
            "success"
        )
        
        return JsonResponse({
            "ok": True,
            "message": "User deleted successfully",
        })
    except Exception as e:
        logger.exception(f"Error in user_delete: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def mentor_approve_reject(request, user_id):
    """Approve or reject a mentor profile"""
    err = _require_staff(request)
    if err:
        return err
    try:
        try:
            user = User.objects.get(id=user_id)
            mentor = user.mentor_profile
        except (User.DoesNotExist, MentorProfile.DoesNotExist):
            return JsonResponse({"ok": False, "error": "User or mentor profile not found"}, status=404)
        
        payload = _get_payload(request)
        approved = payload.get("approved", False)
        
        mentor.approved = bool(approved)
        mentor.save()
        
        action = "approved" if mentor.approved else "rejected"
        audit_log(
            request.user,
            "mentor_approve_reject",
            f"Mentor {action}: {user.username}",
            "success"
        )
        
        user_data = _serialize_user(user)
        return JsonResponse({
            "ok": True,
            "user": user_data,
        })
    except Exception as e:
        logger.exception(f"Error in mentor_approve_reject: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def mentee_approve_reject(request, user_id):
    """Approve or reject a mentee profile"""
    err = _require_staff(request)
    if err:
        return err
    try:
        try:
            user = User.objects.get(id=user_id)
            mentee = user.mentee_profile
        except (User.DoesNotExist, MenteeProfile.DoesNotExist):
            return JsonResponse({"ok": False, "error": "User or mentee profile not found"}, status=404)
        
        payload = _get_payload(request)
        approved = payload.get("approved", False)
        
        mentee.approved = bool(approved)
        mentee.save()
        
        action = "approved" if mentee.approved else "rejected"
        audit_log(
            request.user,
            "mentee_approve_reject",
            f"Mentee {action}: {user.username}",
            "success"
        )
        
        user_data = _serialize_user(user)
        return JsonResponse({
            "ok": True,
            "user": user_data,
        })
    except Exception as e:
        logger.exception(f"Error in mentee_approve_reject: {e}")
        return JsonResponse({"ok": False, "error": str(e)}, status=500)
