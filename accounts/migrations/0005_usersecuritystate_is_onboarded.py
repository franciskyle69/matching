from django.db import migrations, models


def mark_existing_profiles_onboarded(apps, schema_editor):
    UserSecurityState = apps.get_model("accounts", "UserSecurityState")
    MentorProfile = apps.get_model("profiles", "MentorProfile")
    MenteeProfile = apps.get_model("profiles", "MenteeProfile")
    mentor_ids = set(
        MentorProfile.objects.filter(is_profile_complete=True).values_list("user_id", flat=True)
    )
    mentee_ids = set(
        MenteeProfile.objects.filter(is_profile_complete=True).values_list("user_id", flat=True)
    )
    for state in UserSecurityState.objects.all():
        state.is_onboarded = state.user_id in mentor_ids or state.user_id in mentee_ids
        state.save(update_fields=["is_onboarded"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_usersecuritystate"),
        ("profiles", "0017_profile_completion_and_mentor_student_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="usersecuritystate",
            name="is_onboarded",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_existing_profiles_onboarded, migrations.RunPython.noop),
    ]
