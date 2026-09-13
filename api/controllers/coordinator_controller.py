from django.contrib.auth import get_user_model
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from accounts.models import UserProfile, get_user_profile
from ..serializers import PendingMentorSerializer
from ..views.helpers import audit_log, invalidate_approval_cache_mentor

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
        UserProfile.objects.filter(approval_status=UserProfile.STATUS_PENDING_APPROVAL)
        .select_related("user")
        .prefetch_related("user__documents")
        .order_by("-id")
    )
    serializer = PendingMentorSerializer(pending_profiles, many=True)
    return JsonResponse({"count": len(serializer.data), "results": serializer.data})


@api_view(["POST"])
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

    audit_log(request.user, "approve", "coordinator_approval", user.id)
    return JsonResponse({
        "status": "ok",
        "message": f"Mentor {user.email} has been approved.",
        "user_id": user.id,
        "approval_status": profile.approval_status,
    })


@api_view(["POST"])
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

    audit_log(request.user, "reject", "coordinator_approval", user.id)
    return JsonResponse({
        "status": "ok",
        "message": f"Mentor {user.email} has been rejected.",
        "user_id": user.id,
        "approval_status": profile.approval_status,
    })
