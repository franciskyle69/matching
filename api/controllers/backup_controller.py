"""Backup & Restore API using django-dbbackup under existing /api/backup/* routes."""

from datetime import datetime
from pathlib import Path
import tempfile
import time
import io

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.management import call_command
from django.http import FileResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from ..views import _require_staff, audit_log

ALLOWED_BACKUP_SUFFIXES = (
    ".gz",
    ".zip",
    ".bz2",
    ".sql",
    ".psql",
    ".dump",
    ".backup",
)


def _backup_dir() -> Path:
    base = getattr(settings, "BACKUP_DIR", None) or (Path(settings.BASE_DIR) / "backups")
    d = Path(base)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _size_display(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    return f"{size_bytes / (1024 * 1024):.2f} MB"


def _list_backup_files():
    files = []
    for path in _backup_dir().iterdir():
        if not path.is_file():
            continue
        if (
            path.suffix.lower() in ALLOWED_BACKUP_SUFFIXES
            or "backup" in path.name.lower()
            or "db" in path.name.lower()
        ):
            files.append(path)
    files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    return files


def _safe_backup_path(backup_id: str):
    candidate = str(backup_id or "").strip()
    if not candidate or "/" in candidate or "\\" in candidate:
        return None
    path = _backup_dir() / candidate
    if not path.is_file():
        return None
    return path


def _create_json_fixture_backup() -> Path:
    target = _backup_dir() / f"backup_{int(time.time() * 1000)}.json"
    buffer = io.StringIO()
    call_command("dumpdata", stdout=buffer, indent=2, verbosity=0)
    target.write_text(buffer.getvalue(), encoding="utf-8")
    return target


def _restore_json_fixture(path: Path):
    # Match previous restore semantics: replace current data with backup snapshot.
    call_command("flush", interactive=False, verbosity=0)
    call_command("loaddata", str(path), verbosity=0)


@login_required
@require_GET
def backup_list(request):
    err = _require_staff(request)
    if err:
        return err
    result = []
    for f in _list_backup_files():
        try:
            stat = f.stat()
            size = stat.st_size
            created = datetime.fromtimestamp(stat.st_mtime, tz=timezone.get_current_timezone())
            result.append({
                "id": f.name,
                "created": created.isoformat(),
                "size_bytes": size,
                "size_display": _size_display(size),
                "records": "Database snapshot",
            })
        except Exception:
            continue
    return JsonResponse({"backups": result, "backup_dir": str(_backup_dir())})


@login_required
@require_http_methods(["POST"])
def backup_create(request):
    err = _require_staff(request)
    if err:
        return err
    before = {item.name for item in _list_backup_files()}
    try:
        call_command("dbbackup", interactive=False, verbosity=0)
        after = _list_backup_files()
        created = next((item for item in after if item.name not in before), after[0] if after else None)
        if created is None:
            return JsonResponse({"error": "Backup command completed but no file was found."}, status=500)

        audit_log(request.user, "create", "backup", created.name)
        stat = created.stat()
        return JsonResponse({
            "ok": True,
            "id": created.name,
            "path": str(created),
            "size_bytes": stat.st_size,
            "size_display": _size_display(stat.st_size),
            "records": "Database snapshot",
        })
    except Exception as e:
        # Fallback for environments without pg_dump/psql (common on local Windows setups).
        try:
            created = _create_json_fixture_backup()
            stat = created.stat()
            audit_log(request.user, "create", "backup", created.name)
            return JsonResponse(
                {
                    "ok": True,
                    "id": created.name,
                    "path": str(created),
                    "size_bytes": stat.st_size,
                    "size_display": _size_display(stat.st_size),
                    "records": "JSON fixture snapshot",
                    "note": f"dbbackup unavailable, used JSON fallback: {e}",
                }
            )
        except Exception as fallback_error:
            return JsonResponse(
                {
                    "error": f"Primary backup failed: {e}. Fallback backup failed: {fallback_error}",
                },
                status=500,
            )


@login_required
@require_GET
def backup_download(request, backup_id):
    err = _require_staff(request)
    if err:
        return err
    path = _safe_backup_path(backup_id)
    if not path:
        return JsonResponse({"error": "Backup not found."}, status=404)
    try:
        audit_log(request.user, "download", "backup", path.name)
        return FileResponse(open(path, "rb"), as_attachment=True, filename=path.name)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def backup_restore(request):
    err = _require_staff(request)
    if err:
        return err
    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "No file uploaded."}, status=400)

    suffix = Path(f.name).suffix or ".dump"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=_backup_dir()) as tmp:
        for chunk in f.chunks():
            tmp.write(chunk)
        tmp_path = Path(tmp.name)

    try:
        if tmp_path.suffix.lower() == ".json":
            _restore_json_fixture(tmp_path)
        else:
            call_command(
                "dbrestore",
                input_filename=str(tmp_path),
                interactive=False,
                verbosity=0,
            )
        audit_log(request.user, "restore", "backup", f.name)
        return JsonResponse({"ok": True, "message": "Restore completed. You may need to log in again."})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


@login_required
@require_http_methods(["POST"])
def backup_restore_by_id(request, backup_id):
    """Restore from an existing backup file on the server (staff only)."""
    err = _require_staff(request)
    if err:
        return err
    path = _safe_backup_path(backup_id)
    if not path:
        return JsonResponse({"error": "Backup not found."}, status=404)

    try:
        if path.suffix.lower() == ".json":
            _restore_json_fixture(path)
        else:
            call_command(
                "dbrestore",
                input_filename=str(path),
                interactive=False,
                verbosity=0,
            )
        audit_log(request.user, "restore", "backup", path.name)
        return JsonResponse({"ok": True, "message": "Restore completed. You may need to log in again."})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def backup_delete(request, backup_id):
    err = _require_staff(request)
    if err:
        return err
    path = _safe_backup_path(backup_id)
    if not path:
        return JsonResponse({"error": "Backup not found."}, status=404)
    try:
        path.unlink()
        audit_log(request.user, "delete", "backup", path.name)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
