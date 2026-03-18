"""
Maps storage paths to Cloudinary URLs.
Used by CloudinaryStorage to resolve url(path).
"""
from django.db import models


class CloudinaryMediaFile(models.Model):
    """Maps a storage path (e.g. avatars/user_1_abc.jpg) to a Cloudinary public URL and public_id."""
    path = models.CharField(max_length=512, unique=True, db_index=True)
    url = models.URLField(max_length=1024)
    public_id = models.CharField(max_length=512, blank=True)  # for delete

    class Meta:
        app_label = "api"
        verbose_name = "Cloudinary media file"
        verbose_name_plural = "Cloudinary media files"
