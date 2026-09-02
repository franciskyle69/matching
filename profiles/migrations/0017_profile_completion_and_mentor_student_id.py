from django.db import migrations, models


def backfill_profile_complete(apps, schema_editor):
    MentorProfile = apps.get_model("profiles", "MentorProfile")
    MenteeProfile = apps.get_model("profiles", "MenteeProfile")

    for mentee in MenteeProfile.objects.all().iterator():
        complete = bool(
            mentee.program
            and mentee.year_level
            and mentee.campus
            and mentee.student_id_no
            and mentee.contact_no
            and mentee.admission_type
            and mentee.sex
        )
        if complete != bool(mentee.is_profile_complete):
            mentee.is_profile_complete = complete
            mentee.save(update_fields=["is_profile_complete"])

    for mentor in MentorProfile.objects.all().iterator():
        role = str(mentor.role or "").strip()
        has_questionnaire = bool(mentor.subjects or mentor.expertise_level)
        complete = bool(mentor.approved or has_questionnaire or role)
        if complete != bool(mentor.is_profile_complete):
            mentor.is_profile_complete = complete
            mentor.save(update_fields=["is_profile_complete"])


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0016_verificationdocument"),
    ]

    operations = [
        migrations.AddField(
            model_name="mentorprofile",
            name="student_id_no",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="mentorprofile",
            name="is_profile_complete",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="menteeprofile",
            name="is_profile_complete",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="menteeprofile",
            name="student_id_no",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.RunPython(backfill_profile_complete, migrations.RunPython.noop),
    ]
