# Migration for CloudinaryMediaFile (Cloudinary storage path -> URL mapping)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0001_drivemediafile"),
    ]

    operations = [
        migrations.CreateModel(
            name="CloudinaryMediaFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("path", models.CharField(db_index=True, max_length=512, unique=True)),
                ("url", models.URLField(max_length=1024)),
                ("public_id", models.CharField(blank=True, max_length=512)),
            ],
            options={
                "verbose_name": "Cloudinary media file",
                "verbose_name_plural": "Cloudinary media files",
            },
        ),
    ]
