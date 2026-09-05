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
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)

    def test_login_sets_httponly_refresh_cookie_not_json_tokens(self):
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
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertNotIn("access_token", payload)
        self.assertNotIn("refresh_token", payload)
        self.assertIn("pl_refresh", res.cookies)
        self.assertTrue(res.cookies["pl_refresh"]["httponly"])

    def test_login_does_not_require_portal_role(self):
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
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(res.status_code, 200)

    def test_login_rate_limit(self):
        for _ in range(8):
            self.client.post(
                "/api/auth/login/",
                data=json.dumps(
                    {
                        "email": "mentor1@student.buksu.edu.ph",
                        "password": "wrong",
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
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 429)


class ApiSecurityTests(TestCase):
    def test_unauthenticated_api_returns_json_401(self):
        res = self.client.get("/api/me/")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json().get("error"), "Authentication required.")

    def test_security_headers_on_html(self):
        res = self.client.get("/landing/")
        self.assertEqual(res.status_code, 200)
        csp = res.get("Content-Security-Policy", "")
        self.assertIn("script-src", csp)
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertEqual(res.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(res.get("Referrer-Policy"), "strict-origin-when-cross-origin")


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

    def test_approved_mentor_cannot_change_role(self):
        user = User.objects.create_user(
            username="mentor4",
            email="mentor4@test.com",
            password="Pass123!",
        )
        mentor_profile = MentorProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=4,
            role="Senior IT Student",
            approved=True,
        )
        self.client.force_login(user)
        res = self.client.post(
            "/api/me/mentor-profile/",
            data=json.dumps(
                {
                    "role": "Instructor",
                    "capacity": 2,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["role"], "Senior IT Student")
        self.assertTrue(body["mentor_approved"])
        self.assertTrue(body["mentor_role_locked"])
        mentor_profile.refresh_from_db()
        self.assertEqual(mentor_profile.role, "Senior IT Student")
        self.assertTrue(mentor_profile.approved)
        self.assertEqual(mentor_profile.capacity, 5)

    def test_pending_mentor_can_change_role(self):
        user = User.objects.create_user(
            username="mentor5",
            email="mentor5@test.com",
            password="Pass123!",
        )
        mentor_profile = MentorProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=4,
            role="Senior IT Student",
            approved=False,
        )
        self.client.force_login(user)
        res = self.client.post(
            "/api/me/mentor-profile/",
            data=json.dumps({"role": "Instructor"}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["role"], "Instructor")
        self.assertFalse(body["mentor_approved"])
        self.assertFalse(body["mentor_role_locked"])
        mentor_profile.refresh_from_db()
        self.assertEqual(mentor_profile.role, "Instructor")
        self.assertFalse(mentor_profile.approved)
        self.assertEqual(mentor_profile.year_level, 4)

    def test_pending_student_mentor_can_set_year_level(self):
        user = User.objects.create_user(
            username="mentor6",
            email="mentor6@test.com",
            password="Pass123!",
        )
        mentor_profile = MentorProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=4,
            role="Senior IT Student",
            approved=False,
        )
        self.client.force_login(user)
        res = self.client.post(
            "/api/me/mentor-profile/",
            data=json.dumps({"year_level": 3, "capacity": 5}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["year_level"], 3)
        mentor_profile.refresh_from_db()
        self.assertEqual(mentor_profile.year_level, 3)

    def test_approved_student_mentor_cannot_change_year_level(self):
        user = User.objects.create_user(
            username="mentor7",
            email="mentor7@test.com",
            password="Pass123!",
        )
        mentor_profile = MentorProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=3,
            role="Senior IT Student",
            approved=True,
        )
        self.client.force_login(user)
        res = self.client.post(
            "/api/me/mentor-profile/",
            data=json.dumps({"year_level": 4, "capacity": 5}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["year_level"], 3)
        mentor_profile.refresh_from_db()
        self.assertEqual(mentor_profile.year_level, 3)

    def test_instructor_year_level_stays_four(self):
        user = User.objects.create_user(
            username="mentor8",
            email="mentor8@test.com",
            password="Pass123!",
        )
        mentor_profile = MentorProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=4,
            role="Instructor",
            approved=False,
        )
        self.client.force_login(user)
        res = self.client.post(
            "/api/me/mentor-profile/",
            data=json.dumps({"year_level": 3, "capacity": 5}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["year_level"], 4)
        mentor_profile.refresh_from_db()
        self.assertEqual(mentor_profile.year_level, 4)


class AvailabilitySlotTests(TestCase):
    def test_normalise_keeps_day_prefix(self):
        from api.controllers.account_controller import _normalise_availability_slots

        self.assertEqual(
            _normalise_availability_slots(["Mon/Wed|08:00-12:00"]),
            ["Mon/Wed|08:00-12:00"],
        )

    def test_normalise_sorts_and_canonicalises_days(self):
        from api.controllers.account_controller import _normalise_availability_slots

        self.assertEqual(
            _normalise_availability_slots(["wednesday/mon|8:00-12:00"]),
            ["Mon/Wed|08:00-12:00"],
        )

    def test_normalise_keeps_legacy_slot_without_days(self):
        from api.controllers.account_controller import _normalise_availability_slots

        self.assertEqual(
            _normalise_availability_slots(["08:00-10:00"]),
            ["08:00-10:00"],
        )

    def test_normalise_rejects_out_of_bounds_and_reversed(self):
        from api.controllers.account_controller import _normalise_availability_slots

        self.assertEqual(
            _normalise_availability_slots(
                ["Mon|06:00-08:00", "Mon|12:00-11:00", "Mon|not-a-time"]
            ),
            [],
        )

    def test_overlap_requires_a_shared_day(self):
        from matching.services import _normalise_slots, _slots_overlap

        monday = _normalise_slots(["Mon|08:00-12:00"])
        tuesday = _normalise_slots(["Tue|08:00-12:00"])
        monday_late = _normalise_slots(["Mon|11:00-13:00"])

        self.assertFalse(_slots_overlap(monday, tuesday))
        self.assertTrue(_slots_overlap(monday, monday_late))

    def test_legacy_slot_overlaps_any_day(self):
        from matching.services import _normalise_slots, _slots_overlap

        legacy = _normalise_slots(["08:00-12:00"])
        saturday = _normalise_slots(["Sat|09:00-10:00"])

        self.assertTrue(_slots_overlap(legacy, saturday))

    def test_overlap_ratio_is_day_aware(self):
        from matching.ml.features import availability_overlap_ratio

        self.assertEqual(
            availability_overlap_ratio(["Mon|08:00-12:00"], ["Tue|08:00-12:00"]),
            0.0,
        )
        self.assertEqual(
            availability_overlap_ratio(["Mon|08:00-12:00"], ["Mon|08:00-12:00"]),
            1.0,
        )
        self.assertEqual(
            availability_overlap_ratio(
                ["Mon/Tue|08:00-12:00"], ["Mon|08:00-12:00"]
            ),
            0.5,
        )


class CompleteProfileApiTests(TestCase):
    def setUp(self):
        self.password = "TestPass123!"
        self.user = User.objects.create_user(
            username="oauthmentee",
            email="oauthmentee@student.buksu.edu.ph",
            password=self.password,
        )
        MenteeProfile.objects.create(
            user=self.user,
            program="BSIT",
            year_level=1,
            is_profile_complete=False,
        )
        self.client.force_login(self.user)

    def test_me_reports_incomplete_profile(self):
        res = self.client.get("/api/me/")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json().get("is_profile_complete"))

    def test_complete_profile_requires_fields(self):
        res = self.client.post(
            "/api/me/complete-profile/",
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("errors", res.json())

    def test_complete_profile_saves_and_flags_complete(self):
        res = self.client.post(
            "/api/me/complete-profile/",
            data=json.dumps(
                {
                    "program": "BSIT",
                    "year_level": 1,
                    "student_id_no": "2023-0001",
                    "campus": "MAIN CAMPUS",
                    "contact_no": "09123456789",
                    "sex": "female",
                    "interests": ["Web Development", "UI/UX Design"],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["is_profile_complete"])
        self.user.refresh_from_db()
        mentee = self.user.mentee_profile
        self.assertTrue(mentee.is_profile_complete)
        self.assertEqual(mentee.student_id_no, "2023-0001")
