"""HTTP-based email delivery service and Django email backend.

Provides reliable email delivery over HTTPS APIs (Resend and SendGrid),
bypassing cloud datacenter outbound SMTP port blocking (e.g. Render ports 25, 465, 587)
and IP reputation filtering on traditional mail servers.
"""

from __future__ import annotations

import logging
from email.utils import parseaddr
from typing import Any, Iterable, List, Optional, Sequence, Union

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.message import EmailMessage

logger = logging.getLogger(__name__)

try:
    import resend
    _HAS_RESEND_SDK = True
except ImportError:
    _HAS_RESEND_SDK = False

RESEND_API_URL = "https://api.resend.com/emails"
SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"


def format_from_email(from_email: Optional[str] = None) -> str:
    """Return a formatted from-email string, falling back to Django DEFAULT_FROM_EMAIL."""
    candidate = from_email or getattr(settings, "DEFAULT_FROM_EMAIL", "") or "BukSU PeerLink <onboarding@resend.dev>"
    return candidate.strip()


def send_resend_email(
    to: Union[str, Sequence[str]],
    subject: str,
    html_content: Optional[str] = None,
    text_content: Optional[str] = None,
    from_email: Optional[str] = None,
    reply_to: Optional[Union[str, Sequence[str]]] = None,
    api_key: Optional[str] = None,
    timeout: Optional[int] = None,
) -> dict[str, Any]:
    """Send an email using the Resend HTTPS REST API.

    Args:
        to: Email address or list of email addresses.
        subject: Email subject line.
        html_content: HTML body of the email.
        text_content: Plain text body of the email.
        from_email: Sender email address (e.g. 'BukSU PeerLink <onboarding@resend.dev>').
        reply_to: Optional reply-to address or list of addresses.
        api_key: Optional Resend API key override (defaults to settings.RESEND_API_KEY).
        timeout: HTTP request timeout in seconds.

    Returns:
        Dict containing the Resend API response JSON (including message ID).

    Raises:
        requests.RequestException: If the HTTP request fails or Resend returns an error.
    """
    key = (api_key or getattr(settings, "RESEND_API_KEY", "") or "").strip()
    if not key:
        raise ValueError("RESEND_API_KEY is not configured.")

    sender = format_from_email(from_email)
    recipients = [to] if isinstance(to, str) else list(to)
    if not recipients:
        raise ValueError("At least one recipient email address is required.")

    payload: dict[str, Any] = {
        "from": sender,
        "to": recipients,
        "subject": subject,
    }
    if html_content:
        payload["html"] = html_content
    if text_content:
        payload["text"] = text_content
    if not html_content and not text_content:
        payload["text"] = ""

    if reply_to:
        payload["reply_to"] = [reply_to] if isinstance(reply_to, str) else list(reply_to)

    if _HAS_RESEND_SDK:
        resend.api_key = key
        params: dict[str, Any] = {
            "from": sender,
            "to": recipients,
            "subject": subject,
        }
        if html_content:
            params["html"] = html_content
        if text_content:
            params["text"] = text_content
        if not html_content and not text_content:
            params["text"] = ""
        if reply_to:
            params["reply_to"] = [reply_to] if isinstance(reply_to, str) else list(reply_to)

        try:
            resp = resend.Emails.send(params)
            result = resp if isinstance(resp, dict) else {"id": getattr(resp, "id", str(resp))}
            logger.info(
                "resend_email_sent",
                extra={
                    "id": result.get("id"),
                    "to": recipients,
                    "subject": subject,
                },
            )
            return result
        except Exception as exc:
            logger.error(
                "resend_sdk_error",
                extra={"error": str(exc), "to": recipients, "from": sender},
            )
            raise

    req_timeout = timeout or getattr(settings, "EMAIL_TIMEOUT", 15)
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "User-Agent": "BukSU-PeerLink-Mailer/1.0",
    }

    response = requests.post(
        RESEND_API_URL,
        json=payload,
        headers=headers,
        timeout=req_timeout,
    )
    if not response.ok:
        logger.error(
            "resend_api_error",
            extra={
                "status_code": response.status_code,
                "response": response.text,
                "to": recipients,
                "from": sender,
            },
        )
        response.raise_for_status()

    result = response.json()
    logger.info(
        "resend_email_sent",
        extra={
            "id": result.get("id"),
            "to": recipients,
            "subject": subject,
        },
    )
    return result


def send_sendgrid_email(
    to: Union[str, Sequence[str]],
    subject: str,
    html_content: Optional[str] = None,
    text_content: Optional[str] = None,
    from_email: Optional[str] = None,
    reply_to: Optional[Union[str, Sequence[str]]] = None,
    api_key: Optional[str] = None,
    timeout: Optional[int] = None,
) -> dict[str, Any]:
    """Send an email using the SendGrid v3 HTTPS REST API."""
    key = (api_key or getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    if not key:
        raise ValueError("SENDGRID_API_KEY is not configured.")

    sender_raw = format_from_email(from_email)
    sender_name, sender_addr = parseaddr(sender_raw)
    from_obj: dict[str, str] = {"email": sender_addr or sender_raw}
    if sender_name:
        from_obj["name"] = sender_name

    recipients = [to] if isinstance(to, str) else list(to)
    if not recipients:
        raise ValueError("At least one recipient email address is required.")

    personalizations = [{"to": [{"email": r} for r in recipients]}]

    contents: list[dict[str, str]] = []
    if text_content:
        contents.append({"type": "text/plain", "value": text_content})
    if html_content:
        contents.append({"type": "text/html", "value": html_content})
    if not contents:
        contents.append({"type": "text/plain", "value": ""})

    payload: dict[str, Any] = {
        "personalizations": personalizations,
        "from": from_obj,
        "subject": subject,
        "content": contents,
    }

    if reply_to:
        reply_list = [reply_to] if isinstance(reply_to, str) else list(reply_to)
        if reply_list:
            r_name, r_addr = parseaddr(reply_list[0])
            payload["reply_to"] = {"email": r_addr or reply_list[0]}
            if r_name:
                payload["reply_to"]["name"] = r_name

    req_timeout = timeout or getattr(settings, "EMAIL_TIMEOUT", 15)
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        SENDGRID_API_URL,
        json=payload,
        headers=headers,
        timeout=req_timeout,
    )
    if not response.ok:
        logger.error(
            "sendgrid_api_error",
            extra={
                "status_code": response.status_code,
                "response": response.text,
                "to": recipients,
            },
        )
        response.raise_for_status()

    result: dict[str, Any] = {"status_code": response.status_code}
    if response.text:
        try:
            result = response.json()
        except Exception:
            pass
    logger.info("sendgrid_email_sent", extra={"to": recipients, "subject": subject})
    return result


def send_http_email(
    to: Union[str, Sequence[str]],
    subject: str,
    html_content: Optional[str] = None,
    text_content: Optional[str] = None,
    from_email: Optional[str] = None,
    reply_to: Optional[Union[str, Sequence[str]]] = None,
    fail_silently: bool = False,
) -> bool:
    """Unified email dispatcher routing through configured HTTP API or fallback."""
    resend_key = (getattr(settings, "RESEND_API_KEY", "") or "").strip()
    sendgrid_key = (getattr(settings, "SENDGRID_API_KEY", "") or "").strip()
    delivery_mode = (getattr(settings, "EMAIL_DELIVERY_MODE", "") or "").upper()
    is_dev = getattr(settings, "DEBUG", False) or getattr(settings, "DJANGO_ENV", "") == "development"

    try:
        if resend_key:
            send_resend_email(
                to=to,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                from_email=from_email,
                reply_to=reply_to,
            )
            return True
        elif sendgrid_key:
            send_sendgrid_email(
                to=to,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
                from_email=from_email,
                reply_to=reply_to,
            )
            return True
        elif delivery_mode == "CONSOLE" or is_dev:
            # Graceful console logging fallback when no API key is supplied in dev
            logger.info(
                "console_email_fallback: To: %s | Subject: %s\nText:\n%s\nHTML:\n%s",
                to,
                subject,
                text_content or "(none)",
                html_content or "(none)",
            )
            return True
        else:
            raise RuntimeError(
                "No HTTP email API key configured. Set RESEND_API_KEY or SENDGRID_API_KEY in environment variables."
            )
    except Exception as exc:
        logger.exception("http_email_dispatch_failed", extra={"error": str(exc), "to": to, "subject": subject})
        if not fail_silently:
            raise
        return False


class HttpEmailBackend(BaseEmailBackend):
    """Django EmailBackend that transmits messages over HTTPS API instead of SMTP.

    Drop-in replacement for standard Django EmailBackends:
    Compatible with send_mail(), EmailMessage(), EmailMultiAlternatives(),
    and allauth password reset/activation flows.
    """

    def __init__(self, fail_silently: bool = False, **kwargs: Any):
        super().__init__(fail_silently=fail_silently, **kwargs)

    def send_messages(self, email_messages: Iterable[EmailMessage]) -> int:
        """Send one or more email messages over HTTP API."""
        if not email_messages:
            return 0

        num_sent = 0
        for message in email_messages:
            recipients = list(message.to)
            if not recipients:
                continue

            subject = message.subject or ""
            text_content = message.body or ""
            html_content = None

            # Detect HTML content from alternatives (e.g. EmailMultiAlternatives)
            for alt_content, mimetype in getattr(message, "alternatives", []):
                if mimetype == "text/html":
                    html_content = alt_content
                    break

            if not html_content and getattr(message, "content_subtype", "") == "html":
                html_content = message.body
                text_content = ""

            from_email = message.from_email or getattr(settings, "DEFAULT_FROM_EMAIL", None)
            reply_to = getattr(message, "reply_to", None)

            try:
                success = send_http_email(
                    to=recipients,
                    subject=subject,
                    html_content=html_content,
                    text_content=text_content,
                    from_email=from_email,
                    reply_to=reply_to,
                    fail_silently=False,
                )
                if success:
                    num_sent += 1
            except Exception as exc:
                if not self.fail_silently:
                    raise
                logger.warning(
                    "http_email_backend_message_suppressed",
                    extra={"error": str(exc), "to": recipients, "subject": subject},
                )

        return num_sent
