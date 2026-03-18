"""
Django storage backend that saves files to Google Drive (service account).
When DRIVE_SERVICE_ACCOUNT_JSON and optionally DRIVE_MEDIA_FOLDER_ID are set,
default_storage uses this backend so all media (avatars, covers, post images) go to Drive.
"""
import json
import os
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, Storage
from django.utils.deconstruct import deconstructible


def _fs_fallback():
    """Filesystem fallback when Drive is not configured (avoids recursion)."""
    return FileSystemStorage(location=settings.MEDIA_ROOT, base_url=settings.MEDIA_URL or "/media/")


def _get_drive_service():
    """Build Drive API service from service account credentials. Returns (service, folder_id) or (None, None)."""
    import google.oauth2.service_account
    from googleapiclient.discovery import build

    raw = os.environ.get("DRIVE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None, None

    # Path to JSON file or inline JSON
    if raw.startswith("{") and "client_email" in raw:
        try:
            info = json.loads(raw)
        except json.JSONDecodeError:
            return None, None
    else:
        path = Path(raw)
        if not path.is_absolute() and not path.exists():
            # Try relative to project root (same .env on multiple dev devices)
            path = Path(settings.BASE_DIR) / raw
        if not path.exists():
            return None, None
        try:
            with open(path, "r", encoding="utf-8") as f:
                info = json.load(f)
        except (OSError, json.JSONDecodeError):
            return None, None

    folder_id = os.environ.get("DRIVE_MEDIA_FOLDER_ID", "").strip()
    scopes = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive"]
    creds = google.oauth2.service_account.Credentials.from_service_account_info(info, scopes=scopes)
    service = build("drive", "v3", credentials=creds, cache_discovery=False)

    if not folder_id:
        # Create or find "AppMedia" folder in root
        folder_id = _get_or_create_app_folder(service)
    return service, folder_id


def _get_or_create_app_folder(service):
    """Return folder ID for 'AppMedia' in the service account's Drive, creating it if needed."""
    from django.core.cache import cache
    cache_key = "drive_media_folder_id"
    folder_id = cache.get(cache_key)
    if folder_id:
        return folder_id
    try:
        query = "name='AppMedia' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        result = service.files().list(q=query, spaces="drive", fields="files(id)", pageSize=1).execute()
        files = result.get("files", [])
        if files:
            folder_id = files[0]["id"]
        else:
            body = {"name": "AppMedia", "mimeType": "application/vnd.google-apps.folder"}
            folder = service.files().create(body=body, fields="id").execute()
            folder_id = folder["id"]
    except Exception as e:
        raise RuntimeError(f"Drive folder setup failed: {_drive_error_message(e)}") from e
    cache.set(cache_key, folder_id, timeout=None)
    return folder_id


def _drive_error_message(e):
    """Extract a user-friendly message from Drive API exceptions."""
    detail = str(e).strip()
    if detail:
        return detail
    # googleapiclient.errors.HttpError has .content (bytes) with JSON error body
    content = getattr(e, "content", None)
    if content and isinstance(content, bytes):
        try:
            err = json.loads(content.decode("utf-8", errors="replace"))
            msg = err.get("error", {}).get("message", "")
            if msg:
                return msg
        except Exception:
            pass
        return content.decode("utf-8", errors="replace")[:500]
    if hasattr(e, "reason") and e.reason:
        return e.reason
    return "Unknown error (check server logs)"


def _mime_for_path(name):
    """Return MIME type for common extensions."""
    ext = (Path(name).suffix or "").lower()
    mime = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".gif": "image/gif", ".webp": "image/webp",
        ".pdf": "application/pdf",
    }
    return mime.get(ext, "application/octet-stream")


@deconstructible
class GoogleDriveStorage(Storage):
    """Store files in Google Drive via service account; map path -> file_id in DriveMediaFile."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._service = None
        self._folder_id = None

    def _get_service(self):
        if self._service is None:
            self._service, self._folder_id = _get_drive_service()
        return self._service, self._folder_id

    def _save(self, name, content):
        service, folder_id = self._get_service()
        if not service or not folder_id:
            return _fs_fallback()._save(name, content)

        if hasattr(content, "read"):
            content = content.read()
        if isinstance(content, str):
            content = content.encode("utf-8")

        name_safe = name.replace("\\", "/")
        mime = _mime_for_path(name_safe)
        file_metadata = {"name": os.path.basename(name_safe), "parents": [folder_id]}

        from googleapiclient.http import MediaIoBaseUpload
        from io import BytesIO
        media = MediaIoBaseUpload(BytesIO(content), mimetype=mime, resumable=False)

        try:
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id",
            ).execute()
        except Exception as e:
            detail = _drive_error_message(e)
            raise RuntimeError(f"Google Drive upload failed: {detail}") from e

        file_id = file["id"]

        # Allow anyone with link to view (so avatar/cover/post images load in browser)
        try:
            service.permissions().create(
                fileId=file_id,
                body={"type": "anyone", "role": "reader"},
            ).execute()
        except Exception:
            pass

        # Use view link for images so they display inline; fallback for other types
        is_image = mime.startswith("image/")
        if is_image:
            view_url = f"https://drive.google.com/uc?export=view&id={file_id}"
        else:
            filed = service.files().get(fileId=file_id, fields="webViewLink,webContentLink").execute()
            view_url = filed.get("webContentLink") or filed.get("webViewLink") or f"https://drive.google.com/uc?export=view&id={file_id}"

        from api.models import DriveMediaFile
        DriveMediaFile.objects.update_or_create(
            path=name_safe,
            defaults={"drive_file_id": file_id, "view_url": view_url},
        )
        return name_safe

    def _open(self, name, mode="rb"):
        from api.models import DriveMediaFile
        try:
            rec = DriveMediaFile.objects.get(path=name)
        except DriveMediaFile.DoesNotExist:
            return _fs_fallback()._open(name, mode)
        service, _ = self._get_service()
        if not service:
            raise FileNotFoundError(name)
        from io import BytesIO
        from googleapiclient.http import MediaIoBaseDownload
        request = service.files().get_media(fileId=rec.drive_file_id)
        buf = BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        buf.seek(0)
        return ContentFile(buf.read(), name=name)

    def url(self, name):
        from api.models import DriveMediaFile
        try:
            rec = DriveMediaFile.objects.get(path=name)
            return rec.view_url or f"https://drive.google.com/uc?export=view&id={rec.drive_file_id}"
        except DriveMediaFile.DoesNotExist:
            return _fs_fallback().url(name)

    def exists(self, name):
        from api.models import DriveMediaFile
        return DriveMediaFile.objects.filter(path=name).exists()

    def delete(self, name):
        from api.models import DriveMediaFile
        try:
            rec = DriveMediaFile.objects.get(path=name)
            service, _ = self._get_service()
            if service:
                try:
                    service.files().delete(fileId=rec.drive_file_id).execute()
                except Exception:
                    pass
            rec.delete()
        except DriveMediaFile.DoesNotExist:
            pass
