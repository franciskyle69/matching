from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

urlpatterns = [
    path(
        "password_reset/",
        auth_views.PasswordResetView.as_view(
            template_name="registration/password_reset_form.html",
            email_template_name="registration/password_reset_email.html",
            html_email_template_name="registration/password_reset_email_html.html",
        ),
        name="password_reset",
    ),
    path("register/", views.register, name="register"),
    path("matching/", views.matching_dashboard, name="matching_dashboard"),
    path("login/", views.login_view, name="login"),
    path("role/<str:role>/", views.select_role, name="select_role"),
    path("settings/", views.settings_view, name="settings"),
    path("activate/<uidb64>/<token>/", views.activate_account, name="activate_account"),
]
