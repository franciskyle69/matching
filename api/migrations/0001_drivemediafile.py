# Generated migration for DriveMediaFile (Google Drive storage path mapping)

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="DriveMediaFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("path", models.CharField(db_index=True, max_length=512, unique=True)),
                ("drive_file_id", models.CharField(max_length=128)),
                ("view_url", models.URLField(blank=True, max_length=1024)),
            ],
            options={
                "verbose_name": "Drive media file",
                "verbose_name_plural": "Drive media files",
            },
        ),
    ]
