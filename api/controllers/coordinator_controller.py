from django.contrib.auth import get_user_model
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from accounts.models import UserProfile, get_user_profile, get_user_display_name
from ..serializers import PendingMentorSerializer
from ..views.helpers import audit_log, invalidate_approval_cache_mentor, invalidate_approval_cache_mentee
from .account_controller import _clear_me_cache

User = get_user_model()


def _is_coordinator_or_staff(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    profile = get_user_profile(user, create_default=False)
    return bool(profile and profile.role == UserProfile.ROLE_COORDINATOR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pending_mentors(request):
    if not _is_coordinator_or_staff(request.user):
        return JsonResponse({"error": "Coordinator access required."}, status=403)

    pending_profiles = (
        UserProfile.objects.filter(approval_status__in=[UserProfile.STATUS_PENDING, UserProfile.STATUS_PENDING_APPROVAL])
        .select_related("user")
        .prefetch_related("user__documents")
        .order_by("-id")
    )
    serializer = PendingMentorSerializer(pending_profiles, many=True)
    return JsonResponse({"count": len(serializer.data), "results": serializer.data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def pending_users(request):
    if not _is_coordinator_or_staff(request.user):
        return JsonResponse({"error": "Coordinator access required."}, status=403)

    pending_profiles = (
        UserProfile.objects.filter(approval_status__in=[UserProfile.STATUS_PENDING, UserProfile.STATUS_PENDING_APPROVAL])
        .select_related("user")
        .prefetch_related("user__documents")
        .order_by("-id")
    )
    users_data = []
    for up in pending_profiles:
        u = up.user
        display_name = get_user_display_name(u) or u.get_full_name() or u.username
        users_data.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": display_name,
            "role": up.role,
            "approval_status": up.approval_status,
            "is_onboarded": up.is_onboarded,
            "student_id_no": getattr(up, "student_id_no", "") or "",
            "contact_no": getattr(up, "contact_no", "") or "",
            "admission_type": getattr(up, "admission_type", "") or "",
            "sex": getattr(up, "sex", "") or "",
            "campus": getattr(up, "campus", "Main") or "Main",
            "program": getattr(up, "program", "BSIT") or "BSIT",
            "year_level": getattr(up, "year_level", 1) or 1,
        })
    return JsonResponse({"count": len(users_data), "users": users_data, "results": users_data})


@api_view(["POST", "PATCH"])
@permission_classes([IsAuthenticated])
def approve_mentor(request, user_id):
    if not _is_coordinator_or_staff(request.user):
        return JsonResponse({"error": "Coordinator access required."}, status=403)

    user = User.objects.filter(id=user_id).first()
    if not user:
        return JsonResponse({"error": "User not found."}, status=404)

    profile = get_user_profile(user)
    profile.approval_status = UserProfile.STATUS_ACTIVE
    profile.save(update_fields=["approval_status"])

    # Synchronize mentor_profile.approved if exists
    if hasattr(user, "mentor_profile"):
        m = user.mentor_profile
        m.approved = True
        m.save(update_fields=["approved"])
        invalidate_approval_cache_mentor(m.id)

    # Synchronize mentee_profile.approved if exists
    if hasattr(user, "mentee_profile"):
        e = user.mentee_profile
        e.approved = True
        e.save(update_fields=["approved"])
        invalidate_approval_cache_mentee(e.id)

    _clear_me_cache(user.id)
    audit_log(request.user, "approve", "coordinator_approval", user.id)
    return JsonResponse({
        "status": "ok",
        "message": f"User {user.email} has been approved.",
        "user_id": user.id,
        "approval_status": profile.approval_status,
    })


@api_view(["POST", "PATCH"])
@permission_classes([IsAuthenticated])
def reject_mentor(request, user_id):
    if not _is_coordinator_or_staff(request.user):
        return JsonResponse({"error": "Coordinator access required."}, status=403)

    user = User.objects.filter(id=user_id).first()
    if not user:
        return JsonResponse({"error": "User not found."}, status=404)

    profile = get_user_profile(user)
    profile.approval_status = UserProfile.STATUS_REJECTED
    profile.save(update_fields=["approval_status"])

    if hasattr(user, "mentor_profile"):
        m = user.mentor_profile
        m.approved = False
        m.save(update_fields=["approved"])
        invalidate_approval_cache_mentor(m.id)

    if hasattr(user, "mentee_profile"):
        e = user.mentee_profile
        e.approved = False
        e.save(update_fields=["approved"])
        invalidate_approval_cache_mentee(e.id)

    _clear_me_cache(user.id)
    audit_log(request.user, "reject", "coordinator_approval", user.id)
    return JsonResponse({
        "status": "ok",
        "message": f"User {user.email} has been rejected.",
        "user_id": user.id,
        "approval_status": profile.approval_status,
    })


approve_user = approve_mentor
reject_user = reject_mentor

