from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from accounts.models import get_user_display_name
from profiles.models import MentorProfile, MenteeProfile

from ..views import _require_staff, audit_log, invalidate_approval_cache_mentor, invalidate_approval_cache_mentee


def _mentor_general_info_complete(mentor):
    """True if mentor has program, year_level, and at least one of subjects/topics/expertise_level."""
    if not mentor.program or not mentor.year_level:
        return False
    subs = mentor.subjects if isinstance(mentor.subjects, list) else []
    tops = mentor.topics if isinstance(mentor.topics, list) else []
    has_prefs = bool(subs or tops or mentor.expertise_level is not None)
    return has_prefs


def _mentee_general_info_complete(mentee):
    """True if mentee has all required general fields filled (matches mentee_general_info_completed)."""
    return bool(
        mentee.program
        and mentee.year_level
        and getattr(mentee, "campus", "")
        and getattr(mentee, "student_id_no", "")
        and getattr(mentee, "contact_no", "")
        and getattr(mentee, "admission_type", "")
        and getattr(mentee, "sex", "")
    )


def _serialize_mentor_detail(mentor):
    u = mentor.user
    display_name = get_user_display_name(u) or u.username
    subs = mentor.subjects if isinstance(mentor.subjects, list) else (list(mentor.subjects) if mentor.subjects else [])
    tops = mentor.topics if isinstance(mentor.topics, list) else (list(mentor.topics) if mentor.topics else [])
    return {
        "id": mentor.id,
        "user_id": u.id,
        "username": u.username,
        "display_name": display_name,
        "full_name": display_name,
        "email": getattr(u, "email", "") or "",
        "program": mentor.program or "",
        "year_level": mentor.year_level,
        "gpa": str(mentor.gpa) if mentor.gpa is not None else "",
        "avatar_url": mentor.avatar_url or "",
        "role": mentor.role or "",
        "subjects": subs,
        "topics": tops,
        "expertise_level": mentor.expertise_level,
        "capacity": getattr(mentor, "capacity", 1),
        "interests": mentor.interests or "",
        "approved": mentor.approved,
        "general_info_complete": _mentor_general_info_complete(mentor),
    }


def _serialize_mentee_detail(mentee):
    u = mentee.user
    display_name = get_user_display_name(u) or u.username
    return {
        "id": mentee.id,
        "user_id": u.id,
        "username": u.username,
        "display_name": display_name,
        "full_name": display_name,
        "email": getattr(u, "email", "") or "",
        "program": mentee.program or "",
        "year_level": mentee.year_level,
        "gpa": str(mentee.gpa) if mentee.gpa is not None else "",
        "avatar_url": mentee.avatar_url or "",
        "campus": getattr(mentee, "campus", "") or "",
        "student_id_no": getattr(mentee, "student_id_no", "") or "",
        "contact_no": getattr(mentee, "contact_no", "") or "",
        "admission_type": getattr(mentee, "admission_type", "") or "",
        "sex": getattr(mentee, "sex", "") or "",
        "subjects": mentee.subjects if isinstance(mentee.subjects, list) else (list(mentee.subjects) if mentee.subjects else []),
        "topics": mentee.topics if isinstance(mentee.topics, list) else (list(mentee.topics) if mentee.topics else []),
        "difficulty_level": mentee.difficulty_level,
        "interests": mentee.interests or "",
        "approved": mentee.approved,
        "general_info_complete": _mentee_general_info_complete(mentee),
    }


@login_required
@require_GET
def pending_list(request):
    err = _require_staff(request)
    if err:
        return err

    pending_mentors = (
        MentorProfile.objects.select_related("user")
        .filter(approved=False)
        .exclude(user=request.user)
        .order_by("user__username")
    )
    pending_mentees = (
        MenteeProfile.objects.select_related("user")
        .filter(approved=False)
        .exclude(user=request.user)
        .order_by("user__username")
    )

    mentors_data = [_serialize_mentor_detail(m) for m in pending_mentors]
    mentees_data = [_serialize_mentee_detail(m) for m in pending_mentees]

    # Sort: general info complete first, then by display name.
    mentors_data.sort(key=lambda x: (not x.get("general_info_complete", False), (x.get("display_name") or x.get("username") or "").lower()))
    mentees_data.sort(key=lambda x: (not x.get("general_info_complete", False), (x.get("display_name") or x.get("username") or "").lower()))

    return JsonResponse({
        "pending_mentors": mentors_data,
        "pending_mentees": mentees_data,
    })


@login_required
@require_http_methods(["POST"])
def approve_mentor(request):
    err = _require_staff(request)
    if err:
        return err

    from ..views import _get_payload, _get_int
    payload = _get_payload(request)
    mentor_id = _get_int(payload, "mentor_id") or _get_int(payload, "mentor")
    if not mentor_id:
        return JsonResponse({"error": "mentor_id is required."}, status=400)

    mentor = MentorProfile.objects.filter(id=mentor_id).first()
    if not mentor:
        return JsonResponse({"error": "Mentor not found."}, status=404)

    mentor.approved = True
    mentor.save(update_fields=["approved"])
    audit_log(request.user, "approve", "mentor_approval", mentor.id)
    invalidate_approval_cache_mentor(mentor.id)
    return JsonResponse({"status": "ok", "mentor": _serialize_mentor_detail(mentor)})


@login_required
@require_http_methods(["POST"])
def reject_mentor(request):
    err = _require_staff(request)
    if err:
        return err

    from ..views import _get_payload, _get_int
    payload = _get_payload(request)
    mentor_id = _get_int(payload, "mentor_id") or _get_int(payload, "mentor")
    if not mentor_id:
        return JsonResponse({"error": "mentor_id is required."}, status=400)

    mentor = MentorProfile.objects.filter(id=mentor_id).first()
    if not mentor:
        return JsonResponse({"error": "Mentor not found."}, status=404)

    mentor.approved = False
    mentor.save(update_fields=["approved"])
    audit_log(request.user, "reject", "mentor_approval", mentor.id)
    invalidate_approval_cache_mentor(mentor.id)
    return JsonResponse({"status": "ok", "mentor": _serialize_mentor_detail(mentor)})


@login_required
@require_http_methods(["POST"])
def approve_mentee(request):
    err = _require_staff(request)
    if err:
        return err

    from ..views import _get_payload, _get_int
    payload = _get_payload(request)
    mentee_id = _get_int(payload, "mentee_id") or _get_int(payload, "mentee")
    if not mentee_id:
        return JsonResponse({"error": "mentee_id is required."}, status=400)

    mentee = MenteeProfile.objects.filter(id=mentee_id).first()
    if not mentee:
        return JsonResponse({"error": "Mentee not found."}, status=404)

    mentee.approved = True
    mentee.save(update_fields=["approved"])
    audit_log(request.user, "approve", "mentee_approval", mentee.id)
    invalidate_approval_cache_mentee(mentee.id)
    return JsonResponse({"status": "ok", "mentee": _serialize_mentee_detail(mentee)})


@login_required
@require_http_methods(["POST"])
def reject_mentee(request):
    err = _require_staff(request)
    if err:
        return err

    from ..views import _get_payload, _get_int
    payload = _get_payload(request)
    mentee_id = _get_int(payload, "mentee_id") or _get_int(payload, "mentee")
    if not mentee_id:
        return JsonResponse({"error": "mentee_id is required."}, status=400)

    mentee = MenteeProfile.objects.filter(id=mentee_id).first()
    if not mentee:
        return JsonResponse({"error": "Mentee not found."}, status=404)

    mentee.approved = False
    mentee.save(update_fields=["approved"])
    audit_log(request.user, "reject", "mentee_approval", mentee.id)
    invalidate_approval_cache_mentee(mentee.id)
    return JsonResponse({"status": "ok", "mentee": _serialize_mentee_detail(mentee)})
