from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from accounts.models import get_user_display_name, UserProfile, get_user_profile
from profiles.models import MentorProfile, MenteeProfile, serialize_verification_documents
from .account_controller import _clear_me_cache

from ..views import (
    _require_staff,
    APPROVAL_LIST_CACHE_TTL,
    audit_log,
    get_approval_list_cache_key,
    invalidate_approval_cache_mentor,
    invalidate_approval_cache_mentee,
)


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
        and getattr(mentee, "sex", "")
    )


def _enrich_document_details(u, profile, doc_data, request=None):
    from accounts.models import MentorDocument
    from ..serializers import _build_absolute_file_url, _get_file_info
    docs = list(doc_data.get("verification_documents") or [])
    grouped = dict(doc_data.get("verification_documents_by_kind") or {})

    for item in docs:
        if item.get("url"):
            item["url"] = _build_absolute_file_url(item["url"], request)
        is_img, ftype = _get_file_info(item.get("name"), item.get("url"))
        item["is_image"] = is_img
        item["file_type"] = ftype

    existing_urls = {d.get("url") for d in docs if d.get("url")}
    for md in MentorDocument.objects.filter(user=u).order_by("-uploaded_at"):
        url = _build_absolute_file_url(md.cloudinary_url, request)
        if url and url not in existing_urls:
            existing_urls.add(url)
            label = dict(MentorDocument.DOCUMENT_TYPE_CHOICES).get(md.document_type, md.document_type)
            name = f"{label}.pdf"
            is_img, ftype = _get_file_info(name, url)
            entry = {
                "id": md.id,
                "kind": md.document_type.lower(),
                "label": label,
                "name": name,
                "url": url,
                "file_type": ftype,
                "is_image": is_img,
                "source": "cloudinary",
            }
            docs.append(entry)
            grouped.setdefault(entry["kind"], []).append(entry)

    first_url = docs[0]["url"] if docs else ""
    first_name = docs[0]["name"] if docs else ""

    proof_of_enrollment = ""
    id_card = ""
    for d in docs:
        k = d.get("kind", "").lower()
        if not proof_of_enrollment and any(term in k for term in ["study_load", "study", "enrollment", "load", "grade"]):
            proof_of_enrollment = d.get("url", "")
        if not id_card and any(term in k for term in ["faculty_verification", "id_card", "id", "card", "application"]):
            id_card = d.get("url", "")

    return {
        "documents": docs,
        "verification_documents": docs,
        "verification_documents_by_kind": grouped,
        "verification_document_url": first_url,
        "verification_document_name": first_name,
        "proof_of_enrollment_url": proof_of_enrollment or first_url,
        "id_card_url": id_card or first_url,
    }


def _serialize_mentor_detail(mentor, request=None):
    u = mentor.user
    up = getattr(u, "profile", None)
    display_name = get_user_display_name(u) or u.username
    subs = mentor.subjects if isinstance(mentor.subjects, list) else (list(mentor.subjects) if mentor.subjects else [])
    tops = mentor.topics if isinstance(mentor.topics, list) else (list(mentor.topics) if mentor.topics else [])
    comps = list(mentor.competency_levels.values_list("competency__name", flat=True)) if hasattr(mentor, "competency_levels") else tops
    prog = mentor.program or (up.program if up else "") or "BSIT"
    dept = getattr(up, "department", "") or (prog if "Department" in prog else f"{prog} Department")

    payload = {
        "id": mentor.id,
        "user_id": u.id,
        "username": u.username,
        "display_name": display_name,
        "full_name": display_name,
        "email": getattr(u, "email", "") or "",
        "student_id_no": getattr(up, "student_id_no", "") or "",
        "contact_no": getattr(up, "contact_no", "") or "",
        "campus": getattr(up, "campus", "Main") or "Main",
        "department": dept,
        "program": prog,
        "year_level": mentor.year_level or (up.year_level if up else 1),
        "admission_type": getattr(up, "admission_type", "") or "",
        "sex": getattr(mentor, "gender", "") or (getattr(up, "sex", "") if up else "") or "",
        "gpa": str(mentor.gpa) if mentor.gpa is not None else "",
        "avatar_url": mentor.avatar_url or "",
        "role": mentor.role or "Student Mentor",
        "role_label": mentor.role or "Student Mentor",
        "role_type": "mentor",
        "gender": getattr(mentor, "gender", "") or "",
        "subjects": subs,
        "topics": tops,
        "competencies": comps,
        "skills": comps or tops,
        "expertise_level": mentor.expertise_level,
        "capacity": getattr(mentor, "capacity", 1),
        "interests": mentor.interests or "",
        "approved": mentor.approved,
        "approval_status": getattr(up, "approval_status", "PENDING") if up else "PENDING",
        "general_info_complete": _mentor_general_info_complete(mentor),
    }
    raw_doc_data = serialize_verification_documents(mentor, request)
    payload.update(_enrich_document_details(u, mentor, raw_doc_data, request))
    return payload


def _serialize_mentee_detail(mentee, request=None):
    u = mentee.user
    up = getattr(u, "profile", None)
    display_name = get_user_display_name(u) or u.username
    subs = mentee.subjects if isinstance(mentee.subjects, list) else (list(mentee.subjects) if mentee.subjects else [])
    tops = mentee.topics if isinstance(mentee.topics, list) else (list(mentee.topics) if mentee.topics else [])
    comps = list(mentee.competency_needs.values_list("competency__name", flat=True)) if hasattr(mentee, "competency_needs") else tops
    prog = mentee.program or (up.program if up else "") or "BSIT"
    dept = getattr(up, "department", "") or (prog if "Department" in prog else f"{prog} Department")

    payload = {
        "id": mentee.id,
        "user_id": u.id,
        "username": u.username,
        "display_name": display_name,
        "full_name": display_name,
        "email": getattr(u, "email", "") or "",
        "student_id_no": getattr(mentee, "student_id_no", "") or (getattr(up, "student_id_no", "") if up else "") or "",
        "contact_no": getattr(mentee, "contact_no", "") or (getattr(up, "contact_no", "") if up else "") or "",
        "campus": getattr(mentee, "campus", "") or (getattr(up, "campus", "Main") if up else "Main") or "Main",
        "department": dept,
        "program": prog,
        "year_level": mentee.year_level or (up.year_level if up else 1),
        "admission_type": getattr(mentee, "admission_type", "") or (getattr(up, "admission_type", "") if up else "") or "",
        "sex": getattr(mentee, "sex", "") or (getattr(up, "sex", "") if up else "") or "",
        "gpa": str(mentee.gpa) if mentee.gpa is not None else "",
        "avatar_url": mentee.avatar_url or "",
        "role": "Mentee",
        "role_label": "Mentee",
        "role_type": "mentee",
        "subjects": subs,
        "topics": tops,
        "competencies": comps,
        "skills": comps or tops,
        "difficulty_level": mentee.difficulty_level,
        "support_need": mentee.difficulty_level,
        "interests": mentee.interests or "",
        "approved": mentee.approved,
        "approval_status": getattr(up, "approval_status", "PENDING") if up else "PENDING",
        "general_info_complete": _mentee_general_info_complete(mentee),
    }
    raw_doc_data = serialize_verification_documents(mentee, request)
    payload.update(_enrich_document_details(u, mentee, raw_doc_data, request))
    return payload


@login_required
@require_GET
def pending_list(request):
    err = _require_staff(request)
    if err:
        return err

    cache_key = get_approval_list_cache_key(request.user.id)
    cached_payload = cache.get(cache_key)
    if cached_payload is not None:
        return JsonResponse(cached_payload)

    pending_mentors = (
        MentorProfile.objects.select_related("user")
        .prefetch_related("verification_documents")
        .filter(approved=False)
        .exclude(user=request.user)
        .order_by("user__username")
    )
    pending_mentees = (
        MenteeProfile.objects.select_related("user")
        .prefetch_related("verification_documents")
        .filter(approved=False)
        .exclude(user=request.user)
        .order_by("user__username")
    )

    mentors_data = [_serialize_mentor_detail(m, request) for m in pending_mentors]
    mentees_data = [_serialize_mentee_detail(m, request) for m in pending_mentees]

    # Sort: general info complete first, then by display name.
    mentors_data.sort(key=lambda x: (not x.get("general_info_complete", False), (x.get("display_name") or x.get("username") or "").lower()))
    mentees_data.sort(key=lambda x: (not x.get("general_info_complete", False), (x.get("display_name") or x.get("username") or "").lower()))

    payload = {
        "pending_mentors": mentors_data,
        "pending_mentees": mentees_data,
    }
    cache.set(cache_key, payload, timeout=APPROVAL_LIST_CACHE_TTL)
    return JsonResponse(payload)


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
    up = getattr(mentor.user, "profile", None) or get_user_profile(mentor.user)
    if up:
        up.approval_status = UserProfile.STATUS_ACTIVE
        up.save(update_fields=["approval_status"])
    audit_log(request.user, "approve", "mentor_approval", mentor.id)
    invalidate_approval_cache_mentor(mentor.id)
    _clear_me_cache(mentor.user_id)
    return JsonResponse({"status": "ok", "mentor": _serialize_mentor_detail(mentor, request)})


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
    up = getattr(mentor.user, "profile", None) or get_user_profile(mentor.user)
    if up:
        up.approval_status = UserProfile.STATUS_REJECTED
        up.save(update_fields=["approval_status"])
    audit_log(request.user, "reject", "mentor_approval", mentor.id)
    invalidate_approval_cache_mentor(mentor.id)
    _clear_me_cache(mentor.user_id)
    return JsonResponse({"status": "ok", "mentor": _serialize_mentor_detail(mentor, request)})


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
    up = getattr(mentee.user, "profile", None) or get_user_profile(mentee.user)
    if up:
        up.approval_status = UserProfile.STATUS_ACTIVE
        up.save(update_fields=["approval_status"])
    audit_log(request.user, "approve", "mentee_approval", mentee.id)
    invalidate_approval_cache_mentee(mentee.id)
    _clear_me_cache(mentee.user_id)
    return JsonResponse({"status": "ok", "mentee": _serialize_mentee_detail(mentee, request)})


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
    up = getattr(mentee.user, "profile", None) or get_user_profile(mentee.user)
    if up:
        up.approval_status = UserProfile.STATUS_REJECTED
        up.save(update_fields=["approval_status"])
    audit_log(request.user, "reject", "mentee_approval", mentee.id)
    invalidate_approval_cache_mentee(mentee.id)
    _clear_me_cache(mentee.user_id)
    return JsonResponse({"status": "ok", "mentee": _serialize_mentee_detail(mentee, request)})
