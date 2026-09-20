from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction
from django.db.models import Count
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from accounts.models import get_user_display_name
from matching.models import (
    MentorProfile,
    MenteeProfile,
    Competency,
    Notification,
    MenteeMentorRequest,
)
from matching.services import (
    run_greedy_matching,
    recommend_mentors_for_mentee_with_meta,
    compute_score,
    compute_score_breakdown,
)

from ..views import (
    _require_role,
    _require_mentee,
    _get_payload,
    _get_int,
    _serialize_mentor_for_matching,
    _serialize_mentee_for_matching,
    get_mentor_approved,
    get_mentee_approved,
    audit_log,
    logger,
)
from ..permissions import IsApprovedByCoordinator


def _require_coordinator_approval(request):
    if not IsApprovedByCoordinator().has_permission(request):
        return JsonResponse(
            {"error": "Account pending approval by coordinator."},
            status=403,
        )
    return None



def _recommendations_empty_message(empty_reason: str) -> str:
    if empty_reason == "no_mentors":
        return "No mentors are currently available."
    if empty_reason == "gender_preference":
        return 'No mentors match your gender preference. Try selecting "No Preference".'
    if empty_reason == "all_full":
        return "All mentors have reached their mentee capacity. Please try again later."
    if empty_reason == "no_time_overlap":
        return "No mentors match your current schedule. Try adjusting your availability."
    return "No mentor recommendations yet. Try updating your matching questionnaire."


def _email_from_address() -> str:
    return getattr(settings, "DEFAULT_FROM_EMAIL", "") or getattr(settings, "EMAIL_HOST_USER", "")


def _subject_list(values):
    if isinstance(values, list):
        return [v for v in values if v]
    if values:
        return [values]
    return []


def _build_match_details(mentee_profile, mentor):
    mentee_subjects = _subject_list(getattr(mentee_profile, "subjects", []))
    mentee_topics = _subject_list(getattr(mentee_profile, "topics", []))
    mentor_subjects = _subject_list(getattr(mentor, "subjects", []))
    mentor_topics = _subject_list(getattr(mentor, "topics", []))
    mentee_subj_set = {str(x).strip().lower() for x in mentee_subjects if x}
    mentee_top_set = {str(x).strip().lower() for x in mentee_topics if x}
    overlap_subjects = [
        s for s in mentor_subjects if s and str(s).strip().lower() in mentee_subj_set
    ]
    overlap_topics = [
        t for t in mentor_topics if t and str(t).strip().lower() in mentee_top_set
    ]
    mentor_competency_ids = set(mentor.competencies.values_list("id", flat=True))
    mentee_competency_ids = set(mentee_profile.competencies.values_list("id", flat=True))
    shared_competency_ids = mentor_competency_ids & mentee_competency_ids
    shared_competencies = []
    if shared_competency_ids:
        shared_competencies = list(
            Competency.objects.filter(id__in=shared_competency_ids)
            .order_by("name")
            .values_list("name", flat=True)
        )
    breakdown = None
    try:
        breakdown = compute_score_breakdown(mentor, mentee_profile)
    except Exception as exc:
        logger.warning("compute_score_breakdown_failed", extra={"error": str(exc)})

    return {
        "common_subjects": overlap_subjects,
        "common_topics": overlap_topics,
        "common_competencies": shared_competencies,
        "mentor_subjects": mentor_subjects,
        "mentor_topics": mentor_topics,
        "mentee_subjects": mentee_subjects,
        "mentee_topics": mentee_topics,
        "score_breakdown": breakdown,
    }


def _paired_mentor_ids_for_mentee(mentee_profile):
    return set(
        MenteeMentorRequest.objects.filter(
            mentee=mentee_profile,
            accepted=True,
        ).values_list("mentor_id", flat=True)
    )


def _notify_coordinators_of_match(mentee_name: str, mentor_name: str) -> None:
    """Notify every coordinator/admin (staff) that a new mentee–mentor pairing was formed.

    The message includes a suggested next action and routes the coordinator to the
    Users tab, where they can review the pairing and follow up.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    staff_users = list(User.objects.filter(is_staff=True, is_active=True))
    if not staff_users:
        return
    message = (
        f"New match: {mentee_name} is now paired with {mentor_name}. "
        "Open Users to review the pairing and follow up with both if needed."
    )[:255]
    Notification.objects.bulk_create(
        [
            Notification(user=staff_user, message=message, action_tab="users")
            for staff_user in staff_users
        ]
    )


def _send_pairing_email(recipient_email: str, subject: str, message: str) -> bool:
    if not recipient_email:
        return False
    from_email = _email_from_address()
    if not from_email:
        logger.warning("pairing_email_skipped_no_from")
        return False
    try:
        send_mail(
            subject,
            message,
            from_email,
            [recipient_email],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("pairing_email_send_failed", extra={"to": recipient_email, "subject": subject})
        return False


@login_required
@require_GET
def run_matching(request):
    role_error = _require_role(request)
    if role_error:
        return role_error
    approval_error = _require_coordinator_approval(request)
    if approval_error:
        return approval_error
    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)
    if mentor and not get_mentor_approved(mentor) and not request.user.is_staff:
        return JsonResponse(
            {"error": "Mentor account pending approval by coordinator."}, status=403
        )
    if mentee and not get_mentee_approved(mentee) and not request.user.is_staff:
        return JsonResponse(
            {"error": "Mentee account pending approval by coordinator."}, status=403
        )
    mode = (request.GET.get("mode") or "one_to_one").strip().lower()
    if mode not in ("one_to_one", "group"):
        mode = "one_to_one"
    min_score = request.GET.get("min_score")
    if min_score is not None:
        try:
            min_score = float(min_score)
        except (TypeError, ValueError):
            min_score = 0.3 if mode == "group" else None
    elif mode == "group":
        min_score = 0.3
    pairs = run_greedy_matching(mode=mode, min_score=min_score)
    mentor_map = {
        m.id: m for m in MentorProfile.objects.filter(id__in=[p[0] for p in pairs])
    }
    mentee_map = {
        e.id: e for e in MenteeProfile.objects.filter(id__in=[p[1] for p in pairs])
    }
    data = []
    for mid, eid, score in pairs:
        m = mentor_map.get(mid)
        e = mentee_map.get(eid)
        mentor_subjects = (m.subjects if isinstance(m.subjects, list) else []) if m else []
        mentee_subjects = (e.subjects if isinstance(e.subjects, list) else []) if e else []
        mentor_topics = (m.topics if isinstance(m.topics, list) else []) if m else []
        mentee_topics = (e.topics if isinstance(e.topics, list) else []) if e else []
        mentee_subj_set = {str(x).strip().lower() for x in mentee_subjects if x}
        mentee_top_set = {str(x).strip().lower() for x in mentee_topics if x}
        overlap_subjects = [
            s for s in mentor_subjects if s and str(s).strip().lower() in mentee_subj_set
        ]
        overlap_topics = [
            t for t in mentor_topics if t and str(t).strip().lower() in mentee_top_set
        ]
        mentor_competency_ids = set(m.competencies.values_list("id", flat=True)) if m else set()
        mentee_competency_ids = set(e.competencies.values_list("id", flat=True)) if e else set()
        shared_competency_ids = mentor_competency_ids & mentee_competency_ids
        shared_competencies = []
        if shared_competency_ids:
            shared_competencies = list(
                Competency.objects.filter(id__in=shared_competency_ids)
                .order_by("name")
                .values_list("name", flat=True)
            )
        breakdown = None
        if m and e:
            try:
                breakdown = compute_score_breakdown(m, e)
            except Exception:
                pass
        data.append(
            {
                "mentor_id": mid,
                "mentor_username": m.user.username if m else None,
                "mentor_display_name": (get_user_display_name(m.user) or m.user.username) if m else None,
                "mentor": _serialize_mentor_for_matching(m, request),
                "mentee_id": eid,
                "mentee_username": e.user.username if e else None,
                "mentee_display_name": (get_user_display_name(e.user) or e.user.username) if e else None,
                "mentee": _serialize_mentee_for_matching(e, request),
                "score": round(float(score), 4),
                "score_breakdown": breakdown,
                "match_details": {
                    "common_subjects": overlap_subjects,
                    "common_topics": overlap_topics,
                    "common_competencies": shared_competencies,
                    "mentor_subjects": mentor_subjects,
                    "mentor_topics": mentor_topics,
                    "mentee_subjects": mentee_subjects,
                    "mentee_topics": mentee_topics,
                    "score_breakdown": breakdown,
                },
            }
        )
    logger.info(
        "matching_run", extra={"count": len(data), "mode": mode, "user_id": request.user.id}
    )
    audit_log(request.user, "run", "matching", mode)
    return JsonResponse(
        {
            "count": len(data),
            "results": data,
            "mode": mode,
            "min_score": min_score if mode == "group" else None,
        }
    )


@login_required
@require_GET
def mentee_recommendations(request):
    """Return a list of mentor recommendations for the current mentee."""
    mentee_profile, error = _require_mentee(request)
    if error:
        return error
    approval_error = _require_coordinator_approval(request)
    if approval_error:
        return approval_error
    if not get_mentee_approved(mentee_profile):
        return JsonResponse(
            {"error": "Mentee account pending approval by coordinator."},
            status=403,
        )
    try:
        limit = int(request.GET.get("limit") or 10)
    except (TypeError, ValueError):
        limit = 10
    try:
        min_score = float(request.GET.get("min_score") or 0.0)
    except (TypeError, ValueError):
        min_score = 0.0

    recommendations, filter_meta = recommend_mentors_for_mentee_with_meta(
        mentee_profile,
        limit=limit,
        min_score=min_score,
    )
    mentor_ids = [mentor.id for mentor, _score in recommendations]
    accepted_rows = (
        MenteeMentorRequest.objects.filter(accepted=True, mentor_id__in=mentor_ids)
        .values("mentor_id")
        .annotate(total=Count("id"))
    )
    accepted_counts = {
        int(row["mentor_id"]): int(row["total"] or 0) for row in accepted_rows
    }
    paired_mentor_ids = _paired_mentor_ids_for_mentee(mentee_profile)
    data = []

    for mentor, score in recommendations:
        if mentor.id in paired_mentor_ids:
            continue
        capacity = max(int(getattr(mentor, "capacity", 0) or 0), 0)
        slots_left = max(capacity - int(accepted_counts.get(mentor.id, 0)), 0)
        match_details = _build_match_details(mentee_profile, mentor)
        data.append(
            {
                "mentor_id": mentor.id,
                "mentor_username": mentor.user.username,
                "mentor_display_name": get_user_display_name(mentor.user) or mentor.user.username,
                "mentor": _serialize_mentor_for_matching(mentor, request),
                "slots_left": slots_left,
                "is_available": slots_left > 0,
                "mentee_id": mentee_profile.id,
                "mentee_username": mentee_profile.user.username,
                "mentee_display_name": get_user_display_name(mentee_profile.user) or mentee_profile.user.username,
                "mentee": _serialize_mentee_for_matching(mentee_profile, request),
                "score": round(float(score), 4),
                "score_breakdown": match_details.get("score_breakdown"),
                "match_details": match_details,
            }
        )

    logger.info(
        "mentee_recommendations",
        extra={"count": len(data), "user_id": request.user.id},
    )
    payload = {
        "count": len(data),
        "results": data,
        "from_cache": bool(filter_meta.get("from_cache")),
        "elapsed_ms": int(filter_meta.get("elapsed_ms") or 0),
    }
    if len(data) == 0:
        empty_reason = filter_meta.get("empty_reason")
        payload["empty_reason"] = empty_reason
        payload["message"] = _recommendations_empty_message(empty_reason)
        payload["suggested_time_slots"] = filter_meta.get("suggested_time_slots", [])
    return JsonResponse(payload)


@login_required
@require_http_methods(["POST"])
def mentee_choose_mentor(request):
    """
    Allow a mentee to choose a mentor from their recommendations.
    Requests are auto-accepted unless the mentor has reached mentee capacity.
    """
    mentee_profile, error = _require_mentee(request)
    if error:
        return error
    approval_error = _require_coordinator_approval(request)
    if approval_error:
        return approval_error
    payload = _get_payload(request)
    mentor_id = _get_int(payload, "mentor_id")
    if not mentor_id:
        return JsonResponse({"error": "mentor_id is required."}, status=400)
    with transaction.atomic():
        mentor = (
            MentorProfile.objects.select_for_update()
            .select_related("user")
            .filter(id=mentor_id)
            .first()
        )
        if not mentor:
            return JsonResponse({"error": "Mentor not found."}, status=404)

        capacity = max(int(getattr(mentor, "capacity", 0) or 0), 0)
        accepted_count = MenteeMentorRequest.objects.filter(
            mentor=mentor,
            accepted=True,
        ).count()
        if accepted_count >= capacity:
            mentee_name = get_user_display_name(mentee_profile.user) or mentee_profile.user.username
            mentor_name = get_user_display_name(mentor.user) or mentor.user.username
            _send_pairing_email(
                getattr(mentee_profile.user, "email", "") or "",
                "Mentor currently full",
                (
                    f"Hi {mentee_name},\n\n"
                    f"{mentor_name} currently has a full mentee slot capacity. "
                    "Please choose another mentor recommendation.\n\n"
                    "You can return to the Matching tab to pick another mentor."
                ),
            )
            return JsonResponse(
                {
                    "error": "This mentor is no longer available",
                    "code": "mentor_capacity_full",
                },
                status=409,
            )

        active_mentee_pairings = MenteeMentorRequest.objects.filter(
            mentee=mentee_profile,
            accepted=True,
        ).exclude(mentor=mentor).count()
        if active_mentee_pairings >= 3:
            return JsonResponse(
                {
                    "error": "You have reached the maximum allowed mentor pairings (3).",
                    "code": "mentee_max_pairings_reached",
                },
                status=409,
            )

        from django.utils import timezone

        req, _created = MenteeMentorRequest.objects.get_or_create(
            mentee=mentee_profile,
            mentor=mentor,
        )
        if not _created and req.accepted:
            return JsonResponse({
                "status": "ok",
                "message": "Already paired with this mentor.",
                "accepted": True,
                "accepted_at": req.accepted_at.isoformat() if req.accepted_at else None,
            })

        if not req.accepted:
            req.accepted = True
            req.accepted_at = timezone.now()
            req.save(update_fields=["accepted", "accepted_at"])

    mentee_name = get_user_display_name(mentee_profile.user) or mentee_profile.user.username
    mentor_name = get_user_display_name(mentor.user) or mentor.user.username

    Notification.objects.create(
        user=mentor.user,
        message=f"{mentee_name} has chosen you as a mentor. The pairing is now active.",
        action_tab="matching",
    )
    Notification.objects.create(
        user=mentee_profile.user,
        message=f"You are now paired with {mentor_name}. Open Matching to view your mentor.",
        action_tab="matching",
    )
    _notify_coordinators_of_match(mentee_name, mentor_name)

    _send_pairing_email(
        getattr(mentor.user, "email", "") or "",
        "New mentee pairing confirmed",
        (
            f"Hi {mentor_name},\n\n"
            f"{mentee_name} has been paired with you as a mentee.\n\n"
            "Open Matching in the dashboard to continue."
        ),
    )
    _send_pairing_email(
        getattr(mentee_profile.user, "email", "") or "",
        "Mentor pairing confirmed",
        (
            f"Hi {mentee_name},\n\n"
            f"You are now paired with {mentor_name}.\n\n"
            "Open Matching in the dashboard to view your mentor and stay in touch."
        ),
    )

    audit_log(request.user, "create", "mentee_mentor_request", req.id)
    logger.info(
        "mentee_chose_mentor_auto_accepted",
        extra={
            "mentee_id": mentee_profile.id,
            "mentor_id": mentor.id,
            "accepted_at": req.accepted_at.isoformat() if req.accepted_at else None,
        },
    )
    return JsonResponse(
        {
            "status": "ok",
            "accepted": True,
            "accepted_at": req.accepted_at.isoformat() if req.accepted_at else None,
        }
    )


@login_required
@require_GET
def mentor_requests(request):
    """Return mentees who have requested the current user as mentor, with subjects/topics/difficulty."""
    mentor_profile = getattr(request.user, "mentor_profile", None)
    if not mentor_profile:
        return JsonResponse({"error": "Mentor profile required."}, status=403)
    approval_error = _require_coordinator_approval(request)
    if approval_error:
        return approval_error
    if not get_mentor_approved(mentor_profile) and not request.user.is_staff:
        return JsonResponse(
            {"error": "Mentor account pending approval."},
            status=403,
        )
    with transaction.atomic():
        mentor_locked = MentorProfile.objects.select_for_update().filter(id=mentor_profile.id).first()
        if not mentor_locked:
            return JsonResponse({"error": "Mentor profile required."}, status=403)
        requests_list = list(
            MenteeMentorRequest.objects.filter(mentor=mentor_locked)
            .select_related("mentee", "mentee__user")
            .prefetch_related("mentee__competencies", "mentor__competencies")
            .order_by("-created_at")
        )
        accepted_count = sum(1 for r in requests_list if r.accepted)
        capacity = max(int(getattr(mentor_locked, "capacity", 0) or 0), 0)
        for r in requests_list:
            if r.accepted:
                continue
            if accepted_count >= capacity:
                continue
            from django.utils import timezone

            r.accepted = True
            r.accepted_at = timezone.now()
            r.save(update_fields=["accepted", "accepted_at"])
            accepted_count += 1

    data = []
    for r in requests_list:
        e = r.mentee
        subjects = e.subjects if isinstance(e.subjects, list) else ([e.subjects] if e.subjects else [])
        topics = e.topics if isinstance(e.topics, list) else ([e.topics] if e.topics else [])
        slots_left = max(capacity - accepted_count, 0)
        status = "official" if r.accepted else "not_available"
        mentee_avatar = ""
        if getattr(e, "avatar_url", None):
            from api.views.helpers import _avatar_url

            mentee_avatar = _avatar_url(request, e.avatar_url)
        match_details = _build_match_details(e, mentor_locked)
        try:
            score = round(float(compute_score(mentor_locked, e)), 4)
        except Exception:
            score = 0.85
        data.append({
            "mentee_id": e.id,
            "mentee_user_id": e.user_id,
            "mentee_username": e.user.username,
            "mentee_display_name": get_user_display_name(e.user) or e.user.username,
            "mentee_avatar_url": mentee_avatar,
            "created_at": r.created_at.isoformat(),
            "accepted": r.accepted,
            "accepted_at": r.accepted_at.isoformat() if r.accepted_at else None,
            "request_id": r.id,
            "status": status,
            "slots_left": slots_left,
            "score": score,
            "score_breakdown": match_details.get("score_breakdown"),
            "match_details": match_details,
            "mentee_subjects": subjects,
            "mentee_topics": topics,
            "mentee_difficulty_level": e.difficulty_level,
            "mentee_bio": getattr(e, "bio", "") or "",
            "mentee_program": getattr(e, "program", "") or "",
            "mentee_year_level": getattr(e, "year_level", None) or 0,
            "mentee_email": e.user.email or "",
            "mentee_preferred_learning_style": getattr(e, "preferred_learning_style", "") or "",
            "mentee_availability": e.availability if isinstance(getattr(e, "availability", []), list) else [],
        })
    return JsonResponse({"count": len(data), "results": data})


@login_required
@require_http_methods(["POST"])
def mentor_accept_mentee(request):
    """Legacy endpoint retained for compatibility. Manual acceptance is disabled."""
    return JsonResponse(
        {
            "error": "Manual acceptance is disabled. Requests are auto-accepted when a mentor has available slots.",
            "code": "manual_accept_disabled",
        },
        status=410,
    )


@login_required
@require_GET
def mentor_profile_by_user_id(request, user_id):
    """
    Return a single mentor's profile by user id for display (e.g. bookmarkable mentor profile page).
    Only approved mentors are returned. Payload shape matches one recommendation item for viewedMentorProfile.
    """
    mentor = (
        MentorProfile.objects.select_related("user")
        .filter(user_id=user_id)
        .first()
    )
    if not mentor:
        return JsonResponse({"error": "Mentor not found."}, status=404)
    if not get_mentor_approved(mentor) and not request.user.is_staff:
        return JsonResponse({"error": "Mentor not found."}, status=404)
    payload = {
        "mentor_id": mentor.id,
        "mentor_username": mentor.user.username,
        "mentor_display_name": get_user_display_name(mentor.user) or mentor.user.username,
        "mentor": _serialize_mentor_for_matching(mentor, request),
        "match_details": {},
    }
    return JsonResponse(payload)


@login_required
@require_GET
def my_mentor(request):
    """For mentees: return the mentor who has accepted them (official mentor), if any."""
    mentee_profile, error = _require_mentee(request)
    if error:
        return error
    approval_error = _require_coordinator_approval(request)
    if approval_error:
        return approval_error
    req = (
        MenteeMentorRequest.objects.filter(mentee=mentee_profile, accepted=True)
        .select_related("mentor", "mentor__user", "mentee")
        .prefetch_related("mentor__competencies", "mentee__competencies")
        .order_by("-accepted_at")
        .first()
    )
    if not req:
        return JsonResponse({"mentor": None})
    m = req.mentor
    mentor_payload = _serialize_mentor_for_matching(m, request)
    mentor_payload["accepted_at"] = req.accepted_at.isoformat()
    mentor_payload["match_details"] = _build_match_details(mentee_profile, m)
    mentor_payload["score_breakdown"] = mentor_payload["match_details"].get("score_breakdown")
    mentor_payload["score"] = round(float(compute_score(m, mentee_profile)), 4)
    return JsonResponse({"mentor": mentor_payload})


@login_required
@require_GET
def admin_pairings(request):
    """
    Staff-only endpoint: return all confirmed mentee-mentor pairings
    with rich matching details (compatibility score, shared subjects, shared competencies, schedules).
    """
    if not request.user.is_staff:
        return JsonResponse({"error": "Unauthorized. Staff access required."}, status=403)

    requests = (
        MenteeMentorRequest.objects.filter(accepted=True)
        .select_related("mentor", "mentor__user", "mentee", "mentee__user")
        .prefetch_related("mentor__competencies", "mentee__competencies")
        .order_by("-accepted_at", "-created_at")
    )
    results = []
    for req in requests:
        m = req.mentor
        e = req.mentee
        if not m or not e:
            continue
        mentor_data = _serialize_mentor_for_matching(m, request)
        mentee_data = _serialize_mentee_for_matching(e, request)
        match_details = _build_match_details(e, m)
        try:
            score = round(float(compute_score(m, e)), 4)
        except Exception:
            score = 0.85

        results.append(
            {
                "id": req.id,
                "accepted": req.accepted,
                "accepted_at": req.accepted_at.isoformat() if req.accepted_at else None,
                "created_at": req.created_at.isoformat() if req.created_at else None,
                "score": score,
                "score_breakdown": match_details.get("score_breakdown"),
                "mentor_id": m.id,
                "mentor_user_id": m.user_id,
                "mentor_username": m.user.username,
                "mentor_display_name": get_user_display_name(m.user) or m.user.username,
                "mentor": mentor_data,
                "mentee_id": e.id,
                "mentee_user_id": e.user_id,
                "mentee_username": e.user.username,
                "mentee_display_name": get_user_display_name(e.user) or e.user.username,
                "mentee": mentee_data,
                "match_details": match_details,
            }
        )
    return JsonResponse({"count": len(results), "results": results})


