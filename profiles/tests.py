from django.contrib.auth.models import User
from django.test import TestCase

from profiles.models import MenteeProfile, MentorProfile
from profiles.profile_completion import (
    compute_is_profile_complete,
    mentee_account_fields_complete,
    mentor_account_fields_complete,
)


class ProfileCompletionTests(TestCase):
    def test_new_google_mentee_is_incomplete(self):
        user = User.objects.create_user(
            username="newmentee",
            email="newmentee@student.buksu.edu.ph",
            password="Pass12345!",
        )
        mentee = MenteeProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=1,
            is_profile_complete=False,
        )
        self.assertFalse(mentee_account_fields_complete(mentee))
        self.assertFalse(compute_is_profile_complete(user))

    def test_filled_mentee_is_complete(self):
        user = User.objects.create_user(
            username="fullmentee",
            email="fullmentee@student.buksu.edu.ph",
            password="Pass12345!",
        )
        mentee = MenteeProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=1,
            campus="MAIN CAMPUS",
            student_id_no="2023-0001",
            contact_no="09123456789",
            admission_type="regular",
            sex="female",
            is_profile_complete=False,
        )
        self.assertTrue(mentee_account_fields_complete(mentee))
        self.assertTrue(compute_is_profile_complete(user))

    def test_mentor_needs_role_and_id(self):
        user = User.objects.create_user(
            username="newmentor",
            email="newmentor@student.buksu.edu.ph",
            password="Pass12345!",
        )
        mentor = MentorProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=4,
            is_profile_complete=False,
        )
        self.assertFalse(mentor_account_fields_complete(mentor))
        mentor.role = "Senior IT Student"
        mentor.student_id_no = "2023-0099"
        mentor.save()
        self.assertTrue(mentor_account_fields_complete(mentor))
        self.assertTrue(compute_is_profile_complete(user))
