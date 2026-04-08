"""
Announcements (mentor posts) and comments on announcements or sessions (Classroom-style).
Supports targeting: all mentees (default) or specific user(s) via recipient_ids.
Soft delete: announcements with deleted_at set are excluded from lists.
"""
from django.contrib.auth.decorators import login_required
from django.db.models import Exists, OuterRef, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from accounts.models import get_user_display_name
from matching.models import (
    Announcement,
    AnnouncementRecipient,
    Comment,
    MentoringSession,
    MenteeMentorRequest,
)
from profiles.models import MenteeProfile

from ..views import (
    _get_payload,
    _get_str,
    _require_mentor,
    audit_log,
    get_mentor_approved,
    get_mentee_approved,
)


def _announcements_queryset_for_user(request):
    """Announcements visible to current user. If announcement has recipients, only they see it; else all mentor's mentees."""
    user = request.user
    mentor = getattr(user, "mentor_profile", None)
    mentee = getattr(user, "mentee_profile", None)
    if mentor and get_mentor_approved(mentor):
        return (
            Announcement.objects.filter(mentor=mentor, deleted_at__isnull=True)
            .select_related("mentor__user")
            .prefetch_related("recipients__user")
            .order_by("-created_at")
        )
    if mentee and get_mentee_approved(mentee):
        session_mentor_ids = MentoringSession.objects.filter(mentee=mentee).values_list(
            "mentor_id", flat=True
        )
        request_mentor_ids = MenteeMentorRequest.objects.filter(
            mentee=mentee
        ).values_list("mentor_id", flat=True)
        mentor_ids = list(set(list(session_mentor_ids) + list(request_mentor_ids)))
        base = Announcement.objects.filter(
            mentor_id__in=mentor_ids, deleted_at__isnull=True
        ).select_related("mentor__user")
        # Show if announcement has no recipients (goes to all) OR current user is in recipients
        no_recip = ~Exists(AnnouncementRecipient.objects.filter(announcement_id=OuterRef("pk")))
        user_recip = Exists(
            AnnouncementRecipient.objects.filter(announcement_id=OuterRef("pk"), user=user)
        )
        return base.filter(no_recip | user_recip).prefetch_related("recipients__user").order_by("-created_at")
    if user.is_staff:
        return (
            Announcement.objects.filter(deleted_at__isnull=True)
            .select_related("mentor__user")
            .prefetch_related("recipients__user")
            .order_by("-created_at")
        )
    return Announcement.objects.none()


def _serialize_announcement(ann):
    recipients = list(ann.recipients.select_related("user").all())
    mentor_display_name = get_user_display_name(ann.mentor.user) or ann.mentor.user.username
    return {
        "id": ann.id,
        "message": ann.message,
        "mentor_id": ann.mentor_id,
        "mentor_user_id": ann.mentor.user_id,
        "mentor_username": ann.mentor.user.username,
        "mentor_display_name": mentor_display_name,
        "created_at": ann.created_at.isoformat(),
        "recipient_ids": [r.user_id for r in recipients],
        "recipient_usernames": [r.user.username for r in recipients],
        "recipient_display_names": [get_user_display_name(r.user) or r.user.username for r in recipients],
    }


def _serialize_comment(c):
    author_display_name = get_user_display_name(c.author) or c.author.username
    return {
        "id": c.id,
        "content": c.content,
        "author_id": c.author_id,
        "author_username": c.author.username,
        "author_display_name": author_display_name,
        "created_at": c.created_at.isoformat(),
    }


@login_required
@require_GET
def announcements_list(request):
    qs = _announcements_queryset_for_user(request)
    data = {"announcements": [_serialize_announcement(a) for a in qs]}
    mentor = getattr(request.user, "mentor_profile", None)
    if mentor and get_mentor_approved(mentor):
        mentee_profiles = MenteeProfile.objects.filter(
            Q(mentoringsession__mentor=mentor)
            | Q(menteementorrequest__mentor=mentor)
        ).select_related("user").distinct()
        data["mentee_options"] = [
            {
                "id": mp.user_id,
                "username": mp.user.username,
                "display_name": get_user_display_name(mp.user) or mp.user.username,
            }
            for mp in mentee_profiles
        ]
    else:
        data["mentee_options"] = []
    return JsonResponse(data)


def _mentee_user_ids_for_mentor(mentor_profile):
    """User IDs of mentees associated with this mentor (sessions or any requests)."""
    session_ids = MentoringSession.objects.filter(mentor=mentor_profile).values_list(
        "mentee__user_id", flat=True
    )
    request_ids = MenteeMentorRequest.objects.filter(
        mentor=mentor_profile
    ).values_list("mentee__user_id", flat=True)
    return set(list(session_ids) + list(request_ids))


@login_required
@require_http_methods(["POST"])
def announcement_create(request):
    mentor_profile, error = _require_mentor(request)
    if error:
        return error
    if not get_mentor_approved(mentor_profile):
        return JsonResponse({"error": "Mentor account pending approval."}, status=403)
    payload = _get_payload(request)
    message = (_get_str(payload, "message") or "").strip()
    if not message:
        return JsonResponse({"error": "Message is required."}, status=400)

    recipient_ids = payload.get("recipient_ids")
    if recipient_ids is not None and not isinstance(recipient_ids, list):
        return JsonResponse({"error": "recipient_ids must be a list of user IDs."}, status=400)
    allowed_mentee_ids = _mentee_user_ids_for_mentor(mentor_profile)
    if recipient_ids:
        try:
            recipient_ids = [int(x) for x in recipient_ids]
        except (TypeError, ValueError):
            return JsonResponse({"error": "recipient_ids must be integers."}, status=400)
        invalid = set(recipient_ids) - allowed_mentee_ids
        if invalid:
            return JsonResponse(
                {"error": "Some recipient IDs are not your mentees or are invalid."},
                status=400,
            )

    ann = Announcement.objects.create(mentor=mentor_profile, message=message)
    if recipient_ids:
        for uid in recipient_ids:
            AnnouncementRecipient.objects.create(announcement=ann, user_id=uid)
    audit_log(request.user, "create", "announcement", ann.id)
    return JsonResponse({"announcement": _serialize_announcement(ann)})


@login_required
@require_http_methods(["POST"])
def announcement_soft_delete(request, announcement_id):
    """Soft-delete an announcement (mentor only). Sets deleted_at so it is hidden from lists."""
    mentor_profile, error = _require_mentor(request)
    if error:
        return error
    ann = Announcement.objects.filter(id=announcement_id, mentor=mentor_profile).first()
    if not ann:
        return JsonResponse({"error": "Announcement not found."}, status=404)
    if ann.deleted_at:
        return JsonResponse({"error": "Announcement already deleted."}, status=400)
    ann.deleted_at = timezone.now()
    ann.save(update_fields=["deleted_at"])
    audit_log(request.user, "delete", "announcement", ann.id)
    return JsonResponse({"ok": True})


@login_required
@require_GET
def comments_list(request, target_type, target_id):
    """List comments for an announcement or session. target_type: 'announcement' | 'session'."""
    target_id = int(target_id)
    if target_type == "announcement":
        qs = Comment.objects.filter(announcement_id=target_id).select_related("author").order_by("created_at")
        if not qs.exists():
            ann = Announcement.objects.filter(id=target_id).first()
            if not ann:
                return JsonResponse({"error": "Announcement not found."}, status=404)
            visible = _announcements_queryset_for_user(request).filter(id=target_id).exists()
            if not visible:
                return JsonResponse({"error": "Not allowed to view this announcement."}, status=403)
    elif target_type == "session":
        qs = Comment.objects.filter(session_id=target_id).select_related("author").order_by("created_at")
        if not qs.exists():
            session = MentoringSession.objects.filter(id=target_id).first()
            if not session:
                return JsonResponse({"error": "Session not found."}, status=404)
            user = request.user
            mentor = getattr(user, "mentor_profile", None)
            mentee = getattr(user, "mentee_profile", None)
            allowed = (
                (mentor and session.mentor_id == mentor.id)
                or (mentee and session.mentee_id == mentee.id)
                or user.is_staff
            )
            if not allowed:
                return JsonResponse({"error": "Not allowed to view this session."}, status=403)
    else:
        return JsonResponse({"error": "Invalid target_type."}, status=400)
    return JsonResponse({"comments": [_serialize_comment(c) for c in qs]})


@login_required
@require_http_methods(["POST"])
def comment_create(request):
    """Create a comment on an announcement or session. Body: target_type, target_id, content."""
    payload = _get_payload(request)
    target_type = (_get_str(payload, "target_type") or "").strip().lower()
    target_id = payload.get("target_id")
    try:
        target_id = int(target_id)
    except (TypeError, ValueError):
        return JsonResponse({"error": "target_id must be an integer."}, status=400)
    content = (_get_str(payload, "content") or "").strip()
    if not content:
        return JsonResponse({"error": "Content is required."}, status=400)

    if target_type == "announcement":
        ann = Announcement.objects.filter(id=target_id).first()
        if not ann:
            return JsonResponse({"error": "Announcement not found."}, status=404)
        visible = _announcements_queryset_for_user(request).filter(id=target_id).exists()
        if not visible:
            return JsonResponse({"error": "Not allowed to comment on this announcement."}, status=403)
        comment = Comment.objects.create(author=request.user, announcement=ann, content=content)
    elif target_type == "session":
        session = MentoringSession.objects.filter(id=target_id).first()
        if not session:
            return JsonResponse({"error": "Session not found."}, status=404)
        user = request.user
        mentor = getattr(user, "mentor_profile", None)
        mentee = getattr(user, "mentee_profile", None)
        allowed = (
            (mentor and session.mentor_id == mentor.id)
            or (mentee and session.mentee_id == mentee.id)
            or user.is_staff
        )
        if not allowed:
            return JsonResponse({"error": "Not allowed to comment on this session."}, status=403)
        comment = Comment.objects.create(author=request.user, session=session, content=content)
    else:
        return JsonResponse({"error": "target_type must be 'announcement' or 'session'."}, status=400)

    audit_log(request.user, "create", "comment", comment.id)
    return JsonResponse({"comment": _serialize_comment(comment)})
