import json

from django.contrib.auth.models import User
from django.test import TestCase

from profiles.models import (
    MentorProfile,
    MenteeProfile,
    MentorCompetency,
    MenteeCompetencyNeed,
)
from matching.models import Notification, Competency, Topic, Subject


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

    def test_mentee_matching_save_persists_competency_ids(self):
        user = User.objects.create_user(
            username="mentee2",
            email="mentee2@test.com",
            password="Pass123!",
        )
        mentee_profile = MenteeProfile.objects.create(user=user, program="BSIT", year_level=1)
        subject = Subject.objects.create(name="Programming")
        topic = Topic.objects.create(subject=subject, name="Python")
        competency = Competency.objects.create(topic=topic, name="Django")

        self.client.force_login(user)
        res = self.client.post(
            "/api/me/mentee-matching/",
            data=json.dumps(
                {
                    "subjects": [subject.name],
                    "topics": [topic.name],
                    "competency_ids": [competency.id],
                    "competency_needs": [
                        {"competency_id": competency.id, "need_level": 4}
                    ],
                    "difficulty_level": 3,
                    "availability": ["08:00-10:00"],
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(res.status_code, 200)
        mentee_profile.refresh_from_db()
        self.assertEqual(list(mentee_profile.competencies.values_list("id", flat=True)), [competency.id])
        self.assertEqual(res.json()["competency_ids"], [competency.id])
        self.assertEqual(res.json()["topics"], [topic.name])
        self.assertEqual(res.json()["competency_needs"].get(str(competency.id)) or res.json()["competency_needs"].get(competency.id), 4)
        self.assertTrue(
            MenteeCompetencyNeed.objects.filter(
                mentee=mentee_profile,
                competency=competency,
                need_level=4,
            ).exists()
        )

    def test_mentor_profile_save_persists_competency_levels(self):
        user = User.objects.create_user(
            username="mentor3",
            email="mentor3@test.com",
            password="Pass123!",
        )
        mentor_profile = MentorProfile.objects.create(user=user, program="BSIT", year_level=4, approved=True)
        subject = Subject.objects.create(name="Programming 2")
        topic = Topic.objects.create(subject=subject, name="Arrays")
        competency = Competency.objects.create(topic=topic, name="Array Manipulation")

        self.client.force_login(user)
        res = self.client.post(
            "/api/me/mentor-profile/",
            data=json.dumps(
                {
                    "subjects": [subject.name],
                    "topics": [topic.name],
                    "competency_ids": [competency.id],
                    "competency_levels": [
                        {"competency_id": competency.id, "proficiency_level": 5}
                    ],
                    "expertise_level": 4,
                    "years_experience": 3,
                    "teaching_experience_years": 2,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        mentor_profile.refresh_from_db()
        self.assertEqual(mentor_profile.topics, [topic.name])
        self.assertEqual(mentor_profile.years_experience, 3)
        self.assertEqual(mentor_profile.teaching_experience_years, 2)
        self.assertTrue(
            MentorCompetency.objects.filter(
                mentor=mentor_profile,
                competency=competency,
                proficiency_level=5,
            ).exists()
        )
