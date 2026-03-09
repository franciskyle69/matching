from .models import Notification


def notification_counts(request):
    if not request.user.is_authenticated:
        return {"unread_notifications_count": 0}
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return {"unread_notifications_count": count}


def sidebar_user(request):
    """Avatar URL and role for the shared sidebar (Django-rendered pages)."""
    if not request.user.is_authenticated:
        return {"user_avatar_url": "", "user_role": None}
    avatar = ""
    role = None
    if hasattr(request.user, "mentor_profile"):
        role = "mentor"
        avatar = getattr(request.user.mentor_profile, "avatar_url", "") or ""
    if hasattr(request.user, "mentee_profile"):
        role = "mentee"
        if not avatar:
            avatar = getattr(request.user.mentee_profile, "avatar_url", "") or ""
    if avatar and not avatar.startswith(("http://", "https://")):
        avatar = request.build_absolute_uri(avatar if avatar.startswith("/") else "/" + avatar.lstrip("/"))
    return {"user_avatar_url": avatar, "user_role": role}
