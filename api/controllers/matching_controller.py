from django.contrib.auth.decorators import login_required
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from matching.models import MentorProfile, MenteeProfile, Notification, MenteeMentorRequest
from matching.services import (
    run_greedy_matching,
    recommend_mentors_for_mentee_with_meta,
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


@login_required
@require_GET
def run_matching(request):
    role_error = _require_role(request)
    if role_error:
        return role_error
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
        data.append(
            {
                "mentor_id": mid,
                "mentor_username": m.user.username if m else None,
                "mentor": _serialize_mentor_for_matching(m, request),
                "mentee_id": eid,
                "mentee_username": e.user.username if e else None,
                "mentee": _serialize_mentee_for_matching(e, request),
                "score": round(float(score), 4),
                "match_details": {
                    "common_subjects": overlap_subjects,
                    "common_topics": overlap_topics,
                    "mentor_subjects": mentor_subjects,
                    "mentor_topics": mentor_topics,
                    "mentee_subjects": mentee_subjects,
                    "mentee_topics": mentee_topics,
                },
            }
        )
    logger.info(
        "matching_run", extra={"count": len(data), "mode": mode, "user_id": request.user.id}
    )
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
    data = []
    mentee_subjects = (
        mentee_profile.subjects
        if isinstance(mentee_profile.subjects, list)
        else ([mentee_profile.subjects] if mentee_profile.subjects else [])
    )
    mentee_topics = (
        mentee_profile.topics
        if isinstance(mentee_profile.topics, list)
        else ([mentee_profile.topics] if mentee_profile.topics else [])
    )
    mentee_subj_set = {str(x).strip().lower() for x in mentee_subjects if x}
    mentee_top_set = {str(x).strip().lower() for x in mentee_topics if x}

    for mentor, score in recommendations:
        mentor_subjects = (
            mentor.subjects
            if isinstance(mentor.subjects, list)
            else ([mentor.subjects] if mentor.subjects else [])
        )
        mentor_topics = (
            mentor.topics
            if isinstance(mentor.topics, list)
            else ([mentor.topics] if mentor.topics else [])
        )
        overlap_subjects = [
            s for s in mentor_subjects if s and str(s).strip().lower() in mentee_subj_set
        ]
        overlap_topics = [
            t for t in mentor_topics if t and str(t).strip().lower() in mentee_top_set
        ]
        data.append(
            {
                "mentor_id": mentor.id,
                "mentor_username": mentor.user.username,
                "mentor": _serialize_mentor_for_matching(mentor, request),
                "mentee_id": mentee_profile.id,
                "mentee_username": mentee_profile.user.username,
                "mentee": _serialize_mentee_for_matching(mentee_profile, request),
                "score": round(float(score), 4),
                "match_details": {
                    "common_subjects": overlap_subjects,
                    "common_topics": overlap_topics,
                    "mentor_subjects": mentor_subjects,
                    "mentor_topics": mentor_topics,
                    "mentee_subjects": mentee_subjects,
                    "mentee_topics": mentee_topics,
                },
            }
        )

    logger.info(
        "mentee_recommendations",
        extra={"count": len(data), "user_id": request.user.id},
    )
    payload = {"count": len(data), "results": data}
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
    This sends a notification to the chosen mentor so they can follow up.
    """
    mentee_profile, error = _require_mentee(request)
    if error:
        return error
    payload = _get_payload(request)
    mentor_id = _get_int(payload, "mentor_id")
    if not mentor_id:
        return JsonResponse({"error": "mentor_id is required."}, status=400)
    mentor = MentorProfile.objects.select_related("user").filter(id=mentor_id).first()
    if not mentor:
        return JsonResponse({"error": "Mentor not found."}, status=404)

    MenteeMentorRequest.objects.get_or_create(mentee=mentee_profile, mentor=mentor)
    Notification.objects.create(
        user=mentor.user,
        message=f"{mentee_profile.user.username} has requested you as a mentor.",
        action_tab="matching",
    )
    logger.info(
        "mentee_chose_mentor",
        extra={"mentee_id": mentee_profile.id, "mentor_id": mentor.id},
    )
    return JsonResponse({"status": "ok"})


@login_required
@require_GET
def mentor_requests(request):
    """Return mentees who have requested the current user as mentor, with subjects/topics/difficulty."""
    mentor_profile = getattr(request.user, "mentor_profile", None)
    if not mentor_profile:
        return JsonResponse({"error": "Mentor profile required."}, status=403)
    if not get_mentor_approved(mentor_profile) and not request.user.is_staff:
        return JsonResponse(
            {"error": "Mentor account pending approval."},
            status=403,
        )
    requests_list = MenteeMentorRequest.objects.filter(mentor=mentor_profile).select_related("mentee", "mentee__user").order_by("-created_at")
    data = []
    for r in requests_list:
        e = r.mentee
        subjects = e.subjects if isinstance(e.subjects, list) else ([e.subjects] if e.subjects else [])
        topics = e.topics if isinstance(e.topics, list) else ([e.topics] if e.topics else [])
        data.append({
            "mentee_id": e.id,
            "mentee_username": e.user.username,
            "created_at": r.created_at.isoformat(),
            "accepted": r.accepted,
            "accepted_at": r.accepted_at.isoformat() if r.accepted_at else None,
            "request_id": r.id,
            "mentee_subjects": subjects,
            "mentee_topics": topics,
            "mentee_difficulty_level": e.difficulty_level,
        })
    return JsonResponse({"count": len(data), "results": data})


@login_required
@require_http_methods(["POST"])
def mentor_accept_mentee(request):
    """Mentor accepts a mentee request; makes the mentee an official mentee of the mentor."""
    mentor_profile = getattr(request.user, "mentor_profile", None)
    if not mentor_profile:
        return JsonResponse({"error": "Mentor profile required."}, status=403)
    if not get_mentor_approved(mentor_profile):
        return JsonResponse({"error": "Mentor account pending approval."}, status=403)
    payload = _get_payload(request)
    mentee_id = _get_int(payload, "mentee_id")
    if not mentee_id:
        return JsonResponse({"error": "mentee_id is required."}, status=400)
    from django.utils import timezone
    req = MenteeMentorRequest.objects.filter(mentor=mentor_profile, mentee_id=mentee_id).first()
    if not req:
        return JsonResponse({"error": "Request not found."}, status=404)
    if req.accepted:
        return JsonResponse({"error": "Already accepted."}, status=400)
    req.accepted = True
    req.accepted_at = timezone.now()
    req.save(update_fields=["accepted", "accepted_at"])
    cache.delete(f"sessions_list:{request.user.id}")
    cache.delete(f"sessions_list:{req.mentee.user_id}")
    Notification.objects.create(
        user=req.mentee.user,
        message=f"{mentor_profile.user.username} has accepted you as their mentee. You can now schedule sessions in Sessions.",
        action_tab="sessions",
    )
    audit_log(request.user, "accept_mentee", "mentee_mentor_request", req.id)
    logger.info("mentor_accepted_mentee", extra={"mentor_id": mentor_profile.id, "mentee_id": req.mentee_id})
    return JsonResponse({"status": "ok", "accepted_at": req.accepted_at.isoformat()})


@login_required
@require_GET
def my_mentor(request):
    """For mentees: return the mentor who has accepted them (official mentor), if any."""
    mentee_profile, error = _require_mentee(request)
    if error:
        return error
    req = MenteeMentorRequest.objects.filter(mentee=mentee_profile, accepted=True).select_related("mentor", "mentor__user").order_by("-accepted_at").first()
    if not req:
        return JsonResponse({"mentor": None})
    m = req.mentor
    return JsonResponse({
        "mentor": {
            "id": m.id,
            "username": m.user.username,
            "accepted_at": req.accepted_at.isoformat(),
        },
    })

