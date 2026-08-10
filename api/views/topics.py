from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.cache import cache
import re
from difflib import SequenceMatcher

from matching.forms import TopicForm
from matching.models import Topic

from .helpers import (
    _get_payload,
    _require_role,
    _require_staff,
    _serialize_topic,
    audit_log,
    invalidate_subjects_cache,
    logger,
)


def _validate_topic_name(name, subject_id, current_topic_id=None):
    text = str(name or "").strip()
    if len(text) < 3:
        return "Topic name must be at least 3 characters."
    if len(text) > 120:
        return "Topic name must be 120 characters or fewer."

    if not re.search(r"[A-Za-z]", text):
        return "Topic name must include letters."

    normalized = re.sub(r"\s+", " ", text)
    if re.fullmatch(r"(.)\1{3,}", normalized.lower()):
        return "Topic name looks invalid. Please use a meaningful topic."

    existing_qs = Topic.objects.filter(subject_id=subject_id)
    if current_topic_id:
        existing_qs = existing_qs.exclude(id=current_topic_id)

    for existing in existing_qs.only("name"):
        existing_name = str(existing.name or "").strip()
        if existing_name.lower() == normalized.lower():
            return "This topic already exists for the selected subject."
        similarity = SequenceMatcher(
            None,
            existing_name.lower(),
            normalized.lower(),
        ).ratio()
        if similarity >= 0.9:
            return (
                "This topic is too similar to an existing topic. "
                "Use the existing topic or choose a clearer name."
            )
    return ""


@login_required
@require_GET
def topics_list(request):
    role_error = _require_role(request)
    if role_error and not request.user.is_staff:
        return role_error
    subject_id = request.GET.get("subject_id")
    include_inactive = request.user.is_staff and str(
        request.GET.get("include_inactive", "0"),
    ).strip().lower() in {"1", "true", "yes", "on"}
    status = str(request.GET.get("status", "")).strip().lower()
    qs = Topic.objects.select_related("subject").order_by("name")
    if subject_id:
        qs = qs.filter(subject_id=subject_id)
    if status in {Topic.STATUS_ACTIVE, Topic.STATUS_INACTIVE}:
        qs = qs.filter(status=status)
    elif not include_inactive:
        qs = qs.filter(status=Topic.STATUS_ACTIVE)
    return JsonResponse({"items": [_serialize_topic(item) for item in qs]})


@login_required
@require_http_methods(["POST"])
def topic_create(request):
    err = _require_staff(request)
    if err:
        return err
    payload = _get_payload(request)
    form = TopicForm(payload)
    if not form.is_valid():
        errors = {k: list(v) for k, v in form.errors.items()}
        return JsonResponse({"errors": errors}, status=400)
    subject_id = payload.get("subject") or payload.get("subject_id")
    name = payload.get("name")
    validation_error = _validate_topic_name(name, subject_id)
    if validation_error:
        return JsonResponse({"error": validation_error}, status=400)
    topic = form.save(commit=False)
    topic.created_by = request.user
    topic.updated_by = request.user
    topic.save()
    invalidate_subjects_cache()
    cache.delete("matching:topic_support_map:v1")
    audit_log(request.user, "topic_create", "topic", topic.id)
    logger.info("topic_created", extra={"user_id": request.user.id, "topic_id": topic.id})
    return JsonResponse({"topic": _serialize_topic(topic)})


@login_required
@require_http_methods(["POST"])
def topic_update(request, topic_id: int):
    err = _require_staff(request)
    if err:
        return err
    topic = Topic.objects.filter(id=topic_id).first()
    if not topic:
        return JsonResponse({"error": "Topic not found."}, status=404)
    payload = _get_payload(request)
    form = TopicForm(payload, instance=topic)
    if not form.is_valid():
        errors = {k: list(v) for k, v in form.errors.items()}
        return JsonResponse({"errors": errors}, status=400)
    subject_id = payload.get("subject") or payload.get("subject_id") or topic.subject_id
    name = payload.get("name", topic.name)
    validation_error = _validate_topic_name(name, subject_id, current_topic_id=topic.id)
    if validation_error:
        return JsonResponse({"error": validation_error}, status=400)
    topic = form.save(commit=False)
    topic.updated_by = request.user
    topic.save()
    invalidate_subjects_cache()
    cache.delete("matching:topic_support_map:v1")
    audit_log(request.user, "topic_update", "topic", topic.id)
    logger.info("topic_updated", extra={"user_id": request.user.id, "topic_id": topic.id})
    return JsonResponse({"topic": _serialize_topic(topic)})


@login_required
@require_http_methods(["POST"])
def topic_archive_toggle(request, topic_id: int):
    err = _require_staff(request)
    if err:
        return err
    topic = Topic.objects.filter(id=topic_id).first()
    if not topic:
        return JsonResponse({"error": "Topic not found."}, status=404)
    payload = _get_payload(request)
    requested_status = str(payload.get("status", "")).strip().lower()
    if requested_status not in {Topic.STATUS_ACTIVE, Topic.STATUS_INACTIVE}:
        return JsonResponse(
            {"error": "status must be either 'active' or 'inactive'."},
            status=400,
        )
    topic.status = requested_status
    topic.updated_by = request.user
    topic.save(update_fields=["status", "updated_by", "updated_at"])
    invalidate_subjects_cache()
    cache.delete("matching:topic_support_map:v1")
    action = "topic_restore" if requested_status == Topic.STATUS_ACTIVE else "topic_archive"
    audit_log(request.user, action, "topic", topic.id)
    logger.info(
        "topic_status_updated",
        extra={"user_id": request.user.id, "topic_id": topic.id, "status": requested_status},
    )
    return JsonResponse({"topic": _serialize_topic(topic)})


@login_required
@require_http_methods(["POST"])
def topic_delete(request, topic_id: int):
    _ = topic_id
    err = _require_staff(request)
    if err:
        return err
    return JsonResponse(
        {"error": "Topic deletion is disabled. Archive topics instead."},
        status=405,
    )
