from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0012_menteeprofile_verification_document_and_more"),
        ("matching", "0020_competency"),
    ]

    operations = [
        migrations.AddField(
            model_name="mentorprofile",
            name="competencies",
            field=models.ManyToManyField(
                blank=True,
                related_name="mentor_profiles",
                to="matching.competency",
            ),
        ),
        migrations.AddField(
            model_name="menteeprofile",
            name="competencies",
            field=models.ManyToManyField(
                blank=True,
                related_name="mentee_profiles",
                to="matching.competency",
            ),
        ),
    ]
