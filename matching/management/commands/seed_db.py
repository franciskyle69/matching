"""
Custom Django management command to wipe the database and reseed the curriculum,
users (46 total: 1 coordinator, 20 faculty mentors, 10 student mentors, 15 mentees),
and randomized preferences/availability for the BukSU mentorship matching system.

Usage:
    python manage.py seed_db
    python manage.py seed_db --seed 42
"""

from __future__ import annotations

import random
from typing import Any, Dict, List, Tuple

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
from profiles.subject_catalog import (
    SUBJECT_CATEGORY_GE,
    SUBJECT_CATEGORY_MAJOR,
    SUBJECT_CATEGORY_NSTP,
    SUBJECT_CATEGORY_PE,
)

# Canonical curriculum matrix definition (BSIT)
CURRICULUM_MATRIX: List[Dict[str, Any]] = [
    {
        "code": "IT 111",
        "name": "Introduction to Computing",
        "category": SUBJECT_CATEGORY_MAJOR,
        "description": "Introduction to Computing",
        "topics": [
            {
                "name": "History & Hardware Evolution",
                "competencies": [
                    ("Computing Generations", "Identify computing hardware generations and their capabilities."),
                    ("Processor Architecture", "Describe CPU components and how instructions are executed."),
                    ("Memory & Storage Types", "Differentiate primary memory from secondary storage technologies."),
                ],
            },
            {
                "name": "Digital Logic & Data Representation",
                "competencies": [
                    ("Binary/Octal/Hex Conversions", "Convert values among binary, octal, decimal, and hexadecimal."),
                    ("Boolean Logic Gates", "Apply AND, OR, NOT, NAND, NOR, and XOR in simple circuits."),
                    ("Data Encoding (ASCII/Unicode)", "Explain how characters are represented with ASCII and Unicode."),
                ],
            },
            {
                "name": "Operating Systems & Architecture",
                "competencies": [
                    ("OS Fundamentals", "Explain the role of an operating system in managing hardware and software."),
                    ("Process Management", "Describe processes, scheduling, and basic concurrency concepts."),
                    ("File Systems & Permissions", "Use file-system structures and permission models safely."),
                ],
            },
            {
                "name": "Computer Networks Basics",
                "competencies": [
                    ("Network Topologies", "Compare common physical and logical network topologies."),
                    ("OSI Model Layers", "Map networking tasks to the OSI reference model."),
                    ("Client-Server Architecture", "Explain request-response roles in client-server systems."),
                ],
            },
        ],
    },
    {
        "code": "IT 112",
        "name": "Computer Programming",
        "category": SUBJECT_CATEGORY_MAJOR,
        "description": "Computer Programming",
        "topics": [
            {
                "name": "Control Structures",
                "competencies": [
                    ("Loop Control", "Use for, while, and loop-control statements correctly."),
                    ("Conditional Logic", "Write branching logic with if/else and related operators."),
                    ("Iteration Patterns", "Choose iteration patterns that match the problem being solved."),
                ],
            },
            {
                "name": "Data Structures",
                "competencies": [
                    ("Array Creation", "Declare and initialize one-dimensional arrays."),
                    ("1D/2D Manipulation", "Read, update, and traverse 1D and 2D arrays."),
                    ("Linear/Binary Searching", "Implement linear and binary search on ordered data."),
                    ("Basic Sorting Algorithms", "Apply introductory sorting algorithms such as bubble or selection sort."),
                ],
            },
            {
                "name": "Modular Programming",
                "competencies": [
                    ("Function Definitions", "Define reusable functions with a clear purpose."),
                    ("Parameters & Return Values", "Pass arguments and return results from functions."),
                    ("Variable Scope & Lifetime", "Distinguish local, parameter, and global variable lifetimes."),
                ],
            },
            {
                "name": "Debugging & Execution",
                "competencies": [
                    ("Syntax Errors", "Locate and correct syntax errors before a program runs."),
                    ("Logic Troubleshooting", "Trace incorrect program behavior to a logical cause."),
                    ("Console Debugging Techniques", "Use print statements and console tools to inspect runtime state."),
                ],
            },
        ],
    },
    {
        "code": "IT 113",
        "name": "IT Fundamentals",
        "category": SUBJECT_CATEGORY_MAJOR,
        "description": "IT Fundamentals",
        "topics": [
            {
                "name": "Web Markup",
                "competencies": [
                    ("HTML5 Semantic Elements", "Structure pages with HTML5 semantic tags."),
                    ("Forms & Inputs", "Build forms with appropriate input types and labels."),
                    ("Media & Tables", "Embed media and present tabular data accessibly."),
                ],
            },
            {
                "name": "Web Styling",
                "competencies": [
                    ("CSS Selectors", "Target elements using classes, IDs, and combinators."),
                    ("Box Model", "Apply margin, border, padding, and content sizing."),
                    ("Flexbox & Grid", "Build one- and two-dimensional layouts with Flexbox and Grid."),
                    ("Responsive Layouts", "Adapt layouts across common viewport sizes."),
                ],
            },
            {
                "name": "Client-Side Scripting",
                "competencies": [
                    ("JavaScript Syntax", "Use variables, types, and operators in JavaScript."),
                    ("DOM Manipulation", "Read and update page elements from JavaScript."),
                    ("Event Listeners", "Respond to user events such as click and input."),
                ],
            },
            {
                "name": "Command Line & Web Infra",
                "competencies": [
                    ("CLI Navigation", "Navigate directories and run basic command-line tools."),
                    ("Domain Name System (DNS)", "Explain how domain names resolve to hosts."),
                    ("HTTP Request Methods", "Distinguish GET, POST, PUT, PATCH, and DELETE."),
                ],
            },
        ],
    },
    {
        "code": "IT 115",
        "name": "Intro to Human Computer Interaction",
        "category": SUBJECT_CATEGORY_MAJOR,
        "description": "Intro to Human Computer Interaction",
        "topics": [
            {
                "name": "HCI Principles & Guidelines",
                "competencies": [
                    ("HCI Principles & Paradigms", "Apply core HCI principles and interaction paradigms."),
                    ("Guideline Categories of HCI", "Use established HCI guideline categories in critiques."),
                    ("System Prototype Proposal", "Write a focused proposal for an interactive system prototype."),
                ],
            },
            {
                "name": "Interaction Design & Cognitive Models",
                "competencies": [
                    ("Interaction Design Frameworks", "Select interaction-design frameworks for a given problem."),
                    ("Human Information Processing", "Relate interface decisions to human information processing."),
                ],
            },
            {
                "name": "User Research & Behavioral Mapping",
                "competencies": [
                    ("User Research & Analysis", "Plan and synthesize user research for design decisions."),
                    ("Customer Journey Mapping", "Map customer journeys across touchpoints."),
                    ("User Flow Diagrams", "Draw user flows that capture key tasks and decision points."),
                ],
            },
            {
                "name": "Prototyping & UI Tooling",
                "competencies": [
                    ("Wireframe Sketching", "Sketch low-fidelity wireframes before visual design."),
                    ("Figma UI Design", "Build interface screens in Figma."),
                    ("Design System & Components", "Reuse components from a consistent design system."),
                ],
            },
            {
                "name": "High-Fidelity Design & Documentation",
                "competencies": [
                    ("High-Fidelity Prototyping", "Produce interactive high-fidelity prototypes."),
                    ("Design Systems Documentation", "Document tokens, components, and usage rules."),
                ],
            },
        ],
    },
]

ADDITIONAL_CATALOG_SUBJECTS: List[Dict[str, str]] = [
    {"name": "GE 108: Understanding the Self", "code": "GE 108", "category": SUBJECT_CATEGORY_GE},
    {"name": "GE 104: Readings in Philippine History", "code": "GE 104", "category": SUBJECT_CATEGORY_GE},
    {"name": "GE EL 108: Philippine Indigenous Communities", "code": "GE EL 108", "category": SUBJECT_CATEGORY_GE},
    {"name": "GE 105: Mathematics in the Modern World", "code": "GE 105", "category": SUBJECT_CATEGORY_GE},
    {"name": "NSTP 1: Civic Welfare Training Service", "code": "NSTP 1", "category": SUBJECT_CATEGORY_NSTP},
    {"name": "NSTP 2: Civic Welfare Training Service", "code": "NSTP 2", "category": SUBJECT_CATEGORY_NSTP},
    {"name": "PE 1: PATH FIT 1 - Movement Enhancement", "code": "PE 1", "category": SUBJECT_CATEGORY_PE},
    {"name": "PE 2: PATH FIT 2 - Fitness Exercises", "code": "PE 2", "category": SUBJECT_CATEGORY_PE},
]

DAY_CHOICES = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
TIME_BLOCKS = (
    ("08:00", "10:00"),
    ("10:00", "12:00"),
    ("13:00", "15:00"),
    ("15:00", "17:00"),
    ("18:00", "20:00"),
)


# Filipino name pool for rich presentation
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
        "Wipe existing records and reseed curriculum, users, and randomized preferences "
        "for the BukSU BSIT mentorship system."
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

        self.stdout.write(self.style.MIGRATE_HEADING("=== Mentorship System Database Seeder ==="))
        self.stdout.write(f"Using random seed: {seed_value}")

        with transaction.atomic():
            self._wipe_database()
            created_subjects, created_topics, created_competencies = self._seed_curriculum()
            users_summary = self._seed_users_and_preferences(rng, created_subjects, created_competencies)

        self._reset_db_sequences()
        cache.clear()

        # Detailed success output
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("DATABASE RESEEDING COMPLETED SUCCESSFULLY!"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS(f"  - Major Subjects created:        {len(CURRICULUM_MATRIX)}"))
        self.stdout.write(self.style.SUCCESS(f"  - Total Subjects in catalog:     {created_subjects['total_count']}"))
        self.stdout.write(self.style.SUCCESS(f"  - Active Topics created:         {created_topics['count']}"))
        self.stdout.write(self.style.SUCCESS(f"  - Competencies created:          {created_competencies['count']}"))
        self.stdout.write(self.style.SUCCESS(f"  - Total Users created:           {users_summary['total_users']}"))
        self.stdout.write(self.style.SUCCESS(f"      * Coordinators:              {users_summary['coordinator']}"))
        self.stdout.write(self.style.SUCCESS(f"      * Faculty Mentors:           {users_summary['faculty_mentors']}"))
        self.stdout.write(self.style.SUCCESS(f"      * Student Mentors:           {users_summary['student_mentors']}"))
        self.stdout.write(self.style.SUCCESS(f"      * Mentees:                   {users_summary['mentees']}"))
        self.stdout.write(self.style.SUCCESS(f"  - Active Preference Profiles:    {users_summary['profiles_count']}"))
        self.stdout.write(self.style.SUCCESS("=" * 60))

        # Sample Credentials
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Sample Login Credentials:"))
        self.stdout.write("  [Coordinator]     coordinator1@buksu.edu.ph         password: coordinator1")
        self.stdout.write("  [Faculty Mentor]  mentor1@buksu.edu.ph              password: mentor1")
        self.stdout.write("  [Student Mentor]  mentor21@student.buksu.edu.ph     password: mentor21")
        self.stdout.write("  [Mentee]          mentee1@student.buksu.edu.ph      password: mentee1")

        # Verify XGBoost matching engine readiness
        self._verify_matching_engine()

    def _wipe_database(self) -> None:
        """Wipe database records in correct order to prevent foreign key errors."""
        self.stdout.write(self.style.WARNING("1. Cleaning up database records..."))

        # Dependent and relational models first
        PostComment.objects.all().delete()
        UserPost.objects.all().delete()
        Comment.objects.all().delete()
        AnnouncementRecipient.objects.all().delete()
        Announcement.objects.all().delete()
        MenteeMentorRequest.objects.all().delete()
        MatchingDatasetTopic.objects.all().delete()
        MatchingDatasetRecord.objects.all().delete()
        Notification.objects.all().delete()
        UserTopicPreference.objects.all().delete()
        AuditLog.objects.all().delete()
        MentorCompetency.objects.all().delete()
        MenteeCompetencyNeed.objects.all().delete()
        VerificationDocument.objects.all().delete()
        MentorDocument.objects.all().delete()

        # Clear M2M intermediate relations
        for model in (MentorProfile, MenteeProfile, UserProfile):
            for field in model._meta.many_to_many:
                try:
                    field.remote_field.through.objects.all().delete()
                except Exception:
                    pass

        # Profiles and Security State
        UserProfile.objects.all().delete()
        UserSecurityState.objects.all().delete()
        MentorProfile.objects.all().delete()
        MenteeProfile.objects.all().delete()

        # Sessions & Axes rate limit logs
        Session.objects.all().delete()
        try:
            from axes.models import AccessAttempt, AccessFailureLog, AccessLog
            AccessAttempt.objects.all().delete()
            AccessFailureLog.objects.all().delete()
            AccessLog.objects.all().delete()
        except Exception:
            pass

        # Allauth EmailAddress
        try:
            from allauth.account.models import EmailAddress, EmailConfirmation
            EmailConfirmation.objects.all().delete()
            EmailAddress.objects.all().delete()
        except Exception:
            pass

        # Wipe Users (cascades any remaining user references)
        user_deleted_count, _ = User.objects.all().delete()

        # Wipe Curriculum
        Competency.objects.all().delete()
        Topic.objects.all().delete()
        Subject.objects.all().delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"   Cleaned all User records ({user_deleted_count} deleted), dependencies, "
                "and existing curriculum records."
            )
        )

    def _seed_curriculum(self) -> Tuple[Dict[str, Any], Dict[str, int], Dict[str, Any]]:
        """Seed the canonical non-overlapping BSIT curriculum matrix and subject catalog."""
        self.stdout.write(self.style.WARNING("2. Seeding clean BSIT curriculum matrix..."))

        major_subjects: Dict[str, Subject] = {}
        all_subjects_count = 0

        # Create major BSIT subjects
        for item in CURRICULUM_MATRIX:
            subj = Subject.objects.create(
                code=item["code"],
                name=item["name"],
                category=item["category"],
                description=item.get("description", ""),
            )
            major_subjects[item["code"]] = subj
            major_subjects[item["name"]] = subj
            all_subjects_count += 1

        # Create GE, NSTP, and PE catalog subjects
        for item in ADDITIONAL_CATALOG_SUBJECTS:
            Subject.objects.create(
                code=item["code"],
                name=item["name"],
                category=item["category"],
                description=item.get("name", ""),
            )
            all_subjects_count += 1

        topic_count = 0
        competency_count = 0
        competencies_by_subject: Dict[str, List[Competency]] = {}
        all_competencies_list: List[Competency] = []

        for item in CURRICULUM_MATRIX:
            subject_obj = major_subjects[item["code"]]
            competencies_by_subject[subject_obj.name] = []

            for topic_data in item["topics"]:
                topic_obj = Topic.objects.create(
                    subject=subject_obj,
                    name=topic_data["name"],
                    status=Topic.STATUS_ACTIVE,
                )
                topic_count += 1

                for comp_name, comp_desc in topic_data["competencies"]:
                    comp_obj = Competency.objects.create(
                        topic=topic_obj,
                        name=comp_name,
                        description=comp_desc,
                    )
                    competency_count += 1
                    competencies_by_subject[subject_obj.name].append(comp_obj)
                    all_competencies_list.append(comp_obj)

        self.stdout.write(
            self.style.SUCCESS(
                f"   Created {len(CURRICULUM_MATRIX)} BSIT major subjects ({all_subjects_count} total in catalog), "
                f"{topic_count} topics, and {competency_count} distinct competencies."
            )
        )

        return (
            {
                "major_subjects": [major_subjects[item["code"]] for item in CURRICULUM_MATRIX],
                "by_name": major_subjects,
                "total_count": all_subjects_count,
            },
            {"count": topic_count},
            {
                "count": competency_count,
                "by_subject": competencies_by_subject,
                "all": all_competencies_list,
            },
        )

    def _generate_availability_slots(self, rng: random.Random, min_slots: int = 2, max_slots: int = 4) -> List[str]:
        """Generate non-overlapping availability slots in wire format 'Day|Start-End'."""
        count = rng.randint(min_slots, max_slots)
        slots_pool = [
            f"{day}|{start}-{end}"
            for day in DAY_CHOICES
            for start, end in TIME_BLOCKS
        ]
        return sorted(rng.sample(slots_pool, k=min(count, len(slots_pool))))


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
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_active=True,
            is_staff=is_staff,
        )

        # Mark security state as onboarded with no force password change
        UserSecurityState.objects.update_or_create(
            user=user,
            defaults={
                "is_onboarded": True,
                "must_change_password": False,
            },
        )

        # Mark email as verified in allauth if installed
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

    def _seed_users_and_preferences(
        self,
        rng: random.Random,
        created_subjects: Dict[str, Any],
        created_competencies: Dict[str, Any],
    ) -> Dict[str, int]:
        """Seed 46 accounts and assign randomized preferences/availability."""
        self.stdout.write(self.style.WARNING("3. Seeding users (46 total) and randomized preferences..."))

        major_subjects_list: List[Subject] = created_subjects["major_subjects"]
        competencies_by_subject: Dict[str, List[Competency]] = created_competencies["by_subject"]

        coordinator_count = 0
        faculty_mentor_count = 0
        student_mentor_count = 0
        mentee_count = 0
        profiles_count = 0

        # -------------------------------------------------------------
        # 1 Coordinator: coordinator1@buksu.edu.ph
        # -------------------------------------------------------------
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
            is_email_verified=True,
            campus="Main",
            program="BSIT",
            bio="BSIT Program Mentorship Coordinator.",
        )
        coordinator_count += 1

        # Helper to assign preferences & availability to a user
        def assign_preferences_and_availability(user: User, profile: Any, role: str) -> None:
            nonlocal profiles_count

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
                raise ValueError(f"Unsupported role: {role}")

            num_subjects = rng.randint(subj_min, min(subj_max, len(major_subjects_list)))
            chosen_subjects = rng.sample(major_subjects_list, k=num_subjects)

            chosen_competencies: List[Competency] = []
            for subj in chosen_subjects:
                subj_topics = list(Topic.objects.filter(subject=subj, status=Topic.STATUS_ACTIVE).order_by("name"))
                if not subj_topics:
                    continue
                num_topics = rng.randint(top_min, min(top_max, len(subj_topics)))
                chosen_topics_for_subj = rng.sample(subj_topics, k=num_topics)

                for top in chosen_topics_for_subj:
                    avail_comps = list(Competency.objects.filter(topic=top).order_by("name"))
                    if not avail_comps:
                        continue
                    num_comps = rng.randint(comp_min, min(comp_max, len(avail_comps)))
                    chosen_comps_for_top = rng.sample(avail_comps, k=num_comps)
                    chosen_competencies.extend(chosen_comps_for_top)

            if len(chosen_competencies) > global_max:
                chosen_competencies = chosen_competencies[:global_max]

            if len(chosen_competencies) < global_min:
                for subj in chosen_subjects:
                    if len(chosen_competencies) >= global_min:
                        break
                    for top in Topic.objects.filter(subject=subj, status=Topic.STATUS_ACTIVE):
                        if len(chosen_competencies) >= global_min:
                            break
                        for comp in Competency.objects.filter(topic=top):
                            if comp not in chosen_competencies:
                                chosen_competencies.append(comp)
                                if len(chosen_competencies) >= global_min:
                                    break

            unique_topics = list({c.topic for c in chosen_competencies})
            active_subjects = list({t.subject for t in unique_topics})

            availability_slots = self._generate_availability_slots(rng, slot_min, slot_max)
            overall_rating = rng.randint(1, 5)

            profile.subjects = [s.name for s in active_subjects]
            profile.topics = [t.name for t in unique_topics]
            profile.skills = [c.name for c in chosen_competencies]
            profile.availability = availability_slots

            if role == UserProfile.ROLE_MENTEE:
                profile.difficulty_level = overall_rating
                profile.save()
                profile.competencies.set(chosen_competencies)

                for comp in chosen_competencies:
                    MenteeCompetencyNeed.objects.create(
                        mentee=profile,
                        competency=comp,
                        need_level=rng.randint(1, 5),
                    )
            else:
                profile.expertise_level = overall_rating
                profile.save()
                profile.competencies.set(chosen_competencies)

                for comp in chosen_competencies:
                    MentorCompetency.objects.create(
                        mentor=profile,
                        competency=comp,
                        proficiency_level=rng.randint(1, 5),
                    )

            for topic in unique_topics:
                UserTopicPreference.objects.create(
                    user=user,
                    subject=topic.subject,
                    topic=topic,
                    target=target,
                    is_active_selection=True,
                )

            profiles_count += 1

        # -------------------------------------------------------------
        # 20 Faculty Mentors: mentor1@buksu.edu.ph to mentor20@buksu.edu.ph
        # -------------------------------------------------------------
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
                is_email_verified=True,
                campus="Main",
                program="BSIT",
                bio=f"Faculty mentor in Information Technology at BukSU Main Campus.",
            )

            mentor_profile = MentorProfile.objects.create(
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

            assign_preferences_and_availability(user, mentor_profile, UserProfile.ROLE_INSTRUCTOR_MENTOR)
            faculty_mentor_count += 1

        # -------------------------------------------------------------
        # 10 Student Mentors: mentor21@student.buksu.edu.ph to mentor30@student.buksu.edu.ph
        # -------------------------------------------------------------
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
                is_email_verified=True,
                campus="Main",
                program="BSIT",
                year_level=year,
                bio=f"Senior peer mentor ({year}th Year BSIT) at BukSU Main Campus.",
            )

            mentor_profile = MentorProfile.objects.create(
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

            assign_preferences_and_availability(user, mentor_profile, UserProfile.ROLE_STUDENT_MENTOR)
            student_mentor_count += 1

        # -------------------------------------------------------------
        # 15 Mentees: mentee1@student.buksu.edu.ph to mentee15@student.buksu.edu.ph
        # -------------------------------------------------------------
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
                is_email_verified=True,
                campus="Main",
                program="BSIT",
                year_level=1,
                bio=f"1st Year BSIT student eager to learn and grow in IT.",
            )

            mentee_profile = MenteeProfile.objects.create(
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

            assign_preferences_and_availability(user, mentee_profile, UserProfile.ROLE_MENTEE)
            mentee_count += 1


        total_users = coordinator_count + faculty_mentor_count + student_mentor_count + mentee_count

        return {
            "total_users": total_users,
            "coordinator": coordinator_count,
            "faculty_mentors": faculty_mentor_count,
            "student_mentors": student_mentor_count,
            "mentees": mentee_count,
            "profiles_count": profiles_count,
        }

    def _reset_db_sequences(self) -> None:
        """Reset sequence counters for PostgreSQL/SQLite."""
        if connection.vendor not in ("postgresql", "mysql", "sqlite"):
            return
        try:
            from django.core.management.color import no_style
            models_to_reset = [
                User,
                Subject,
                Topic,
                Competency,
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
        """Run a test match recommendation with the XGBoost engine for mentee1."""
        test_email = "mentee1@student.buksu.edu.ph"
        try:
            mentee = MenteeProfile.objects.select_related("user").get(user__email=test_email)
            recommendations, meta = recommend_mentors_for_mentee_with_meta(mentee, limit=5)

            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING("XGBoost Matching Engine Verification Test:"))
            self.stdout.write(f"  Target Mentee: {mentee.user.email} ({get_user_display_name(mentee.user)})")
            self.stdout.write(f"  Struggling Subjects: {', '.join(mentee.subjects)}")
            self.stdout.write(f"  Target Topics: {', '.join(mentee.topics)}")
            self.stdout.write(f"  Availability: {', '.join(mentee.availability)}")

            if recommendations:
                self.stdout.write(self.style.SUCCESS(f"  Matched Top {len(recommendations)} Mentors (Algorithm: {meta.get('algorithm', 'XGBoost')}):"))
                for rank, (mentor, score) in enumerate(recommendations, start=1):
                    mentor_name = get_user_display_name(mentor.user)
                    confidence_pct = round(score * 100, 1)
                    shared_subj = set(mentee.subjects) & set(mentor.subjects)
                    self.stdout.write(
                        f"    {rank}. {mentor_name} <{mentor.user.email}> [{mentor.role}] "
                        f"- Confidence: {confidence_pct}% | Overlap Subjects: {', '.join(shared_subj) or 'General'}"
                    )
            else:
                self.stdout.write(self.style.WARNING(f"  No mentor matches found (Reason: {meta.get('empty_reason')})"))
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f"  Verification check skipped: {exc}"))
