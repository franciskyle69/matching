from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.contrib.auth.decorators import login_required

from matching.models import Notification

from .helpers import (
    _serialize_notification,
    logger,
)


@login_required
@require_GET
def notifications_list(request):
    items = Notification.objects.filter(user=request.user).order_by("-created_at")
    return JsonResponse({"items": [_serialize_notification(item) for item in items]})


@login_required
@require_http_methods(["POST"])
def notifications_mark_all_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    logger.info("notifications_mark_all", extra={"user_id": request.user.id})
    return JsonResponse({"status": "ok"})


@login_required
@require_http_methods(["POST"])
def notification_mark_read(request, notification_id: int):
    item = Notification.objects.filter(id=notification_id, user=request.user).first()
    if not item:
        return JsonResponse({"error": "Notification not found."}, status=404)
    item.is_read = True
    item.save()
    logger.info("notification_mark_read", extra={"user_id": request.user.id, "notification_id": item.id})
    return JsonResponse({"status": "ok"})


@login_required
@require_GET
def notifications_unread_count(request):
    return JsonResponse(
        {"count": Notification.objects.filter(user=request.user, is_read=False).count()}
    )
