from django.db import migrations, models


def set_mentor_capacity_to_five(apps, schema_editor):
    MentorProfile = apps.get_model("profiles", "MentorProfile")
    MentorProfile.objects.exclude(capacity=5).update(capacity=5)


class Migration(migrations.Migration):
    dependencies = [
        ("profiles", "0014_matching_profile_levels"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mentorprofile",
            name="capacity",
            field=models.PositiveSmallIntegerField(default=5),
        ),
        migrations.RunPython(set_mentor_capacity_to_five, migrations.RunPython.noop),
    ]
