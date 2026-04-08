import random

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db.models import Q

from profiles.models import MentorProfile, MenteeProfile
from profiles.forms import SUBJECT_CHOICES, TOPIC_CHOICES, RATING_CHOICES, ROLE_CHOICES


class Command(BaseCommand):
    help = "Seed mentor/mentee demo accounts with realistic random full names."

    FIRST_NAMES = [
        "Nolan", "Mark", "Eve", "Allen", "Samantha", "Cecil", "Debbie", "William",
        "Logan", "Maya", "Jordan", "Avery", "Theo", "Iris", "Ethan", "Liam",
        "Noah", "Olivia", "Emma", "Sophia", "Amelia", "Lucas", "Mason", "Elijah",
        "Harper", "Mila", "Aria", "Scarlett", "Camila", "Gianna", "Benjamin", "James",
        "Henry", "Alexander", "Michael", "Daniel", "Sebastian", "Jack", "Aiden", "David",
        "Matthew", "Levi", "Julian", "Leo", "Asher", "Ezra", "Nova", "Willow",
        "Aurora", "Hazel", "Luna", "Violet", "Stella", "Zoey", "Grace", "Chloe",
    ]
    MIDDLE_NAMES = [
        "", "", "", "Lee", "James", "Marie", "Rose", "Anne", "Mae", "Ray", "Kai", "Alex",
        "Noel", "Jude", "Skye", "Reese", "Cole", "Blair", "Drew", "Lane",
    ]
    LAST_NAMES = [
        "Grayson", "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
        "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
        "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
        "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Walker", "Young",
        "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
        "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
        "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker",
    ]

    def _random_name_parts(self):
        first_name = random.choice(self.FIRST_NAMES)
        middle_name = random.choice(self.MIDDLE_NAMES)
        last_name = random.choice(self.LAST_NAMES)
        return first_name, middle_name, last_name

    def add_arguments(self, parser):
        parser.add_argument(
            "--mentors",
            type=int,
            default=50,
            help="Number of mentor accounts to create (default: 50).",
        )
        parser.add_argument(
            "--mentees",
            type=int,
            default=50,
            help="Number of mentee accounts to create (default: 50).",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing mentorN/menteeN demo users before seeding.",
        )

    def handle(self, *args, **options):
        mentor_count = options["mentors"]
        mentee_count = options["mentees"]

        created_mentors = 0
        created_mentees = 0

        if options["reset"]:
            # Delete existing demo users whose usernames match mentor<number> or mentee<number>.
            demo_users_qs = User.objects.filter(
                Q(username__regex=r"^mentor[0-9]+$") | Q(username__regex=r"^mentee[0-9]+$")
            )
            demo_count = demo_users_qs.count()
            if demo_count and username_table_exists:
                self.stdout.write(self.style.WARNING(f"Deleting {demo_count} existing demo user(s) (mentorN/menteeN)…"))
                demo_users_qs.delete()
            elif demo_count and not username_table_exists:
                self.stdout.write(self.style.WARNING(
                    "Skipping reset delete because related UserName table is missing in this database."
                ))
            else:
                self.stdout.write("No existing mentorN/menteeN demo users to delete.")

        # Precompute simple Python lists of labels/numeric ratings
        subject_labels = [value for (value, _label) in SUBJECT_CHOICES]
        topic_labels = [value for (value, _label) in TOPIC_CHOICES]
        rating_values = [val for (val, _label) in RATING_CHOICES]
        role_labels = [label for (label, _name) in ROLE_CHOICES]
        time_slots = [
            "08:00-10:00",
            "10:00-12:00",
            "13:00-15:00",
            "15:00-17:00",
            "18:00-20:00",
        ]

        # Seed mentors: mentor1..mentorN
        for i in range(1, mentor_count + 1):
            username = f"mentor{i}"
            first_name, middle_name, last_name = self._random_name_parts()
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@example.com",
                    "first_name": first_name,
                    "last_name": last_name,
                },
            )
            if not created:
                user.email = f"{username}@example.com"
                user.first_name = first_name
                user.last_name = last_name
            user.set_password(username)
            user.save()
            # Randomized but reasonable defaults so mentors look "real"
            subjects_sample = random.sample(subject_labels, k=1) if subject_labels else []
            topics_sample = random.sample(topic_labels, k=1) if topic_labels else []
            expertise = random.choice(rating_values) if rating_values else 3
            role = random.choice(role_labels) if role_labels else "Senior IT Student"
            gender = random.choice(["male", "female"])
            # Give each mentor 1–3 random time slots.
            mentor_slots = (
                random.sample(time_slots, k=random.randint(1, min(3, len(time_slots))))
                if time_slots
                else []
            )

            mentor_profile, _ = MentorProfile.objects.get_or_create(
                user=user,
                defaults={
                    "program": "BSIT",
                    "year_level": 4,
                    "gpa": None,
                    "avatar_url": "",
                    "skills": [],
                    "availability": mentor_slots,
                    "interests": "",
                    "capacity": 3,
                    "role": role,
                    "subjects": subjects_sample,
                    "topics": topics_sample,
                    "expertise_level": expertise,
                    "gender": gender,
                    "approved": True,
                },
            )
            created_mentors += 1
            full_name = " ".join(
                p for p in [first_name, middle_name, last_name] if p
            )
            self.stdout.write(self.style.SUCCESS(
                f"Created mentor user {username} ({full_name}) (id={user.id}, profile_id={mentor_profile.id})"
            ))

        # Seed mentees: mentee1..menteeN
        for i in range(1, mentee_count + 1):
            username = f"mentee{i}"
            first_name, middle_name, last_name = self._random_name_parts()
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": f"{username}@example.com",
                    "first_name": first_name,
                    "last_name": last_name,
                },
            )
            if not created:
                user.email = f"{username}@example.com"
                user.first_name = first_name
                user.last_name = last_name
            user.set_password(username)
            user.save()
            # Randomized mentee questionnaire answers so matching can run immediately
            mentee_subjects = random.sample(subject_labels, k=min(2, len(subject_labels))) if subject_labels else []
            mentee_topics = random.sample(topic_labels, k=min(3, len(topic_labels))) if topic_labels else []
            difficulty = random.choice(rating_values) if rating_values else 3
            sex = random.choice(["male", "female"])
            # Give each mentee 1–2 random time slots so some, but not all,
            # will overlap with mentors.
            mentee_slots = (
                random.sample(time_slots, k=random.randint(1, min(2, len(time_slots))))
                if time_slots
                else []
            )

            mentee_profile, _ = MenteeProfile.objects.get_or_create(
                user=user,
                defaults={
                    "program": "BSIT",
                    "year_level": 1,
                    "gpa": None,
                    "avatar_url": "",
                    "skills": [],
                    "availability": mentee_slots,
                    "interests": "",
                    "campus": "Main",
                    "student_id_no": f"S{i:05d}",
                    "contact_no": "",
                    "admission_type": "Regular",
                    "sex": sex,
                    "subjects": mentee_subjects,
                    "topics": mentee_topics,
                    "difficulty_level": difficulty,
                    "approved": True,
                },
            )
            created_mentees += 1
            full_name = " ".join(
                p for p in [first_name, middle_name, last_name] if p
            )
            self.stdout.write(self.style.SUCCESS(
                f"Created mentee user {username} ({full_name}) (id={user.id}, profile_id={mentee_profile.id})"
            ))

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Created {created_mentors} mentor(s) and {created_mentees} mentee(s)."
            )
        )

