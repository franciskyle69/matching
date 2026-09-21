from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from accounts.models import UserProfile
from matching.models import Subject, Topic, Competency
from profiles.models import MenteeProfile, MentorProfile
from api.serializers import OnboardingPreferenceSerializer

User = get_user_model()


class OnboardingPreferenceSerializerTestCase(TestCase):
    def setUp(self):
        User.objects.filter(username__in=["mentee1", "mentor1", "instructor1"]).delete()

        self.subject1, _ = Subject.objects.get_or_create(name="Introduction to Computing", defaults={"code": "IT 111"})
        self.subject2, _ = Subject.objects.get_or_create(name="Computer Programming", defaults={"code": "IT 112"})
        self.subject3, _ = Subject.objects.get_or_create(name="Data Structures", defaults={"code": "IT 113"})
        self.subject4, _ = Subject.objects.get_or_create(name="Database Systems", defaults={"code": "IT 115"})
        self.subject5, _ = Subject.objects.get_or_create(name="Web Systems", defaults={"code": "IT 221"})

        # Topics under Subject 1
        self.top1_1, _ = Topic.objects.get_or_create(subject=self.subject1, name="Hardware Basics")
        self.top1_2, _ = Topic.objects.get_or_create(subject=self.subject1, name="Digital Logic")
        self.top1_3, _ = Topic.objects.get_or_create(subject=self.subject1, name="OS Fundamentals")

        # Topics under Subject 2
        self.top2_1, _ = Topic.objects.get_or_create(subject=self.subject2, name="Control Structures")
        self.top2_2, _ = Topic.objects.get_or_create(subject=self.subject2, name="Arrays")

        # Competencies
        self.c1, _ = Competency.objects.get_or_create(topic=self.top1_1, name="CPU Architecture")
        self.c2, _ = Competency.objects.get_or_create(topic=self.top1_1, name="Memory Management")
        self.c3, _ = Competency.objects.get_or_create(topic=self.top1_1, name="Storage Types")

        self.c4, _ = Competency.objects.get_or_create(topic=self.top1_2, name="Boolean Logic")
        self.c5, _ = Competency.objects.get_or_create(topic=self.top1_2, name="Hex Conversions")

        self.c6, _ = Competency.objects.get_or_create(topic=self.top2_1, name="Loop Control")
        self.c7, _ = Competency.objects.get_or_create(topic=self.top2_1, name="Conditionals")
        self.c8, _ = Competency.objects.get_or_create(topic=self.top2_1, name="Iteration Patterns")

        # Users
        self.mentee_user = User.objects.create_user(
            username="mentee1",
            email="mentee1@student.buksu.edu.ph",
            password="Password123!",
        )
        self.mentee_up, _ = UserProfile.objects.get_or_create(
            user=self.mentee_user,
            defaults={"role": UserProfile.ROLE_MENTEE, "approval_status": UserProfile.STATUS_ACTIVE},
        )
        self.mentee_up.role = UserProfile.ROLE_MENTEE
        self.mentee_up.save()
        self.mentee_profile, _ = MenteeProfile.objects.get_or_create(
            user=self.mentee_user,
            defaults={"program": "BSIT", "year_level": 1},
        )

        self.mentor_user = User.objects.create_user(
            username="mentor1",
            email="mentor1@student.buksu.edu.ph",
            password="Password123!",
        )
        self.mentor_up, _ = UserProfile.objects.get_or_create(
            user=self.mentor_user,
            defaults={"role": UserProfile.ROLE_STUDENT_MENTOR, "approval_status": UserProfile.STATUS_ACTIVE},
        )
        self.mentor_up.role = UserProfile.ROLE_STUDENT_MENTOR
        self.mentor_up.save()
        self.mentor_profile, _ = MentorProfile.objects.get_or_create(
            user=self.mentor_user,
            defaults={"program": "BSIT", "year_level": 3},
        )

        self.instructor_user = User.objects.create_user(
            username="instructor1",
            email="instructor1@buksu.edu.ph",
            password="Password123!",
        )
        self.instructor_up, _ = UserProfile.objects.get_or_create(
            user=self.instructor_user,
            defaults={"role": UserProfile.ROLE_INSTRUCTOR_MENTOR, "approval_status": UserProfile.STATUS_ACTIVE},
        )
        self.instructor_up.role = UserProfile.ROLE_INSTRUCTOR_MENTOR
        self.instructor_up.save()
        self.instructor_profile, _ = MentorProfile.objects.get_or_create(
            user=self.instructor_user,
            defaults={"program": "BSIT", "year_level": 4, "role": "Instructor"},
        )



    def test_mentee_valid_submission(self):
        payload = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics"],
            "competencies": [self.c1.id, self.c2.id],
            "availability_slots": ["Mon|09:00-11:00"],
            "role": "MENTEE",
        }
        serializer = OnboardingPreferenceSerializer(data=payload, context={"user": self.mentee_user})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(len(serializer.validated_data["resolved_competencies"]), 2)

    def test_mentee_max_competencies_exceeded(self):
        payload_capped_topics = {
            "subjects": ["IT 111", "IT 112"],
            "topics": ["Hardware Basics", "Control Structures"],
            "competencies": [self.c1.id, self.c2.id, self.c3.id, self.c6.id, self.c7.id, self.c8.id],  # 6 comps
            "availability_slots": ["Mon|09:00-11:00"],
            "role": "MENTEE",
        }
        s2 = OnboardingPreferenceSerializer(data=payload_capped_topics, context={"user": self.mentee_user})
        self.assertFalse(s2.is_valid())
        self.assertIn("Mentees cannot select more than 5 competencies total", str(s2.errors))

    def test_mentee_min_competencies_required(self):
        payload = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics"],
            "competencies": [],
            "availability_slots": ["Mon|09:00-11:00"],
            "role": "MENTEE",
        }
        serializer = OnboardingPreferenceSerializer(data=payload, context={"user": self.mentee_user})
        self.assertFalse(serializer.is_valid())
        self.assertIn("competenc", str(serializer.errors).lower())

    def test_mentee_availability_limits(self):
        # Min availability slots is 1
        payload_no_avail = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics"],
            "competencies": [self.c1.id],
            "availability_slots": [],
            "role": "MENTEE",
        }
        s1 = OnboardingPreferenceSerializer(data=payload_no_avail, context={"user": self.mentee_user})
        self.assertFalse(s1.is_valid())
        self.assertIn("at least 1 availability slot", str(s1.errors))

        # Max availability slots is 4
        payload_5_avail = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics"],
            "competencies": [self.c1.id],
            "availability_slots": ["Mon|09:00-11:00", "Tue|09:00-11:00", "Wed|09:00-11:00", "Thu|09:00-11:00", "Fri|09:00-11:00"],
            "role": "MENTEE",
        }
        s2 = OnboardingPreferenceSerializer(data=payload_5_avail, context={"user": self.mentee_user})
        self.assertFalse(s2.is_valid())
        self.assertIn("cannot select more than 4 availability slots", str(s2.errors))

    def test_student_mentor_limits(self):
        # Student mentor requires min 2 availability slots and min 2 competencies, allows up to 2 subjects, 10 competencies
        payload = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics"],
            "competencies": [self.c1.id],  # only 1 competency, min is 2
            "availability_slots": ["Mon|09:00-11:00"],  # only 1 slot, min is 2
            "role": "STUDENT_MENTOR",
        }
        s = OnboardingPreferenceSerializer(data=payload, context={"user": self.mentor_user})
        self.assertFalse(s.is_valid())
        self.assertIn("Student Mentors must select at least 2", str(s.errors))

        # Student mentor max 2 subjects (3 should fail)
        payload_3_subj = {
            "subjects": ["IT 111", "IT 112", "IT 113"],
            "topics": ["Hardware Basics", "Control Structures"],
            "competencies": [self.c1.id, self.c6.id],
            "availability_slots": ["Mon|09:00-11:00", "Wed|13:00-15:00"],
            "role": "STUDENT_MENTOR",
        }
        s2 = OnboardingPreferenceSerializer(data=payload_3_subj, context={"user": self.mentor_user})
        self.assertFalse(s2.is_valid())
        self.assertIn("Student Mentors cannot select more than 2 subjects", str(s2.errors))

    def test_instructor_mentor_subject_limits(self):
        Top3_1, _ = Topic.objects.get_or_create(subject=self.subject3, name="LinkedLists")
        Top4_1, _ = Topic.objects.get_or_create(subject=self.subject4, name="SQL")
        c_ll, _ = Competency.objects.get_or_create(topic=Top3_1, name="Singly Linked Lists")
        c_sql, _ = Competency.objects.get_or_create(topic=Top4_1, name="SELECT Queries")

        # 3 subjects is valid for Instructor Mentor
        payload_3_subj = {
            "subjects": ["IT 111", "IT 112", "IT 113"],
            "topics": ["Hardware Basics", "Control Structures", "LinkedLists"],
            "competencies": [self.c1.id, self.c6.id, c_ll.id],
            "availability_slots": ["Mon|09:00-11:00", "Wed|13:00-15:00"],
            "role": "INSTRUCTOR_MENTOR",
        }
        s_valid = OnboardingPreferenceSerializer(data=payload_3_subj, context={"user": self.instructor_user})
        self.assertTrue(s_valid.is_valid(), s_valid.errors)

        # 4 subjects exceeds the max cap of 3
        payload_4_subj = {
            "subjects": ["IT 111", "IT 112", "IT 113", "IT 115"],
            "topics": ["Hardware Basics", "Control Structures", "LinkedLists", "SQL"],
            "competencies": [self.c1.id, self.c6.id, c_ll.id, c_sql.id],
            "availability_slots": ["Mon|09:00-11:00", "Wed|13:00-15:00"],
            "role": "INSTRUCTOR_MENTOR",
        }
        s_invalid = OnboardingPreferenceSerializer(data=payload_4_subj, context={"user": self.instructor_user})
        self.assertFalse(s_invalid.is_valid())
        self.assertIn("Instructor Mentors cannot select more than 3 subjects", str(s_invalid.errors))

    def test_mentee_topics_per_subject_limit(self):
        # Mentee max topics per subject is 2
        payload = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics", "Digital Logic", "OS Fundamentals"],  # 3 topics under IT 111
            "competencies": [self.c1.id, self.c4.id],
            "availability_slots": ["Mon|09:00-11:00"],
            "role": "MENTEE",
        }
        s = OnboardingPreferenceSerializer(data=payload, context={"user": self.mentee_user})
        self.assertFalse(s.is_valid())
        self.assertIn("Mentees cannot select more than 2 topics per subject", str(s.errors))

    def test_mentee_competencies_per_topic_limit(self):
        # Mentee max competencies per topic is 2
        payload = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics"],
            "competencies": [self.c1.id, self.c2.id, self.c3.id],  # 3 comps under Hardware Basics
            "availability_slots": ["Mon|09:00-11:00"],
            "role": "MENTEE",
        }
        s = OnboardingPreferenceSerializer(data=payload, context={"user": self.mentee_user})
        self.assertFalse(s.is_valid())
        self.assertIn("Mentees cannot select more than 2 competencies per topic", str(s.errors))


    def test_hierarchy_integrity_check(self):
        # c6 belongs to Control Structures (IT 112), but subject IT 111 is selected without IT 112
        payload = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics"],
            "competencies": [self.c6.id],  # c6 belongs to IT 112!
            "availability_slots": ["Mon|09:00-11:00"],
            "role": "MENTEE",
        }
        s = OnboardingPreferenceSerializer(data=payload, context={"user": self.mentee_user})
        self.assertFalse(s.is_valid())
        self.assertIn("Hierarchy integrity violation", str(s.errors))

    def test_complete_onboarding_api_endpoint(self):
        client = Client()
        client.force_login(self.mentee_user)

        # Try to submit 6 competencies as mentee via API endpoint
        bad_payload = {
            "subjects": ["IT 111", "IT 112"],
            "topics": ["Hardware Basics", "Control Structures"],
            "competencies": [self.c1.id, self.c2.id, self.c3.id, self.c6.id, self.c7.id, self.c8.id],
            "availability": [{"day": "Monday", "start_time": "09:00", "end_time": "11:00"}],
        }
        response = client.post(
            "/api/user/complete-onboarding/",
            data=bad_payload,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        resp_data = response.json()
        self.assertIn("Mentees cannot select more than 5 competencies total", resp_data.get("error", ""))

        # Now submit valid mentee payload
        good_payload = {
            "subjects": ["IT 111"],
            "topics": ["Hardware Basics"],
            "competencies": [self.c1.id, self.c2.id],
            "availability": [{"day": "Monday", "start_time": "09:00", "end_time": "11:00"}],
        }
        ok_response = client.post(
            "/api/user/complete-onboarding/",
            data=good_payload,
            content_type="application/json",
        )
        self.assertEqual(ok_response.status_code, 200)
        self.assertTrue(ok_response.json().get("user", {}).get("is_onboarded"))

    def test_seed_users_command(self):
        from django.core.management import call_command
        from io import StringIO
        from django.contrib.auth import authenticate
        from django.test.client import RequestFactory

        out = StringIO()
        call_command("seed_users", "--seed", "42", stdout=out)
        output = out.getvalue()

        self.assertIn("USER SEEDING & PREFERENCE VERIFICATION COMPLETED", output)
        self.assertIn("Total Users Created:                 46", output)
        self.assertIn("[PASS] Mentee Competencies:", output)
        self.assertIn("[PASS] Mentor Competencies:", output)

        # Verify user counts
        self.assertEqual(User.objects.count(), 46)
        self.assertEqual(UserProfile.objects.filter(role=UserProfile.ROLE_COORDINATOR).count(), 1)
        self.assertEqual(UserProfile.objects.filter(role=UserProfile.ROLE_INSTRUCTOR_MENTOR).count(), 20)
        self.assertEqual(UserProfile.objects.filter(role=UserProfile.ROLE_STUDENT_MENTOR).count(), 10)
        self.assertEqual(UserProfile.objects.filter(role=UserProfile.ROLE_MENTEE).count(), 15)

        # Verify onboarding status and active status
        self.assertTrue(all(up.is_onboarded and up.approval_status == "ACTIVE" for up in UserProfile.objects.all()))

        # Verify password prefix authentication
        rf = RequestFactory().get("/")
        test_user = authenticate(rf, username="mentor1", password="mentor1")
        self.assertIsNotNone(test_user)
        test_mentee = authenticate(rf, username="mentee1", password="mentee1")
        self.assertIsNotNone(test_mentee)

        # Verify Mentee competencies bounds
        for mentee in MenteeProfile.objects.all():
            comp_count = mentee.competencies.count()
            self.assertGreaterEqual(comp_count, 1)
            self.assertLessEqual(comp_count, 5)
            self.assertGreaterEqual(len(mentee.availability), 1)
            self.assertLessEqual(len(mentee.availability), 4)

        # Verify Mentor competencies bounds
        for mentor in MentorProfile.objects.all():
            comp_count = mentor.competencies.count()
            self.assertGreaterEqual(comp_count, 2)
            self.assertLessEqual(comp_count, 10)
            self.assertGreaterEqual(len(mentor.availability), 2)
            self.assertLessEqual(len(mentor.availability), 6)

