from django.contrib import messages
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from allauth.exceptions import ImmediateHttpResponse
from django import forms

from profiles.models import MentorProfile, MenteeProfile

User = get_user_model()
ROLE_SESSION_KEY = "selected_role"
GOOGLE_OAUTH_ROLE_SESSION_KEY = "google_oauth_selected_role"


class RoleAwareSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Enforce role selection for Google login and create the appropriate
    profile when a brand new social account signs up.
    Also handles linking Google accounts to existing email/password accounts.
    """

    def pre_social_login(self, request, sociallogin: SocialLogin):
        selected_role = request.session.get(ROLE_SESSION_KEY)
        selected_google_role = request.session.get(GOOGLE_OAUTH_ROLE_SESSION_KEY)
        user = sociallogin.user
        email = None
        if sociallogin.email_addresses:
            email = sociallogin.email_addresses[0].email
        if not email:
            email = getattr(user, "email", None)
        if not email:
            email = sociallogin.account.extra_data.get("email") if getattr(sociallogin, "account", None) else None
        
        # Validate institutional email domain for Google OAuth
        if email:
            from accounts.forms import validate_institutional_email
            try:
                validate_institutional_email(email)
            except forms.ValidationError as e:
                messages.error(request, str(e))
                raise ImmediateHttpResponse(
                    redirect("/app/signin?oauth_error=institutional_email")
                )
        else:
            messages.error(request, "Google account email could not be read.")
            raise ImmediateHttpResponse(redirect("/app/signin?oauth_error=missing_email"))
        
        # If a local account exists for this email, attach the social login to that user
        # and continue normal login flow. Using 'connect' here forces allauth's
        # /accounts/login/?next=/accounts/3rdparty/ fallback.
        if email and not user.pk:
            try:
                existing_user = User.objects.get(email__iexact=email)
                sociallogin.user = existing_user
            except User.DoesNotExist:
                pass  # New user, continue with normal flow
        
        # Update user reference after potential linking
        user = sociallogin.user
        is_mentor = hasattr(user, "mentor_profile")
        is_mentee = hasattr(user, "mentee_profile")

        # If role is not selected, infer from existing profile.
        if not selected_role:
            if is_mentor:
                request.session[ROLE_SESSION_KEY] = "mentor"
                selected_role = "mentor"
            elif is_mentee:
                request.session[ROLE_SESSION_KEY] = "mentee"
                selected_role = "mentee"

        if (
            not selected_role
            and selected_google_role in ("mentor", "mentee")
            and not (is_mentor or is_mentee)
        ):
            request.session[ROLE_SESSION_KEY] = selected_google_role
            selected_role = selected_google_role

        # Brand new Google users must explicitly choose role for this OAuth attempt.
        if not user.pk and selected_google_role not in ("mentor", "mentee"):
            messages.info(request, "Please choose Mentor or Mentee before continuing with Google login.")
            raise ImmediateHttpResponse(redirect("/app/signin?role_required=1"))

        if not user.pk and selected_google_role in ("mentor", "mentee"):
            request.session[ROLE_SESSION_KEY] = selected_google_role
            selected_role = selected_google_role

        # If the social account maps to an existing user that has no profile yet,
        # require role selection first.
        if user.pk and not is_mentor and not is_mentee and not selected_role:
            messages.info(request, "Please choose Mentor or Mentee before continuing with Google login.")
            raise ImmediateHttpResponse(redirect("/app/signin?role_required=1"))
        if user.pk and not is_mentor and not is_mentee and selected_role:
            if selected_role == "mentor":
                MentorProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=4,
                    approved=False,
                )
            elif selected_role == "mentee":
                MenteeProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=1,
                    approved=False,
                )

    def _generate_unique_username(self, base_username):
        base = "".join(
            ch for ch in (base_username or "user") if ch.isalnum() or ch in "._-"
        ).strip("._-")
        if not base:
            base = "user"
        candidate = base[:150]
        counter = 1
        while User.objects.filter(username=candidate).exists():
            suffix = str(counter)
            candidate = f"{base[: max(1, 150 - len(suffix) - 1)]}_{suffix}"
            counter += 1
        return candidate

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        if not getattr(user, "username", ""):
            email = getattr(user, "email", "") or ""
            base = email.split("@", 1)[0] if "@" in email else "user"
            user.username = self._generate_unique_username(base)
        return user

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        selected_role = request.session.get(ROLE_SESSION_KEY)

        if selected_role == "mentor" and not hasattr(user, "mentor_profile"):
            MentorProfile.objects.create(
                user=user,
                program="BSIT",
                year_level=4,
                approved=False,
            )
        elif selected_role == "mentee":
            if not hasattr(user, "mentee_profile"):
                MenteeProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=1,
                    approved=False,
                )
            request.session.pop(GOOGLE_OAUTH_ROLE_SESSION_KEY, None)
        return user

    def get_login_redirect_url(self, request):
        return "/app/signin?oauth=google"
