"""Unit tests for HTTP-based email delivery service and HttpEmailBackend."""

from unittest.mock import MagicMock, patch

from django.conf import settings
from django.core.mail import EmailMessage, EmailMultiAlternatives, get_connection, send_mail
from django.test import SimpleTestCase, override_settings

from accounts.email_utils import email_backend_can_send
from users.services.email_service import (
    HttpEmailBackend,
    send_http_email,
    send_resend_email,
    send_sendgrid_email,
)


class EmailServiceUnitTests(SimpleTestCase):
    """Test individual HTTP sending functions and API payload generation."""

    @patch("resend.Emails.send")
    def test_send_resend_email_via_sdk(self, mock_send):
        mock_send.return_value = {"id": "resend-sdk-msg-123"}

        res = send_resend_email(
            to="student@student.buksu.edu.ph",
            subject="Test Subject",
            html_content="<p>Test HTML</p>",
            text_content="Test Text",
            from_email="BukSU PeerLink <onboarding@resend.dev>",
            api_key="re_mock_api_key_12345",
        )

        self.assertEqual(res.get("id"), "resend-sdk-msg-123")
        mock_send.assert_called_once()
        args, kwargs = mock_send.call_args
        params = args[0] if args else kwargs.get("params")
        self.assertEqual(params["to"], ["student@student.buksu.edu.ph"])
        self.assertEqual(params["subject"], "Test Subject")
        self.assertEqual(params["html"], "<p>Test HTML</p>")
        self.assertEqual(params["text"], "Test Text")

    @patch("users.services.email_service._HAS_RESEND_SDK", False)
    @patch("users.services.email_service.requests.post")
    def test_send_resend_email_fallback_requests(self, mock_post):
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "resend-fallback-123"}
        mock_post.return_value = mock_response

        res = send_resend_email(
            to="student@student.buksu.edu.ph",
            subject="Test Subject",
            html_content="<p>Test HTML</p>",
            text_content="Test Text",
            from_email="BukSU PeerLink <onboarding@resend.dev>",
            api_key="re_mock_api_key_12345",
        )

        self.assertEqual(res.get("id"), "resend-fallback-123")
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://api.resend.com/emails")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer re_mock_api_key_12345")
        self.assertEqual(kwargs["json"]["to"], ["student@student.buksu.edu.ph"])
        self.assertEqual(kwargs["json"]["subject"], "Test Subject")

    @patch("users.services.email_service.requests.post")
    def test_send_sendgrid_email_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 202
        mock_response.text = ""
        mock_post.return_value = mock_response

        res = send_sendgrid_email(
            to="student@student.buksu.edu.ph",
            subject="SendGrid Subject",
            html_content="<p>SendGrid HTML</p>",
            text_content="SendGrid Text",
            from_email="BukSU PeerLink <noreply@buksu.edu.ph>",
            api_key="SG.mock_api_key",
        )

        self.assertEqual(res.get("status_code"), 202)
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://api.sendgrid.com/v3/mail/send")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer SG.mock_api_key")
        self.assertEqual(kwargs["json"]["personalizations"][0]["to"][0]["email"], "student@student.buksu.edu.ph")

    @override_settings(RESEND_API_KEY="re_test_key")
    @patch("users.services.email_service.send_resend_email")
    def test_send_http_email_routes_to_resend_when_key_present(self, mock_resend):
        mock_resend.return_value = {"id": "123"}
        success = send_http_email(
            to="test@buksu.edu.ph",
            subject="Hello",
            text_content="World",
        )
        self.assertTrue(success)
        mock_resend.assert_called_once()

    @override_settings(RESEND_API_KEY="", SENDGRID_API_KEY="", EMAIL_HOST_USER="", EMAIL_HOST_PASSWORD="", DEBUG=True)
    def test_send_http_email_dev_console_fallback(self):
        # In debug mode without API keys or SMTP, should fall back safely without raising
        success = send_http_email(
            to="test@buksu.edu.ph",
            subject="Hello Dev",
            text_content="World Dev",
        )
        self.assertTrue(success)

    @override_settings(RESEND_API_KEY="", SENDGRID_API_KEY="", EMAIL_HOST_USER="", EMAIL_HOST_PASSWORD="", DEBUG=False, DJANGO_ENV="production")
    def test_send_http_email_raises_in_prod_when_no_keys(self):
        with self.assertRaises(RuntimeError):
            send_http_email(
                to="test@buksu.edu.ph",
                subject="Hello Prod",
                text_content="World Prod",
                fail_silently=False,
            )


class HttpEmailBackendTests(SimpleTestCase):
    """Test Django HttpEmailBackend integration."""

    @patch("users.services.email_service.send_http_email")
    def test_backend_send_messages_success(self, mock_dispatch):
        mock_dispatch.return_value = True
        backend = HttpEmailBackend()

        msg1 = EmailMessage(
            subject="Test 1",
            body="Body 1",
            from_email="BukSU <onboarding@resend.dev>",
            to=["user1@buksu.edu.ph"],
        )
        msg2 = EmailMultiAlternatives(
            subject="Test 2",
            body="Plain 2",
            from_email="BukSU <onboarding@resend.dev>",
            to=["user2@buksu.edu.ph"],
        )
        msg2.attach_alternative("<p>HTML 2</p>", "text/html")

        sent_count = backend.send_messages([msg1, msg2])
        self.assertEqual(sent_count, 2)
        self.assertEqual(mock_dispatch.call_count, 2)

    @patch("users.services.email_service.send_http_email", side_effect=Exception("Network error"))
    def test_backend_honors_fail_silently(self, mock_dispatch):
        backend_silent = HttpEmailBackend(fail_silently=True)
        msg = EmailMessage(subject="Fail", body="Fail", to=["fail@buksu.edu.ph"])
        sent_count = backend_silent.send_messages([msg])
        self.assertEqual(sent_count, 0)

        backend_loud = HttpEmailBackend(fail_silently=False)
        with self.assertRaises(Exception):
            backend_loud.send_messages([msg])


class EmailBackendCanSendTests(SimpleTestCase):
    """Test email_backend_can_send utility function under different configurations."""

    @override_settings(
        EMAIL_BACKEND="users.services.email_service.HttpEmailBackend",
        EMAIL_DELIVERY_MODE="HTTP",
        RESEND_API_KEY="re_test_key",
        DEBUG=False,
    )
    def test_can_send_with_resend_key(self):
        self.assertTrue(email_backend_can_send())

    @override_settings(
        EMAIL_BACKEND="users.services.email_service.HttpEmailBackend",
        EMAIL_DELIVERY_MODE="HTTP",
        RESEND_API_KEY="",
        SENDGRID_API_KEY="SG.test_key",
        DEBUG=False,
    )
    def test_can_send_with_sendgrid_key(self):
        self.assertTrue(email_backend_can_send())

    @override_settings(
        EMAIL_BACKEND="users.services.email_service.HttpEmailBackend",
        EMAIL_DELIVERY_MODE="HTTP",
        RESEND_API_KEY="",
        SENDGRID_API_KEY="",
        DEBUG=True,
    )
    def test_can_send_in_debug_console_fallback(self):
        self.assertTrue(email_backend_can_send())

    @override_settings(
        EMAIL_BACKEND="users.services.email_service.HttpEmailBackend",
        EMAIL_DELIVERY_MODE="HTTP",
        RESEND_API_KEY="",
        SENDGRID_API_KEY="",
        EMAIL_HOST_USER="",
        EMAIL_HOST_PASSWORD="",
        DEBUG=False,
        DJANGO_ENV="production",
    )
    def test_cannot_send_in_prod_without_keys(self):
        self.assertFalse(email_backend_can_send())

    @override_settings(
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_DELIVERY_MODE="SMTP",
        EMAIL_HOST_USER="mailer@buksu.edu.ph",
        EMAIL_HOST_PASSWORD="secretpassword",
    )
    def test_can_send_with_smtp_credentials(self):
        self.assertTrue(email_backend_can_send())
