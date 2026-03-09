from django.core.management.base import BaseCommand
from django.utils import timezone

from matching.models import MentoringSession, Notification


class Command(BaseCommand):
    help = "Send 24h and 1h reminders for upcoming mentoring sessions."

    def handle(self, *args, **options):
        now = timezone.now()

        upcoming_24h = MentoringSession.objects.filter(
            status="scheduled",
            reminder_24h_sent=False,
            scheduled_at__gte=now,
            scheduled_at__lte=now + timezone.timedelta(hours=24),
        )
        for s in upcoming_24h:
            Notification.objects.create(
                user=s.mentor.user,
                message=f"Reminder: session with {s.mentee.user.username} is within 24 hours.",
            )
            Notification.objects.create(
                user=s.mentee.user,
                message=f"Reminder: session with {s.mentor.user.username} is within 24 hours.",
            )
            s.reminder_24h_sent = True
            s.save(update_fields=["reminder_24h_sent"])

        upcoming_1h = MentoringSession.objects.filter(
            status="scheduled",
            reminder_1h_sent=False,
            scheduled_at__gte=now,
            scheduled_at__lte=now + timezone.timedelta(hours=1),
        )
        for s in upcoming_1h:
            Notification.objects.create(
                user=s.mentor.user,
                message=f"Reminder: session with {s.mentee.user.username} starts within 1 hour.",
            )
            Notification.objects.create(
                user=s.mentee.user,
                message=f"Reminder: session with {s.mentor.user.username} starts within 1 hour.",
            )
            s.reminder_1h_sent = True
            s.save(update_fields=["reminder_1h_sent"])

        self.stdout.write(self.style.SUCCESS("Session reminders processed."))
