"""
Maps storage paths to Google Drive file IDs and view URLs.
Used by GoogleDriveStorage to resolve url(path) and _open(path).
"""
from django.db import models


class DriveMediaFile(models.Model):
    """Maps a storage path (e.g. avatars/user_1_abc.jpg) to a Drive file id and view URL."""
    path = models.CharField(max_length=512, unique=True, db_index=True)
    drive_file_id = models.CharField(max_length=128)
    view_url = models.URLField(max_length=1024, blank=True)

    class Meta:
        app_label = "api"
        verbose_name = "Drive media file"
        verbose_name_plural = "Drive media files"
