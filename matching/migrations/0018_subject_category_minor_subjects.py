from django.db import migrations, models

from profiles.subject_catalog import SUBJECT_CATALOG


def seed_subject_categories(apps, schema_editor):
    Subject = apps.get_model("matching", "Subject")
    for entry in SUBJECT_CATALOG:
        subject, _created = Subject.objects.get_or_create(
            name=entry["name"],
            defaults={
                "code": entry["code"],
                "category": entry["category"],
            },
        )
        updates = []
        if subject.code != entry["code"]:
            subject.code = entry["code"]
            updates.append("code")
        if subject.category != entry["category"]:
            subject.category = entry["category"]
            updates.append("category")
        if updates:
            subject.save(update_fields=updates)


def unseed_minor_subjects(apps, schema_editor):
    Subject = apps.get_model("matching", "Subject")
    minor_names = [
        entry["name"]
        for entry in SUBJECT_CATALOG
        if entry["category"] != "major"
    ]
    Subject.objects.filter(name__in=minor_names).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0017_alter_notification_action_tab"),
    ]

    operations = [
        migrations.AddField(
            model_name="subject",
            name="code",
            field=models.CharField(blank=True, default="", max_length=30),
        ),
        migrations.AddField(
            model_name="subject",
            name="category",
            field=models.CharField(
                choices=[
                    ("major", "Major"),
                    ("ge", "General Education (GE)"),
                    ("nstp", "NSTP"),
                    ("pe", "Physical Education (PE)"),
                ],
                default="major",
                max_length=20,
            ),
        ),
        migrations.AlterModelOptions(
            name="subject",
            options={"ordering": ["category", "name"]},
        ),
        migrations.RunPython(seed_subject_categories, unseed_minor_subjects),
    ]
