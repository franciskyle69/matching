"""Activity logs controller for staff: list and export audit log entries with

search, date, role, category, and action filters, plus human-readable activity descriptions.
"""

import csv
import io
from datetime import datetime
from math import ceil

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.views.decorators.http import require_GET

from matching.models import AuditLog
from ..views import _require_staff

# Humanized descriptive mappings: (action, model_name) -> (summary_phrase, category, action_type)
HUMANIZED_ACTIONS = {
    ("login", "auth"): ("Signed in to platform", "auth", "auth"),
    ("logout", "auth"): ("Signed out of session", "auth", "auth"),
    ("register", "auth"): ("Registered new user account", "auth", "create"),
    ("verify_email", "auth"): ("Verified email address", "auth", "update"),
    ("create", "mentee_mentor_request"): ("Submitted mentorship request", "matching", "create"),
    ("accept", "mentee_mentor_request"): ("Accepted mentorship request", "matching", "approve"),
    ("reject", "mentee_mentor_request"): ("Declined mentorship request", "matching", "reject"),
    ("run", "matching"): ("Executed matching recommendation engine", "matching", "run"),
    ("approve", "mentor_approval"): ("Approved mentor application", "approvals", "approve"),
    ("reject", "mentor_approval"): ("Rejected mentor application", "approvals", "reject"),
    ("approve", "mentee_approval"): ("Approved mentee application", "approvals", "approve"),
    ("reject", "mentee_approval"): ("Rejected mentee application", "approvals", "reject"),
    ("approve", "coordinator_approval"): ("Approved coordinator application", "approvals", "approve"),
    ("reject", "coordinator_approval"): ("Rejected coordinator application", "approvals", "reject"),
    ("update", "complete_onboarding"): ("Completed profile questionnaire & onboarding", "profiles", "update"),
    ("update", "mentor_profile"): ("Updated mentor profile details", "profiles", "update"),
    ("update", "mentee_profile"): ("Updated mentee profile details", "profiles", "update"),
    ("update", "account"): ("Updated account settings", "profiles", "update"),
    ("user_create", "user"): ("Created user account", "system", "create"),
    ("create", "user_account"): ("Created user account", "system", "create"),
    ("create", "backup"): ("Created system database backup", "system", "backup"),
    ("restore", "backup"): ("Restored system database", "system", "backup"),
    ("delete", "backup"): ("Removed system backup file", "system", "delete"),
    ("download", "backup"): ("Downloaded database backup", "system", "backup"),
    ("create", "announcement"): ("Published system announcement", "community", "create"),
    ("delete", "announcement"): ("Removed announcement", "community", "delete"),
    ("create", "post"): ("Published community post", "community", "create"),
    ("delete", "post"): ("Deleted community post", "community", "delete"),
    ("like", "post"): ("Liked a community post", "community", "update"),
    ("unlike", "post"): ("Unliked a community post", "community", "update"),
    ("share", "post"): ("Shared a community post", "community", "update"),
    ("create", "post_comment"): ("Commented on post", "community", "create"),
    ("topic_create", "topic"): ("Created discussion topic", "community", "create"),
    ("topic_update", "topic"): ("Updated discussion topic", "community", "update"),
}


def _user_role_label(user):
    """Return clean standardized role key: 'staff', 'instructor', 'student', 'mentee', or 'user'."""
    if not user:
        return ""
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return "staff"

    mentor_prof = getattr(user, "mentor_profile", None)
    if mentor_prof:
        mrole = str(getattr(mentor_prof, "role", "") or "").lower()
        if "instructor" in mrole or "faculty" in mrole:
            return "instructor"
        return "student"  # Student Mentor

    if getattr(user, "mentee_profile", None):
        return "mentee"
    return "user"


def _format_activity_entry(log):
    """Format single audit log row with humanized descriptions and clean metadata."""
    user = log.user
    role = _user_role_label(user)

    who = "System / Anonymous"
    email = ""
    if user:
        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        who = full_name or user.username or (f"User #{user.id}")
        email = getattr(user, "email", "") or ""

    # Derive human-readable description and category
    lookup_key = (log.action.lower(), log.model_name.lower())
    if lookup_key in HUMANIZED_ACTIONS:
        phrase, category, action_type = HUMANIZED_ACTIONS[lookup_key]
    else:
        # Generic heuristic
        m_lower = log.model_name.lower()
        act_lower = log.action.lower()
        if "approval" in m_lower or "coordinator" in m_lower:
            category = "approvals"
        elif "match" in m_lower or "request" in m_lower or "pair" in m_lower:
            category = "matching"
        elif "backup" in m_lower or "user" in m_lower:
            category = "system"
        elif "auth" in m_lower:
            category = "auth"
        elif any(k in m_lower for k in ("post", "comment", "topic", "announcement")):
            category = "community"
        elif "profile" in m_lower or "account" in m_lower:
            category = "profiles"
        else:
            category = "general"

        if "create" in act_lower or "register" in act_lower:
            action_type = "create"
        elif "delete" in act_lower:
            action_type = "delete"
        elif "approve" in act_lower:
            action_type = "approve"
        elif "reject" in act_lower:
            action_type = "reject"
        elif "login" in act_lower or "logout" in act_lower:
            action_type = "auth"
        else:
            action_type = "update"

        m_readable = log.model_name.replace("_", " ").title()
        act_readable = log.action.replace("_", " ").capitalize()
        phrase = f"{act_readable} on {m_readable}"

    what = phrase
    if log.object_id:
        # Add target context cleanly
        clean_obj = str(log.object_id)
        if len(clean_obj) > 30:
            clean_obj = clean_obj[:27] + "…"
        what = f"{phrase} (#{clean_obj})"

    return {
        "id": log.id,
        "time": log.created_at.isoformat(),
        "who": who,
        "email": email,
        "username": getattr(user, "username", "") if user else "",
        "role": role,
        "what": what,
        "action": log.action,
        "action_type": action_type,
        "category": category,
        "model_name": log.model_name,
        "object_id": log.object_id or "",
        "status": "Success",
    }


def _build_activity_queryset(request):
    """Filter AuditLog queryset by search, date range, category, and role."""
    qs = AuditLog.objects.select_related("user", "user__mentor_profile", "user__mentee_profile")

    search = (request.GET.get("search") or "").strip()
    if search:
        qs = qs.filter(
            Q(user__email__icontains=search)
            | Q(user__username__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
            | Q(action__icontains=search)
            | Q(model_name__icontains=search)
            | Q(object_id__icontains=search)
        )

    date_from = request.GET.get("date_from")
    if date_from:
        parsed_from = parse_date(date_from)
        if parsed_from:
            qs = qs.filter(created_at__date__gte=parsed_from)

    date_to = request.GET.get("date_to")
    if date_to:
        parsed_to = parse_date(date_to)
        if parsed_to:
            qs = qs.filter(created_at__date__lte=parsed_to)

    category = (request.GET.get("category") or "").strip().lower()
    if category and category != "all":
        # Filter by model categories
        if category == "auth":
            qs = qs.filter(model_name__in=["auth", "account"])
        elif category == "matching":
            qs = qs.filter(model_name__in=["matching", "mentee_mentor_request", "pairing"])
        elif category == "approvals":
            qs = qs.filter(model_name__in=["mentor_approval", "mentee_approval", "coordinator_approval"])
        elif category == "profiles":
            qs = qs.filter(model_name__in=["mentor_profile", "mentee_profile", "complete_onboarding", "account"])
        elif category == "system":
            qs = qs.filter(model_name__in=["backup", "user", "user_account", "topic"])
        elif category == "community":
            qs = qs.filter(model_name__in=["announcement", "post", "post_comment", "topic"])

    role_filter = (request.GET.get("role") or "").strip().lower()
    if role_filter and role_filter != "all":
        if role_filter in ("staff", "admin"):
            qs = qs.filter(Q(user__is_staff=True) | Q(user__is_superuser=True))
        elif role_filter == "instructor":
            qs = qs.filter(user__mentor_profile__role__icontains="instructor")
        elif role_filter in ("student", "mentor"):
            qs = qs.filter(
                user__mentor_profile__isnull=False,
                user__is_staff=False,
            ).exclude(user__mentor_profile__role__icontains="instructor")
        elif role_filter == "mentee":
            qs = qs.filter(user__mentee_profile__isnull=False, user__is_staff=False)

    return qs


@login_required
@require_GET
def activity_logs_list(request):
    """List activity (audit) logs with search, category, role, and date range filters."""
    err = _require_staff(request)
    if err:
        return err

    # Check if direct CSV export was requested via ?export=csv
    if request.GET.get("export") == "csv":
        return activity_logs_export(request)

    qs = _build_activity_queryset(request)
    total_count = qs.count()

    try:
        page = max(1, int(request.GET.get("page", 1)))
    except (TypeError, ValueError):
        page = 1

    try:
        page_size = int(request.GET.get("page_size", 20))
    except (TypeError, ValueError):
        page_size = 20

    if page_size < 1:
        page_size = 20
    if page_size > 100:
        page_size = 100

    total_pages = max(1, ceil(total_count / page_size)) if page_size else 1
    if page > total_pages:
        page = total_pages

    offset = (page - 1) * page_size
    paged_qs = qs.order_by("-created_at")[offset:offset + page_size]

    logs = [_format_activity_entry(log) for log in paged_qs]

    # Calculate summary counts for quick stats
    today_date = timezone.now().date()
    today_count = AuditLog.objects.filter(created_at__date=today_date).count()

    return JsonResponse({
        "logs": logs,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "last_page": total_pages,
        "stats": {
            "total_records": total_count,
            "today_records": today_count,
        },
    })


@login_required
@require_GET
def activity_logs_export(request):
    """Export filtered activity logs to CSV format for audit and compliance reports."""
    err = _require_staff(request)
    if err:
        return err

    qs = _build_activity_queryset(request).order_by("-created_at")[:2000]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID",
        "Timestamp (ISO)",
        "Actor Name",
        "Actor Email",
        "Actor Role",
        "Category",
        "Action",
        "Model",
        "Object ID",
        "Description",
        "Status",
    ])

    for log in qs:
        entry = _format_activity_entry(log)
        writer.writerow([
            entry["id"],
            entry["time"],
            entry["who"],
            entry["email"],
            entry["role"],
            entry["category"],
            entry["action"],
            entry["model_name"],
            entry["object_id"],
            entry["what"],
            entry["status"],
        ])

    csv_data = output.getvalue()
    filename = f"peerlink_activity_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    response = HttpResponse(csv_data, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
