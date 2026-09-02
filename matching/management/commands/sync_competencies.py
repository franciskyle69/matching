from django.core.management.base import BaseCommand

from profiles.subject_catalog import apply_curriculum


class Command(BaseCommand):
    help = "Replace major-subject topics and competencies with the canonical BSIT curriculum matrix."

    def handle(self, *args, **options):
        _ = (args, options)
        stats = apply_curriculum()
        self.stdout.write(
            self.style.SUCCESS(
                f"Curriculum synced: {stats['subjects']} major subjects, "
                f"{stats['topics']} topics, {stats['competencies']} distinct competencies."
            )
        )
