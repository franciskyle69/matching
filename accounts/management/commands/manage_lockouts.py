"""
Management command to view and clear login lockouts.

Usage:
    python manage.py manage_lockouts --list                    # Show all locked accounts
    python manage.py manage_lockouts --unlock <user_id>        # Unlock specific user
    python manage.py manage_lockouts --clear-all               # Clear all lockouts
    python manage.py manage_lockouts --unlock-by-email <email> # Unlock by email
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from axes.models import AccessAttempt, AccessLog
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = "Manage login attempt lockouts (view and clear)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--list",
            action="store_true",
            help="List all locked accounts",
        )
        parser.add_argument(
            "--unlock",
            type=int,
            metavar="USER_ID",
            help="Unlock a specific user by ID",
        )
        parser.add_argument(
            "--unlock-by-email",
            type=str,
            metavar="EMAIL",
            help="Unlock a specific user by email",
        )
        parser.add_argument(
            "--clear-all",
            action="store_true",
            help="Clear all lockouts (use with caution)",
        )
        parser.add_argument(
            "--history",
            type=int,
            metavar="USER_ID",
            help="Show lockout history for a user",
        )

    def handle(self, *args, **options):
        if options["list"]:
            self.list_lockouts()
        elif options["unlock"]:
            self.unlock_user(user_id=options["unlock"])
        elif options["unlock_by_email"]:
            self.unlock_user(email=options["unlock_by_email"])
        elif options["clear_all"]:
            self.clear_all_lockouts()
        elif options["history"]:
            self.show_history(user_id=options["history"])
        else:
            self.stdout.write(
                self.style.WARNING("Please provide an action: --list, --unlock, --clear-all, or --history")
            )

    def list_lockouts(self):
        """List all currently locked accounts."""
        locked_attempts = AccessAttempt.objects.filter(locked=True)
        
        if not locked_attempts.exists():
            self.stdout.write(self.style.SUCCESS("✓ No locked accounts found."))
            return

        self.stdout.write(self.style.WARNING(f"\n📋 Found {locked_attempts.count()} locked account(s):\n"))
        
        for attempt in locked_attempts:
            user_info = f"User: {attempt.username}" if attempt.username else "Unknown user"
            ip_info = f" | IP: {attempt.ip_address}" if attempt.ip_address else ""
            failures = f" | Failures: {attempt.failures_since_start}"
            lock_time = attempt.locked_datetime.strftime("%Y-%m-%d %H:%M:%S") if attempt.locked_datetime else "Unknown"
            
            self.stdout.write(
                f"  • {user_info}{ip_info}{failures}\n"
                f"    Locked at: {lock_time}"
            )
        
        self.stdout.write("")

    def unlock_user(self, user_id=None, email=None):
        """Unlock a specific user."""
        try:
            if user_id:
                user = User.objects.get(id=user_id)
                query = {"username": user.username}
            elif email:
                user = User.objects.get(email=email)
                query = {"username": user.username}
            else:
                raise CommandError("Must provide either --unlock <id> or --unlock-by-email <email>")
            
            deleted_count, _ = AccessAttempt.objects.filter(**query, locked=True).delete()
            
            if deleted_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Unlocked user '{user.username}' (ID: {user.id})")
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f"⚠ User '{user.username}' was not locked.")
                )
        except User.DoesNotExist:
            if user_id:
                raise CommandError(f"User with ID {user_id} not found.")
            else:
                raise CommandError(f"User with email {email} not found.")

    def clear_all_lockouts(self):
        """Clear all lockouts (use with caution)."""
        self.stdout.write(
            self.style.WARNING(
                "⚠️  This will clear ALL login lockouts. Are you sure? (yes/no): "
            ),
            ending="",
        )
        response = input()
        
        if response.lower() != "yes":
            self.stdout.write(self.style.WARNING("Cancelled."))
            return

        deleted_count, _ = AccessAttempt.objects.filter(locked=True).delete()
        self.stdout.write(
            self.style.SUCCESS(f"✓ Cleared {deleted_count} lockout(s).")
        )

    def show_history(self, user_id):
        """Show lockout history for a user."""
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise CommandError(f"User with ID {user_id} not found.")

        logs = AccessLog.objects.filter(username=user.username).order_by("-attempt_time")[:20]
        
        if not logs.exists():
            self.stdout.write(f"No login history found for user '{user.username}'.")
            return

        self.stdout.write(self.style.WARNING(f"\n📜 Recent login attempts for '{user.username}':\n"))
        
        for log in logs:
            status = "✓ Success" if not log.failure_flag else "✗ Failed"
            time = log.attempt_time.strftime("%Y-%m-%d %H:%M:%S")
            ip = f" | IP: {log.ip_address}" if log.ip_address else ""
            
            self.stdout.write(f"  {status} at {time}{ip}\n")
        
        self.stdout.write("")
