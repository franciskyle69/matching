from django.test import TestCase
from profiles.models import MentorProfile, MenteeProfile
from matching.services import (
    _filter_mentors_for_mentee,
    compute_score_breakdown,
    compute_score,
)


class MatchingAcademicOverlapTests(TestCase):
    def setUp(self):
        self.mentee = MenteeProfile(
            id=101,
            subjects=["IT 112 Computer Programming", "IT 113 IT Fundamentals"],
            topics=["Data Structures", "Client-Side Scripting"],
            sex="female",
            availability=["Wed|15:00-17:00"],
            difficulty_level=3,
        )

        # Mentor with only schedule overlap (different subjects and topics)
        self.time_only_mentor = MentorProfile(
            id=201,
            role="INSTRUCTOR",
            gender="female",
            subjects=["IT 111 Introduction to Computing"],
            topics=["Digital Logic & Data Representation"],
            availability=["Wed|15:00-17:00"],
            capacity=5,
            expertise_level=2,
        )

        # Mentor with academic overlap (shares subject and time)
        self.academic_mentor = MentorProfile(
            id=202,
            role="INSTRUCTOR",
            gender="female",
            subjects=["IT 112 Computer Programming"],
            topics=["Data Structures"],
            availability=["Wed|15:00-17:00"],
            capacity=5,
            expertise_level=4,
        )

    def test_filter_mentors_excludes_zero_academic_overlap(self):
        """Mentors with 0 subject and 0 topic overlap must be filtered out."""
        result = _filter_mentors_for_mentee(
            self.mentee,
            [self.time_only_mentor, self.academic_mentor],
            accepted_counts={},
        )
        mentor_ids = [m.id for m in result.mentors]
        self.assertNotIn(self.time_only_mentor.id, mentor_ids)
        self.assertIn(self.academic_mentor.id, mentor_ids)

    def test_filter_mentors_empty_reason_when_only_time_overlaps(self):
        """When candidates exist but none have academic overlap, empty_reason is 'no_academic_overlap'."""
        result = _filter_mentors_for_mentee(
            self.mentee,
            [self.time_only_mentor],
            accepted_counts={},
        )
        self.assertEqual(len(result.mentors), 0)
        self.assertEqual(result.empty_reason, "no_academic_overlap")

    def test_compute_score_breakdown_zero_academic_values(self):
        """Zero academic and competency overlap must yield exactly 0% with descriptive summaries."""
        breakdown = compute_score_breakdown(self.time_only_mentor, self.mentee)
        factors = breakdown["factors"]

        self.assertEqual(factors["academic"]["score"], 0)
        self.assertEqual(factors["academic"]["summary"], "No shared subjects")

        self.assertEqual(factors["competency"]["score"], 0)
        self.assertEqual(factors["competency"]["summary"], "No shared competencies")

        # Overall fit cannot be positive without academic fit
        self.assertEqual(breakdown["overall_score"], 0.0)
        self.assertEqual(breakdown["overall_percentage"], 0)
        self.assertEqual(breakdown["tier_label"], "No Fit")

    def test_compute_score_returns_zero_for_no_academic_overlap(self):
        """compute_score returns 0.0 when academic overlap is zero."""
        score = compute_score(self.time_only_mentor, self.mentee)
        self.assertEqual(score, 0.0)


class MatchingPerformanceAndQueryCountTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from accounts.models import UserProfile
        from matching.models import Competency, Topic, Subject

        # Create mentee
        self.mentee_user = User.objects.create_user(username="perf_mentee", password="password")
        UserProfile.objects.create(
            user=self.mentee_user,
            role=UserProfile.ROLE_MENTEE,
            approval_status=UserProfile.STATUS_ACTIVE,
            is_email_verified=True,
            is_onboarded=True,
        )
        self.mentee = MenteeProfile.objects.create(
            user=self.mentee_user,
            program="BSIT",
            year_level=2,
            subjects=["IT 112 Computer Programming"],
            topics=["Data Structures"],
            sex="female",
            availability=["Wed|15:00-17:00"],
            difficulty_level=3,
        )
        self.subject = Subject.objects.create(name="IT 112 Computer Programming")
        self.topic = Topic.objects.create(name="Data Structures", subject=self.subject)
        self.comp = Competency.objects.create(name="Python Programming", topic=self.topic)
        self.mentee.competencies.add(self.comp)

        # Create candidate mentors (3 overlapping, 2 non-overlapping)
        for i in range(5):
            mentor_user = User.objects.create_user(username=f"perf_mentor_{i}", password="password")
            UserProfile.objects.create(
                user=mentor_user,
                role=UserProfile.ROLE_STUDENT_MENTOR,
                approval_status=UserProfile.STATUS_ACTIVE,
                is_email_verified=True,
                is_onboarded=True,
            )
            mentor = MentorProfile.objects.create(
                user=mentor_user,
                program="BSIT",
                year_level=3,
                role="STUDENT_MENTOR",
                gender="female",
                subjects=["IT 112 Computer Programming"] if i < 3 else ["Other Subject"],
                topics=["Data Structures"] if i < 3 else ["Other Topic"],
                availability=["Wed|15:00-17:00"],
                capacity=5,
                expertise_level=4,
                approved=True,
            )
            mentor.competencies.add(self.comp)

    def test_recommendation_latency_and_query_count(self):
        import time
        from django.db import connection, reset_queries
        from matching.services import recommend_mentors_for_mentee_with_meta

        # First uncached run
        reset_queries()
        t0 = time.perf_counter()
        recs, meta = recommend_mentors_for_mentee_with_meta(self.mentee, limit=5)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        # Verify execution time is < 100ms
        self.assertLess(elapsed_ms, 100.0, f"Uncached recommendation elapsed: {elapsed_ms:.2f}ms")
        self.assertGreater(len(recs), 0)

        # Verify DB queries execute in <= 3 queries total
        query_count = len(connection.queries)
        self.assertLessEqual(
            query_count,
            3,
            f"Query count was {query_count} (expected <= 3): {[q['sql'] for q in connection.queries]}",
        )

        # Cached run
        reset_queries()
        t0_cached = time.perf_counter()
        recs_cached, meta_cached = recommend_mentors_for_mentee_with_meta(self.mentee, limit=5)
        cached_elapsed_ms = (time.perf_counter() - t0_cached) * 1000
        self.assertTrue(meta_cached.get("from_cache"))
        self.assertLess(cached_elapsed_ms, 25.0, f"Cached elapsed: {cached_elapsed_ms:.2f}ms")

