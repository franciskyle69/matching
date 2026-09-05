"""Activation and transactional email helpers."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from capstone_site.site_utils import public_host, public_protocol, sync_site_from_env


def email_backend_can_send() -> bool:
    backend = (getattr(settings, "EMAIL_BACKEND", "") or "").lower()
    if any(
        name in backend
        for name in ("console", "locmem", "dummy", "filebased", "inmemory")
    ):
        return True
    return bool(
        (getattr(settings, "EMAIL_HOST_USER", "") or "").strip()
        and (getattr(settings, "EMAIL_HOST_PASSWORD", "") or "").strip()
    )


def send_activation_email(request, user) -> None:
    sync_site_from_env()
    domain = public_host(request)
    protocol = public_protocol(request)
    context = {
        "user": user,
        "domain": domain,
        "uid": urlsafe_base64_encode(force_bytes(user.pk)),
        "token": default_token_generator.make_token(user),
        "protocol": protocol,
    }
    text_message = render_to_string("registration/activation_email.txt", context)
    html_message = render_to_string("registration/activation_email.html", context)
    email_message = EmailMultiAlternatives(
        "Activate your account",
        text_message,
        to=[user.email],
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None) or None,
    )
    email_message.attach_alternative(html_message, "text/html")
    email_message.send()
