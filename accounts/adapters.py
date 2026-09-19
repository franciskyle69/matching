from django.contrib import messages
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from allauth.exceptions import ImmediateHttpResponse
from django import forms

from profiles.models import MentorProfile, MenteeProfile
from profiles.profile_completion import (
    compute_is_profile_complete,
    social_picture_url,
)
from accounts.oauth_gate import (
    ACCOUNT_EXISTS,
    INTENT_SESSION_KEY,
    LOGIN_MISSING_MESSAGE,
    NO_ACCOUNT,
    SIGNUP_EXISTS_MESSAGE,
    SIGNUP_INTENT,
    normalize_oauth_intent,
    resolve_google_oauth_gate,
)
from accounts.models import UserSecurityState

User = get_user_model()
ROLE_SESSION_KEY = "selected_role"
GOOGLE_OAUTH_ROLE_SESSION_KEY = "google_oauth_selected_role"


def _social_email(sociallogin):
    user = sociallogin.user
    if sociallogin.email_addresses:
        return sociallogin.email_addresses[0].email
    email = getattr(user, "email", None)
    if email:
        return email
    account = getattr(sociallogin, "account", None)
    extra = getattr(account, "extra_data", None) or {}
    return extra.get("email")


from allauth.account.adapter import DefaultAccountAdapter


class PeerLinkAccountAdapter(DefaultAccountAdapter):
    """Account adapter tailored for PeerLink's React frontend."""

    def is_login_by_code_required(self, login) -> bool:
        # Allauth's LoginByCodeStage can invoke get_adapter() without request,
        # leaving self.request as None. Guard against AttributeError.
        if not getattr(self, "request", None):
            return False
        return super().is_login_by_code_required(login)

    def add_message(
        self,
        request,
        level,
        message_template=None,
        message_context=None,
        extra_tags="",
        message=None,
    ):
        # The React SPA provides its own welcome and notifications; suppress
        # server template session messages that would linger unconsumed.
        if message_template == "account/messages/logged_in.txt":
            return
        super().add_message(
            request,
            level,
            message_template=message_template,
            message_context=message_context,
            extra_tags=extra_tags,
            message=message,
        )


class RoleAwareSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Enforce role selection for Google login and create the appropriate
    profile when a brand new social account signs up.
    Also handles linking Google accounts to existing email/password accounts.
    """

    def is_open_for_signup(self, request, sociallogin):
        # Strictly disable social account registration. All registrations must be manual.
        return False

    def list_apps(self, request, provider=None, client_id=None):
        """Blends database and settings apps, filtering out empty configs and deduplicating."""
        from allauth.socialaccount.models import SocialApp
        from django.db.models import Q

        apps = super().list_apps(request, provider=provider, client_id=client_id)
        if not apps:
            db_apps = SocialApp.objects.all()
            if provider:
                db_apps = db_apps.filter(Q(provider=provider) | Q(provider_id=provider))
            if client_id:
                db_apps = db_apps.filter(client_id=client_id)
            apps = list(db_apps)
        valid_apps = [a for a in apps if getattr(a, "client_id", "").strip()]
        if valid_apps:
            apps = valid_apps
        deduped = {}
        for a in apps:
            cid = a.client_id
            if cid not in deduped or getattr(a, "pk", None):
                deduped[cid] = a
        return list(deduped.values())

    def get_app(self, request, provider, client_id=None):
        """Safely resolve SocialApp avoiding MultipleObjectsReturned."""
        from django.core.exceptions import MultipleObjectsReturned
        from allauth.socialaccount.models import SocialApp

        try:
            return super().get_app(request, provider, client_id=client_id)
        except MultipleObjectsReturned:
            apps = self.list_apps(request, provider=provider, client_id=client_id)
            for app in apps:
                if getattr(app, "pk", None) and getattr(app, "client_id", ""):
                    return app
            for app in apps:
                if getattr(app, "client_id", ""):
                    return app
            return apps[0]
        except SocialApp.DoesNotExist:
            apps = self.list_apps(request, provider=provider)
            if apps:
                for app in apps:
                    if getattr(app, "pk", None) and getattr(app, "client_id", ""):
                        return app
                return apps[0]
            raise

    def pre_social_login(self, request, sociallogin: SocialLogin):
        selected_role = request.session.get(ROLE_SESSION_KEY)
        selected_google_role = request.session.get(GOOGLE_OAUTH_ROLE_SESSION_KEY)
        user = sociallogin.user
        email = _social_email(sociallogin)

        # Validate institutional email domain for Google OAuth
        if email:
            from accounts.forms import validate_institutional_email
            try:
                validate_institutional_email(email)
            except forms.ValidationError as e:
                if request.headers.get("x-requested-with") == "XMLHttpRequest" or "application/json" in request.headers.get("accept", ""):
                    from django.http import JsonResponse
                    raise ImmediateHttpResponse(
                        JsonResponse({"error": str(e)}, status=400)
                    )
                raise ImmediateHttpResponse(
                    redirect("/app/signin?oauth_error=institutional_email")
                )
        else:
            if request.headers.get("x-requested-with") == "XMLHttpRequest" or "application/json" in request.headers.get("accept", ""):
                from django.http import JsonResponse
                raise ImmediateHttpResponse(
                    JsonResponse({"error": "Google account email could not be read."}, status=400)
                )
            raise ImmediateHttpResponse(redirect("/app/signin?oauth_error=missing_email"))

        existing_user = User.objects.filter(email__iexact=email).first()
        account_exists = bool(
            getattr(sociallogin, "is_existing", False)
            or existing_user is not None
            or getattr(user, "pk", None)
        )
        intent = normalize_oauth_intent(request.session.get(INTENT_SESSION_KEY))
        gate = resolve_google_oauth_gate(intent, account_exists)
        if gate == NO_ACCOUNT:
            error_payload = {
                "error": "No account found with this email. Please complete the manual registration first."
            }
            if (
                request.headers.get("x-requested-with") == "XMLHttpRequest"
                or "application/json" in request.headers.get("accept", "")
            ):
                from django.http import JsonResponse
                raise ImmediateHttpResponse(JsonResponse(error_payload, status=401))
            messages.error(
                request,
                "No account found with this email. Please complete the manual registration first.",
            )
            raise ImmediateHttpResponse(
                redirect("/app/signin?oauth_error=no_account")
            )
        if gate == ACCOUNT_EXISTS:
            raise ImmediateHttpResponse(
                redirect("/app/signup?oauth_error=account_exists")
            )

        # Login (or continuing signup of a brand-new user): attach Google to a
        # matching local account when one already exists.
        if email and existing_user:
            if not getattr(user, "pk", None):
                sociallogin.user = existing_user
            # Ensure social account is linked and saved
            from allauth.socialaccount.models import SocialAccount
            if not SocialAccount.objects.filter(
                provider=sociallogin.account.provider,
                uid=sociallogin.account.uid,
            ).exists():
                sociallogin.account.user = existing_user
                sociallogin.account.save()
            # Ensure EmailAddress record is verified so verification stage never blocks user
            from allauth.account.models import EmailAddress
            email_obj, _ = EmailAddress.objects.get_or_create(
                user=existing_user,
                email__iexact=email,
                defaults={"email": email, "verified": True, "primary": True},
            )
            if not email_obj.verified:
                email_obj.verified = True
                email_obj.save(update_fields=["verified"])

        # Update user reference after potential linking
        user = sociallogin.user
        is_mentor = hasattr(user, "mentor_profile") or (
            hasattr(user, "profile")
            and getattr(user.profile, "role", "") in ("STUDENT_MENTOR", "INSTRUCTOR_MENTOR", "mentor")
        )
        is_mentee = hasattr(user, "mentee_profile") or (
            hasattr(user, "profile")
            and getattr(user.profile, "role", "") in ("MENTEE", "mentee")
        )
        actual_role = "mentor" if is_mentor else "mentee" if is_mentee else None

        # Existing users must match the role selected for this OAuth attempt.
        if user.pk and selected_google_role in ("mentor", "mentee"):
            if actual_role and actual_role != selected_google_role:
                messages.error(
                    request,
                    (
                        f"This Google account is linked to a {actual_role.title()} "
                        f"account, not {selected_google_role.title()}."
                    ),
                )
                raise ImmediateHttpResponse(
                    redirect(f"/app/?role={selected_google_role}#signin")
                )
            request.session[ROLE_SESSION_KEY] = selected_google_role
            selected_role = selected_google_role

        # If role is not selected, infer from existing profile.
        if not selected_role:
            if actual_role:
                request.session[ROLE_SESSION_KEY] = actual_role
                selected_role = actual_role

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
                    is_profile_complete=False,
                    avatar_url=social_picture_url(sociallogin),
                )
            elif selected_role == "mentee":
                MenteeProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=1,
                    approved=False,
                    is_profile_complete=False,
                    avatar_url=social_picture_url(sociallogin),
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
        UserSecurityState.objects.get_or_create(user=user, defaults={"is_onboarded": False})
        selected_role = request.session.get(ROLE_SESSION_KEY)

        picture = social_picture_url(sociallogin)
        if selected_role == "mentor" and not hasattr(user, "mentor_profile"):
            MentorProfile.objects.create(
                user=user,
                program="BSIT",
                year_level=4,
                approved=False,
                is_profile_complete=False,
                avatar_url=picture,
            )
        elif selected_role == "mentee":
            if not hasattr(user, "mentee_profile"):
                MenteeProfile.objects.create(
                    user=user,
                    program="BSIT",
                    year_level=1,
                    approved=False,
                    is_profile_complete=False,
                    avatar_url=picture,
                )
            request.session.pop(GOOGLE_OAUTH_ROLE_SESSION_KEY, None)
        else:
            self._apply_google_avatar(user, picture)
        return user

    def _apply_google_avatar(self, user, picture):
        if not picture:
            return
        profile = None
        if hasattr(user, "mentor_profile"):
            profile = user.mentor_profile
        elif hasattr(user, "mentee_profile"):
            profile = user.mentee_profile
        if profile and not getattr(profile, "avatar_url", ""):
            profile.avatar_url = picture
            profile.save(update_fields=["avatar_url"])

    def get_login_redirect_url(self, request):
        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            if not compute_is_profile_complete(user):
                state, _ = UserSecurityState.objects.get_or_create(user=user)
                state.is_onboarded = False
                state.save(update_fields=["is_onboarded"])
                return "/app/?oauth=google#onboarding"
            return "/app/?oauth=google"
        return "/app/?oauth=google#onboarding"
