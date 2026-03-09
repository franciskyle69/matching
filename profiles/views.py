from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404

from .forms import MentorQuestionnaireForm, MenteeQuestionnaireForm
from .models import MentorProfile, MenteeProfile


@login_required
def mentor_questionnaire(request):
    """
    Legacy URL kept for backwards compatibility.
    Redirect mentors into the React dashboard settings tab.
    """
    return redirect("/app/#settings")


@login_required
def mentee_questionnaire(request):
    """
    Legacy URL kept for backwards compatibility.
    Redirect mentees into the React dashboard settings tab.
    """
    return redirect("/app/#settings")
