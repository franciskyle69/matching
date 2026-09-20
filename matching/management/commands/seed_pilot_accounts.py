"""
Management command to seed realistic, diverse mentor and mentee accounts for pilot testing and defense.
Each account has distinct subjects, topics, difficulty levels (1-5), and expertise levels (1-5).
Aligned with BukSU AMU same-gender matching policy.
All accounts use the universal password: PeerLink@2026
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from django.utils import timezone
from allauth.account.models import EmailAddress
from accounts.models import UserProfile, UserSecurityState
from profiles.models import MentorProfile, MenteeProfile
from matching.models import Competency, MenteeMentorRequest, Notification

User = get_user_model()
UNIVERSAL_PASSWORD = "PeerLink@2026"

COORDINATOR_ACCOUNT = {
    "username": "coordinator.pilot",
    "email": "coordinator.pilot@peerlink.edu.ph",
    "first_name": "Dr. Grace",
    "last_name": "Hopper",
    "is_staff": True,
    "is_superuser": True,
}

MENTORS_DATA = [
    {
        "username": "mentor.prog.advanced",
        "email": "mentor.prog.advanced@peerlink.edu.ph",
        "first_name": "Mark",
        "last_name": "Dela Cruz",
        "role": "Senior IT Student",
        "account_role": UserProfile.ROLE_STUDENT_MENTOR,
        "year_level": 4,
        "expertise_level": 5,
        "years_experience": 3,
        "teaching_experience_years": 2,
        "gender": "male",
        "bio": "Senior IT student specializing in data structures, algorithms, and modular software architecture.",
        "subjects": ["Computer Programming", "Introduction to Computing"],
        "topics": ["Control Structures", "Data Structures", "Modular Programming", "Debugging & Execution"],
        "availability": ["Mon|09:00-11:00", "Wed|13:00-15:00", "Fri|13:00-15:00"],
    },
    {
        "username": "mentor.prog.beginner",
        "email": "mentor.prog.beginner@peerlink.edu.ph",
        "first_name": "Sarah",
        "last_name": "Jenkins",
        "role": "Senior IT Student",
        "account_role": UserProfile.ROLE_STUDENT_MENTOR,
        "year_level": 3,
        "expertise_level": 2,
        "years_experience": 1,
        "teaching_experience_years": 1,
        "gender": "female",
        "bio": "Patient peer tutor focused on helping 1st-year students overcome anxiety with basic logic, loops, and syntax.",
        "subjects": ["Computer Programming", "IT Fundamentals"],
        "topics": ["Control Structures", "Debugging & Execution", "Client-Side Scripting"],
        "availability": ["Tue|09:00-11:00", "Thu|09:00-11:00", "Sat|10:00-12:00"],
    },
    {
        "username": "mentor.hci.instructor",
        "email": "mentor.hci.instructor@peerlink.edu.ph",
        "first_name": "Alan",
        "last_name": "Turing",
        "role": "Instructor",
        "account_role": UserProfile.ROLE_INSTRUCTOR_MENTOR,
        "year_level": 4,
        "expertise_level": 5,
        "years_experience": 5,
        "teaching_experience_years": 4,
        "gender": "male",
        "bio": "AMU Instructor Mentor specializing in Human-Computer Interaction, cognitive modeling, and UI prototyping.",
        "subjects": ["Intro to Human Computer Interaction", "IT Fundamentals"],
        "topics": [
            "HCI Principles & Guidelines",
            "High-Fidelity Design & Documentation",
            "Interaction Design & Cognitive Models",
            "Prototyping & UI Tooling",
            "User Research & Behavioral Mapping",
        ],
        "availability": ["Mon|13:00-15:00", "Wed|13:00-15:00", "Fri|09:00-11:00"],
    },
    {
        "username": "mentor.systems.mid",
        "email": "mentor.systems.mid@peerlink.edu.ph",
        "first_name": "Bea",
        "last_name": "Alonzo",
        "role": "Senior IT Student",
        "account_role": UserProfile.ROLE_STUDENT_MENTOR,
        "year_level": 4,
        "expertise_level": 3,
        "years_experience": 2,
        "teaching_experience_years": 1,
        "gender": "female",
        "bio": "Passionate about computer systems, network protocols, operating system architectures, and hardware evolution.",
        "subjects": ["Introduction to Computing", "IT Fundamentals"],
        "topics": ["Computer Networks Basics", "Digital Logic & Data Representation", "Operating Systems & Architecture"],
        "availability": ["Mon|09:00-11:00", "Thu|13:00-15:00", "Fri|13:00-15:00"],
    },
    {
        "username": "mentor.math.advanced",
        "email": "mentor.math.advanced@peerlink.edu.ph",
        "first_name": "David",
        "last_name": "Santos",
        "role": "Senior IT Student",
        "account_role": UserProfile.ROLE_STUDENT_MENTOR,
        "year_level": 3,
        "expertise_level": 4,
        "years_experience": 2,
        "teaching_experience_years": 1,
        "gender": "male",
        "bio": "IT student with strong mathematics and analytical logic background. Enjoys breaking down complex proofs and logic.",
        "subjects": ["GE 105: Mathematics in the Modern World", "Introduction to Computing"],
        "topics": ["Digital Logic & Data Representation", "Operating Systems & Architecture"],
        "availability": ["Tue|13:00-15:00", "Wed|09:00-11:00", "Thu|09:00-11:00"],
    },
]

MENTEES_DATA = [
    {
        "username": "mentee.prog.beginner",
        "email": "mentee.prog.beginner@peerlink.edu.ph",
        "first_name": "Juanita",
        "last_name": "Gomez",
        "year_level": 1,
        "difficulty_level": 2,
        "sex": "female",
        "preferred_learning_style": "Visual & Hands-on Coding",
        "bio": "1st-year IT student struggling with if-statements, while loops, and debugging syntax errors.",
        "subjects": ["Computer Programming"],
        "topics": ["Control Structures", "Debugging & Execution"],
        "availability": ["Tue|09:00-11:00", "Thu|09:00-11:00"],
    },
    {
        "username": "mentee.prog.advanced",
        "email": "mentee.prog.advanced@peerlink.edu.ph",
        "first_name": "Christian",
        "last_name": "Reyes",
        "year_level": 2,
        "difficulty_level": 5,
        "sex": "male",
        "preferred_learning_style": "Deep Dive & Code Review",
        "bio": "2nd-year IT student preparing for competitive programming and advanced data structures.",
        "subjects": ["Computer Programming", "Introduction to Computing"],
        "topics": ["Data Structures", "Modular Programming", "Debugging & Execution"],
        "availability": ["Mon|09:00-11:00", "Wed|13:00-15:00"],
    },
    {
        "username": "mentee.hci.mid",
        "email": "mentee.hci.mid@peerlink.edu.ph",
        "first_name": "Kevin",
        "last_name": "Castro",
        "year_level": 2,
        "difficulty_level": 4,
        "sex": "male",
        "preferred_learning_style": "Interactive Critique & Guided Prototyping",
        "bio": "Aspiring UX/UI designer looking for guidance in heuristic evaluation and Figma wireframing.",
        "subjects": ["Intro to Human Computer Interaction"],
        "topics": ["Prototyping & UI Tooling", "HCI Principles & Guidelines", "User Research & Behavioral Mapping"],
        "availability": ["Mon|13:00-15:00", "Fri|09:00-11:00"],
    },
    {
        "username": "mentee.systems.mid",
        "email": "mentee.systems.mid@peerlink.edu.ph",
        "first_name": "Diana",
        "last_name": "Lim",
        "year_level": 1,
        "difficulty_level": 3,
        "sex": "female",
        "preferred_learning_style": "Practical Demonstrations & Lab Diagnostics",
        "bio": "Freshman IT student curious about networking subnetting, OSI model layers, and Linux CLI navigation.",
        "subjects": ["Introduction to Computing", "IT Fundamentals"],
        "topics": ["Computer Networks Basics", "Operating Systems & Architecture"],
        "availability": ["Mon|09:00-11:00", "Fri|13:00-15:00"],
    },
    {
        "username": "mentee.math.mid",
        "email": "mentee.math.mid@peerlink.edu.ph",
        "first_name": "Daniel",
        "last_name": "Ramos",
        "year_level": 1,
        "difficulty_level": 3,
        "sex": "male",
        "preferred_learning_style": "Step-by-Step Problem Sets",
        "bio": "Working to improve grade in Mathematics in the Modern World and propositional logic.",
        "subjects": ["GE 105: Mathematics in the Modern World"],
        "topics": ["Digital Logic & Data Representation"],
        "availability": ["Tue|13:00-15:00", "Thu|09:00-11:00"],
    },
]


class Command(BaseCommand):
    help = "Seed pilot testing accounts with diverse difficulties, expertise levels, and subject areas."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding pilot testing accounts for PeerLink..."))

        # 1. Seed Coordinator
        self._seed_coordinator()

        # 2. Seed Mentors
        for m_data in MENTORS_DATA:
            self._seed_mentor(m_data)

        # 3. Seed Mentees
        for m_data in MENTEES_DATA:
            self._seed_mentee(m_data)

        # 4. Seed Confirmed Actual Matches
        self._seed_actual_matches()

        self.stdout.write(self.style.SUCCESS("\n[SUCCESS] All pilot accounts and active matches have been seeded and verified!"))
        self.stdout.write(self.style.NOTICE(f"Universal Password for all accounts: {UNIVERSAL_PASSWORD}\n"))

    def _seed_coordinator(self):
        data = COORDINATOR_ACCOUNT
        user, _ = User.objects.get_or_create(username=data["username"], defaults={"email": data["email"]})
        user.first_name = data["first_name"]
        user.last_name = data["last_name"]
        user.email = data["email"]
        user.is_staff = data["is_staff"]
        user.is_superuser = data["is_superuser"]
        user.set_password(UNIVERSAL_PASSWORD)
        user.save()

        EmailAddress.objects.update_or_create(
            user=user,
            email=user.email,
            defaults={"verified": True, "primary": True},
        )
        UserSecurityState.objects.update_or_create(
            user=user,
            defaults={"must_change_password": False, "is_onboarded": True},
        )
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "role": UserProfile.ROLE_COORDINATOR,
                "approval_status": UserProfile.STATUS_ACTIVE,
                "is_onboarded": True,
                "is_email_verified": True,
                "program": "BSIT",
                "year_level": 4,
            },
        )
        self.stdout.write(f"  [COORDINATOR] {user.email} (Password: {UNIVERSAL_PASSWORD})")

    def _seed_mentor(self, data):
        user, _ = User.objects.get_or_create(username=data["username"], defaults={"email": data["email"]})
        user.first_name = data["first_name"]
        user.last_name = data["last_name"]
        user.email = data["email"]
        user.set_password(UNIVERSAL_PASSWORD)
        user.is_active = True
        user.save()

        EmailAddress.objects.update_or_create(
            user=user,
            email=user.email,
            defaults={"verified": True, "primary": True},
        )
        UserSecurityState.objects.update_or_create(
            user=user,
            defaults={"must_change_password": False, "is_onboarded": True},
        )
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "role": data["account_role"],
                "approval_status": UserProfile.STATUS_ACTIVE,
                "is_onboarded": True,
                "is_email_verified": True,
                "program": "BSIT",
                "year_level": data["year_level"],
            },
        )

        mentor_profile, _ = MentorProfile.objects.get_or_create(
            user=user,
            defaults={
                "program": "BSIT",
                "year_level": data["year_level"],
                "role": data["role"],
                "expertise_level": data["expertise_level"],
                "approved": True,
                "is_profile_complete": True,
            }
        )
        mentor_profile.program = "BSIT"
        mentor_profile.year_level = data["year_level"]
        mentor_profile.role = data["role"]
        mentor_profile.expertise_level = data["expertise_level"]
        mentor_profile.years_experience = data["years_experience"]
        mentor_profile.teaching_experience_years = data["teaching_experience_years"]
        mentor_profile.gender = data["gender"]
        mentor_profile.bio = data["bio"]
        mentor_profile.subjects = data["subjects"]
        mentor_profile.topics = data["topics"]
        mentor_profile.availability = data["availability"]
        mentor_profile.approved = True
        mentor_profile.is_profile_complete = True
        mentor_profile.capacity = 5
        mentor_profile.save()

        # Connect matching competencies
        comps = Competency.objects.filter(topic__name__in=data["topics"])
        mentor_profile.competencies.set(comps)

        self.stdout.write(
            f"  [MENTOR] {user.email} | Exp: {data['expertise_level']}/5 | {data['role']} | Focus: {', '.join(data['subjects'][:2])}"
        )
        return user

    def _seed_mentee(self, data):
        user, _ = User.objects.get_or_create(username=data["username"], defaults={"email": data["email"]})
        user.first_name = data["first_name"]
        user.last_name = data["last_name"]
        user.email = data["email"]
        user.set_password(UNIVERSAL_PASSWORD)
        user.is_active = True
        user.save()

        EmailAddress.objects.update_or_create(
            user=user,
            email=user.email,
            defaults={"verified": True, "primary": True},
        )
        UserSecurityState.objects.update_or_create(
            user=user,
            defaults={"must_change_password": False, "is_onboarded": True},
        )
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "role": UserProfile.ROLE_MENTEE,
                "approval_status": UserProfile.STATUS_ACTIVE,
                "is_onboarded": True,
                "is_email_verified": True,
                "program": "BSIT",
                "year_level": data["year_level"],
            },
        )

        mentee_profile, _ = MenteeProfile.objects.get_or_create(
            user=user,
            defaults={
                "program": "BSIT",
                "year_level": data["year_level"],
                "difficulty_level": data["difficulty_level"],
                "is_profile_complete": True,
            }
        )
        mentee_profile.program = "BSIT"
        mentee_profile.year_level = data["year_level"]
        mentee_profile.difficulty_level = data["difficulty_level"]
        mentee_profile.sex = data["sex"]
        mentee_profile.preferred_gender = "no_preference"
        mentee_profile.preferred_learning_style = data["preferred_learning_style"]
        mentee_profile.bio = data["bio"]
        mentee_profile.subjects = data["subjects"]
        mentee_profile.topics = data["topics"]
        mentee_profile.availability = data["availability"]
        mentee_profile.is_profile_complete = True
        mentee_profile.save()

        # Connect matching competencies
        comps = Competency.objects.filter(topic__name__in=data["topics"])
        mentee_profile.competencies.set(comps)

        self.stdout.write(
            f"  [MENTEE] {user.email} | Diff: {data['difficulty_level']}/5 | Focus: {', '.join(data['subjects'][:2])}"
        )
        return user

    def _seed_actual_matches(self):
        self.stdout.write(self.style.NOTICE("\nSetting up active confirmed pairings..."))

        # Pairings designed for defense demonstrations:
        # 1) Christian Reyes (Diff 5/5, Male) <-> Mark Dela Cruz (Exp 5/5, Senior Student Mentor)
        # 2) Kevin Castro (Diff 4/5, Male) <-> Alan Turing (Exp 5/5, Instructor Mentor)
        # Note: Juanita Gomez, Diana Lim, and Daniel Ramos remain unpaired for live matching demos!
        actual_pairings = [
            ("mentee.prog.advanced", "mentor.prog.advanced"),
            ("mentee.hci.mid", "mentor.hci.instructor"),
        ]

        for mentee_uname, mentor_uname in actual_pairings:
            try:
                mentee_user = User.objects.get(username=mentee_uname)
                mentor_user = User.objects.get(username=mentor_uname)
                mentee_prof = mentee_user.mentee_profile
                mentor_prof = mentor_user.mentor_profile

                req, created = MenteeMentorRequest.objects.get_or_create(
                    mentee=mentee_prof,
                    mentor=mentor_prof,
                )
                req.accepted = True
                if not req.accepted_at:
                    req.accepted_at = timezone.now()
                req.save()

                mentee_name = f"{mentee_user.first_name} {mentee_user.last_name}"
                mentor_name = f"{mentor_user.first_name} {mentor_user.last_name}"

                # Notifications for Mentor & Mentee
                Notification.objects.get_or_create(
                    user=mentor_user,
                    message=f"{mentee_name} has chosen you as a mentor. The pairing is now active.",
                    defaults={"action_tab": "matching"},
                )
                Notification.objects.get_or_create(
                    user=mentee_user,
                    message=f"You are now paired with {mentor_name}. Open Matching to view your mentor.",
                    defaults={"action_tab": "matching"},
                )

                # Notifications for Coordinator / Staff
                staff_users = User.objects.filter(is_staff=True, is_active=True)
                for staff in staff_users:
                    Notification.objects.get_or_create(
                        user=staff,
                        message=f"New match: {mentee_name} is now paired with {mentor_name}. Open Users to review the pairing.",
                        defaults={"action_tab": "users"},
                    )

                self.stdout.write(
                    f"  [ACTIVE MATCH] {mentee_name} ({mentee_user.email}) <==> {mentor_name} ({mentor_user.email})"
                )
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Failed pairing {mentee_uname} and {mentor_uname}: {e}"))

