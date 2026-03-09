from django.urls import path

from . import views

urlpatterns = [
    path("subjects/", views.subject_list, name="subjects_list"),
    path("subjects/add/", views.subject_create, name="subjects_create"),
    path("subjects/<int:subject_id>/edit/", views.subject_edit, name="subjects_edit"),
    path("subjects/<int:subject_id>/delete/", views.subject_delete, name="subjects_delete"),
    path("sessions/", views.session_list, name="sessions_list"),
    path("sessions/add/", views.session_create, name="sessions_create"),
    path("sessions/<int:session_id>/reschedule/", views.session_reschedule, name="sessions_reschedule"),
    path("sessions/<int:session_id>/<str:status>/", views.session_update_status, name="sessions_update_status"),
    path("notifications/", views.notifications_list, name="notifications_list"),
    path("notifications/mark-all-read/", views.notifications_mark_all_read, name="notifications_mark_all_read"),
    path("notifications/<int:notification_id>/read/", views.notification_mark_read, name="notification_mark_read"),
]
