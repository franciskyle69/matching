"""
Reset and seed the dashboard database with 46 BukSU accounts and mentoring preferences.

Usage:
    python manage.py seed_dashboard
    python manage.py seed_dashboard --no-reset
    python manage.py seed_dashboard --password 'override-for-all'
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from django.contrib.auth.models import User
from django.contrib.sessions.models import Session
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from accounts.models import UserSecurityState, get_user_display_name
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
    MAJOR_SUBJECT_NAMES,
    competencies_for_subjects,
    topics_for_competencies,
)

CAMPUSES = ("Main", "Malaybalay", "Guingona")
ADMISSION_TYPES = ("Regular", "Transferee", "Returnee")
LEARNING_STYLES = ("Visual", "Auditory", "Reading/Writing", "Kinesthetic")

DAY_LABELS = (
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
)
DAY_WIRE = {
    "Monday": "Mon",
    "Tuesday": "Tue",
    "Wednesday": "Wed",
    "Thursday": "Thu",
    "Friday": "Fri",
    "Saturday": "Sat",
}
TIME_RANGE_OPTIONS = (
    ("09:00", "11:00"),
    ("10:00", "12:00"),
    ("13:00", "15:00"),
    ("15:00", "17:00"),
    ("18:00", "20:00"),
)

# Bundles guarantee availability overlap for matching (wire format used by the app).
AVAILABILITY_BUNDLES = (
    ["Wed|10:00-12:00", "Fri|13:00-15:00"],
    ["Mon|09:00-11:00", "Thu|15:00-17:00"],
    ["Tue|10:00-12:00", "Wed|18:00-20:00"],
    ["Thu|13:00-15:00", "Sat|09:00-11:00"],
    ["Mon|15:00-17:00", "Fri|10:00-12:00"],
)

FEMALE_NAMES = [
    ("Heart", "Evangelista"),
    ("Kathryn", "Bernardo"),
    ("Liza", "Soberano"),
    ("Nadine", "Lustre"),
    ("Julia", "Barretto"),
    ("Francine", "Diaz"),
    ("Andrea", "Brillantes"),
    ("Belle", "Mariano"),
    ("Marian", "Rivera"),
    ("Anne", "Curtis"),
    ("Angel", "Locsin"),
    ("Bea", "Alonzo"),
    ("Kim", "Chiu"),
    ("Sarah", "Geronimo"),
    ("Erich", "Gonzales"),
    ("Maine", "Mendoza"),
    ("Gabbi", "Garcia"),
    ("Kyline", "Alcantara"),
    ("Lovi", "Poe"),
    ("Maja", "Salvador"),
    ("Janella", "Salvador"),
    ("Barbie", "Forteza"),
    ("Sharon", "Cuneta"),
    ("Judy", "Ann Santos"),
]

MALE_NAMES = [
    ("Piolo", "Pascual"),
    ("Dingdong", "Dantes"),
    ("Jericho", "Rosales"),
    ("Daniel", "Padilla"),
    ("Enrique", "Gil"),
    ("Joshua", "Garcia"),
    ("Donny", "Pangilinan"),
    ("Alden", "Richards"),
    ("Coco", "Martin"),
    ("Gerald", "Anderson"),
    ("Richard", "Gomez"),
    ("Ian", "Veneracion"),
    ("Paulo", "Avelino"),
    ("Dennis", "Trillo"),
    ("Carlo", "Aquino"),
    ("James", "Reid"),
    ("Xian", "Lim"),
    ("David", "Licauco"),
    ("Elijah", "Canlas"),
    ("Kokoy", "de Santos"),
    ("Zanjoe", "Marudo"),
    ("Jake", "Cuenca"),
]


@dataclass
class SeedAccount:
    first_name: str
    last_name: str
    email: str
    username: str
    role: str  # coordinator | faculty_mentor | student_mentor | mentee
    gender: str  # male | female
    id_no: str
    password: str = ""
    preferences: dict = field(default_factory=dict)


def account_password(email: str, override: str | None = None) -> str:
    """Password = email local-part (Django PBKDF2 via set_password)."""
    if override:
        return override
    return email.split("@")[0]


def _format_time_ampm(hhmm: str) -> str:
    hour, minute = (int(part) for part in hhmm.split(":"))
    suffix = "AM" if hour < 12 else "PM"
    display_hour = hour % 12 or 12
    return f"{display_hour}:{minute:02d} {suffix}"


def _availability_object(day: str, start: str, end: str) -> dict:
    """Rich slot metadata (for logs); DB stores wire strings for matching."""
    wire_day = DAY_WIRE[day]
    return {
        "day": day,
        "startTime": start,
        "endTime": end,
        "wire": f"{wire_day}|{start}-{end}",
        "label": f"{day} • {_format_time_ampm(start)} - {_format_time_ampm(end)}",
    }


def _pick_availability(rng: random.Random, bundle_index: int) -> tuple[list[str], list[dict]]:
    bundle = list(AVAILABILITY_BUNDLES[bundle_index % len(AVAILABILITY_BUNDLES)])
    extra_count = rng.randint(0, 2)
    wire_slots = list(bundle)
    rich_slots: list[dict] = []

    for wire in wire_slots:
        day_token, times = wire.split("|")
        start, end = times.split("-")
        day_label = next(label for label, token in DAY_WIRE.items() if token == day_token)
        rich_slots.append(_availability_object(day_label, start, end))

    for _ in range(extra_count):
        day = rng.choice(DAY_LABELS)
        start, end = rng.choice(TIME_RANGE_OPTIONS)
        obj = _availability_object(day, start, end)
        if obj["wire"] not in wire_slots:
            wire_slots.append(obj["wire"])
            rich_slots.append(obj)

    rng.shuffle(wire_slots)
    return wire_slots[: rng.randint(2, 4)], rich_slots[:4]


def _pick_subjects(rng: random.Random) -> list[str]:
    count = rng.randint(2, min(4, len(MAJOR_SUBJECT_NAMES)))
    return rng.sample(list(MAJOR_SUBJECT_NAMES), k=count)


def _pick_competencies(subjects: list[str], rng: random.Random) -> list[str]:
    pool = competencies_for_subjects(subjects)
    if not pool:
        return []
    count = rng.randint(3, min(5, len(pool)))
    return rng.sample(pool, k=count)


def _pick_mentee_support_level(rng: random.Random) -> int:
    return rng.choices([3, 4, 5], weights=[2, 3, 5], k=1)[0]


def _pick_mentor_support_level(rng: random.Random) -> int:
    return rng.randint(1, 5)


def _pick_contact(rng: random.Random, index: int) -> str:
    suffix = f"{index:07d}"[-7:]
    return f"09{suffix}"


class Command(BaseCommand):
    help = (
        "Wipe user data and seed 46 BukSU accounts with BSIT mentoring preferences "
        "for out-of-the-box matching."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-reset",
            action="store_true",
            help="Skip database wipe before seeding.",
        )
        parser.add_argument(
            "--password",
            type=str,
            default="",
            help="Optional single password override for every account.",
        )

    def handle(self, *args, **options):
        password_override = (options.get("password") or "").strip() or None
        rng = random.Random(20260902)

        if not options["no_reset"]:
            self._wipe_user_data()

        call_command("sync_competencies", verbosity=0)
        db_competencies = {
            competency.name: competency
            for competency in Competency.objects.select_related("topic__subject").all()
        }
        if not db_competencies:
            self.stdout.write(
                self.style.WARNING(
                    "No competencies in DB after sync. Run migrations first."
                )
            )

        accounts = self._build_account_plan()
        created_counts = {
            "coordinator": 0,
            "faculty_mentor": 0,
            "student_mentor": 0,
            "mentee": 0,
            "preference_profiles": 0,
        }

        with transaction.atomic():
            for index, account in enumerate(accounts):
                plain_password = account.password or account_password(
                    account.email, password_override
                )
                if account.role == "coordinator":
                    self._create_coordinator(account, plain_password)
                    created_counts["coordinator"] += 1
                elif account.role in ("faculty_mentor", "student_mentor"):
                    self._create_mentor(
                        account, plain_password, rng, db_competencies, index
                    )
                    created_counts[account.role] += 1
                    created_counts["preference_profiles"] += 1
                elif account.role == "mentee":
                    self._create_mentee(
                        account, plain_password, rng, db_competencies, index
                    )
                    created_counts["mentee"] += 1
                    created_counts["preference_profiles"] += 1

        self._print_summary(created_counts, password_override)
        self._print_match_readiness()

    def _build_account_plan(self) -> list[SeedAccount]:
        accounts: list[SeedAccount] = []
        faculty_seq = 101
        student_seq = 201
        mentee_seq = 301

        instructor_females = FEMALE_NAMES[1:11]
        instructor_males = MALE_NAMES[0:10]
        student_females = FEMALE_NAMES[11:16]
        student_males = MALE_NAMES[10:15]
        mentee_females = FEMALE_NAMES[16:24]
        mentee_males = MALE_NAMES[15:22]

        def add(
            first: str,
            last: str,
            *,
            role: str,
            gender: str,
            email: str,
            username: str,
            id_no: str,
        ) -> None:
            accounts.append(
                SeedAccount(
                    first_name=first,
                    last_name=last,
                    email=email,
                    username=username,
                    role=role,
                    gender=gender,
                    id_no=id_no,
                    password=account_password(email),
                )
            )

        coord_first, coord_last = FEMALE_NAMES[0]
        add(
            coord_first,
            coord_last,
            role="coordinator",
            gender="female",
            email="coordinator1@buksu.edu.ph",
            username="coordinator1",
            id_no=f"{faculty_seq:05d}",
        )
        faculty_seq += 1

        mentor_num = 1
        for first, last in instructor_females:
            add(
                first,
                last,
                role="faculty_mentor",
                gender="female",
                email=f"mentor{mentor_num}@buksu.edu.ph",
                username=f"mentor{mentor_num}",
                id_no=f"{faculty_seq:05d}",
            )
            faculty_seq += 1
            mentor_num += 1

        for first, last in instructor_males:
            add(
                first,
                last,
                role="faculty_mentor",
                gender="male",
                email=f"mentor{mentor_num}@buksu.edu.ph",
                username=f"mentor{mentor_num}",
                id_no=f"{faculty_seq:05d}",
            )
            faculty_seq += 1
            mentor_num += 1

        for first, last in student_females:
            add(
                first,
                last,
                role="student_mentor",
                gender="female",
                email=f"mentor{mentor_num}@student.buksu.edu.ph",
                username=f"mentor{mentor_num}",
                id_no=f"{student_seq:05d}",
            )
            student_seq += 1
            mentor_num += 1

        for first, last in student_males:
            add(
                first,
                last,
                role="student_mentor",
                gender="male",
                email=f"mentor{mentor_num}@student.buksu.edu.ph",
                username=f"mentor{mentor_num}",
                id_no=f"{student_seq:05d}",
            )
            student_seq += 1
            mentor_num += 1

        mentee_num = 1
        for first, last in mentee_females:
            add(
                first,
                last,
                role="mentee",
                gender="female",
                email=f"mentee{mentee_num}@student.buksu.edu.ph",
                username=f"mentee{mentee_num}",
                id_no=f"{mentee_seq:05d}",
            )
            mentee_seq += 1
            mentee_num += 1

        for first, last in mentee_males:
            add(
                first,
                last,
                role="mentee",
                gender="male",
                email=f"mentee{mentee_num}@student.buksu.edu.ph",
                username=f"mentee{mentee_num}",
                id_no=f"{mentee_seq:05d}",
            )
            mentee_seq += 1
            mentee_num += 1

        if len(accounts) != 46:
            raise RuntimeError(f"Expected 46 accounts, planned {len(accounts)}.")
        return accounts

    def _wipe_user_data(self) -> None:
        self.stdout.write(self.style.WARNING("Wiping existing user data and dependents…"))

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
        UserSecurityState.objects.all().delete()

        session_count = Session.objects.count()
        Session.objects.all().delete()

        user_count = User.objects.count()
        User.objects.all().delete()

        self._reset_sequences(
            [
                User,
                MentorProfile,
                MenteeProfile,
                MenteeMentorRequest,
                Notification,
                UserTopicPreference,
                UserPost,
                PostComment,
                Announcement,
                Comment,
                AuditLog,
                MentorCompetency,
                MenteeCompetencyNeed,
                VerificationDocument,
                UserSecurityState,
            ]
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Removed {user_count} user(s), {session_count} session(s), "
                "and related profile/match records."
            )
        )

    def _reset_sequences(self, models) -> None:
        if connection.vendor not in ("postgresql", "mysql", "sqlite"):
            return
        from django.core.management.color import no_style

        statements = connection.ops.sequence_reset_sql(no_style(), models)
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)

    def _create_user(self, account: SeedAccount, password: str, *, is_staff: bool = False) -> User:
        user = User.objects.create_user(
            username=account.username,
            email=account.email,
            password=password,
            first_name=account.first_name,
            last_name=account.last_name,
            is_active=True,
            is_staff=is_staff,
        )
        UserSecurityState.objects.get_or_create(
            user=user, defaults={"must_change_password": False}
        )
        return user

    def _create_coordinator(self, account: SeedAccount, password: str) -> None:
        user = self._create_user(account, password, is_staff=True)
        self.stdout.write(
            self.style.SUCCESS(
                f"Coordinator: {account.first_name} {account.last_name} "
                f"({account.email} / {password})"
            )
        )

    def _build_preferences(
        self,
        rng: random.Random,
        bundle_index: int,
        *,
        is_mentor: bool,
    ) -> dict:
        subjects = _pick_subjects(rng)
        competencies = _pick_competencies(subjects, rng)
        topics = topics_for_competencies(competencies)
        availability, availability_meta = _pick_availability(rng, bundle_index)
        support_level = (
            _pick_mentor_support_level(rng)
            if is_mentor
            else _pick_mentee_support_level(rng)
        )
        return {
            "subjects": subjects,
            "skills": competencies,
            "competencies": competencies,
            "topics": topics,
            "availability": availability,
            "availability_meta": availability_meta,
            "support_level": support_level,
        }

    def _assign_db_competencies(
        self,
        profile,
        rng: random.Random,
        level: int,
        *,
        is_mentor: bool,
        db_competencies: dict[str, Competency],
        competency_names: list[str],
    ) -> None:
        sample = [
            db_competencies[name]
            for name in competency_names
            if name in db_competencies
        ]
        if not sample:
            return
        profile.competencies.set(sample)
        if is_mentor:
            for competency in sample:
                MentorCompetency.objects.update_or_create(
                    mentor=profile,
                    competency=competency,
                    defaults={"proficiency_level": level},
                )
        else:
            for competency in sample:
                MenteeCompetencyNeed.objects.update_or_create(
                    mentee=profile,
                    competency=competency,
                    defaults={"need_level": level},
                )

    def _sync_topic_preferences(
        self,
        user: User,
        subjects: list[str],
        topics: list[str],
        *,
        target: str,
    ) -> None:
        subject_by_name = {
            subject.name: subject
            for subject in Subject.objects.filter(name__in=subjects)
        }
        topic_rows = Topic.objects.filter(
            name__in=topics, status=Topic.STATUS_ACTIVE
        ).select_related("subject")

        for topic in topic_rows:
            subject = subject_by_name.get(topic.subject.name)
            if not subject:
                continue
            UserTopicPreference.objects.get_or_create(
                user=user,
                subject=subject,
                topic=topic,
                target=target,
                defaults={"is_active_selection": True},
            )

    def _create_mentor(
        self,
        account: SeedAccount,
        password: str,
        rng: random.Random,
        db_competencies: dict[str, Competency],
        index: int,
    ) -> None:
        user = self._create_user(account, password, is_staff=False)
        is_faculty = account.role == "faculty_mentor"
        prefs = self._build_preferences(rng, index, is_mentor=True)
        account.preferences = prefs

        mentor_role = "Instructor" if is_faculty else "Senior IT Student"
        program = "Faculty / Staff" if is_faculty else "BSIT"
        year_level = 4 if is_faculty else rng.choice((3, 4))
        id_label = "Faculty ID" if is_faculty else "Student ID"

        profile = MentorProfile.objects.create(
            user=user,
            program=program,
            year_level=year_level,
            bio=(
                f"{account.first_name} mentors BSIT students. "
                f"{id_label}: {account.id_no}."
            )[:200],
            skills=prefs["competencies"],
            availability=prefs["availability"],
            interests=f"{id_label}: {account.id_no}",
            capacity=5,
            role=mentor_role,
            subjects=prefs["subjects"],
            topics=prefs["topics"],
            expertise_level=prefs["support_level"],
            gender=account.gender,
            years_experience=rng.randint(3, 15) if is_faculty else rng.randint(1, 3),
            teaching_experience_years=rng.randint(2, 12) if is_faculty else None,
            approved=True,
        )
        self._assign_db_competencies(
            profile,
            rng,
            prefs["support_level"],
            is_mentor=True,
            db_competencies=db_competencies,
            competency_names=prefs["competencies"],
        )
        self._sync_topic_preferences(
            user, prefs["subjects"], prefs["topics"], target="mentor"
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Mentor ({mentor_role}): {account.email} / {password} "
                f"| subjects={len(prefs['subjects'])} "
                f"| competencies={len(prefs['competencies'])} "
                f"| slots={len(prefs['availability'])} "
                f"| support={prefs['support_level']}"
            )
        )

    def _create_mentee(
        self,
        account: SeedAccount,
        password: str,
        rng: random.Random,
        db_competencies: dict[str, Competency],
        index: int,
    ) -> None:
        user = self._create_user(account, password, is_staff=False)
        prefs = self._build_preferences(rng, index, is_mentor=False)
        account.preferences = prefs

        profile = MenteeProfile.objects.create(
            user=user,
            program="BSIT",
            year_level=1,
            bio=(
                f"{account.first_name} is a 1st Year BSIT student at BukSU."
            )[:200],
            skills=prefs["competencies"],
            availability=prefs["availability"],
            interests="Peer mentoring, collaborative learning",
            campus=rng.choice(CAMPUSES),
            student_id_no=account.id_no,
            contact_no=_pick_contact(rng, index),
            admission_type=rng.choice(ADMISSION_TYPES),
            sex=account.gender,
            subjects=prefs["subjects"],
            topics=prefs["topics"],
            preferred_learning_style=rng.choice(LEARNING_STYLES),
            difficulty_level=prefs["support_level"],
            preferred_gender=rng.choice(("male", "female", "no_preference")),
            approved=True,
        )
        self._assign_db_competencies(
            profile,
            rng,
            prefs["support_level"],
            is_mentor=False,
            db_competencies=db_competencies,
            competency_names=prefs["competencies"],
        )
        self._sync_topic_preferences(
            user, prefs["subjects"], prefs["topics"], target="mentee"
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Mentee: {account.email} / {password} "
                f"| subjects={len(prefs['subjects'])} "
                f"| competencies={len(prefs['competencies'])} "
                f"| slots={len(prefs['availability'])} "
                f"| support={prefs['support_level']}"
            )
        )

    def _print_summary(self, created_counts: dict[str, int], password_override: str | None) -> None:
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Seed summary"))
        self.stdout.write("+" + "-" * 42 + "+" + "-" * 8 + "+")
        self.stdout.write(f"| {'Metric':<40} | {'Count':>6} |")
        self.stdout.write("+" + "-" * 42 + "+" + "-" * 8 + "+")
        rows = [
            ("User records created", User.objects.count()),
            ("Preference profiles (mentor + mentee)", created_counts["preference_profiles"]),
            ("Coordinator accounts", created_counts["coordinator"]),
            ("Faculty mentors", created_counts["faculty_mentor"]),
            ("Student mentors", created_counts["student_mentor"]),
            ("Mentee accounts", created_counts["mentee"]),
            ("Mentor profiles in DB", MentorProfile.objects.count()),
            ("Mentee profiles in DB", MenteeProfile.objects.count()),
            ("Major subjects", Subject.objects.filter(category="major").count()),
            ("Active topics", Topic.objects.filter(status=Topic.STATUS_ACTIVE).count()),
            ("Distinct competencies", Competency.objects.count()),
        ]
        for label, count in rows:
            self.stdout.write(f"| {label:<40} | {str(count):>6} |")
        self.stdout.write("+" + "-" * 42 + "+" + "-" * 8 + "+")

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Sample login credentials"))
        samples = [
            ("Coordinator", "coordinator1@buksu.edu.ph", account_password("coordinator1@buksu.edu.ph", password_override)),
            ("Faculty mentor", "mentor1@buksu.edu.ph", account_password("mentor1@buksu.edu.ph", password_override)),
            ("Student mentor", "mentor21@student.buksu.edu.ph", account_password("mentor21@student.buksu.edu.ph", password_override)),
            ("Mentee", "mentee1@student.buksu.edu.ph", account_password("mentee1@student.buksu.edu.ph", password_override)),
        ]
        for label, email, pwd in samples:
            self.stdout.write(f"  {label:<16} {email} / {pwd}")

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Seeded {User.objects.count()} users with "
                f"{created_counts['preference_profiles']} mentoring preference profiles."
            )
        )

    def _print_match_readiness(self) -> None:
        mentee_email = "mentee1@student.buksu.edu.ph"
        try:
            mentee = MenteeProfile.objects.select_related("user").prefetch_related(
                "competencies"
            ).get(user__email=mentee_email)
        except MenteeProfile.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Match test skipped: {mentee_email} not found."))
            return

        scored, meta = recommend_mentors_for_mentee_with_meta(mentee, limit=5)
        mentee_competencies = set(mentee.competencies.values_list("name", flat=True))

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("XGBoost match readiness test"))
        self.stdout.write(f"  Mentee: {mentee_email} ({get_user_display_name(mentee.user)})")
        self.stdout.write(f"  Subjects: {', '.join(mentee.subjects or [])}")
        self.stdout.write(f"  Topics: {', '.join(mentee.topics or [])}")
        self.stdout.write(f"  Competencies: {', '.join(sorted(mentee_competencies))}")
        self.stdout.write(f"  Availability: {', '.join(mentee.availability or [])}")

        if not scored:
            reason = meta.get("empty_reason") or "unknown"
            self.stdout.write(self.style.WARNING(f"  No recommendations ({reason})."))
            suggested = meta.get("suggested_time_slots") or []
            if suggested:
                self.stdout.write(f"  Suggested slots: {', '.join(suggested[:3])}")
            return

        self.stdout.write(self.style.SUCCESS("  Top 5 XGBoost mentor predictions:"))
        for rank, (mentor, score) in enumerate(scored, start=1):
            mentor_competencies = set(mentor.competencies.values_list("name", flat=True))
            shared = sorted(mentee_competencies & mentor_competencies)
            overlap_text = ", ".join(shared) if shared else "(no shared competencies)"
            confidence = max(0.0, min(1.0, float(score))) * 100.0
            self.stdout.write(
                f"    {rank}. {get_user_display_name(mentor.user)} "
                f"<{mentor.user.email}>  confidence={confidence:.1f}%  "
                f"shared competencies: {overlap_text}"
            )
