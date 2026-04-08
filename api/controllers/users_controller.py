from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods, require_GET
from django.contrib.auth.decorators import login_required
from django.db.models import Q

from ..views import (
    _get_payload,
    _get_str,
    _require_staff,
    audit_log,
    logger,
)
from accounts.models import get_user_display_name
from profiles.models import MentorProfile, MenteeProfile


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
        "date_joined": user.date_joined.isoformat(),
        "role": role,
        "mentor_approved": mentor.approved if mentor else None,
        "mentee_approved": mentee.approved if mentee else None,
    }


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
            }
        
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
            }
        
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
