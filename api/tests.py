import json
import os
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings

from profiles.models import (
    MentorProfile,
    MenteeProfile,
    MentorCompetency,
    MenteeCompetencyNeed,
)
from accounts.jwt_utils import decode_access_token
from accounts.models import UserSecurityState
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

    def test_login_returns_access_token_and_httponly_refresh_cookie(self):
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
        self.assertIn("access_token", payload)
        self.assertFalse(payload["user"]["is_onboarded"])
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

    def test_login_rate_limit_blocks_correct_password_after_failures(self):
        for _ in range(5):
            self.client.post(
                "/api/auth/login/",
                data=json.dumps(
                    {
                        "identifier": self.user.email,
                        "password": "wrong-password",
                    }
                ),
                content_type="application/json",
            )

        response = self.client.post(
            "/api/auth/login/",
            data=json.dumps(
                {
                    "identifier": self.user.email,
                    "password": self.password,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json().get("error"), "Account locked")


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
@patch.dict(os.environ, {"CLOUDINARY_CLOUD_NAME": ""}, clear=False)
class ApiRegisterTests(TestCase):
    def _pdf(self, name="form.pdf"):
        return SimpleUploadedFile(name, b"%PDF-1.4 test", content_type="application/pdf")

    def test_register_creates_minimal_onboarding_account(self):
        res = self.client.post(
            "/api/auth/register/",
            {
                "role": "mentee",
                "display_name": "Ada Lovelace",
                "email": "ada.lovelace@student.buksu.edu.ph",
                "password": "TestPass123!",
                "confirm_password": "TestPass123!",
            },
        )
        self.assertIn(res.status_code, (200, 201), res.content)
        user = User.objects.get(email="ada.lovelace@student.buksu.edu.ph")
        self.assertTrue(user.is_active)
        self.assertFalse(UserSecurityState.objects.get(user=user).is_onboarded)

    def test_register_does_not_require_smtp_credentials(self):
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
            EMAIL_HOST_USER="",
            EMAIL_HOST_PASSWORD="",
        ):
            res = self.client.post(
                "/api/auth/register/",
                {
                    "role": "mentee",
                    "display_name": "Ada Missing",
                    "email": "ada.missing-smtp@student.buksu.edu.ph",
                    "password": "TestPass123!",
                    "confirm_password": "TestPass123!",
                },
            )
        self.assertIn(res.status_code, (200, 201))
        self.assertTrue(User.objects.filter(email="ada.missing-smtp@student.buksu.edu.ph").exists())

    def test_api_csrf_failure_returns_json(self):
        csrf_client = Client(enforce_csrf_checks=True)
        res = csrf_client.post("/api/auth/register/", {"role": "mentee"})
        self.assertEqual(res.status_code, 403)
        payload = res.json()
        self.assertEqual(payload.get("code"), "csrf")
        self.assertIn("Refresh the page", payload.get("error", ""))

    def test_unified_registration_and_onboarding(self):
        registration = self.client.post(
            "/api/auth/register/",
            {
                "display_name": "Ada Lovelace",
                "email": "ada.unified@student.buksu.edu.ph",
                "password": "TestPass123!",
                "confirm_password": "TestPass123!",
                "role": "mentee",
            },
        )
        self.assertIn(registration.status_code, (200, 201), registration.content)
        payload = registration.json()
        self.assertFalse(payload["user"]["is_onboarded"])
        claims = decode_access_token(payload["access_token"])
        self.assertEqual(claims["email"], "ada.unified@student.buksu.edu.ph")
        self.assertFalse(claims["is_onboarded"])
        self.assertFalse(UserSecurityState.objects.get(user__email=claims["email"]).is_onboarded)

        from PIL import Image
        image = BytesIO()
        Image.new("RGB", (8, 8), "white").save(image, format="PNG")
        image.seek(0)
        onboarding = self.client.post(
            "/api/user/complete-onboarding/",
            {
                "profile_photo": SimpleUploadedFile("id.png", image.read(), content_type="image/png"),
                "metadata": json.dumps({"campus": "Main", "contact_no": "09171234567", "subjects": ["Python"]}),
            },
        )
        self.assertEqual(onboarding.status_code, 200, onboarding.content)
        self.assertTrue(onboarding.json()["user"]["is_onboarded"])
        self.assertTrue(UserSecurityState.objects.get(user__email=claims["email"]).is_onboarded)

    def test_unified_registration_rejects_non_institutional_email(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "display_name": "Ada Lovelace",
                "email": "ada@example.com",
                "password": "TestPass123!",
                "confirm_password": "TestPass123!",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.json()["errors"])


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


class AdminUserDeleteTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin-delete",
            email="admin-delete@test.com",
            password="AdminPass123!",
            is_staff=True,
        )
        self.target = User.objects.create_user(
            username="to-delete-user",
            email="delete-me@test.com",
            password="Pass123!",
        )
        self.client.force_login(self.admin)

    def test_admin_can_deactivate_user_account(self):
        res = self.client.post(f"/api/users/{self.target.id}/delete/")

        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["ok"])
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_active)

    def test_admin_cannot_delete_own_account(self):
        res = self.client.post(f"/api/users/{self.admin.id}/delete/")

        self.assertEqual(res.status_code, 400)
        self.assertIn("Cannot delete your own account", res.json()["error"])
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)


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


class ApiCoordinatorAndMentorRegistrationTests(TestCase):
    def setUp(self):
        from accounts.jwt_utils import issue_access_token
        from accounts.models import UserProfile, get_user_profile

        # Create Coordinator
        self.coord_user = User.objects.create_user(
            username="coordinator1",
            email="coordinator1@buksu.edu.ph",
            password="CoordPassword123!",
            is_staff=True,
        )
        coord_profile = get_user_profile(self.coord_user)
        coord_profile.role = UserProfile.ROLE_COORDINATOR
        coord_profile.approval_status = UserProfile.STATUS_ACTIVE
        coord_profile.save()
        self.coord_token = issue_access_token(self.coord_user)

    def test_student_mentor_registration_and_documents(self):
        from accounts.models import UserProfile, MentorDocument
        from accounts.jwt_utils import decode_access_token

        file1 = SimpleUploadedFile("intent.pdf", b"%PDF-1.4 dummy intent content", content_type="application/pdf")
        file2 = SimpleUploadedFile("study_load.pdf", b"%PDF-1.4 dummy study load content", content_type="application/pdf")
        file3 = SimpleUploadedFile("grades.pdf", b"%PDF-1.4 dummy grades content", content_type="application/pdf")

        res = self.client.post(
            "/api/auth/register/",
            data={
                "first_name": "Senior",
                "last_name": "Tutor",
                "email": "seniortutor@student.buksu.edu.ph",
                "password": "TestPassword123!",
                "role": "STUDENT_MENTOR",
                "campus": "Main Campus",
                "program": "BSIT",
                "year_level": 3,
                "letter_of_intent": file1,
                "study_load": file2,
                "grades": file3,
            },
        )
        self.assertIn(res.status_code, [200, 201], res.content)
        data = res.json()
        self.assertEqual(data["user"]["role"], "STUDENT_MENTOR")
        self.assertEqual(data["user"]["approval_status"], "PENDING_APPROVAL")

        # Verify PyJWT claims
        claims = decode_access_token(data["access_token"])
        self.assertEqual(claims["role"], "STUDENT_MENTOR")
        self.assertEqual(claims["approval_status"], "PENDING_APPROVAL")
        self.assertFalse(claims["is_onboarded"])

        # Verify MentorDocument records created
        user = User.objects.get(email="seniortutor@student.buksu.edu.ph")
        docs = list(MentorDocument.objects.filter(user=user))
        self.assertEqual(len(docs), 3)
        doc_types = {d.document_type for d in docs}
        self.assertEqual(doc_types, {"LETTER_OF_INTENT", "STUDY_LOAD", "GRADES"})
        for d in docs:
            self.assertTrue(d.cloudinary_url)
            self.assertTrue(d.cloudinary_public_id)

    def test_instructor_mentor_registration_and_document(self):
        from accounts.models import UserProfile, MentorDocument

        file = SimpleUploadedFile("faculty_id.png", b"fake png content", content_type="image/png")
        res = self.client.post(
            "/api/auth/register/",
            data={
                "first_name": "Prof",
                "last_name": "Instructor",
                "email": "prof.mentor@buksu.edu.ph",
                "password": "TestPassword123!",
                "role": "INSTRUCTOR_MENTOR",
                "campus": "Main Campus",
                "program": "BSIT",
                "year_level": 4,
                "faculty_verification": file,
            },
        )
        self.assertIn(res.status_code, [200, 201], res.content)
        data = res.json()
        self.assertEqual(data["user"]["role"], "INSTRUCTOR_MENTOR")
        self.assertEqual(data["user"]["approval_status"], "PENDING_APPROVAL")

        user = User.objects.get(email="prof.mentor@buksu.edu.ph")
        docs = list(MentorDocument.objects.filter(user=user))
        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0].document_type, "FACULTY_VERIFICATION")
        self.assertTrue(docs[0].cloudinary_url)

    def test_coordinator_pending_mentors_and_approval_actions(self):
        from accounts.models import UserProfile, get_user_profile

        # Create a pending student mentor
        mentor_user = User.objects.create_user(
            username="pending_mentor",
            email="pending_mentor@student.buksu.edu.ph",
            password="Password123!",
        )
        m_profile = get_user_profile(mentor_user)
        m_profile.role = UserProfile.ROLE_STUDENT_MENTOR
        m_profile.approval_status = UserProfile.STATUS_PENDING_APPROVAL
        m_profile.save()

        # 1. Fetch pending list as coordinator
        res = self.client.get(
            "/api/coordinator/pending-mentors/",
            HTTP_AUTHORIZATION=f"Bearer {self.coord_token}",
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["count"], 1)
        mentor_entry = next((m for m in data["results"] if m["id"] == mentor_user.id), None)
        self.assertIsNotNone(mentor_entry)
        self.assertEqual(mentor_entry["role"], "STUDENT_MENTOR")

        # 2. Approve mentor
        approve_res = self.client.post(
            f"/api/coordinator/approve-mentor/{mentor_user.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.coord_token}",
        )
        self.assertEqual(approve_res.status_code, 200)
        m_profile.refresh_from_db()
        self.assertEqual(m_profile.approval_status, UserProfile.STATUS_ACTIVE)

        # 3. Reject mentor
        reject_res = self.client.post(
            f"/api/coordinator/reject-mentor/{mentor_user.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.coord_token}",
        )
        self.assertEqual(reject_res.status_code, 200)
        m_profile.refresh_from_db()
        self.assertEqual(m_profile.approval_status, UserProfile.STATUS_REJECTED)

    def test_simplified_onboarding_without_image(self):
        from accounts.models import UserProfile, get_user_profile
        from accounts.jwt_utils import issue_access_token

        student_user = User.objects.create_user(
            username="onboarding_student",
            email="onboarding.student@student.buksu.edu.ph",
            password="Password123!",
        )
        s_profile = get_user_profile(student_user)
        s_profile.role = UserProfile.ROLE_MENTEE
        s_profile.approval_status = UserProfile.STATUS_ACTIVE
        s_profile.save()
        token = issue_access_token(student_user)

        res = self.client.post(
            "/api/user/complete-onboarding/",
            data=json.dumps({
                "subjects": ["IT 111", "IT 112"],
                "skills": ["Loop Control", "Flexbox & Grid"],
                "support_need": 4,
                "availability": [
                    {"day": "Monday", "start_time": "09:00", "end_time": "11:00"},
                    {"day": "Wednesday", "start_time": "14:00", "end_time": "16:00"},
                ],
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertTrue(data["user"]["is_onboarded"])

        s_profile.refresh_from_db()
        self.assertTrue(s_profile.is_onboarded)

        student_user.refresh_from_db()
        mentee = getattr(student_user, "mentee_profile", None) or MenteeProfile.objects.filter(user=student_user).first()
        self.assertIsNotNone(mentee)
        self.assertEqual(mentee.subjects, ["IT 111", "IT 112"])
        self.assertEqual(mentee.skills, ["Loop Control", "Flexbox & Grid"])
        self.assertEqual(mentee.difficulty_level, 4)
        self.assertEqual(len(mentee.availability), 2)
