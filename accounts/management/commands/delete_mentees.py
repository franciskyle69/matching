"""
Django management command to safely bulk-delete mentee user accounts.

Usage:
    # Preview targeted mentee accounts without deleting:
    python manage.py delete_mentees --dry-run

    # Interactive deletion with confirmation prompt:
    python manage.py delete_mentees

    # Automated / non-interactive deletion (for scripts and CI/CD):
    python manage.py delete_mentees --force
"""

from django.core.management.base import BaseCommand
from accounts.models import UserProfile
from accounts.services.account_cleanup import get_mentee_queryset, bulk_delete_mentees


class Command(BaseCommand):
    help = "Safely bulk-delete all user accounts with the 'mentee' role, cleaning up files and database relations."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate the deletion process: lists all targeted mentee accounts and prints the total count without deleting anything.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Bypass the interactive terminal confirmation prompt (useful for non-interactive scripts or Render jobs).",
        )
        parser.add_argument(
            "--skip-files",
            action="store_true",
            help="Skip remote Cloudinary and local media file deletion (database records only).",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        force = options.get("force", False)
        skip_files = options.get("skip_files", False)

        queryset = get_mentee_queryset()
        mentees = list(queryset)
        total_count = len(mentees)

        self.stdout.write(self.style.MIGRATE_HEADING("=" * 70))
        self.stdout.write(self.style.MIGRATE_HEADING(" BULK DELETE MENTEE ACCOUNTS MANAGEMENT UTILITY"))
        self.stdout.write(self.style.MIGRATE_HEADING("=" * 70))

        if total_count == 0:
            self.stdout.write(self.style.SUCCESS("No mentee accounts found in the database. Nothing to delete."))
            return

        # -------------------------------------------------------------
        # List targeted accounts
        # -------------------------------------------------------------
        self.stdout.write(
            self.style.WARNING(f"\nTargeted Mentee Accounts ({total_count} total):\n")
        )
        col_id = "ID"
        col_user = "Username"
        col_email = "Email"
        col_name = "Full Name"
        col_status = "Status"
        col_date = "Date Joined"

        header = f"{col_id:<6} | {col_user:<18} | {col_email:<26} | {col_name:<22} | {col_status:<10} | {col_date:<12}"
        self.stdout.write(header)
        self.stdout.write("-" * len(header))

        for u in mentees:
            profile = getattr(u, "profile", None)
            full_name = f"{u.first_name} {u.last_name}".strip() or "N/A"
            status = getattr(profile, "approval_status", "ACTIVE") if profile else "N/A"
            date_joined_str = u.date_joined.strftime("%Y-%m-%d") if u.date_joined else "N/A"
            u_email = (u.email or "N/A")[:25]
            u_name = (u.username or "")[:17]
            f_name = full_name[:21]

            row = f"{u.id:<6} | {u_name:<18} | {u_email:<26} | {f_name:<22} | {status:<10} | {date_joined_str:<12}"
            self.stdout.write(row)

        self.stdout.write("-" * len(header))
        self.stdout.write(f"Total targeted mentee accounts: {total_count}\n")

        # -------------------------------------------------------------
        # Dry Run Mode
        # -------------------------------------------------------------
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n[DRY RUN COMPLETE] Found {total_count} mentee account(s). "
                    "No database records, Cloudinary assets, or files were deleted."
                )
            )
            return

        # -------------------------------------------------------------
        # Interactive Confirmation Prompt
        # -------------------------------------------------------------
        if not force:
            self.stdout.write(
                self.style.ERROR(
                    "\nWARNING: This action is permanent! It will cascade and delete associated profiles,"
                    "\ntopic preferences, documents, application records, and remote Cloudinary files."
                )
            )
            prompt_message = f"Are you sure you want to permanently delete {total_count} mentee accounts? [y/N]: "
            try:
                confirm = input(prompt_message).strip().lower()
            except (KeyboardInterrupt, EOFError):
                self.stdout.write(self.style.WARNING("\nOperation cancelled."))
                return

            if confirm not in ("y", "yes"):
                self.stdout.write(self.style.WARNING("Operation cancelled by user. No accounts were deleted."))
                return

        # -------------------------------------------------------------
        # Execution
        # -------------------------------------------------------------
        self.stdout.write("\nStarting deletion process...")
        results = bulk_delete_mentees(queryset=mentees, delete_files=not skip_files)

        deleted_count = results["deleted_count"]
        failed_count = results["failed_count"]

        self.stdout.write("\nResults:")
        for res in results["results"]:
            if res["success"]:
                self.stdout.write(self.style.SUCCESS(f"  [OK] {res['message']}"))
            else:
                self.stdout.write(self.style.ERROR(f"  [FAILED] {res['message']}"))

        self.stdout.write(self.style.MIGRATE_HEADING("\n" + "=" * 70))
        if failed_count == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f" SUCCESS: Successfully deleted all {deleted_count} mentee account(s)."
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f" COMPLETED WITH ERRORS: {deleted_count} deleted, {failed_count} failed."
                )
            )
        self.stdout.write(self.style.MIGRATE_HEADING("=" * 70 + "\n"))
