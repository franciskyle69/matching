import json
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from accounts.models import UserProfile
from profiles.models import MenteeProfile
from matching.models import Subject, Topic, Competency

User = get_user_model()


class AccountApprovalWorkflowTestCase(TestCase):
    def setUp(self):
        User.objects.filter(username__in=["mentee_test", "coordinator_test", "mentor_test"]).delete()

        # Create coordinator staff user
        self.coordinator = User.objects.create_user(
            username="coordinator_test",
            email="coordinator@buksu.edu.ph",
            password="Password123!",
            is_staff=True,
        )
        self.coordinator_up, _ = UserProfile.objects.get_or_create(
            user=self.coordinator,
            defaults={"role": UserProfile.ROLE_COORDINATOR, "approval_status": UserProfile.STATUS_ACTIVE},
        )
        self.coordinator_up.approval_status = UserProfile.STATUS_ACTIVE
        self.coordinator_up.save()

        # Create mentee user
        self.mentee = User.objects.create_user(
            username="mentee_test",
            email="mentee_test@student.buksu.edu.ph",
            password="Password123!",
        )
        self.mentee_up, _ = UserProfile.objects.get_or_create(
            user=self.mentee,
            defaults={
                "role": UserProfile.ROLE_MENTEE,
                "is_onboarded": False,
                "approval_status": UserProfile.STATUS_PENDING_APPROVAL,
            },
        )
        self.mentee_profile, _ = MenteeProfile.objects.get_or_create(
            user=self.mentee,
            defaults={"program": "BSIT", "year_level": 1, "approved": False},
        )

        # Create subjects and competencies for preference submission
        self.sub, _ = Subject.objects.get_or_create(name="Computer Programming", defaults={"code": "IT 112"})
        self.top, _ = Topic.objects.get_or_create(subject=self.sub, name="Control Structures")
        self.comp, _ = Competency.objects.get_or_create(topic=self.top, name="Loop Control")

        self.client = Client()

    def test_onboarding_submission_saves_personal_fields_and_sets_pending_status(self):
        self.client.force_login(self.mentee)
        payload = {
            "student_id_no": "2021-987654",
            "contact_no": "09171234567",
            "admission_type": "Regular",
            "sex": "Female",
            "campus": "Main",
            "program": "BSIT",
            "year_level": 1,
            "subjects": [self.sub.id],
            "topics": [self.top.id],
            "competency_ids": [self.comp.id],
            "competency_needs": {str(self.comp.id): 4},
            "availability": [{"day": "Monday", "start_time": "09:00", "end_time": "11:00"}],
        }

        response = self.client.post(
            "/api/user/onboarding/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        self.assertTrue(data.get("is_onboarded"))
        self.assertIn(data.get("approval_status"), ["PENDING", "PENDING_APPROVAL"])

        # Verify UserProfile
        self.mentee_up.refresh_from_db()
        self.assertTrue(self.mentee_up.is_onboarded)
        self.assertEqual(self.mentee_up.student_id_no, "2021-987654")
        self.assertEqual(self.mentee_up.contact_no, "09171234567")
        self.assertEqual(self.mentee_up.sex.lower(), "female")
        self.assertIn(self.mentee_up.approval_status, ["PENDING", "PENDING_APPROVAL"])

        # Verify MenteeProfile
        self.mentee_profile.refresh_from_db()
        self.assertEqual(self.mentee_profile.student_id_no, "2021-987654")
        self.assertEqual(self.mentee_profile.contact_no, "09171234567")
        self.assertEqual(self.mentee_profile.admission_type, "Regular")
        self.assertEqual(self.mentee_profile.sex.lower(), "female")
        self.assertFalse(self.mentee_profile.approved)

    def test_coordinator_permission_guard_blocks_pending_user_from_matching(self):
        self.client.force_login(self.mentee)
        # Verify approval_status is pending
        self.mentee_up.approval_status = UserProfile.STATUS_PENDING_APPROVAL
        self.mentee_up.is_onboarded = True
        self.mentee_up.save()

        response = self.client.get("/api/matching/recommendations/")
        self.assertEqual(response.status_code, 403)
        self.assertIn("pending approval by coordinator", response.json().get("error", "").lower())

    def test_coordinator_can_list_and_approve_user(self):
        # Setup mentee as pending
        self.mentee_up.approval_status = UserProfile.STATUS_PENDING_APPROVAL
        self.mentee_up.is_onboarded = True
        self.mentee_up.student_id_no = "2021-987654"
        self.mentee_up.contact_no = "09171234567"
        self.mentee_up.save()

        # Login as Coordinator
        self.client.force_login(self.coordinator)

        # 1. List pending users
        response = self.client.get("/api/coordinator/pending-users/")
        self.assertEqual(response.status_code, 200)
        users = response.json().get("users", [])
        pending_ids = [u["id"] for u in users]
        self.assertIn(self.mentee.id, pending_ids)

        # 2. Approve mentee via PATCH endpoint
        approve_resp = self.client.patch(f"/api/coordinator/users/{self.mentee.id}/approve/")
        self.assertEqual(approve_resp.status_code, 200, approve_resp.content)
        self.assertEqual(approve_resp.json().get("approval_status"), "ACTIVE")

        # Verify DB state
        self.mentee_up.refresh_from_db()
        self.assertEqual(self.mentee_up.approval_status, UserProfile.STATUS_ACTIVE)
        self.mentee_profile.refresh_from_db()
        self.assertTrue(self.mentee_profile.approved)

        # 3. Mentee can now access matching endpoint without 403
        self.client.force_login(self.mentee)
        match_resp = self.client.get("/api/matching/recommendations/")
        self.assertNotEqual(match_resp.status_code, 403)

    def test_coordinator_can_reject_user(self):
        self.client.force_login(self.coordinator)
        reject_resp = self.client.patch(f"/api/coordinator/users/{self.mentee.id}/reject/")
        self.assertEqual(reject_resp.status_code, 200, reject_resp.content)
        self.assertEqual(reject_resp.json().get("approval_status"), "REJECTED")

        self.mentee_up.refresh_from_db()
        self.assertEqual(self.mentee_up.approval_status, UserProfile.STATUS_REJECTED)
        self.mentee_profile.refresh_from_db()
        self.assertFalse(self.mentee_profile.approved)

    def test_newly_registered_accounts_strictly_default_to_pending(self):
        from accounts.models import get_user_profile

        # 1. Register a new mentee
        res = self.client.post(
            "/api/auth/register/",
            data={
                "first_name": "New",
                "last_name": "Mentee",
                "email": "newmentee@student.buksu.edu.ph",
                "password": "Password123!",
                "role": "MENTEE",
                "campus": "Main Campus",
                "program": "BSIT",
                "year_level": 1,
            },
        )
        self.assertEqual(res.status_code, 201, res.content)
        data = res.json()
        self.assertEqual(data.get("message"), "Registration successful. Please check your email to verify your account.")
        self.assertNotIn("access_token", data)

        # Verify DB models
        user = User.objects.get(email="newmentee@student.buksu.edu.ph")
        profile = get_user_profile(user)
        self.assertEqual(profile.approval_status, "PENDING")
        self.assertFalse(user.mentee_profile.approved)
        self.assertFalse(profile.is_email_verified)

        # 2. Model default check directly
        standalone_user = User.objects.create_user(
            username="standalone_pending",
            email="standalone@student.buksu.edu.ph",
            password="Password123!",
        )
        standalone_profile = UserProfile.objects.create(
            user=standalone_user,
            role=UserProfile.ROLE_MENTEE,
        )
        self.assertEqual(standalone_profile.approval_status, "PENDING")
        self.assertEqual(standalone_user.approval_status, "PENDING")
