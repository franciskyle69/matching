from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required

from matching.models import Topic

from .helpers import _require_role, _serialize_topic


@login_required
@require_GET
def topics_list(request):
    role_error = _require_role(request)
    if role_error and not request.user.is_staff:
        return role_error
    subject_id = request.GET.get("subject_id")
    qs = Topic.objects.select_related("subject").order_by("name")
    if subject_id:
        qs = qs.filter(subject_id=subject_id)
    return JsonResponse({"items": [_serialize_topic(item) for item in qs]})
