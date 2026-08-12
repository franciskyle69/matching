from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):
    dependencies = [
        ("matching", "0020_competency"),
        ("profiles", "0013_add_profile_competencies"),
    ]

    operations = [
        migrations.AddField(
            model_name="mentorprofile",
            name="teaching_experience_years",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mentorprofile",
            name="years_experience",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="menteeprofile",
            name="preferred_learning_style",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.CreateModel(
            name="MenteeCompetencyNeed",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "need_level",
                    models.PositiveSmallIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(5),
                        ]
                    ),
                ),
                (
                    "competency",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="mentee_competency_needs",
                        to="matching.competency",
                    ),
                ),
                (
                    "mentee",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="competency_needs",
                        to="profiles.menteeprofile",
                    ),
                ),
            ],
            options={
                "unique_together": {("mentee", "competency")},
            },
        ),
        migrations.CreateModel(
            name="MentorCompetency",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "proficiency_level",
                    models.PositiveSmallIntegerField(
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(5),
                        ]
                    ),
                ),
                (
                    "competency",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="mentor_competency_levels",
                        to="matching.competency",
                    ),
                ),
                (
                    "mentor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="competency_levels",
                        to="profiles.mentorprofile",
                    ),
                ),
            ],
            options={
                "unique_together": {("mentor", "competency")},
            },
        ),
        migrations.AddIndex(
            model_name="mentorcompetency",
            index=models.Index(fields=["mentor", "competency"], name="prof_mcomp_mentor_comp"),
        ),
        migrations.AddIndex(
            model_name="menteecompetencyneed",
            index=models.Index(fields=["mentee", "competency"], name="prof_mcneed_mentee_comp"),
        ),
    ]
