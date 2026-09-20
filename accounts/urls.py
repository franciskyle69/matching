from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path(
        "password_reset/",
        views.PeerLinkPasswordResetView.as_view(),
        name="password_reset",
    ),
    path(
        "password_reset/done/",
        views.password_reset_done_view,
        name="password_reset_done",
    ),
    path("register/", views.register, name="register"),
    path("matching/", views.matching_dashboard, name="matching_dashboard"),
    path("login/", views.login_view, name="login"),
    path("role/<str:role>/", views.select_role, name="select_role"),
    path("google/role/<str:role>/", views.select_google_role, name="select_google_role"),
    path("google/start/<str:intent>/", views.start_google_oauth, name="start_google_oauth"),
    path("settings/", views.settings_view, name="settings"),
    path("activate/<uidb64>/<token>/", views.activate_account, name="activate_account"),
]
