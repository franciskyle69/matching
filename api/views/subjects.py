from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.contrib.auth.decorators import login_required

from matching.forms import SubjectForm
from matching.models import Subject

from .helpers import _get_payload, _require_role, _require_staff, _serialize_subject, logger
from .helpers import invalidate_subjects_cache
from ..views import get_subjects_list


@login_required
@require_GET
def subjects_list(request):
    role_error = _require_role(request)
    if role_error and not request.user.is_staff:
        return role_error
    items = get_subjects_list()
    return JsonResponse({"items": items})


@login_required
@require_http_methods(["POST"])
def subject_create(request):
    _ = request
    return JsonResponse(
        {"error": "Subject creation is disabled. Subjects are predefined."},
        status=405,
    )


@login_required
@require_http_methods(["POST"])
def subject_update(request, subject_id: int):
    err = _require_staff(request)
    if err:
        return err
    subject = Subject.objects.filter(id=subject_id).first()
    if not subject:
        return JsonResponse({"error": "Subject not found."}, status=404)
    payload = _get_payload(request)
    form = SubjectForm(payload, instance=subject)
    if not form.is_valid():
        errors = {k: list(v) for k, v in form.errors.items()}
        return JsonResponse({"errors": errors}, status=400)
    form.save()
    invalidate_subjects_cache()
    logger.info("subject_updated", extra={"user_id": request.user.id, "subject_id": subject.id})
    return JsonResponse({"subject": _serialize_subject(subject)})


@login_required
@require_http_methods(["POST"])
def subject_delete(request, subject_id: int):
    _ = subject_id
    return JsonResponse(
        {"error": "Subject deletion is disabled. Subjects are predefined."},
        status=405,
    )
