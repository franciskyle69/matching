from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from profiles.models import MentorProfile, MenteeProfile


class Command(BaseCommand):
    help = "Reset demo accounts (mentorN/menteeN) with password=username."

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=50,
            help="How many mentors/mentees to create (default: 50).",
        )
        parser.add_argument(
            "--keep-existing",
            action="store_true",
            help="Do not delete existing demo users; only ensure passwords/profiles.",
        )

    def handle(self, *args, **options):
        User = get_user_model()
        n = max(1, int(options["count"] or 50))
        keep_existing = bool(options["keep_existing"])

        with transaction.atomic():
            if not keep_existing:
                # Avoid DB-level regex for SQLite portability.
                demo_ids = []
                for uname, uid in User.objects.filter(
                    username__startswith="mentor"
                ).values_list("username", "id"):
                    if uname[6:].isdigit():
                        demo_ids.append(uid)
                for uname, uid in User.objects.filter(
                    username__startswith="mentee"
                ).values_list("username", "id"):
                    if uname[5:].isdigit():
                        demo_ids.append(uid)
                if demo_ids:
                    User.objects.filter(id__in=demo_ids).delete()

            created_users = 0
            updated_users = 0

            for i in range(1, n + 1):
                username = f"mentor{i}"
                email = f"{username}@example.com"
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={"email": email, "is_staff": False, "is_active": True},
                )
                user.email = email
                user.is_active = True
                user.set_password(username)
                user.save()
                MentorProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "program": "BSIT",
                        "year_level": 4,
                        "approved": True,
                        "capacity": 3,
                        "skills": [],
                        "availability": ["08:00-10:00"],
                        "subjects": [],
                        "topics": [],
                        "expertise_level": 3,
                        "gender": "male",
                    },
                )
                created_users += 1 if created else 0
                updated_users += 0 if created else 1

            for i in range(1, n + 1):
                username = f"mentee{i}"
                email = f"{username}@example.com"
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={"email": email, "is_staff": False, "is_active": True},
                )
                user.email = email
                user.is_active = True
                user.set_password(username)
                user.save()
                MenteeProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "program": "BSIT",
                        "year_level": 1,
                        "approved": True,
                        "skills": [],
                        "availability": ["10:00-12:00"],
                        "subjects": [],
                        "topics": [],
                        "difficulty_level": 3,
                        "campus": "Main",
                        "student_id_no": f"S{i:05d}",
                        "contact_no": "",
                        "admission_type": "Regular",
                        "sex": "female",
                    },
                )
                created_users += 1 if created else 0
                updated_users += 0 if created else 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Users created: {created_users}, updated: {updated_users}. "
                f"Passwords are the same as username (e.g. mentee5/mentee5)."
            )
        )

