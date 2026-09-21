from rest_framework.permissions import BasePermission
from accounts.models import get_user_profile


class IsApprovedByCoordinator(BasePermission):
    """
    Allows access only to authenticated users whose account has been approved by a Coordinator.
    Coordinators and staff always pass.
    """
    message = "Account pending approval by coordinator."

    def has_permission(self, request, view=None):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        profile = getattr(user, "profile", None) or get_user_profile(user, create_default=False)
        if profile and str(getattr(profile, "role", "")).upper() == "COORDINATOR":
            return True
        status = getattr(user, "approval_status", None)
        if not status and profile:
            status = getattr(profile, "approval_status", None)
        return status == "ACTIVE"


class IsCoordinator(BasePermission):
    """
    Allows access only to authenticated users with Coordinator role, staff, or superusers.
    """
    message = "Coordinator access required."

    def has_permission(self, request, view=None):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        profile = getattr(user, "profile", None) or get_user_profile(user, create_default=False)
        role = str(getattr(profile, "role", "")).upper()
        return role == "COORDINATOR"


