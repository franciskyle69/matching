from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.db.models import Q, Value, CharField, Case, When
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from accounts.models import get_user_display_name
from matching.models import MentoringSession


User = get_user_model()


def _user_avatar(user_obj):
    mp = getattr(user_obj, "mentor_profile", None)
    if mp and getattr(mp, "avatar_url", ""):
        return mp.avatar_url
    me = getattr(user_obj, "mentee_profile", None)
    if me and getattr(me, "avatar_url", ""):
        return me.avatar_url
    return ""


def _user_role(user_obj):
    if hasattr(user_obj, "mentor_profile"):
        return "mentor"
    if hasattr(user_obj, "mentee_profile"):
        return "mentee"
    return "user"


def search(request):
    """
    Lightweight global search used by the dashboard topbar.

    Returns a small mixed list of users (mentors/mentees) and sessions so the
    frontend can show autocomplete suggestions.
    """
    q = (request.GET.get("q") or "").strip()
    if not q:
        return JsonResponse({"results": []})

    user_filter = (
        Q(username__icontains=q)
        | Q(email__icontains=q)
        | Q(first_name__icontains=q)
        | Q(last_name__icontains=q)
        | Q(mentor_profile__subjects__icontains=q)
        | Q(mentor_profile__topics__icontains=q)
        | Q(mentee_profile__program__icontains=q)
        | Q(mentee_profile__student_id_no__icontains=q)
    )
    users = (
        User.objects.filter(user_filter, is_active=True)
        .select_related("mentor_profile", "mentee_profile")
        .distinct()[:10]
    )

    session_filter = (
        Q(subject__name__icontains=q)
        | Q(topic__name__icontains=q)
        | Q(mentor__user__username__icontains=q)
        | Q(mentee__user__username__icontains=q)
    )
    sessions = (
        MentoringSession.objects.select_related(
            "mentor__user", "mentee__user", "subject", "topic"
        )
        .filter(session_filter)[:5]
    )

    results = []

    for u in users:
        role = _user_role(u)
        results.append(
            {
                "type": "user",
                "id": u.id,
                "label": get_user_display_name(u) or u.username,
                "role": role,
                "avatar_url": _user_avatar(u),
            }
        )

    for s in sessions:
        mentor_user = getattr(s.mentor, "user", None)
        mentee_user = getattr(s.mentee, "user", None)
        mentor_name = get_user_display_name(mentor_user) if mentor_user else ""
        mentee_name = get_user_display_name(mentee_user) if mentee_user else ""
        mentor_name = mentor_name or "Mentor"
        mentee_name = mentee_name or "Mentee"
        subject_name = s.subject.name if s.subject else "Session"
        topic_name = s.topic.name if s.topic else ""
        label = subject_name
        if topic_name:
            label += f" · {topic_name}"
        label += f" with {mentor_name} / {mentee_name}"
        results.append(
            {
                "type": "session",
                "id": s.id,
                "label": label,
            }
        )

    return JsonResponse({"results": results})


@login_required
@require_GET
def user_public_profile(request, user_id):
    """Return a public-facing profile for any user by user_id."""
    target = (
        User.objects.filter(id=user_id, is_active=True)
        .select_related("mentor_profile", "mentee_profile")
        .first()
    )
    if not target:
        return JsonResponse({"error": "User not found."}, status=404)

    role = _user_role(target)
    avatar_url = _user_avatar(target)

    mp = getattr(target, "mentor_profile", None)
    me = getattr(target, "mentee_profile", None)

    bio = ""
    cover_url = ""
    tags = []
    subjects = []
    topics = []
    availability = []
    details = {}

    if mp:
        bio = getattr(mp, "bio", "") or ""
        cover_url = getattr(mp, "cover_url", "") or ""
        tags = list(mp.interest_tags.values_list("name", flat=True))
        subjects = mp.subjects if isinstance(mp.subjects, list) else []
        topics = mp.topics if isinstance(mp.topics, list) else []
        availability = mp.availability if isinstance(mp.availability, list) else []
        details = {
            "gender": getattr(mp, "gender", "") or "",
            "expertise_level": mp.expertise_level,
            "capacity": getattr(mp, "capacity", None),
            "role": getattr(mp, "role", "") or "",
        }
    elif me:
        bio = getattr(me, "bio", "") or ""
        cover_url = getattr(me, "cover_url", "") or ""
        tags = list(me.interest_tags.values_list("name", flat=True))
        subjects = me.subjects if isinstance(me.subjects, list) else []
        topics = me.topics if isinstance(me.topics, list) else []
        availability = me.availability if isinstance(me.availability, list) else []
        details = {
            "program": getattr(me, "program", "") or "",
            "year_level": getattr(me, "year_level", None),
            "campus": getattr(me, "campus", "") or "",
        }

    from matching.models import UserPost
    posts_count = UserPost.objects.filter(author_id=user_id).count()
    images_count = (
        UserPost.objects.filter(author_id=user_id)
        .exclude(image="")
        .exclude(image__isnull=True)
        .count()
    )

    return JsonResponse({
        "id": target.id,
        "username": target.username,
        "display_name": get_user_display_name(target),
        "full_name": get_user_display_name(target),
        "role": role,
        "avatar_url": avatar_url,
        "cover_url": cover_url,
        "bio": bio,
        "tags": tags,
        "subjects": subjects,
        "topics": topics,
        "availability": availability,
        "details": details,
        "posts_count": posts_count,
        "images_count": images_count,
    })

