"""Django management command to safely restore a PeerLink backup.

Usage:
    python manage.py restore_system backups/peerlink_backup_20260922_084500.json.gz
    python manage.py restore_system peerlink_backup_20260922_084500.json.gz --no-input
"""

import gzip
import os
import shutil
import tempfile
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection


class Command(BaseCommand):
    help = "Safely restores the PeerLink database from a backup file (.json, .json.gz, .dump)."

    def add_arguments(self, parser):
        parser.add_argument(
            "backup_file",
            type=str,
            help="Path to the backup file or filename inside the backups/ folder.",
        )
        parser.add_argument(
            "--no-input",
            action="store_true",
            help="Skip the interactive confirmation prompt.",
        )

    def handle(self, *args, **options):
        file_arg = options["backup_file"].strip()
        backup_dir = getattr(settings, "BACKUP_DIR", None) or (Path(settings.BASE_DIR) / "backups")
        backup_dir = Path(backup_dir)

        # Resolve path
        path = Path(file_arg)
        if not path.is_file():
            path = backup_dir / file_arg
        if not path.is_file():
            raise CommandError(f"Backup file not found: {file_arg} (checked {path})")

        self.stdout.write(self.style.WARNING(f"\nTarget backup file: {path.name} ({path.stat().st_size / 1024:.1f} KB)"))
        self.stdout.write(
            self.style.ERROR(
                "WARNING: Restoring will completely overwrite existing records in the database."
            )
        )

        if not options.get("no_input"):
            confirm = input("Are you sure you want to proceed with this restore? Type 'yes' to confirm: ")
            if confirm.strip().lower() != "yes":
                self.stdout.write(self.style.NOTICE("Restore aborted by user."))
                return

        self.stdout.write(self.style.NOTICE("Flushing database tables..."))
        try:
            call_command("flush", interactive=False, verbosity=0)
        except Exception as e:
            raise CommandError(f"Failed to flush database tables: {e}")

        # Decompress if gzipped
        is_gzipped = path.name.endswith(".gz")
        tmp_dir = tempfile.mkdtemp(prefix="peerlink_restore_")
        target_fixture = path

        try:
            if is_gzipped:
                uncompressed_name = path.name[:-3]
                target_fixture = Path(tmp_dir) / uncompressed_name
                self.stdout.write(self.style.NOTICE(f"Decompressing {path.name}..."))
                with gzip.open(path, "rb") as f_in:
                    with open(target_fixture, "wb") as f_out:
                        shutil.copyfileobj(f_in, f_out)

            # Load fixture or dump
            if target_fixture.name.endswith(".json"):
                self.stdout.write(self.style.NOTICE("Loading database records via loaddata..."))
                call_command("loaddata", str(target_fixture), verbosity=1)
            elif target_fixture.suffix in (".dump", ".sql", ".psql"):
                self.stdout.write(self.style.NOTICE("Attempting dbrestore for binary/SQL dump..."))
                call_command("dbrestore", input_filename=str(target_fixture), interactive=False, verbosity=1)
            else:
                raise CommandError(f"Unsupported backup format: {target_fixture.suffix}")

            # Reset sequences for PostgreSQL
            self._reset_db_sequences()

            self.stdout.write(
                self.style.SUCCESS(
                    f"\n[OK] System restore completed successfully from {path.name}!\n"
                    f"     Database sequences synchronized. Users can now log in."
                )
            )

        except Exception as e:
            raise CommandError(f"Restore failed: {e}")
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def _reset_db_sequences(self):
        """Synchronize primary key sequences (critical for PostgreSQL to avoid ID collision)."""
        engine = settings.DATABASES.get("default", {}).get("ENGINE", "")
        if "postgresql" not in engine:
            return

        self.stdout.write(self.style.NOTICE("Synchronizing PostgreSQL primary key sequences..."))
        try:
            all_models = apps.get_models()
            sequence_sql = connection.ops.sequence_reset_sql(no_style(), all_models)
            if sequence_sql:
                with connection.cursor() as cursor:
                    for sql in sequence_sql:
                        cursor.execute(sql)
                self.stdout.write(self.style.SUCCESS("PostgreSQL sequences synchronized successfully."))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"Sequence reset notice: {e}"))
