from django.contrib import messages
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from allauth.exceptions import ImmediateHttpResponse

from profiles.models import MentorProfile, MenteeProfile

User = get_user_model()
ROLE_SESSION_KEY = "selected_role"


class RoleAwareSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Enforce role selection for Google login and create the appropriate
    profile when a brand new social account signs up.
    Also handles linking Google accounts to existing email/password accounts.
    """

    def pre_social_login(self, request, sociallogin: SocialLogin):
        selected_role = request.session.get(ROLE_SESSION_KEY)
        user = sociallogin.user
        email = sociallogin.email_addresses[0].email if sociallogin.email_addresses else None
        
        # Check if a user with this email already exists (for account linking)
        # This allows users to log in with Google even if they created account with email/password
        if email and not user.pk:
            try:
                existing_user = User.objects.get(email=email)
                # Link the Google social account to the existing user account
                sociallogin.user = existing_user
                sociallogin.state['process'] = 'connect'
                messages.success(request, f"Google account successfully linked! You can now log in with either email/password or Google.")
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

        # If the social account maps to an existing user that has no profile yet,
        # require role selection first.
        if user.pk and not is_mentor and not is_mentee and not selected_role:
            messages.info(request, "Please choose Mentor or Mentee before logging in with Google.")
            raise ImmediateHttpResponse(redirect("home"))
        if user.pk and not is_mentor and not is_mentee and selected_role:
            if selected_role == "mentor":
                MentorProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=4,
                )
            elif selected_role == "mentee":
                MenteeProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=1,
                )

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        selected_role = request.session.get(ROLE_SESSION_KEY)

        # Create the appropriate profile for a new user if missing.
        if selected_role == "mentor":
            # For testing/development, allow immediate dashboard access.
            mentor_profile = getattr(user, "mentor_profile", None)
            if mentor_profile is not None and not getattr(mentor_profile, "approved", False):
                mentor_profile.approved = True
                mentor_profile.save(update_fields=["approved"])

        if selected_role == "mentor" and not hasattr(user, "mentor_profile"):
            MentorProfile.objects.create(
                user=user,
                program="BSIT",
                year_level=4,
                approved=True,
            )
        elif selected_role == "mentee":
            mentee_profile = getattr(user, "mentee_profile", None)
            if mentee_profile is not None and not getattr(mentee_profile, "approved", False):
                mentee_profile.approved = True
                mentee_profile.save(update_fields=["approved"])

        if selected_role == "mentee" and not hasattr(user, "mentee_profile"):
            MenteeProfile.objects.create(
                user=user,
                program="BSIT",
                year_level=1,
                approved=True,
            )
        return user

    def get_login_redirect_url(self, request):
        return "/app/"
