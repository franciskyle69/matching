"""
Activity logs for staff: list audit log entries with search and date filters.
"""
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from django.db.models import Q
from django.utils.dateparse import parse_date

from matching.models import AuditLog

from ..views import _require_staff


def _user_role_label(user):
    """Return a short role label for display (superadmin, admin, mentor, mentee, user)."""
    if not user:
        return ""
    if getattr(user, "is_superuser", False):
        return "superadmin"
    if getattr(user, "is_staff", False):
        return "admin"
    if getattr(user, "mentor_profile", None):
        return "mentor"
    if getattr(user, "mentee_profile", None):
        return "mentee"
    return "user"


@login_required
@require_GET
def activity_logs_list(request):
    """List activity (audit) logs with optional search and date range. Staff only."""
    err = _require_staff(request)
    if err:
        return err

    qs = AuditLog.objects.select_related("user")

    search = (request.GET.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(user__email__icontains=search)
            | Q(user__username__icontains=search)
            | Q(action__icontains=search)
            | Q(model_name__icontains=search)
        )

    date_from = request.GET.get("date_from")
    if date_from:
        parsed = parse_date(date_from)
        if parsed:
            qs = qs.filter(created_at__date__gte=parsed)

    date_to = request.GET.get("date_to")
    if date_to:
        parsed = parse_date(date_to)
        if parsed:
            qs = qs.filter(created_at__date__lte=parsed)

    qs = qs.order_by("-created_at")[:500]

    logs = []
    for log in qs:
        user = log.user
        who = "—"
        role = ""
        if user:
            who = getattr(user, "email", None) or user.username or f"user_{user.id}"
            role = _user_role_label(user)
        what = f"{log.action} on {log.model_name}"
        if log.object_id:
            what += f" (id={log.object_id})"
        logs.append({
            "id": log.id,
            "time": log.created_at.isoformat(),
            "who": who,
            "role": role,
            "what": what,
            "action": log.action,
            "model_name": log.model_name,
            "object_id": log.object_id or "",
            "status": "Success",
        })

    return JsonResponse({"logs": logs})
