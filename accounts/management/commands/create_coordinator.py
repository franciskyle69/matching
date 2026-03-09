from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Create an academic mentoring coordinator (staff) account. Coordinators can approve mentors/mentees, run matching, and manage subjects."

    def add_arguments(self, parser):
        parser.add_argument("username", type=str, help="Login username for the coordinator")
        parser.add_argument(
            "--email",
            type=str,
            default="",
            help="Email address (optional)",
        )
        parser.add_argument(
            "--password",
            type=str,
            default=None,
            help="Password (if not set, you will be prompted)",
        )
        parser.add_argument(
            "--no-input",
            action="store_true",
            help="Do not prompt for password; use --password or leave empty",
        )

    def handle(self, *args, **options):
        username = options["username"].strip()
        if not username:
            self.stderr.write(self.style.ERROR("Username is required."))
            return

        if User.objects.filter(username__iexact=username).exists():
            self.stderr.write(self.style.ERROR(f"A user with username '{username}' already exists."))
            return

        email = (options["email"] or "").strip()
        password = options["password"]

        if not options["no_input"] and password is None:
            from getpass import getpass
            password = getpass("Password: ")
            if not password:
                self.stderr.write(self.style.ERROR("Password cannot be empty."))
                return

        password = password or ""
        user = User.objects.create_user(
            username=username,
            email=email or f"{username}@example.com",
            password=password if password else None,
            is_staff=True,
            is_active=True,
        )
        if not password:
            user.set_unusable_password()
            user.save(update_fields=["password"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Coordinator account '{username}' created. They can log in at /app/ and will have access to approve mentors, run matching, and manage subjects."
            )
        )
