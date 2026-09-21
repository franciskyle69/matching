"""User and email verification utility functions.

Re-exports core email delivery services from accounts.email_utils for consistency.
"""

from __future__ import annotations

from accounts.email_utils import (
    email_backend_can_send,
    send_activation_email,
    send_verification_email,
)
from users.services.email_service import (
    send_http_email,
    send_resend_email,
)

__all__ = [
    "email_backend_can_send",
    "send_activation_email",
    "send_http_email",
    "send_resend_email",
    "send_verification_email",
]
