import django.db.models.deletion
from django.db import migrations, models

import profiles.models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0015_mentor_capacity_fixed_to_five"),
    ]

    operations = [
        migrations.CreateModel(
            name="VerificationDocument",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("letter_of_intent", "Letter of intent"),
                            ("study_load", "Study load"),
                            ("grade", "Grade"),
                            ("application", "Application form"),
                        ],
                        max_length=32,
                    ),
                ),
                (
                    "file",
                    models.FileField(
                        upload_to=profiles.models.verification_document_item_upload_path
                    ),
                ),
                ("original_name", models.CharField(blank=True, max_length=255)),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
                (
                    "mentee",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="verification_documents",
                        to="profiles.menteeprofile",
                    ),
                ),
                (
                    "mentor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="verification_documents",
                        to="profiles.mentorprofile",
                    ),
                ),
            ],
            options={
                "ordering": ["kind", "id"],
            },
        ),
        migrations.AddIndex(
            model_name="verificationdocument",
            index=models.Index(
                fields=["mentor", "kind"], name="prof_vdoc_mentor_kind"
            ),
        ),
        migrations.AddIndex(
            model_name="verificationdocument",
            index=models.Index(
                fields=["mentee", "kind"], name="prof_vdoc_mentee_kind"
            ),
        ),
        migrations.AddConstraint(
            model_name="verificationdocument",
            constraint=models.CheckConstraint(
                check=models.Q(
                    models.Q(("mentee__isnull", True), ("mentor__isnull", False))
                    | models.Q(("mentee__isnull", False), ("mentor__isnull", True))
                ),
                name="verification_doc_one_profile",
            ),
        ),
    ]
