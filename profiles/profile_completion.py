"""Account-detail completeness for Google OAuth and first-time onboarding."""

from django.core.exceptions import ObjectDoesNotExist

STUDENT_MENTOR_ROLE = "Senior IT Student"
INSTRUCTOR_ROLE = "Instructor"
MENTOR_TRACK_ROLES = (STUDENT_MENTOR_ROLE, INSTRUCTOR_ROLE)


def _filled(value):
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return True
    return bool(str(value).strip())


def _related(user, attr):
    try:
        return getattr(user, attr)
    except ObjectDoesNotExist:
        return None
    except AttributeError:
        return None


def mentee_account_fields_complete(mentee):
    return bool(
        mentee
        and _filled(getattr(mentee, "program", ""))
        and getattr(mentee, "year_level", None)
        and _filled(getattr(mentee, "student_id_no", ""))
        and _filled(getattr(mentee, "campus", ""))
        and _filled(getattr(mentee, "contact_no", ""))
        and _filled(getattr(mentee, "sex", ""))
    )


def mentor_account_fields_complete(mentor):
    role = str(getattr(mentor, "role", "") or "").strip()
    return bool(
        mentor
        and _filled(getattr(mentor, "program", ""))
        and getattr(mentor, "year_level", None)
        and _filled(getattr(mentor, "student_id_no", ""))
        and role in MENTOR_TRACK_ROLES
    )


def compute_is_profile_complete(user):
    """True when stored flag is set or required account fields are filled."""
    if not user:
        return False
    if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
        return True
    profile = _related(user, "profile")
    if profile and getattr(profile, "role", None) in ("COORDINATOR",):
        return True
    mentor = _related(user, "mentor_profile")
    mentee = _related(user, "mentee_profile")
    if mentor:
        return bool(
            getattr(mentor, "is_profile_complete", False)
            or mentor_account_fields_complete(mentor)
        )
    if mentee:
        return bool(
            getattr(mentee, "is_profile_complete", False)
            or mentee_account_fields_complete(mentee)
        )
    return True


def mark_profile_complete(profile, complete=True):
    if profile is None:
        return
    if getattr(profile, "is_profile_complete", None) is complete:
        return
    profile.is_profile_complete = complete
    profile.save(update_fields=["is_profile_complete"])


def get_auth_provider(user):
    if not user or not getattr(user, "is_authenticated", False):
        return "password"
    try:
        from allauth.socialaccount.models import SocialAccount

        if SocialAccount.objects.filter(user=user, provider="google").exists():
            return "google"
    except Exception:
        pass
    return "password"


def social_picture_url(sociallogin):
    extra = {}
    account = getattr(sociallogin, "account", None)
    extra = getattr(account, "extra_data", None) or {}
    if not extra and getattr(sociallogin, "user", None):
        extra = {}
    return (
        extra.get("picture")
        or extra.get("picture_url")
        or extra.get("avatar_url")
        or ""
    )
