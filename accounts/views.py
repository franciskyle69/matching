from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.contrib.auth import get_user_model

from .forms import RegisterForm, AccountSettingsForm
from profiles.models import MentorProfile, MenteeProfile
from matching.models import MentoringSession


ROLE_SESSION_KEY = "selected_role"


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
        total_sessions = MentoringSession.objects.count()
        completed_sessions = MentoringSession.objects.filter(status="completed").count()
        completion_rate = 0
        if total_sessions > 0:
            completion_rate = round((completed_sessions / total_sessions) * 100)
        stats = {
            "total_mentors": total_mentors,
            "total_mentees": total_mentees,
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "completion_rate": completion_rate,
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
    return redirect("login")


def login_view(request):
    if request.user.is_authenticated:
        return redirect("/app/")
    selected_role = request.session.get(ROLE_SESSION_KEY)
    if not selected_role:
        messages.info(request, "Please choose Mentor or Mentee to continue.")
        return redirect("home")

    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            if not user.is_active:
                messages.error(request, "Please verify your email before logging in.")
                return redirect("login")
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

    return render(request, "registration/login.html", {"form": form, "selected_role": selected_role})


def register(request):
    """
    Create account page. Also creates a basic MentorProfile or
    MenteeProfile depending on the chosen role so the user can
    log in and be recognised in the UI immediately.
    """
    if request.user.is_authenticated:
        return redirect("/app/")

    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.is_active = False
            user.save()
            role = form.cleaned_data.get("role")

            if role == "mentor":
                MentorProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=4,
                )
            else:
                MenteeProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=1,
                )
            current_site = get_current_site(request)
            subject = "Activate your account"
            text_message = render_to_string(
                "registration/activation_email.txt",
                {
                    "user": user,
                    "domain": current_site.domain,
                    "uid": urlsafe_base64_encode(force_bytes(user.pk)),
                    "token": default_token_generator.make_token(user),
                    "protocol": "https" if request.is_secure() else "http",
                },
            )
            html_message = render_to_string(
                "registration/activation_email.html",
                {
                    "user": user,
                    "domain": current_site.domain,
                    "uid": urlsafe_base64_encode(force_bytes(user.pk)),
                    "token": default_token_generator.make_token(user),
                    "protocol": "https" if request.is_secure() else "http",
                },
            )
            email = EmailMultiAlternatives(subject, text_message, to=[user.email])
            email.attach_alternative(html_message, "text/html")
            email.send()
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
        messages.success(request, "Your account has been activated. You can log in now.")
        return redirect("login")

    messages.error(request, "Activation link is invalid or expired.")
    return redirect("register")


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
    if request.method == "POST":
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
        },
    )
