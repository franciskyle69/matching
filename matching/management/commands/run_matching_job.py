import logging

from django.core.management.base import BaseCommand

from matching.services import run_greedy_matching

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run matching and log result counts."

    def handle(self, *args, **options):
        pairs = run_greedy_matching()
        self.stdout.write(self.style.SUCCESS(f"Matching run completed: {len(pairs)} pairs"))
        logger.info("matching_job_run", extra={"pairs": len(pairs)})
