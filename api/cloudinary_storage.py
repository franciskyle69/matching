"""
Django storage backend that uploads files to Cloudinary.
When CLOUDINARY_CLOUD_NAME (and API key/secret) are set, default_storage uses this
so all media (avatars, covers, post images) go to Cloudinary.
"""
import os
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, Storage
from django.utils.deconstruct import deconstructible


def _fs_fallback():
    """Filesystem fallback when Cloudinary is not configured."""
    return FileSystemStorage(location=settings.MEDIA_ROOT, base_url=settings.MEDIA_URL or "/media/")


def _cloudinary_configured():
    """Return True if Cloudinary env vars are set."""
    return bool(os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip())


def _resource_type_for_name(name):
    """Use raw uploads for document-like files to keep URLs browser-safe for download/preview."""
    ext = Path(str(name or "")).suffix.lower()
    if ext in {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".csv"}:
        return "raw"
    return "auto"


@deconstructible
class CloudinaryStorage(Storage):
    """Upload files to Cloudinary; map path -> URL in CloudinaryMediaFile."""

    def _save(self, name, content):
        if not _cloudinary_configured():
            return _fs_fallback()._save(name, content)

        if hasattr(content, "read"):
            content = content.read()
        if isinstance(content, str):
            content = content.encode("utf-8")

        name_safe = name.replace("\\", "/")
        folder = Path(name_safe).parent.as_posix() if "/" in name_safe else ""
        resource_type = _resource_type_for_name(name_safe)

        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip(),
            api_key=os.environ.get("CLOUDINARY_API_KEY", "").strip(),
            api_secret=os.environ.get("CLOUDINARY_API_SECRET", "").strip(),
        )

        try:
            with tempfile.NamedTemporaryFile(suffix=Path(name_safe).suffix or ".bin", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                result = cloudinary.uploader.upload(
                    tmp_path,
                    folder=folder or None,
                    resource_type=resource_type,
                    use_filename=True,
                    unique_filename=True,
                )
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        except Exception as e:
            raise RuntimeError(f"Cloudinary upload failed: {e}") from e

        url = result.get("secure_url") or result.get("url", "")
        if not url:
            raise RuntimeError("Cloudinary returned no URL")
        public_id = result.get("public_id", "")

        from api.models import CloudinaryMediaFile
        CloudinaryMediaFile.objects.update_or_create(
            path=name_safe,
            defaults={"url": url, "public_id": public_id},
        )
        return name_safe

    def _open(self, name, mode="rb"):
        from api.models import CloudinaryMediaFile
        try:
            rec = CloudinaryMediaFile.objects.get(path=name)
        except CloudinaryMediaFile.DoesNotExist:
            return _fs_fallback()._open(name, mode)
        import requests
        resp = requests.get(rec.url, timeout=30)
        resp.raise_for_status()
        return ContentFile(resp.content, name=name)

    def url(self, name):
        from api.models import CloudinaryMediaFile
        try:
            rec = CloudinaryMediaFile.objects.get(path=name)
            return rec.url
        except CloudinaryMediaFile.DoesNotExist:
            return _fs_fallback().url(name)

    def exists(self, name):
        from api.models import CloudinaryMediaFile
        return CloudinaryMediaFile.objects.filter(path=name).exists()

    def delete(self, name):
        from api.models import CloudinaryMediaFile
        try:
            rec = CloudinaryMediaFile.objects.get(path=name)
            if _cloudinary_configured() and getattr(rec, "public_id", None):
                import cloudinary
                import cloudinary.uploader
                resource_type = _resource_type_for_name(name)
                cloudinary.config(
                    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip(),
                    api_key=os.environ.get("CLOUDINARY_API_KEY", "").strip(),
                    api_secret=os.environ.get("CLOUDINARY_API_SECRET", "").strip(),
                )
                try:
                    cloudinary.uploader.destroy(rec.public_id, resource_type=resource_type)
                except Exception:
                    pass
            rec.delete()
        except CloudinaryMediaFile.DoesNotExist:
            pass
