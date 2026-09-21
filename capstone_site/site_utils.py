"""Public hostname/protocol helpers for emails and django.contrib.sites."""

from __future__ import annotations

import os


def public_protocol(request=None) -> str:
    from django.conf import settings

    if not settings.DEBUG:
        return "https"
    if request is not None and getattr(request, "is_secure", lambda: False)():
        return "https"
    return "http"


def public_host(request=None) -> str:
    import re
    frontend_raw = os.environ.get("FRONTEND_URL", "").strip()
    if frontend_raw:
        clean_frontend = re.sub(r"[()\[\]'\"\s]+", "", frontend_raw)
        if "://" in clean_frontend:
            clean_frontend = clean_frontend.split("://", 1)[1]
        host = clean_frontend.split("/")[0].split(":")[0].strip()
        if host:
            return host

    render_host = (os.environ.get("RENDER_EXTERNAL_HOSTNAME") or "").strip()
    if render_host:
        return render_host.split(":")[0]

    if request is not None:
        host = (request.get_host() or "").split(":")[0].strip()
        if host and host not in {"testserver"}:
            return host

    try:
        from django.contrib.sites.models import Site
        from django.conf import settings

        site = Site.objects.filter(pk=getattr(settings, "SITE_ID", 1)).first()
        if site and site.domain:
            return site.domain
    except Exception:
        pass
    return "localhost"


def sync_site_from_env() -> None:
    """Keep django.contrib.sites in sync with the custom FRONTEND_URL or Render hostname.

    allauth and activation emails otherwise keep using the default example.com.
    """
    import re
    frontend_raw = os.environ.get("FRONTEND_URL", "").strip()
    host = ""
    if frontend_raw:
        clean_frontend = re.sub(r"[()\[\]'\"\s]+", "", frontend_raw)
        if "://" in clean_frontend:
            clean_frontend = clean_frontend.split("://", 1)[1]
        host = clean_frontend.split("/")[0].split(":")[0].strip()

    if not host:
        host = (os.environ.get("RENDER_EXTERNAL_HOSTNAME") or "").strip().split(":")[0]
    if not host:
        return
    try:
        from django.conf import settings
        from django.contrib.sites.models import Site

        Site.objects.update_or_create(
            pk=getattr(settings, "SITE_ID", 1),
            defaults={"domain": host, "name": "PeerLink"},
        )
    except Exception:
        # Sites table may not exist yet during migrate.
        pass


def sync_google_socialapp_from_env() -> None:
    """Keep allauth SocialApp for Google in sync with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from environment."""
    client_id = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
    client_secret = (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()
    if not client_id:
        return
    try:
        from django.conf import settings
        from django.contrib.sites.models import Site
        from allauth.socialaccount.models import SocialApp

        app, _ = SocialApp.objects.update_or_create(
            provider="google",
            defaults={
                "name": "Google",
                "client_id": client_id,
                "secret": client_secret,
            },
        )
        current_site = Site.objects.filter(pk=getattr(settings, "SITE_ID", 1)).first()
        if current_site and not app.sites.filter(pk=current_site.pk).exists():
            app.sites.add(current_site)
    except Exception:
        pass
