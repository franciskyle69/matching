from django.db import migrations


def seed_subjects(apps, schema_editor):
    Subject = apps.get_model("matching", "Subject")
    subjects = [
        "Computer Programming",
        "Introduction to Computing",
        "Intro to Human Computer Interaction",
        "IT Fundamentals",
    ]
    for name in subjects:
        Subject.objects.get_or_create(name=name)


def unseed_subjects(apps, schema_editor):
    Subject = apps.get_model("matching", "Subject")
    subjects = [
        "Computer Programming",
        "Introduction to Computing",
        "Intro to Human Computer Interaction",
        "IT Fundamentals",
    ]
    Subject.objects.filter(name__in=subjects).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0002_mentoringsession_reminder_1h_sent_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_subjects, unseed_subjects),
    ]
