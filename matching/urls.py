from django.urls import path

from . import views

urlpatterns = [
    path("subjects/", views.subject_list, name="subjects_list"),
    path("subjects/add/", views.subject_create, name="subjects_create"),
    path("subjects/<int:subject_id>/edit/", views.subject_edit, name="subjects_edit"),
    path("subjects/<int:subject_id>/delete/", views.subject_delete, name="subjects_delete"),
    path("notifications/", views.notifications_list, name="notifications_list"),
    path("notifications/mark-all-read/", views.notifications_mark_all_read, name="notifications_mark_all_read"),
    path("notifications/<int:notification_id>/read/", views.notification_mark_read, name="notification_mark_read"),
]
