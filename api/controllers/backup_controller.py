"""Backup & Restore API using django-dbbackup under existing /api/backup/* routes."""

from datetime import datetime
from pathlib import Path
import gzip
import shutil
import tempfile
import time
import io

from django.apps import apps
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core.management import call_command
from django.core.management.color import no_style
from django.db import connection
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


def _reset_db_sequences():
    """Synchronize primary key sequences for PostgreSQL to avoid ID collision."""
    engine = settings.DATABASES.get("default", {}).get("ENGINE", "")
    if "postgresql" not in engine:
        return
    try:
        sequence_sql = connection.ops.sequence_reset_sql(no_style(), apps.get_models())
        if sequence_sql:
            with connection.cursor() as cursor:
                for sql in sequence_sql:
                    cursor.execute(sql)
    except Exception:
        pass


def _create_clean_backup() -> Path:
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    target = _backup_dir() / f"peerlink_backup_{timestamp_str}.json.gz"
    buffer = io.StringIO()
    call_command(
        "dumpdata",
        stdout=buffer,
        exclude=[
            "contenttypes",
            "auth.permission",
            "sessions.session",
            "axes.accessattempt",
            "axes.accesslog",
        ],
        natural_foreign=True,
        natural_primary=True,
        verbosity=0,
    )
    raw_data = buffer.getvalue().encode("utf-8")
    with gzip.open(target, "wb", compresslevel=9) as gz_out:
        gz_out.write(raw_data)
    return target


def _restore_backup_file(path: Path):
    """Safely restore a backup file, whether .json, .json.gz, or binary dump."""
    is_gz = path.name.lower().endswith(".gz") or path.suffix.lower() == ".gz"
    is_json = path.name.lower().endswith(".json") or path.name.lower().endswith(".json.gz")

    if is_json:
        call_command("flush", interactive=False, verbosity=0)
        if is_gz:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".json", dir=_backup_dir()) as tmp:
                with gzip.open(path, "rb") as f_in:
                    shutil.copyfileobj(f_in, tmp)
                tmp_path = Path(tmp.name)
            try:
                call_command("loaddata", str(tmp_path), verbosity=0)
            finally:
                tmp_path.unlink(missing_ok=True)
        else:
            call_command("loaddata", str(path), verbosity=0)
    else:
        call_command("dbrestore", input_filename=str(path), interactive=False, verbosity=0)

    _reset_db_sequences()


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
    return JsonResponse({"backups": result})


@login_required
@require_http_methods(["POST"])
def backup_create(request):
    err = _require_staff(request)
    if err:
        return err
    try:
        created = _create_clean_backup()
        stat = created.stat()
        audit_log(request.user, "create", "backup", created.name)
        return JsonResponse({
            "ok": True,
            "id": created.name,
            "path": str(created),
            "size_bytes": stat.st_size,
            "size_display": _size_display(stat.st_size),
            "records": "Compressed database snapshot",
        })
    except Exception as e:
        return JsonResponse(
            {"error": f"Backup creation failed: {e}"},
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

    # Preserve multi-part extensions like .json.gz
    fname = f.name.lower()
    suffix = ".json.gz" if fname.endswith(".json.gz") else (Path(f.name).suffix or ".dump")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=_backup_dir()) as tmp:
        for chunk in f.chunks():
            tmp.write(chunk)
        tmp_path = Path(tmp.name)

    try:
        _restore_backup_file(tmp_path)
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
        _restore_backup_file(path)
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
