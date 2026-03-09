from django.urls import path

from . import views

urlpatterns = [
    path("mentor/questionnaire/", views.mentor_questionnaire, name="mentor_questionnaire"),
    path("mentee/questionnaire/", views.mentee_questionnaire, name="mentee_questionnaire"),
]
