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
