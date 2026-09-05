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
    """Keep django.contrib.sites in sync with the Render hostname.

    allauth and activation emails otherwise keep using the default example.com.
    """
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
