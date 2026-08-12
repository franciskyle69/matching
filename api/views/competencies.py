from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from matching.models import Competency

from .helpers import _require_role, _serialize_competency


@login_required
@require_GET
def competencies_list(request):
    role_error = _require_role(request)
    if role_error and not request.user.is_staff:
        return role_error

    topic_ids_raw = str(request.GET.get("topic_ids", "")).strip()
    topic_id_raw = str(request.GET.get("topic_id", "")).strip()

    topic_ids = []
    if topic_ids_raw:
        for value in topic_ids_raw.split(","):
            value = value.strip()
            if not value:
                continue
            try:
                topic_ids.append(int(value))
            except ValueError:
                return JsonResponse({"error": "topic_ids must be integers."}, status=400)
    elif topic_id_raw:
        try:
            topic_ids.append(int(topic_id_raw))
        except ValueError:
            return JsonResponse({"error": "topic_id must be an integer."}, status=400)

    if not topic_ids:
        return JsonResponse({"error": "topic_id is required."}, status=400)

    items = (
        Competency.objects.select_related("topic", "topic__subject")
        .filter(topic_id__in=topic_ids)
        .order_by("topic__name", "name")
    )
    return JsonResponse({"items": [_serialize_competency(item) for item in items]})