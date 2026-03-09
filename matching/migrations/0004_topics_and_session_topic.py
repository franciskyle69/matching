from django.db import migrations, models


def seed_topics(apps, schema_editor):
    Subject = apps.get_model("matching", "Subject")
    Topic = apps.get_model("matching", "Topic")

    subject_map = {
        "Computer Programming": ["Arrays", "Loops", "Input and Output Handling", "Error Handling", "Javascript"],
        "Introduction to Computing": ["Input and Output Handling", "Error Handling"],
        "Intro to Human Computer Interaction": ["UI/UX", "HTML", "CSS"],
        "IT Fundamentals": ["HTML", "CSS", "Javascript"],
    }

    for subject_name, topics in subject_map.items():
        subject = Subject.objects.filter(name=subject_name).first()
        if not subject:
            continue
        for topic_name in topics:
            Topic.objects.get_or_create(subject=subject, name=topic_name)


def unseed_topics(apps, schema_editor):
    Topic = apps.get_model("matching", "Topic")
    Topic.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0003_seed_subjects"),
    ]

    operations = [
        migrations.CreateModel(
            name="Topic",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=150)),
                ("subject", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="topics", to="matching.subject")),
            ],
            options={
                "unique_together": {("subject", "name")},
            },
        ),
        migrations.AddField(
            model_name="mentoringsession",
            name="topic",
            field=models.ForeignKey(blank=True, null=True, on_delete=models.deletion.SET_NULL, to="matching.topic"),
        ),
        migrations.RunPython(seed_topics, unseed_topics),
    ]
