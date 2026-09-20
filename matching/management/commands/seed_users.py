"""
Custom Django management command to clear existing user accounts and reseed
46 test users along with preferences and availability slots strictly adhering
to asymmetric Min-Max matching limits, preserving the existing curriculum taxonomy.

Users created (46 total):
- 1 Coordinator: coordinator1@buksu.edu.ph (password: coordinator1)
- 20 Faculty Mentors: mentor1@buksu.edu.ph to mentor20@buksu.edu.ph (passwords: mentor1..mentor20)
- 10 Student Mentors: mentor21@student.buksu.edu.ph to mentor30@student.buksu.edu.ph (passwords: mentor21..mentor30)
- 15 Mentees: mentee1@student.buksu.edu.ph to mentee15@student.buksu.edu.ph (passwords: mentee1..mentee15)

Usage:
    python manage.py seed_users
    python manage.py seed_users --seed 42
"""

from __future__ import annotations

import random
from typing import Any, Dict, List

from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.core.cache import cache
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from accounts.models import (
    MentorDocument,
    UserProfile,
    UserSecurityState,
    get_user_display_name,
)
from matching.models import (
    Announcement,
    AnnouncementRecipient,
    AuditLog,
    Comment,
    Competency,
    MatchingDatasetRecord,
    MatchingDatasetTopic,
    MenteeMentorRequest,
    Notification,
    PostComment,
    Subject,
    Topic,
    UserPost,
    UserTopicPreference,
)
from matching.services import recommend_mentors_for_mentee_with_meta
from profiles.models import (
    MenteeCompetencyNeed,
    MenteeProfile,
    MentorCompetency,
    MentorProfile,
    VerificationDocument,
)

# Canonical non-overlapping time blocks for availability slot generation
TIME_BLOCKS = (
    ("08:00", "10:00"),
    ("10:00", "12:00"),
    ("13:00", "15:00"),
    ("15:00", "17:00"),
    ("18:00", "20:00"),
)

DAY_CHOICES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

# Rich Filipino name pool
FACULTY_NAMES = [
    ("Alan", "Turing", "male"),
    ("Ada", "Lovelace", "female"),
    ("Grace", "Hopper", "female"),
    ("Tim", "Berners-Lee", "male"),
    ("Donald", "Knuth", "male"),
    ("Barbara", "Liskov", "female"),
    ("Ken", "Thompson", "male"),
    ("Dennis", "Ritchie", "male"),
    ("Margaret", "Hamilton", "female"),
    ("Linus", "Torvalds", "male"),
    ("Guido", "van Rossum", "male"),
    ("Katherine", "Johnson", "female"),
    ("Radia", "Perlman", "female"),
    ("John", "von Neumann", "male"),
    ("Claude", "Shannon", "male"),
    ("Adele", "Goldberg", "female"),
    ("Vint", "Cerf", "male"),
    ("Sister", "Mary Keller", "female"),
    ("Bjarne", "Stroustrup", "male"),
    ("Frances", "Allen", "female"),
]

STUDENT_MENTOR_NAMES = [
    ("Daniel", "Padilla", "male"),
    ("Kathryn", "Bernardo", "female"),
    ("James", "Reid", "male"),
    ("Nadine", "Lustre", "female"),
    ("Enrique", "Gil", "male"),
    ("Liza", "Soberano", "female"),
    ("Donny", "Pangilinan", "male"),
    ("Belle", "Mariano", "female"),
    ("Joshua", "Garcia", "male"),
    ("Julia", "Barretto", "female"),
]

MENTEE_NAMES = [
    ("Francine", "Diaz", "female"),
    ("Seth", "Fedelin", "male"),
    ("Andrea", "Brillantes", "female"),
    ("Kyle", "Echarri", "male"),
    ("Kyline", "Alcantara", "female"),
    ("Mavy", "Legaspi", "male"),
    ("Cassie", "Mondragon", "female"),
    ("Darren", "Espanto", "male"),
    ("AC", "Bonifacio", "female"),
    ("Ken", "Suson", "male"),
    ("Stell", "Ajero", "male"),
    ("Justin", "De Dios", "male"),
    ("Josh", "Cullen", "male"),
    ("Pablo", "Nase", "male"),
    ("Sheena", "Catacutan", "female"),
]


class Command(BaseCommand):
    help = (
        "Wipe user accounts and reseed 46 users with hierarchical matching preferences "
        "and availability slots strictly adhering to Min-Max limits, while preserving curriculum."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--seed",
            type=int,
            default=42,
            help="Random seed for reproducible preference and availability generation (default: 42).",
        )

    def handle(self, *args, **options):
        seed_value = options.get("seed")
        rng = random.Random(seed_value)

        self.stdout.write(self.style.MIGRATE_HEADING("=== BukSU Mentorship User Seeder (Preserving Curriculum) ==="))
        self.stdout.write(f"Random seed: {seed_value}")

        # 1. Verify that curriculum taxonomy exists in database
        curriculum_tax = self._load_curriculum_taxonomy()
        if not curriculum_tax["subjects"]:
            self.stdout.write(
                self.style.ERROR(
                    "No curriculum found with active topics and competencies! "
                    "Please run `python manage.py seed_db` first to seed the curriculum matrix."
                )
            )
            return

        with transaction.atomic():
            # 2. Wipe existing user records only (preserve Subject, Topic, Competency)
            self._wipe_user_data()

            # 3. Seed users & preferences
            summary = self._seed_users_and_preferences(rng, curriculum_tax)

        self._reset_db_sequences()
        cache.clear()

        # 4. Print detailed terminal summary
        self._print_summary(summary)

        # 5. Verify XGBoost matching recommendation readiness
        self._verify_matching_engine()

    def _load_curriculum_taxonomy(self) -> Dict[str, Any]:
        """Load existing curriculum taxonomy from the database without modifying it."""
        # Find subjects that have at least one topic with competencies
        subjects = list(
            Subject.objects.filter(topics__competencies__isnull=False)
            .distinct()
            .order_by("code", "name")
        )

        topics_by_subject: Dict[int, List[Topic]] = {}
        comps_by_topic: Dict[int, List[Competency]] = {}

        total_topics = 0
        total_comps = 0

        for subj in subjects:
            subj_topics = list(
                Topic.objects.filter(subject=subj, competencies__isnull=False, status=Topic.STATUS_ACTIVE)
                .distinct()
                .order_by("name")
            )
            topics_by_subject[subj.id] = subj_topics
            total_topics += len(subj_topics)

            for top in subj_topics:
                comps = list(Competency.objects.filter(topic=top).order_by("name"))
                comps_by_topic[top.id] = comps
                total_comps += len(comps)

        self.stdout.write(
            f"Loaded curriculum taxonomy: {len(subjects)} subjects, "
            f"{total_topics} active topics, {total_comps} competencies."
        )

        return {
            "subjects": subjects,
            "topics_by_subject": topics_by_subject,
            "comps_by_topic": comps_by_topic,
        }

    def _wipe_user_data(self) -> None:
        """Clear user accounts, profiles, preferences, competencies, and availability."""
        self.stdout.write(self.style.WARNING("1. Clearing user accounts, profiles, and preference tables..."))

        # Delete dependent posts, comments, requests, and notifications
        PostComment.objects.all().delete()
        UserPost.objects.all().delete()
        Comment.objects.all().delete()
        AnnouncementRecipient.objects.all().delete()
        Announcement.objects.all().delete()
        MenteeMentorRequest.objects.all().delete()
        MatchingDatasetTopic.objects.all().delete()
        MatchingDatasetRecord.objects.all().delete()
        Notification.objects.all().delete()
        AuditLog.objects.all().delete()

        # Preference & Competency tables
        UserTopicPreference.objects.all().delete()
        MentorCompetency.objects.all().delete()
        MenteeCompetencyNeed.objects.all().delete()
        VerificationDocument.objects.all().delete()
        MentorDocument.objects.all().delete()

        # Clear M2M intermediate relations for profiles
        for model in (MentorProfile, MenteeProfile, UserProfile):
            for field in model._meta.many_to_many:
                try:
                    field.remote_field.through.objects.all().delete()
                except Exception:
                    pass

        # Profiles and Security States
        MentorProfile.objects.all().delete()
        MenteeProfile.objects.all().delete()
        UserProfile.objects.all().delete()
        UserSecurityState.objects.all().delete()

        # Sessions & Axes rate limit records
        Session.objects.all().delete()
        try:
            from axes.models import AccessAttempt, AccessFailureLog, AccessLog
            AccessAttempt.objects.all().delete()
            AccessFailureLog.objects.all().delete()
            AccessLog.objects.all().delete()
        except Exception:
            pass

        # Allauth EmailAddress records
        try:
            from allauth.account.models import EmailAddress, EmailConfirmation
            EmailConfirmation.objects.all().delete()
            EmailAddress.objects.all().delete()
        except Exception:
            pass

        # Delete all User records (cascades any remaining user references)
        user_deleted_count, _ = User.objects.all().delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"   Preserved curriculum (Subjects: {Subject.objects.count()}, "
                f"Topics: {Topic.objects.count()}, Competencies: {Competency.objects.count()}). "
                f"Cleared {user_deleted_count} User accounts and related preference data."
            )
        )

    def _generate_non_overlapping_slots(self, rng: random.Random, min_slots: int, max_slots: int) -> List[str]:
        """Generate non-overlapping availability slots in wire format 'Day|Start-End'."""
        num_slots = rng.randint(min_slots, max_slots)

        # Build candidate pool of non-overlapping slots
        pool = [
            f"{day}|{start}-{end}"
            for day in DAY_CHOICES
            for start, end in TIME_BLOCKS
        ]

        # Since each (day, time_block) in TIME_BLOCKS is disjoint, any sample of distinct items is non-overlapping
        chosen = rng.sample(pool, k=min(num_slots, len(pool)))
        return sorted(chosen)

    def _create_base_user(
        self,
        username: str,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        *,
        is_staff: bool = False,
    ) -> User:
        """Create a user with active status and security state marked as onboarded."""
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_staff=is_staff,
        )

        UserSecurityState.objects.update_or_create(
            user=user,
            defaults={
                "is_onboarded": True,
                "must_change_password": False,
            },
        )

        try:
            from allauth.account.models import EmailAddress
            EmailAddress.objects.create(
                user=user,
                email=email,
                primary=True,
                verified=True,
            )
        except Exception:
            pass

        return user

    def _seed_preferences_and_availability(
        self,
        rng: random.Random,
        user: User,
        profile: Any,
        role: str,
        curriculum_tax: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Seed preferences navigating strictly through the hierarchy (Subject -> Topic -> Competency)
        enforcing strict asymmetric Min-Max bounds per role.
        """
        all_subjects: List[Subject] = curriculum_tax["subjects"]
        topics_by_subject: Dict[int, List[Topic]] = curriculum_tax["topics_by_subject"]
        comps_by_topic: Dict[int, List[Competency]] = curriculum_tax["comps_by_topic"]

        # Determine limits based on role
        if role == UserProfile.ROLE_MENTEE:
            subj_min, subj_max = 1, 2
            top_min, top_max = 1, 2
            comp_min, comp_max = 1, 2
            global_min, global_max = 1, 5
            slot_min, slot_max = 1, 4
            target = UserTopicPreference.TARGET_MENTEE
        elif role == UserProfile.ROLE_STUDENT_MENTOR:
            subj_min, subj_max = 1, 3
            top_min, top_max = 1, 3
            comp_min, comp_max = 1, 3
            global_min, global_max = 2, 10
            slot_min, slot_max = 2, 6
            target = UserTopicPreference.TARGET_MENTOR
        elif role == UserProfile.ROLE_INSTRUCTOR_MENTOR:
            subj_min, subj_max = 1, 4
            top_min, top_max = 1, 3
            comp_min, comp_max = 1, 3
            global_min, global_max = 2, 10
            slot_min, slot_max = 2, 6
            target = UserTopicPreference.TARGET_MENTOR
        else:
            raise ValueError(f"Unsupported role for preferences: {role}")

        # 1. Select subjects within limits
        num_subjects = rng.randint(subj_min, min(subj_max, len(all_subjects)))
        chosen_subjects = rng.sample(all_subjects, k=num_subjects)

        chosen_comps: List[Competency] = []
        chosen_topics_map: Dict[int, Topic] = {}

        # 2. Navigate hierarchy: Subject -> Topics -> Competencies
        for subj in chosen_subjects:
            avail_topics = topics_by_subject.get(subj.id, [])
            if not avail_topics:
                continue
            num_topics = rng.randint(top_min, min(top_max, len(avail_topics)))
            chosen_topics_for_subj = rng.sample(avail_topics, k=num_topics)

            for top in chosen_topics_for_subj:
                avail_comps = comps_by_topic.get(top.id, [])
                if not avail_comps:
                    continue
                num_comps = rng.randint(comp_min, min(comp_max, len(avail_comps)))
                chosen_comps_for_top = rng.sample(avail_comps, k=num_comps)

                chosen_comps.extend(chosen_comps_for_top)
                chosen_topics_map[top.id] = top

        # 3. Enforce Global Competencies Cap
        if len(chosen_comps) > global_max:
            chosen_comps = chosen_comps[:global_max]

        # Enforce Global Minimum if under
        if len(chosen_comps) < global_min:
            for subj in chosen_subjects:
                if len(chosen_comps) >= global_min:
                    break
                for top in topics_by_subject.get(subj.id, []):
                    if len(chosen_comps) >= global_min:
                        break
                    for comp in comps_by_topic.get(top.id, []):
                        if comp not in chosen_comps:
                            chosen_comps.append(comp)
                            chosen_topics_map[top.id] = top
                            if len(chosen_comps) >= global_min:
                                break

        # 4. Prune active topics and subjects to match only retained competencies
        active_topics = list({comp.topic for comp in chosen_comps})
        active_subjects = list({top.subject for top in active_topics})

        # 5. Generate Non-Overlapping Availability Slots
        availability_slots = self._generate_non_overlapping_slots(rng, slot_min, slot_max)

        # 6. Ratings & Profile Assignment
        overall_rating = rng.randint(1, 5)

        profile.subjects = [s.name for s in active_subjects]
        profile.topics = [t.name for t in active_topics]
        profile.skills = [c.name for c in chosen_comps]
        profile.availability = availability_slots

        if role == UserProfile.ROLE_MENTEE:
            profile.difficulty_level = overall_rating
            profile.save()
            profile.competencies.set(chosen_comps)

            # Persist MenteeCompetencyNeed with foreign keys
            for comp in chosen_comps:
                comp_need = rng.randint(1, 5)
                MenteeCompetencyNeed.objects.create(
                    mentee=profile,
                    competency=comp,
                    need_level=comp_need,
                )
        else:
            profile.expertise_level = overall_rating
            profile.save()
            profile.competencies.set(chosen_comps)

            # Persist MentorCompetency with foreign keys
            for comp in chosen_comps:
                comp_prof = rng.randint(1, 5)
                MentorCompetency.objects.create(
                    mentor=profile,
                    competency=comp,
                    proficiency_level=comp_prof,
                )

        # Persist UserTopicPreference retaining explicit foreign keys for subject & topic
        for topic in active_topics:
            UserTopicPreference.objects.create(
                user=user,
                subject=topic.subject,
                topic=topic,
                target=target,
                is_active_selection=True,
            )

        return {
            "num_subjects": len(active_subjects),
            "num_topics": len(active_topics),
            "num_competencies": len(chosen_comps),
            "num_slots": len(availability_slots),
        }

    def _seed_users_and_preferences(
        self,
        rng: random.Random,
        curriculum_tax: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Seed 46 total users: 1 Coordinator, 20 Faculty Mentors, 10 Student Mentors, 15 Mentees."""
        self.stdout.write(self.style.WARNING("2. Seeding 46 users, hierarchical preferences, and availability..."))

        stats = {
            "coordinator_count": 0,
            "faculty_count": 0,
            "student_mentor_count": 0,
            "mentee_count": 0,
            "mentee_competency_counts": [],
            "mentor_competency_counts": [],
            "mentee_slot_counts": [],
            "mentor_slot_counts": [],
            "mentee_subject_counts": [],
            "mentor_subject_counts": [],
        }

        # -----------------------------------------------------------------
        # 1 Coordinator: coordinator1@buksu.edu.ph (No preferences required)
        # -----------------------------------------------------------------
        coord_user = self._create_base_user(
            username="coordinator1",
            email="coordinator1@buksu.edu.ph",
            password="coordinator1",
            first_name="Grace",
            last_name="Coordinator",
            is_staff=True,
        )
        UserProfile.objects.create(
            user=coord_user,
            role=UserProfile.ROLE_COORDINATOR,
            approval_status=UserProfile.STATUS_ACTIVE,
            is_onboarded=True,
            campus="Main",
            program="BSIT",
            bio="BSIT Program Mentorship Coordinator.",
        )
        stats["coordinator_count"] += 1

        # -----------------------------------------------------------------
        # 20 Faculty Mentors: mentor1@buksu.edu.ph to mentor20@buksu.edu.ph
        # -----------------------------------------------------------------
        for i in range(1, 21):
            username = f"mentor{i}"
            email = f"mentor{i}@buksu.edu.ph"
            first, last, gender = FACULTY_NAMES[i - 1]

            user = self._create_base_user(
                username=username,
                email=email,
                password=username,
                first_name=first,
                last_name=last,
                is_staff=False,
            )

            UserProfile.objects.create(
                user=user,
                role=UserProfile.ROLE_INSTRUCTOR_MENTOR,
                approval_status=UserProfile.STATUS_ACTIVE,
                is_onboarded=True,
                campus="Main",
                program="BSIT",
                bio="Faculty mentor in Information Technology at BukSU Main Campus.",
            )

            profile = MentorProfile.objects.create(
                user=user,
                program="BSIT",
                year_level=4,
                student_id_no=f"FAC-2026-{i:03d}",
                is_profile_complete=True,
                role="Instructor",
                gender=gender,
                years_experience=rng.randint(3, 15),
                teaching_experience_years=rng.randint(2, 12),
                approved=True,
            )

            pref_stat = self._seed_preferences_and_availability(
                rng, user, profile, UserProfile.ROLE_INSTRUCTOR_MENTOR, curriculum_tax
            )

            stats["faculty_count"] += 1
            stats["mentor_competency_counts"].append(pref_stat["num_competencies"])
            stats["mentor_slot_counts"].append(pref_stat["num_slots"])
            stats["mentor_subject_counts"].append(pref_stat["num_subjects"])

        # -----------------------------------------------------------------
        # 10 Student Mentors: mentor21@student.buksu.edu.ph to mentor30@student.buksu.edu.ph
        # -----------------------------------------------------------------
        for i in range(21, 31):
            username = f"mentor{i}"
            email = f"mentor{i}@student.buksu.edu.ph"
            first, last, gender = STUDENT_MENTOR_NAMES[i - 21]
            year = rng.choice([3, 4])

            user = self._create_base_user(
                username=username,
                email=email,
                password=username,
                first_name=first,
                last_name=last,
                is_staff=False,
            )

            UserProfile.objects.create(
                user=user,
                role=UserProfile.ROLE_STUDENT_MENTOR,
                approval_status=UserProfile.STATUS_ACTIVE,
                is_onboarded=True,
                campus="Main",
                program="BSIT",
                year_level=year,
                bio=f"Senior peer mentor ({year}th Year BSIT) at BukSU Main Campus.",
            )

            profile = MentorProfile.objects.create(
                user=user,
                program="BSIT",
                year_level=year,
                student_id_no=f"2023-{i:04d}",
                is_profile_complete=True,
                role="Senior IT Student",
                gender=gender,
                years_experience=rng.randint(1, 3),
                teaching_experience_years=None,
                approved=True,
            )

            pref_stat = self._seed_preferences_and_availability(
                rng, user, profile, UserProfile.ROLE_STUDENT_MENTOR, curriculum_tax
            )

            stats["student_mentor_count"] += 1
            stats["mentor_competency_counts"].append(pref_stat["num_competencies"])
            stats["mentor_slot_counts"].append(pref_stat["num_slots"])
            stats["mentor_subject_counts"].append(pref_stat["num_subjects"])

        # -----------------------------------------------------------------
        # 15 Mentees: mentee1@student.buksu.edu.ph to mentee15@student.buksu.edu.ph
        # -----------------------------------------------------------------
        learning_styles = ["Visual", "Auditory", "Reading/Writing", "Kinesthetic"]
        for i in range(1, 16):
            username = f"mentee{i}"
            email = f"mentee{i}@student.buksu.edu.ph"
            first, last, gender = MENTEE_NAMES[i - 1]

            user = self._create_base_user(
                username=username,
                email=email,
                password=username,
                first_name=first,
                last_name=last,
                is_staff=False,
            )

            UserProfile.objects.create(
                user=user,
                role=UserProfile.ROLE_MENTEE,
                approval_status=UserProfile.STATUS_ACTIVE,
                is_onboarded=True,
                campus="Main",
                program="BSIT",
                year_level=1,
                bio="1st Year BSIT student eager to learn and grow in IT.",
            )

            profile = MenteeProfile.objects.create(
                user=user,
                program="BSIT",
                year_level=1,
                campus="Main",
                student_id_no=f"2026-{1000 + i:04d}",
                contact_no=f"0917{rng.randint(1000000, 9999999)}",
                is_profile_complete=True,
                sex=gender,
                preferred_gender=rng.choice(["male", "female", "no_preference"]),
                preferred_learning_style=rng.choice(learning_styles),
                approved=True,
            )

            pref_stat = self._seed_preferences_and_availability(
                rng, user, profile, UserProfile.ROLE_MENTEE, curriculum_tax
            )

            stats["mentee_count"] += 1
            stats["mentee_competency_counts"].append(pref_stat["num_competencies"])
            stats["mentee_slot_counts"].append(pref_stat["num_slots"])
            stats["mentee_subject_counts"].append(pref_stat["num_subjects"])

        return stats

    def _print_summary(self, summary: Dict[str, Any]) -> None:
        """Print formatted terminal verification summary."""
        total_users = (
            summary["coordinator_count"]
            + summary["faculty_count"]
            + summary["student_mentor_count"]
            + summary["mentee_count"]
        )

        mentee_comps = summary["mentee_competency_counts"]
        mentor_comps = summary["mentor_competency_counts"]

        avg_mentee_comps = sum(mentee_comps) / len(mentee_comps) if mentee_comps else 0.0
        avg_mentor_comps = sum(mentor_comps) / len(mentor_comps) if mentor_comps else 0.0

        mentee_valid = all(1 <= c <= 5 for c in mentee_comps)
        mentor_valid = all(2 <= c <= 10 for c in mentor_comps)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write(self.style.SUCCESS("USER SEEDING & PREFERENCE VERIFICATION COMPLETED"))
        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write(f"  - Total Users Created:                 {total_users} (Expected: 46)")
        self.stdout.write(f"      * Coordinators:                    {summary['coordinator_count']}")
        self.stdout.write(f"      * Faculty Mentors:                 {summary['faculty_count']}")
        self.stdout.write(f"      * Student Mentors:                 {summary['student_mentor_count']}")
        self.stdout.write(f"      * Mentees:                         {summary['mentee_count']}")
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Rule Compliance Verification:"))

        # Mentee Competencies
        mentee_status = "PASS" if mentee_valid and 1.0 <= avg_mentee_comps <= 5.0 else "FAIL"
        mentee_style = self.style.SUCCESS if mentee_status == "PASS" else self.style.ERROR
        self.stdout.write(
            mentee_style(
                f"  [{mentee_status}] Mentee Competencies: "
                f"Average = {avg_mentee_comps:.2f} (Target: 1.0 - 5.0) | "
                f"Min = {min(mentee_comps)}, Max = {max(mentee_comps)} (Bound: [1, 5])"
            )
        )

        # Mentor Competencies
        mentor_status = "PASS" if mentor_valid and 2.0 <= avg_mentor_comps <= 10.0 else "FAIL"
        mentor_style = self.style.SUCCESS if mentor_status == "PASS" else self.style.ERROR
        self.stdout.write(
            mentor_style(
                f"  [{mentor_status}] Mentor Competencies: "
                f"Average = {avg_mentor_comps:.2f} (Target: 2.0 - 10.0) | "
                f"Min = {min(mentor_comps)}, Max = {max(mentor_comps)} (Bound: [2, 10])"
            )
        )

        # Mentee Subjects & Availability
        self.stdout.write(
            f"  - Mentee Subjects:                     "
            f"Min = {min(summary['mentee_subject_counts'])}, Max = {max(summary['mentee_subject_counts'])} (Bound: [1, 2])"
        )
        self.stdout.write(
            f"  - Mentee Availability Slots:           "
            f"Min = {min(summary['mentee_slot_counts'])}, Max = {max(summary['mentee_slot_counts'])} (Bound: [1, 4])"
        )

        # Mentor Subjects & Availability
        self.stdout.write(
            f"  - Mentor Subjects:                     "
            f"Min = {min(summary['mentor_subject_counts'])}, Max = {max(summary['mentor_subject_counts'])} (Bound: [1, 4])"
        )
        self.stdout.write(
            f"  - Mentor Availability Slots:           "
            f"Min = {min(summary['mentor_slot_counts'])}, Max = {max(summary['mentor_slot_counts'])} (Bound: [2, 6])"
        )

        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Sample Login Credentials:"))
        self.stdout.write("  [Coordinator]     coordinator1@buksu.edu.ph         password: coordinator1")
        self.stdout.write("  [Faculty Mentor]  mentor1@buksu.edu.ph              password: mentor1")
        self.stdout.write("  [Student Mentor]  mentor21@student.buksu.edu.ph     password: mentor21")
        self.stdout.write("  [Mentee]          mentee1@student.buksu.edu.ph      password: mentee1")

    def _reset_db_sequences(self) -> None:
        """Reset sequence counters for PostgreSQL/SQLite."""
        if connection.vendor not in ("postgresql", "mysql", "sqlite"):
            return
        try:
            from django.core.management.color import no_style
            models_to_reset = [
                User,
                UserProfile,
                UserSecurityState,
                MentorProfile,
                MenteeProfile,
                MentorCompetency,
                MenteeCompetencyNeed,
                UserTopicPreference,
            ]
            statements = connection.ops.sequence_reset_sql(no_style(), models_to_reset)
            with connection.cursor() as cursor:
                for statement in statements:
                    cursor.execute(statement)
        except Exception:
            pass

    def _verify_matching_engine(self) -> None:
        """Run a test recommendation to confirm feature vector extraction and matching."""
        test_email = "mentee1@student.buksu.edu.ph"
        try:
            mentee = MenteeProfile.objects.select_related("user").get(user__email=test_email)
            recommendations, meta = recommend_mentors_for_mentee_with_meta(mentee, limit=5)

            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING("XGBoost Matching Engine Verification Test:"))
            self.stdout.write(f"  Target Mentee: {mentee.user.email} ({get_user_display_name(mentee.user)})")
            self.stdout.write(f"  Struggling Subjects: {', '.join(mentee.subjects)}")
            self.stdout.write(f"  Target Topics: {', '.join(mentee.topics)}")
            self.stdout.write(f"  Competencies Needed: {', '.join(mentee.skills)}")
            self.stdout.write(f"  Availability: {', '.join(mentee.availability)}")

            if recommendations:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  Matched Top {len(recommendations)} Mentors (Algorithm: {meta.get('algorithm', 'XGBoost')}):"
                    )
                )
                for rank, (mentor, score) in enumerate(recommendations, start=1):
                    mentor_name = get_user_display_name(mentor.user)
                    confidence_pct = round(score * 100, 1)
                    shared_subj = set(mentee.subjects) & set(mentor.subjects)
                    self.stdout.write(
                        f"    {rank}. {mentor_name} <{mentor.user.email}> [{mentor.role}] "
                        f"- Score: {confidence_pct}% | Overlap Subjects: {', '.join(shared_subj) or 'General'}"
                    )
            else:
                self.stdout.write(self.style.WARNING(f"  No mentor matches found (Reason: {meta.get('empty_reason')})"))
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"  Verification check skipped: {exc}"))
