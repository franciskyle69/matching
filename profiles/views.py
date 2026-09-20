from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect


@login_required
def mentor_questionnaire(request):
    """
    Legacy URL kept for backwards compatibility.
    Redirect mentors into the React dashboard matching profile tab.
    """
    return redirect("/app/#mentor-matching-profile")


@login_required
def mentee_questionnaire(request):
    """
    Legacy URL kept for backwards compatibility.
    Redirect mentees into the React dashboard settings tab.
    """
    return redirect("/app/#settings")
