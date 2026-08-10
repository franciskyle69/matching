from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required

from matching.models import MenteeMentorRequest
from profiles.models import MenteeProfile

from .helpers import _require_mentor, _serialize_mentee, _serialize_mentee_for_matching


@login_required
@require_GET
def mentees_list(request):
    mentor_profile, error = _require_mentor(request)
    if error:
        return error
    mentee_ids = MenteeMentorRequest.objects.filter(mentor=mentor_profile).values_list(
        "mentee_id", flat=True
    )
    items = (
        MenteeProfile.objects.filter(id__in=mentee_ids)
        .select_related("user")
        .order_by("user__username")
    )
    return JsonResponse(
        {
            "items": [
                {**_serialize_mentee(item), **_serialize_mentee_for_matching(item, request)}
                for item in items
            ]
        }
    )
