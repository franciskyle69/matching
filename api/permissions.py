from rest_framework.permissions import BasePermission


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
        profile = getattr(user, "profile", None)
        if profile and profile.role == "COORDINATOR":
            return True
        status = getattr(user, "approval_status", None)
        if not status and profile:
            status = getattr(profile, "approval_status", None)
        return status == "ACTIVE"
