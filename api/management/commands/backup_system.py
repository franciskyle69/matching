"""Django management command to perform a full, reliable backup of the PeerLink system.

Usage:
    python manage.py backup_system
    python manage.py backup_system --output custom_backup.json.gz
    python manage.py backup_system --no-compress
    python manage.py backup_system --include-media
    python manage.py backup_system --keep 30
"""

import gzip
import io
import os
import shutil
import time
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Creates a full, portable, compressed backup of the PeerLink database and system data."

    def add_arguments(self, parser):
        parser.add_argument(
            "-o", "--output",
            type=str,
            help="Custom output filename or path. Defaults to backups/peerlink_backup_YYYYMMDD_HHMMSS.json.gz",
        )
        parser.add_argument(
            "--no-compress",
            action="store_true",
            help="Do not gzip the backup JSON fixture (saves as raw .json).",
        )
        parser.add_argument(
            "--include-media",
            action="store_true",
            help="Also create a zip archive of the media/ upload directory.",
        )
        parser.add_argument(
            "--keep",
            type=int,
            default=int(os.environ.get("DBBACKUP_CLEANUP_KEEP", "20")),
            help="Number of recent backups to keep in the backups directory (default: 20). Older backups are pruned.",
        )

    def handle(self, *args, **options):
        backup_dir = getattr(settings, "BACKUP_DIR", None) or (Path(settings.BASE_DIR) / "backups")
        backup_dir = Path(backup_dir)
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        no_compress = options.get("no_compress", False)

        if options.get("output"):
            out_arg = Path(options["output"])
            target_path = out_arg if out_arg.is_absolute() else (backup_dir / out_arg)
        else:
            extension = ".json" if no_compress else ".json.gz"
            target_path = backup_dir / f"peerlink_backup_{timestamp_str}{extension}"

        self.stdout.write(self.style.NOTICE(f"Starting backup at {datetime.now().isoformat()}..."))
        self.stdout.write(self.style.NOTICE("Extracting database records (excluding volatile contenttypes/sessions)..."))

        # Exclude volatile and auto-generated tables to prevent unique constraint conflicts on restore
        exclude_models = [
            "contenttypes",
            "auth.permission",
            "sessions.session",
            "axes.accessattempt",
            "axes.accesslog",
        ]

        buffer = io.StringIO()
        try:
            call_command(
                "dumpdata",
                stdout=buffer,
                exclude=exclude_models,
                natural_foreign=True,
                natural_primary=True,
                indent=2 if no_compress else None,
                verbosity=0,
            )
            raw_data = buffer.getvalue().encode("utf-8")
        except Exception as e:
            raise CommandError(f"Failed to dump database: {e}")

        raw_size = len(raw_data)
        if raw_size == 0:
            raise CommandError("Database dump resulted in 0 bytes. Aborting backup.")

        # Write out
        if target_path.name.endswith(".gz") or not no_compress:
            if not target_path.name.endswith(".gz"):
                target_path = target_path.with_name(f"{target_path.name}.gz")
            with gzip.open(target_path, "wb", compresslevel=9) as gz_out:
                gz_out.write(raw_data)
        else:
            target_path.write_bytes(raw_data)

        final_size = target_path.stat().st_size
        compression_ratio = (1.0 - (final_size / raw_size)) * 100 if raw_size > 0 else 0

        self.stdout.write(
            self.style.SUCCESS(
                f"[OK] Database backup saved: {target_path.name}\n"
                f"     Path: {target_path}\n"
                f"     Uncompressed: {raw_size / 1024:.1f} KB | Stored: {final_size / 1024:.1f} KB "
                f"({compression_ratio:.1f}% reduction)"
            )
        )

        # Optional media archive
        if options.get("include_media"):
            media_dir = Path(getattr(settings, "MEDIA_ROOT", settings.BASE_DIR / "media"))
            if media_dir.exists() and any(media_dir.iterdir()):
                media_archive = backup_dir / f"peerlink_media_{timestamp_str}"
                shutil.make_archive(str(media_archive), "zip", root_dir=str(media_dir))
                zip_path = backup_dir / f"peerlink_media_{timestamp_str}.zip"
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[OK] Media archive saved: {zip_path.name} ({zip_path.stat().st_size / 1024:.1f} KB)"
                    )
                )
            else:
                self.stdout.write(self.style.WARNING("Media directory is empty or missing; skipping media archive."))

        # Retention cleanup
        keep_count = options.get("keep", 20)
        if keep_count > 0:
            self._prune_old_backups(backup_dir, keep_count)

    def _prune_old_backups(self, backup_dir: Path, keep_count: int):
        backup_files = [
            p for p in backup_dir.iterdir()
            if p.is_file() and (
                p.name.startswith("peerlink_backup_")
                or p.name.startswith("backup_")
                or p.suffix in (".gz", ".json", ".dump", ".backup")
            )
        ]
        backup_files.sort(key=lambda p: p.stat().st_mtime, reverse=True)

        if len(backup_files) > keep_count:
            to_delete = backup_files[keep_count:]
            for old_file in to_delete:
                try:
                    old_file.unlink()
                    self.stdout.write(self.style.NOTICE(f"Pruned older backup: {old_file.name}"))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Could not prune {old_file.name}: {e}"))
