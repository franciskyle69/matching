from django.test import TestCase
from django.urls import reverse

from accounts.oauth_gate import (
    ACCOUNT_EXISTS,
    LOGIN_INTENT,
    NO_ACCOUNT,
    SIGNUP_INTENT,
    normalize_oauth_intent,
    resolve_google_oauth_gate,
)


class GoogleOAuthGateTests(TestCase):
    def test_login_without_account_is_blocked(self):
        self.assertEqual(
            resolve_google_oauth_gate(LOGIN_INTENT, False),
            NO_ACCOUNT,
        )

    def test_login_with_account_continues(self):
        self.assertIsNone(resolve_google_oauth_gate(LOGIN_INTENT, True))

    def test_signup_with_existing_account_is_blocked(self):
        self.assertEqual(
            resolve_google_oauth_gate(SIGNUP_INTENT, True),
            ACCOUNT_EXISTS,
        )

    def test_signup_without_account_continues(self):
        self.assertIsNone(resolve_google_oauth_gate(SIGNUP_INTENT, False))

    def test_unknown_intent_defaults_to_login(self):
        self.assertEqual(normalize_oauth_intent("other"), LOGIN_INTENT)
        self.assertEqual(resolve_google_oauth_gate("other", False), NO_ACCOUNT)


class GoogleOAuthStartViewTests(TestCase):
    def test_login_start_stores_intent_and_posts_to_google(self):
        response = self.client.get(reverse("start_google_oauth", args=["login"]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'action="/accounts/google/login/"')
        self.assertContains(response, 'method="post"')
        self.assertEqual(self.client.session.get("google_oauth_intent"), "login")

    def test_signup_without_role_goes_to_portal(self):
        response = self.client.get(reverse("start_google_oauth", args=["signup"]))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].endswith("/portal/"))

    def test_signup_with_role_stores_intent(self):
        response = self.client.get(
            reverse("start_google_oauth", args=["signup"]) + "?role=mentee"
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'action="/accounts/google/login/"')
        self.assertIn("complete-profile", response.content.decode())
        session = self.client.session
        self.assertEqual(session.get("google_oauth_intent"), "signup")
        self.assertEqual(session.get("google_oauth_selected_role"), "mentee")
