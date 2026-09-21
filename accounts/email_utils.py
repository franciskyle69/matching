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
    delivery_mode = (getattr(settings, "EMAIL_DELIVERY_MODE", "") or "").upper()
    is_dev = getattr(settings, "DEBUG", False) or getattr(settings, "DJANGO_ENV", "") == "development"

    # Console, mock, and in-memory testing backends
    if any(
        name in backend
        for name in ("console", "locmem", "dummy", "filebased", "inmemory")
    ):
        return True

    # HTTP API delivery backend (Resend / SendGrid)
    if "httpemailbackend" in backend or delivery_mode == "HTTP":
        if bool((getattr(settings, "RESEND_API_KEY", "") or "").strip()) or bool((getattr(settings, "SENDGRID_API_KEY", "") or "").strip()):
            return True
        # If SMTP credentials are configured, HttpEmailBackend can fall back to SMTP
        if bool((getattr(settings, "EMAIL_HOST_USER", "") or "").strip()) and bool((getattr(settings, "EMAIL_HOST_PASSWORD", "") or "").strip()):
            return True
        # In development/debug mode, HttpEmailBackend safely falls back to console logging
        if is_dev or delivery_mode == "CONSOLE":
            return True
        return False

    # Standard SMTP backend check
    return bool(
        (getattr(settings, "EMAIL_HOST_USER", "") or "").strip()
        and (getattr(settings, "EMAIL_HOST_PASSWORD", "") or "").strip()
    )


def send_activation_email(request, user) -> str:
    return send_verification_email(request, user)


def send_verification_email(request, user) -> str:
    sync_site_from_env()
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    frontend_url = getattr(settings, "FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url:
        verification_url = f"{frontend_url}/verify-email/{uid}/{token}/"
        domain = frontend_url.split("://")[-1]
        protocol = "https" if frontend_url.startswith("https://") else "http"
    else:
        domain = public_host(request)
        protocol = public_protocol(request)
        verification_url = f"{protocol}://{domain}/verify-email/{uid}/{token}/"

    context = {
        "user": user,
        "domain": domain,
        "uid": uid,
        "token": token,
        "protocol": protocol,
        "verification_url": verification_url,
    }
    text_message = render_to_string("registration/activation_email.txt", context)
    html_message = render_to_string("registration/activation_email.html", context)
    email_message = EmailMultiAlternatives(
        "Verify your BukSU email address",
        text_message,
        to=[user.email],
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None) or None,
    )
    email_message.attach_alternative(html_message, "text/html")
    email_message.send()
    return verification_url

