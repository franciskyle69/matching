from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required

from profiles.models import MenteeProfile

from .helpers import _require_mentor, _serialize_mentee


@login_required
@require_GET
def mentees_list(request):
    mentor_profile, error = _require_mentor(request)
    if error:
        return error
    items = MenteeProfile.objects.select_related("user").order_by("user__username")
    return JsonResponse({"items": [_serialize_mentee(item) for item in items]})
