"""Google OAuth token helpers shared by Drive integration."""
import logging
from datetime import timedelta

import requests
from allauth.socialaccount.models import SocialToken
from django.utils import timezone

logger = logging.getLogger(__name__)


def _refresh_google_token(social_token):
    """Refresh Google OAuth access token; returns new access_token or None."""
    if not social_token.token_secret:
        return None
    app = getattr(social_token, "app", None)
    if not app or not app.client_id or not app.secret:
        return None
    resp = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": app.client_id,
            "client_secret": app.secret,
            "refresh_token": social_token.token_secret,
            "grant_type": "refresh_token",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    if resp.status_code != 200:
        logger.warning(
            "google_token_refresh_failed",
            extra={"status_code": resp.status_code, "response": resp.text[:300]},
        )
        return None
    data = resp.json()
    access_token = data.get("access_token")
    if not access_token:
        return None
    expires_in = data.get("expires_in")
    social_token.token = access_token
    if expires_in:
        social_token.expires_at = timezone.now() + timedelta(seconds=int(expires_in))
    social_token.save(update_fields=["token", "expires_at"])
    return access_token


def get_google_access_token(user):
    """Return a valid Google OAuth access token for the user, refreshing if needed."""
    token = (
        SocialToken.objects.filter(account__user=user, account__provider="google")
        .select_related("app")
        .order_by("-id")
        .first()
    )
    if not token:
        return None
    now = timezone.now()
    if token.expires_at:
        if (token.expires_at - now) < timedelta(minutes=5):
            new_token = _refresh_google_token(token)
            if new_token:
                return new_token
    return token.token
