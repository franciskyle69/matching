import json

from django.contrib.auth.models import User
from django.test import TestCase

from profiles.models import MentorProfile, MenteeProfile
from matching.models import Notification


class ApiAuthTests(TestCase):
    def setUp(self):
        self.password = "TestPass123!"
        self.user = User.objects.create_user(
            username="mentor1",
            email="mentor1@student.buksu.edu.ph",
            password=self.password,
        )
        MentorProfile.objects.create(user=self.user, program="BSIT", year_level=4, approved=True)

    def test_login_success(self):
        res = self.client.post(
            "/api/auth/login/",
            data=json.dumps(
                {
                    "email": "mentor1@student.buksu.edu.ph",
                    "password": self.password,
                    "expected_role": "mentor",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)

    def test_login_rejects_wrong_portal_role(self):
        mentee_user = User.objects.create_user(
            username="mentee1",
            email="mentee1@student.buksu.edu.ph",
            password=self.password,
        )
        MenteeProfile.objects.create(user=mentee_user, program="BSIT", year_level=1)

        res = self.client.post(
            "/api/auth/login/",
            data=json.dumps(
                {
                    "email": "mentee1@student.buksu.edu.ph",
                    "password": self.password,
                    "expected_role": "mentor",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(res.status_code, 403)
        self.assertIn("not Mentor", res.json()["error"])

    def test_login_requires_portal_role(self):
        res = self.client.post(
            "/api/auth/login/",
            data=json.dumps(
                {
                    "email": "mentor1@student.buksu.edu.ph",
                    "password": self.password,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(res.status_code, 400)

    def test_login_rate_limit(self):
        for _ in range(8):
            self.client.post(
                "/api/auth/login/",
                data=json.dumps(
                    {
                        "email": "mentor1@student.buksu.edu.ph",
                        "password": "wrong",
                        "expected_role": "mentor",
                    }
                ),
                content_type="application/json",
            )
        res = self.client.post(
            "/api/auth/login/",
            data=json.dumps(
                {
                    "email": "mentor1@student.buksu.edu.ph",
                    "password": "wrong",
                    "expected_role": "mentor",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 429)


class ApiNotificationsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="mentor2", email="m2@test.com", password="Pass123!")
        self.client.force_login(self.user)

    def test_notifications_mark_all(self):
        Notification.objects.create(user=self.user, message="Test 1")
        Notification.objects.create(user=self.user, message="Test 2")
        res = self.client.post("/api/notifications/mark-all-read/")
        self.assertEqual(res.status_code, 200)


class ApiMatchingTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin1",
            email="admin1@test.com",
            password="AdminPass123!",
            is_staff=True,
        )
        self.client.force_login(self.admin)

    def test_run_matching_admin(self):
        res = self.client.get("/api/matching/run/")
        self.assertEqual(res.status_code, 200)
