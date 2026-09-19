import json
from django.test import TestCase, RequestFactory
from django.urls import reverse
from django.contrib.auth.models import User

from accounts.adapters import RoleAwareSocialAccountAdapter
from accounts.oauth_gate import (
    ACCOUNT_EXISTS,
    LOGIN_INTENT,
    NO_ACCOUNT,
    SIGNUP_INTENT,
    normalize_oauth_intent,
    resolve_google_oauth_gate,
)
from accounts.models import UserProfile


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

    def test_signup_without_account_is_blocked_because_google_signup_disabled(self):
        self.assertEqual(
            resolve_google_oauth_gate(SIGNUP_INTENT, False),
            NO_ACCOUNT,
        )

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

    def test_signup_intent_redirects_to_manual_signup(self):
        response = self.client.get(reverse("start_google_oauth", args=["signup"]))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].endswith("/app/signup"))


class RoleAwareSocialAccountAdapterTests(TestCase):
    def test_is_open_for_signup_always_returns_false(self):
        adapter = RoleAwareSocialAccountAdapter()
        rf = RequestFactory()
        request = rf.get("/accounts/google/login/callback/")
        self.assertFalse(adapter.is_open_for_signup(request, None))


class GoogleOAuthEndpointTests(TestCase):
    def test_unknown_google_login_rejects_and_creates_no_user(self):
        initial_user_count = User.objects.count()
        response = self.client.post(
            "/api/auth/google/",
            data=json.dumps({
                "token": "mock-token",
                "email": "unregistered@student.buksu.edu.ph",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(
            data.get("error"),
            "No account found with this email. Please complete the manual registration first.",
        )
        self.assertEqual(User.objects.count(), initial_user_count)

    def test_existing_user_google_login_succeeds_and_issues_jwt(self):
        user = User.objects.create_user(
            username="test_student",
            email="test@student.buksu.edu.ph",
            password="StrongPassword123!",
            first_name="Test",
            last_name="Student",
        )
        UserProfile.objects.create(user=user, role=UserProfile.ROLE_MENTEE)

        response = self.client.post(
            "/api/auth/google/",
            data=json.dumps({
                "token": "mock-token",
                "email": "test@student.buksu.edu.ph",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertTrue(data.get("access_token"))
        self.assertTrue(data.get("refresh_token"))
        self.assertEqual(data.get("user", {}).get("email"), "test@student.buksu.edu.ph")

    def test_manual_registration_followed_by_google_login(self):
        # 1. Manual registration of a user
        reg_response = self.client.post(
            "/api/auth/register/",
            data=json.dumps({
                "display_name": "Francis Dela Cruz",
                "email": "francis.delacruz@student.buksu.edu.ph",
                "password": "StrongPassword123!",
                "confirm_password": "StrongPassword123!",
                "role": "MENTEE",
            }),
            content_type="application/json",
        )
        self.assertIn(reg_response.status_code, (200, 201))
        self.assertTrue(
            User.objects.filter(email="francis.delacruz@student.buksu.edu.ph").exists()
        )

        # 2. Account logs in through Google with the matching institutional email
        google_response = self.client.post(
            "/api/auth/google/",
            data=json.dumps({
                "token": "mock-token",
                "email": "francis.delacruz@student.buksu.edu.ph",
            }),
            content_type="application/json",
        )
        self.assertEqual(google_response.status_code, 200)
        google_data = google_response.json()
        self.assertEqual(google_data.get("status"), "ok")
        self.assertTrue(google_data.get("access_token"))
        self.assertTrue(google_data.get("refresh_token"))
        self.assertEqual(
            google_data.get("user", {}).get("email"),
            "francis.delacruz@student.buksu.edu.ph",
        )
