"""
Tests for the mentee account deletion management command and service utility.
"""

from io import StringIO
from django.core.management import call_command
from django.test import TestCase
from django.contrib.auth.models import User
from accounts.models import UserProfile, MentorDocument
from profiles.models import MenteeProfile, MentorProfile
from accounts.services.account_cleanup import (
    get_mentee_queryset,
    is_user_mentee,
    delete_single_mentee,
    bulk_delete_mentees,
)


class DeleteMenteesServiceTests(TestCase):
    def setUp(self):
        # Superuser / Admin
        self.admin_user = User.objects.create_superuser(
            username="test_admin",
            email="admin@test.com",
            password="password123",
        )

        # Staff user
        self.staff_user = User.objects.create_user(
            username="test_staff",
            email="staff@test.com",
            password="password123",
            is_staff=True,
        )

        # Coordinator
        self.coord_user = User.objects.create_user(
            username="test_coordinator",
            email="coord@test.com",
            password="password123",
        )
        UserProfile.objects.create(
            user=self.coord_user,
            role=UserProfile.ROLE_COORDINATOR,
            approval_status=UserProfile.STATUS_ACTIVE,
        )

        # Mentor
        self.mentor_user = User.objects.create_user(
            username="test_mentor",
            email="mentor@test.com",
            password="password123",
        )
        UserProfile.objects.create(
            user=self.mentor_user,
            role=UserProfile.ROLE_STUDENT_MENTOR,
            approval_status=UserProfile.STATUS_ACTIVE,
        )
        MentorProfile.objects.create(
            user=self.mentor_user,
            program="BSIT",
            year_level=4,
            capacity=5,
            approved=True,
        )

        # Mentee 1
        self.mentee_user1 = User.objects.create_user(
            username="test_mentee1",
            email="mentee1@test.com",
            password="password123",
        )
        UserProfile.objects.create(
            user=self.mentee_user1,
            role=UserProfile.ROLE_MENTEE,
            approval_status=UserProfile.STATUS_ACTIVE,
        )
        MenteeProfile.objects.create(
            user=self.mentee_user1,
            program="BSIT",
            year_level=1,
            approved=True,
        )

        # Mentee 2
        self.mentee_user2 = User.objects.create_user(
            username="test_mentee2",
            email="mentee2@test.com",
            password="password123",
        )
        UserProfile.objects.create(
            user=self.mentee_user2,
            role=UserProfile.ROLE_MENTEE,
            approval_status=UserProfile.STATUS_PENDING,
        )
        MenteeProfile.objects.create(
            user=self.mentee_user2,
            program="BSIT",
            year_level=2,
            approved=False,
        )

    def test_get_mentee_queryset_safety(self):
        """Ensures get_mentee_queryset only returns mentees and never admins/staff/coordinators/mentors."""
        qs = get_mentee_queryset()
        targeted_ids = set(qs.values_list("id", flat=True))

        self.assertIn(self.mentee_user1.id, targeted_ids)
        self.assertIn(self.mentee_user2.id, targeted_ids)

        self.assertNotIn(self.admin_user.id, targeted_ids)
        self.assertNotIn(self.staff_user.id, targeted_ids)
        self.assertNotIn(self.coord_user.id, targeted_ids)
        self.assertNotIn(self.mentor_user.id, targeted_ids)

    def test_is_user_mentee_safety(self):
        """Verifies role checking accurately guards non-mentee accounts."""
        self.assertTrue(is_user_mentee(self.mentee_user1))
        self.assertTrue(is_user_mentee(self.mentee_user2))

        self.assertFalse(is_user_mentee(self.admin_user))
        self.assertFalse(is_user_mentee(self.staff_user))
        self.assertFalse(is_user_mentee(self.coord_user))
        self.assertFalse(is_user_mentee(self.mentor_user))

    def test_delete_single_mentee_blocks_staff(self):
        """Refuses to delete staff/superuser/mentor accounts."""
        success, msg = delete_single_mentee(self.admin_user)
        self.assertFalse(success)
        self.assertTrue(User.objects.filter(id=self.admin_user.id).exists())

        success, msg = delete_single_mentee(self.mentor_user)
        self.assertFalse(success)
        self.assertTrue(User.objects.filter(id=self.mentor_user.id).exists())

    def test_bulk_delete_mentees_deletes_mentees_and_cascades(self):
        """Ensures deleting mentees removes User, UserProfile, and MenteeProfile."""
        mentee1_id = self.mentee_user1.id
        results = bulk_delete_mentees()

        self.assertEqual(results["deleted_count"], 2)
        self.assertEqual(results["failed_count"], 0)

        self.assertFalse(User.objects.filter(id=mentee1_id).exists())
        self.assertFalse(UserProfile.objects.filter(user_id=mentee1_id).exists())
        self.assertFalse(MenteeProfile.objects.filter(user_id=mentee1_id).exists())

        # Protected accounts still intact
        self.assertTrue(User.objects.filter(id=self.admin_user.id).exists())
        self.assertTrue(User.objects.filter(id=self.mentor_user.id).exists())


class DeleteMenteesCommandTests(TestCase):
    def setUp(self):
        self.mentee = User.objects.create_user(
            username="cmd_mentee",
            email="cmd_mentee@test.com",
            password="password123",
        )
        UserProfile.objects.create(
            user=self.mentee,
            role=UserProfile.ROLE_MENTEE,
            approval_status=UserProfile.STATUS_ACTIVE,
        )
        MenteeProfile.objects.create(
            user=self.mentee,
            program="BSIT",
            year_level=1,
        )

    def test_command_dry_run_does_not_delete(self):
        """--dry-run lists accounts and leaves them untouched."""
        out = StringIO()
        call_command("delete_mentees", "--dry-run", stdout=out)
        output = out.getvalue()

        self.assertIn("cmd_mentee", output)
        self.assertIn("[DRY RUN COMPLETE]", output)
        self.assertTrue(User.objects.filter(id=self.mentee.id).exists())

    def test_command_force_executes_deletion(self):
        """--force executes without interactive prompt."""
        out = StringIO()
        call_command("delete_mentees", "--force", stdout=out)
        output = out.getvalue()

        self.assertIn("SUCCESS: Successfully deleted", output)
        self.assertFalse(User.objects.filter(id=self.mentee.id).exists())
