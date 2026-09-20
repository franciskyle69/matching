from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.utils.crypto import constant_time_compare
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth import get_user_model
import secrets
import time

from .forms import (
    RegisterForm,
    AccountSettingsForm,
    PasswordChangeWithCodeForm,
    PeerLinkPasswordResetForm,
)
from .email_utils import email_backend_can_send, send_activation_email
from .models import must_change_password, set_must_change_password
from .oauth_gate import INTENT_SESSION_KEY, SIGNUP_INTENT, normalize_oauth_intent
from profiles.models import MentorProfile, MenteeProfile, save_verification_documents
ROLE_SESSION_KEY = "selected_role"
GOOGLE_OAUTH_ROLE_SESSION_KEY = "google_oauth_selected_role"
PASSWORD_CHANGE_CODE_SESSION_KEY = "password_change_verification_code"
PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY = "password_change_verification_expires_at"
PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY = "password_change_verification_attempts"
PASSWORD_CHANGE_CODE_VERIFIED_SESSION_KEY = "password_change_verification_verified"
PASSWORD_CHANGE_CODE_EMAIL_SESSION_KEY = "password_change_verification_email"
PASSWORD_CHANGE_CODE_TTL_SECONDS = 10 * 60
PASSWORD_CHANGE_MAX_ATTEMPTS = 5


def home(request):
    """
    Simple dashboard-style home page.
    Shows different actions depending on whether the user
    is a mentor or mentee (or neither yet).
    """
    is_mentor = False
    is_mentee = False
    stats = None
    if request.user.is_authenticated:
        if must_change_password(request.user):
            return redirect("settings")
        is_mentor = hasattr(request.user, "mentor_profile")
        is_mentee = hasattr(request.user, "mentee_profile")

        selected_role = request.session.get(ROLE_SESSION_KEY)
        if selected_role and not is_mentor and not is_mentee:
            if selected_role == "mentor":
                MentorProfile.objects.create(
                    user=request.user,
                    program="BSIT",
                    year_level=4,
                )
                is_mentor = True
            elif selected_role == "mentee":
                MenteeProfile.objects.create(
                    user=request.user,
                    program="BSIT",
                    year_level=1,
                )
                is_mentee = True

        if selected_role == "mentor" and not is_mentor:
            logout(request)
            messages.error(request, "You selected Mentor, but this account is not a mentor.")
            return redirect("home")
        if selected_role == "mentee" and not is_mentee:
            logout(request)
            messages.error(request, "You selected Mentee, but this account is not a mentee.")
            return redirect("home")

        total_mentors = MentorProfile.objects.count()
        total_mentees = MenteeProfile.objects.count()
        stats = {
            "total_mentors": total_mentors,
            "total_mentees": total_mentees,
        }

    return render(
        request,
        "registration/home.html",
        {"is_mentor": is_mentor, "is_mentee": is_mentee, "stats": stats},
    )


def select_role(request, role: str):
    if role not in ("mentor", "mentee"):
        return redirect("home")
    request.session[ROLE_SESSION_KEY] = role
    next_url = request.GET.get("next") or "/app/signin"
    return redirect(next_url)


def select_google_role(request, role: str):
    from capstone_site.site_utils import sync_google_socialapp_from_env
    sync_google_socialapp_from_env()

    if role not in ("mentor", "mentee"):
        return redirect("/app/signin?role_required=1")
    request.session[ROLE_SESSION_KEY] = role
    request.session[GOOGLE_OAUTH_ROLE_SESSION_KEY] = role
    request.session[INTENT_SESSION_KEY] = "login"
    request.session.save()
    return render(
        request,
        "account/google_oauth_continue.html",
        {"process": "login", "next_url": "/app/signin?oauth=google"},
    )


def start_google_oauth(request, intent: str):
    """Google OAuth is strictly login-only. Redirect any signup attempts to manual registration."""
    from capstone_site.site_utils import sync_google_socialapp_from_env
    sync_google_socialapp_from_env()

    normalized = normalize_oauth_intent(intent)
    if normalized == SIGNUP_INTENT:
        messages.info(request, "Google sign up is disabled. Please complete the manual registration.")
        return redirect("/app/signup")
    request.session[INTENT_SESSION_KEY] = "login"
    next_url = "/app/?oauth=google"
    request.session.save()
    return render(
        request,
        "account/google_oauth_continue.html",
        {"process": "login", "next_url": next_url},
    )


def login_view(request):
    if request.user.is_authenticated:
        if must_change_password(request.user):
            return redirect("settings")
        return redirect("/app/")
    selected_role = request.session.get(ROLE_SESSION_KEY)
    role_required = str(request.GET.get("role_required", "")).lower() in (
        "1",
        "true",
        "yes",
        "on",
    )

    if request.method != "POST" and role_required:
        messages.info(request, "Please choose Mentor or Mentee to continue.")

    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            
            # Check if user's email is institutional
            from accounts.forms import is_institutional_email
            if not is_institutional_email(user.email):
                from django.conf import settings
                domains_str = ", ".join(getattr(settings, 'ALLOWED_EMAIL_DOMAINS', []))
                messages.error(request, f"Login restricted to institutional accounts ({domains_str}).")
                return redirect("login")
            
            if not user.is_active:
                messages.error(request, "Please verify your email before logging in.")
                return redirect("login")

            if must_change_password(user):
                login(request, user)
                if hasattr(user, "mentor_profile"):
                    request.session[ROLE_SESSION_KEY] = "mentor"
                elif hasattr(user, "mentee_profile"):
                    request.session[ROLE_SESSION_KEY] = "mentee"
                messages.info(request, "Please change your temporary password before continuing.")
                return redirect("settings")

            if selected_role:
                is_mentor = hasattr(user, "mentor_profile")
                is_mentee = hasattr(user, "mentee_profile")

                if selected_role == "mentor" and not is_mentor:
                    messages.error(request, "This account is not registered as a mentor.")
                    return redirect("login")
                if selected_role == "mentee" and not is_mentee:
                    messages.error(request, "This account is not registered as a mentee.")
                    return redirect("login")

            login(request, user)
            return redirect("home")
    else:
        form = AuthenticationForm(request)

    return render(
        request,
        "registration/login.html",
        {
            "form": form,
            "selected_role": selected_role,
            "role_required": role_required,
        },
    )


def register(request):
    """
    Create account page. Also creates a basic MentorProfile or
    MenteeProfile depending on the chosen role so the user can
    log in and be recognised in the UI immediately.
    """
    if request.user.is_authenticated:
        return redirect("/app/")

    if request.method == "POST":
        form = RegisterForm(request.POST, request.FILES)
        if form.is_valid():
            if not email_backend_can_send():
                messages.error(
                    request,
                    "Account could not be created because email is not configured on the server.",
                )
                return render(request, "registration/register.html", {"form": form})
            user = form.save(commit=True)
            role = form.cleaned_data.get("role")
            files_by_kind = form.cleaned_data.get("verification_files_by_kind") or {}
            try:
                if role == "mentor":
                    mentor = MentorProfile.objects.create(
                        user=user,
                        program="BSIT",
                        year_level=form.cleaned_data.get("year_level") or 4,
                        role=form.cleaned_data.get("mentor_role") or "",
                        approved=False,
                    )
                    save_verification_documents(
                        mentor=mentor,
                        files_by_kind=files_by_kind,
                    )
                else:
                    mentee = MenteeProfile.objects.create(
                        user=user,
                        program="BSIT",
                        year_level=1,
                        approved=False,
                    )
                    save_verification_documents(
                        mentee=mentee,
                        files_by_kind=files_by_kind,
                    )
                send_activation_email(request, user)
            except Exception:
                user.delete()
                messages.error(
                    request,
                    "Account could not be created because activation email could not be sent. Please try again.",
                )
                return render(request, "registration/register.html", {"form": form})
            messages.success(request, "Check your email to activate your account.")
            return redirect("login")
    else:
        form = RegisterForm()

    return render(request, "registration/register.html", {"form": form})


def activate_account(request, uidb64: str, token: str):
    User = get_user_model()
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = User.objects.get(pk=uid)
    except Exception:
        user = None

    if user and default_token_generator.check_token(user, token):
        user.is_active = True
        user.save()
        profile = getattr(user, "profile", None)
        if profile is not None:
            profile.is_email_verified = True
            profile.save(update_fields=["is_email_verified"])
        messages.success(request, "Your account has been activated. You can log in now.")
        return redirect("/app/signin?activated=1")

    messages.error(request, "Activation link is invalid or expired.")
    return redirect("/app/signin?activation_error=1")


@login_required
def matching_dashboard(request):
    """
    Simple page that calls the matching API from the browser and
    shows the pairs in a friendly table.
    """
    return render(request, "registration/matching_dashboard.html")


@login_required
def settings_view(request):
    is_mentor = hasattr(request.user, "mentor_profile")
    is_mentee = hasattr(request.user, "mentee_profile")
    role = "Mentor" if is_mentor else "Mentee" if is_mentee else "Unassigned"
    password_form = PasswordChangeWithCodeForm(user=request.user)

    def _clear_password_change_code_session():
        for key in (
            PASSWORD_CHANGE_CODE_SESSION_KEY,
            PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY,
            PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY,
        ):
            request.session.pop(key, None)

    if request.method == "POST":
        action = (request.POST.get("action") or "").strip()

        if action == "save_account":
            form = AccountSettingsForm(request.POST, instance=request.user)
            if form.is_valid():
                form.save()
                messages.success(request, "Account information updated.")
                return redirect("settings")
        elif action == "send_password_code":
            form = AccountSettingsForm(instance=request.user)
            if not request.user.email:
                messages.error(request, "Add an email address first before changing password.")
                return redirect("settings")

            verification_code = f"{secrets.randbelow(1000000):06d}"
            request.session[PASSWORD_CHANGE_CODE_SESSION_KEY] = verification_code
            request.session[PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY] = int(time.time()) + PASSWORD_CHANGE_CODE_TTL_SECONDS
            request.session[PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY] = 0

            subject = "Your password change verification code"
            body = (
                f"Hello {request.user.get_username()},\n\n"
                f"Your verification code is: {verification_code}\n"
                f"This code expires in 10 minutes.\n\n"
                "If you did not request this, you can ignore this email."
            )
            try:
                EmailMultiAlternatives(subject, body, to=[request.user.email]).send()
                messages.success(request, "Verification code sent to your email.")
            except Exception:
                _clear_password_change_code_session()
                messages.error(request, "Unable to send verification code right now. Please try again.")

            return redirect("settings")
        elif action == "change_password_with_code":
            form = AccountSettingsForm(instance=request.user)
            password_form = PasswordChangeWithCodeForm(request.POST, user=request.user)
            if password_form.is_valid():
                stored_code = str(request.session.get(PASSWORD_CHANGE_CODE_SESSION_KEY, ""))
                expires_at = int(request.session.get(PASSWORD_CHANGE_CODE_EXPIRES_SESSION_KEY, 0) or 0)
                attempts = int(request.session.get(PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY, 0) or 0)

                if not stored_code or not expires_at:
                    messages.error(request, "Request a verification code first.")
                elif int(time.time()) > expires_at:
                    _clear_password_change_code_session()
                    messages.error(request, "Verification code expired. Request a new one.")
                elif attempts >= PASSWORD_CHANGE_MAX_ATTEMPTS:
                    _clear_password_change_code_session()
                    messages.error(request, "Too many incorrect attempts. Request a new verification code.")
                else:
                    entered_code = password_form.cleaned_data["verification_code"]
                    if not constant_time_compare(entered_code, stored_code):
                        request.session[PASSWORD_CHANGE_CODE_ATTEMPTS_SESSION_KEY] = attempts + 1
                        messages.error(request, "Invalid verification code.")
                    else:
                        request.user.set_password(password_form.cleaned_data["new_password2"])
                        request.user.save(update_fields=["password"])
                        set_must_change_password(request.user, False)
                        update_session_auth_hash(request, request.user)
                        _clear_password_change_code_session()
                        messages.success(request, "Password changed successfully.")
                        return redirect("settings")
        else:
            form = AccountSettingsForm(request.POST, instance=request.user)
            if form.is_valid():
                form.save()
                messages.success(request, "Account information updated.")
                return redirect("settings")
    else:
        form = AccountSettingsForm(instance=request.user)

    return render(
        request,
        "registration/settings.html",
        {
            "role": role,
            "is_mentor": is_mentor,
            "is_mentee": is_mentee,
            "form": form,
            "password_form": password_form,
        },
    )


from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy


class PeerLinkPasswordResetView(auth_views.PasswordResetView):
    """Custom password reset view supporting username or email lookup and rich feedback."""

    template_name = "registration/password_reset_form.html"
    email_template_name = "registration/password_reset_email.html"
    html_email_template_name = "registration/password_reset_email_html.html"
    subject_template_name = "registration/password_reset_subject.txt"
    form_class = PeerLinkPasswordResetForm
    success_url = reverse_lazy("password_reset_done")

    def form_valid(self, form):
        dest_email = None
        users = form.cleaned_data.get("matching_users") or []
        if users and users[0].email:
            dest_email = users[0].email
        elif form.cleaned_data.get("email_or_username") and "@" in form.cleaned_data.get("email_or_username"):
            dest_email = form.cleaned_data.get("email_or_username")
        if dest_email:
            self.request.session["password_reset_dest_email"] = dest_email
        return super().form_valid(form)


def password_reset_done_view(request):
    dest_email = request.session.pop("password_reset_dest_email", None)
    return render(
        request,
        "registration/password_reset_done.html",
        {"reset_email": dest_email},
    )
