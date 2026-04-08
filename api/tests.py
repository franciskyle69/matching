import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from profiles.models import MentorProfile, MenteeProfile
from matching.models import MentoringSession, Notification, Subject


class ApiAuthTests(TestCase):
    def setUp(self):
        self.password = "TestPass123!"
        self.user = User.objects.create_user(username="mentor1", email="m1@test.com", password=self.password)
        MentorProfile.objects.create(user=self.user, program="BSIT", year_level=4, approved=True)

    def test_login_success(self):
        res = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"email": "m1@test.com", "password": self.password}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)

    def test_login_rate_limit(self):
        for _ in range(8):
            self.client.post(
                "/api/auth/login/",
                data=json.dumps({"email": "m1@test.com", "password": "wrong"}),
                content_type="application/json",
            )
        res = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"email": "m1@test.com", "password": "wrong"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 429)


class ApiSessionTests(TestCase):
    def setUp(self):
        self.mentor_user = User.objects.create_user(username="mentor2", email="m2@test.com", password="Pass123!")
        self.mentee_user = User.objects.create_user(username="mentee2", email="e2@test.com", password="Pass123!")
        self.mentor = MentorProfile.objects.create(user=self.mentor_user, program="BSIT", year_level=4, approved=True)
        self.mentee = MenteeProfile.objects.create(user=self.mentee_user, program="BSIT", year_level=1)
        self.subject = Subject.objects.create(name="Intro to IT")

        self.client.post(
            "/api/auth/login/",
            data=json.dumps({"email": "m2@test.com", "password": "Pass123!"}),
            content_type="application/json",
        )

    def test_create_session_and_conflict(self):
        scheduled_at = (timezone.now() + timedelta(days=1)).isoformat()
        res = self.client.post(
            "/api/sessions/create/",
            data=json.dumps(
                {
                    "mentee_id": self.mentee.id,
                    "subject_id": self.subject.id,
                    "scheduled_at": scheduled_at,
                    "duration_minutes": 60,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        res_conflict = self.client.post(
            "/api/sessions/create/",
            data=json.dumps(
                {
                    "mentee_id": self.mentee.id,
                    "subject_id": self.subject.id,
                    "scheduled_at": scheduled_at,
                    "duration_minutes": 60,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res_conflict.status_code, 400)

    def test_notifications_mark_all(self):
        Notification.objects.create(user=self.mentor_user, message="Test 1")
        Notification.objects.create(user=self.mentor_user, message="Test 2")
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
        self.client.post(
            "/api/auth/login/",
            data=json.dumps({"email": "admin1@test.com", "password": "AdminPass123!"}),
            content_type="application/json",
        )

    def test_run_matching_admin(self):
        res = self.client.get("/api/matching/run/")
        self.assertEqual(res.status_code, 200)
from django.test import TestCase

# Create your tests here.
