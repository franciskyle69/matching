"""
Backup & Restore for staff: export/import DB state as JSON files.
Backups stored in BACKUP_DIR (default: project root / backups).
"""
import json
import os
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse, FileResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from profiles.models import MentorProfile, MenteeProfile
from matching.models import (
    Subject, Topic, MentoringSession, MenteeMentorRequest,
    Notification, Announcement, AnnouncementRecipient, Comment, AuditLog,
)

from ..views import _require_staff, audit_log

BACKUP_VERSION = 1


def _backup_dir():
    return getattr(settings, "BACKUP_DIR", None) or Path(settings.BASE_DIR) / "backups"


def _ensure_backup_dir():
    d = _backup_dir()
    d.mkdir(parents=True, exist_ok=True)
    return d


def _model_to_row(instance):
    from django.forms.models import model_to_dict

    def _json_safe(value):
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, Decimal):
            # Keep precision for values like GPA.
            return str(value)
        if hasattr(value, "isoformat"):
            return value.isoformat()
        if isinstance(value, dict):
            return {k: _json_safe(v) for k, v in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [_json_safe(v) for v in value]
        if hasattr(value, "all"):
            return [_json_safe(v) for v in value.all()]
        if hasattr(value, "pk"):
            return value.pk
        if hasattr(value, "id"):
            return value.id
        return str(value)

    row = model_to_dict(instance)
    row["pk"] = instance.pk
    for key, value in list(row.items()):
        row[key] = _json_safe(value)
    return row


def _export_data():
    users = list(User.objects.all().order_by("id"))
    mentor_profiles = list(MentorProfile.objects.select_related("user").order_by("id"))
    mentee_profiles = list(MenteeProfile.objects.select_related("user").order_by("id"))
    subjects = list(Subject.objects.order_by("id"))
    topics = list(Topic.objects.select_related("subject").order_by("id"))
    sessions = list(MentoringSession.objects.select_related("mentor", "mentee", "subject", "topic").order_by("id"))
    requests = list(MenteeMentorRequest.objects.select_related("mentee", "mentor").order_by("id"))
    notifications = list(Notification.objects.select_related("user").order_by("id"))
    announcements = list(Announcement.objects.select_related("mentor").order_by("id"))
    ann_recipients = list(AnnouncementRecipient.objects.select_related("announcement", "user").order_by("id"))
    comments = list(Comment.objects.select_related("author", "session", "announcement").order_by("id"))
    audit_logs = list(AuditLog.objects.select_related("user").order_by("id"))

    def user_row(u):
        return {
            "pk": u.id,
            "username": u.username,
            "email": u.email or "",
            "password": u.password,
            "is_staff": u.is_staff,
            "is_active": u.is_active,
            "is_superuser": u.is_superuser,
            "date_joined": u.date_joined.isoformat(),
            "first_name": u.first_name or "",
            "last_name": u.last_name or "",
        }

    return {
        "version": BACKUP_VERSION,
        "created_at": timezone.now().isoformat(),
        "records": {
            "users": [user_row(u) for u in users],
            "mentor_profiles": [_model_to_row(m) for m in mentor_profiles],
            "mentee_profiles": [_model_to_row(m) for m in mentee_profiles],
            "subjects": [_model_to_row(s) for s in subjects],
            "topics": [_model_to_row(t) for t in topics],
            "sessions": [_model_to_row(s) for s in sessions],
            "mentee_mentor_requests": [_model_to_row(r) for r in requests],
            "notifications": [_model_to_row(n) for n in notifications],
            "announcements": [_model_to_row(a) for a in announcements],
            "announcement_recipients": [_model_to_row(r) for r in ann_recipients],
            "comments": [_model_to_row(c) for c in comments],
            "audit_logs": [_model_to_row(a) for a in audit_logs],
        },
    }


def _record_summary(data):
    rec = data.get("records") or {}
    parts = []
    if rec.get("users"):
        parts.append(f"{len(rec['users'])} users")
    if rec.get("mentor_profiles"):
        parts.append(f"{len(rec['mentor_profiles'])} mentors")
    if rec.get("mentee_profiles"):
        parts.append(f"{len(rec['mentee_profiles'])} mentees")
    if rec.get("subjects"):
        parts.append(f"{len(rec['subjects'])} subjects")
    if rec.get("sessions"):
        parts.append(f"{len(rec['sessions'])} sessions")
    if rec.get("announcements"):
        parts.append(f"{len(rec['announcements'])} announcements")
    return ", ".join(parts) if parts else "empty"


def _size_display(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    return f"{size_bytes / (1024 * 1024):.2f} MB"


def _dt(s):
    if not s:
        return None
    from django.utils.dateparse import parse_datetime
    return parse_datetime(s)


def _restore_data(data):
    rec = data.get("records") or {}
    Comment.objects.all().delete()
    AnnouncementRecipient.objects.all().delete()
    Announcement.objects.all().delete()
    Notification.objects.all().delete()
    MenteeMentorRequest.objects.all().delete()
    MentoringSession.objects.all().delete()
    Topic.objects.all().delete()
    Subject.objects.all().delete()
    AuditLog.objects.all().delete()
    MentorProfile.objects.all().delete()
    MenteeProfile.objects.all().delete()
    User.objects.all().delete()

    for row in rec.get("users") or []:
        User.objects.create(
            id=row["pk"],
            username=row["username"],
            email=row.get("email") or "",
            password=row["password"],
            is_staff=row.get("is_staff", False),
            is_active=row.get("is_active", True),
            is_superuser=row.get("is_superuser", False),
            date_joined=_dt(row.get("date_joined")) or timezone.now(),
            first_name=row.get("first_name") or "",
            last_name=row.get("last_name") or "",
        )
    for row in rec.get("mentor_profiles") or []:
        MentorProfile.objects.create(
            id=row["pk"], user_id=row["user"],
            program=row.get("program", ""), year_level=row.get("year_level", 0),
            gpa=row.get("gpa"), avatar_url=row.get("avatar_url", ""),
            skills=row.get("skills", []), availability=row.get("availability", []),
            interests=row.get("interests", ""), capacity=row.get("capacity", 1),
            role=row.get("role", ""), subjects=row.get("subjects", []),
            topics=row.get("topics", []), expertise_level=row.get("expertise_level"),
            approved=row.get("approved", False),
        )
    for row in rec.get("mentee_profiles") or []:
        MenteeProfile.objects.create(
            id=row["pk"], user_id=row["user"],
            program=row.get("program", ""), year_level=row.get("year_level", 0),
            gpa=row.get("gpa"), avatar_url=row.get("avatar_url", ""),
            skills=row.get("skills", []), availability=row.get("availability", []),
            interests=row.get("interests", ""), campus=row.get("campus", ""),
            student_id_no=row.get("student_id_no", ""), contact_no=row.get("contact_no", ""),
            admission_type=row.get("admission_type", ""), sex=row.get("sex", ""),
            subjects=row.get("subjects", []), topics=row.get("topics", []),
            difficulty_level=row.get("difficulty_level"), approved=row.get("approved", False),
        )
    for row in rec.get("subjects") or []:
        Subject.objects.create(id=row["pk"], name=row["name"], description=row.get("description", ""))
    for row in rec.get("topics") or []:
        Topic.objects.create(id=row["pk"], subject_id=row["subject"], name=row["name"])
    for row in rec.get("sessions") or []:
        MentoringSession.objects.create(
            id=row["pk"], mentor_id=row["mentor"], mentee_id=row["mentee"],
            subject_id=row.get("subject"), topic_id=row.get("topic"),
            scheduled_at=_dt(row["scheduled_at"]),
            duration_minutes=row.get("duration_minutes", 60),
            notes=row.get("notes", ""), meeting_notes=row.get("meeting_notes", ""),
            status=row.get("status", "scheduled"),
            reminder_24h_sent=row.get("reminder_24h_sent", False),
            reminder_1h_sent=row.get("reminder_1h_sent", False),
            created_at=_dt(row.get("created_at")) or timezone.now(),
        )
    for row in rec.get("mentee_mentor_requests") or []:
        MenteeMentorRequest.objects.create(
            id=row["pk"], mentee_id=row["mentee"], mentor_id=row["mentor"],
            created_at=_dt(row.get("created_at")) or timezone.now(),
        )
    for row in rec.get("notifications") or []:
        Notification.objects.create(
            id=row["pk"], user_id=row["user"], message=row.get("message", ""),
            is_read=row.get("is_read", False), action_tab=row.get("action_tab", ""),
            created_at=_dt(row.get("created_at")) or timezone.now(),
        )
    for row in rec.get("announcements") or []:
        Announcement.objects.create(
            id=row["pk"], mentor_id=row["mentor"], message=row.get("message", ""),
            created_at=_dt(row.get("created_at")) or timezone.now(),
            deleted_at=_dt(row.get("deleted_at")),
        )
    for row in rec.get("announcement_recipients") or []:
        AnnouncementRecipient.objects.create(
            id=row["pk"], announcement_id=row["announcement"], user_id=row["user"],
        )
    for row in rec.get("comments") or []:
        Comment.objects.create(
            id=row["pk"], author_id=row["author"], content=row.get("content", ""),
            created_at=_dt(row.get("created_at")) or timezone.now(),
            session_id=row.get("session"), announcement_id=row.get("announcement"),
        )
    for row in rec.get("audit_logs") or []:
        AuditLog.objects.create(
            id=row["pk"], user_id=row.get("user"),
            action=row.get("action", ""), model_name=row.get("model_name", ""),
            object_id=row.get("object_id", ""),
            created_at=_dt(row.get("created_at")) or timezone.now(),
        )


@login_required
@require_GET
def backup_list(request):
    err = _require_staff(request)
    if err:
        return err
    backup_dir = _ensure_backup_dir()
    result = []
    for f in sorted(backup_dir.glob("backup_*.json"), key=os.path.getmtime, reverse=True):
        try:
            stat = f.stat()
            size = stat.st_size
            created = datetime.fromtimestamp(stat.st_mtime, tz=timezone.get_current_timezone())
            backup_id = f.stem.replace("backup_", "") if f.stem.startswith("backup_") else f.stem
            records = "—"
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    records = _record_summary(json.load(fp))
            except Exception:
                pass
            result.append({
                "id": backup_id,
                "created": created.isoformat(),
                "size_bytes": size,
                "size_display": _size_display(size),
                "records": records,
            })
        except Exception:
            continue
    return JsonResponse({"backups": result, "backup_dir": str(backup_dir)})


@login_required
@require_http_methods(["POST"])
def backup_create(request):
    err = _require_staff(request)
    if err:
        return err
    backup_dir = _ensure_backup_dir()
    ts = int(timezone.now().timestamp() * 1000)
    path = backup_dir / f"backup_{ts}.json"
    try:
        data = _export_data()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        audit_log(request.user, "create", "backup", str(ts))
        return JsonResponse({
            "ok": True,
            "id": str(ts),
            "path": str(path),
            "size_bytes": path.stat().st_size,
            "size_display": _size_display(path.stat().st_size),
            "records": _record_summary(data),
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_GET
def backup_download(request, backup_id):
    err = _require_staff(request)
    if err:
        return err
    backup_dir = _backup_dir()
    if not backup_dir.exists():
        return JsonResponse({"error": "Backup directory not found."}, status=404)
    path = backup_dir / f"backup_{backup_id}.json"
    if not path.is_file():
        return JsonResponse({"error": "Backup not found."}, status=404)
    try:
        audit_log(request.user, "download", "backup", str(backup_id))
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
    if not f.name.endswith(".json"):
        return JsonResponse({"error": "File must be a .json backup."}, status=400)
    try:
        data = json.load(f)
    except json.JSONDecodeError as e:
        return JsonResponse({"error": f"Invalid JSON: {e}"}, status=400)
    if data.get("version") != BACKUP_VERSION:
        return JsonResponse({"error": "Unsupported backup version."}, status=400)
    try:
        actor_id = request.user.id
        uploaded_name = f.name
        _restore_data(data)
        actor = User.objects.filter(id=actor_id).first()
        if actor:
            audit_log(actor, "restore", "backup", uploaded_name)
        return JsonResponse({"ok": True, "message": "Restore completed. You may need to log in again."})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def backup_restore_by_id(request, backup_id):
    """Restore from an existing backup file on the server (staff only)."""
    err = _require_staff(request)
    if err:
        return err
    backup_dir = _backup_dir()
    path = backup_dir / f"backup_{backup_id}.json"
    if not path.is_file():
        return JsonResponse({"error": "Backup not found."}, status=404)
    try:
        with open(path, "r", encoding="utf-8") as fp:
            data = json.load(fp)
    except json.JSONDecodeError as e:
        return JsonResponse({"error": f"Invalid backup file: {e}"}, status=400)
    if data.get("version") != BACKUP_VERSION:
        return JsonResponse({"error": "Unsupported backup version."}, status=400)
    try:
        actor_id = request.user.id
        _restore_data(data)
        actor = User.objects.filter(id=actor_id).first()
        if actor:
            audit_log(actor, "restore", "backup", str(backup_id))
        return JsonResponse({"ok": True, "message": "Restore completed. You may need to log in again."})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@login_required
@require_http_methods(["POST"])
def backup_delete(request, backup_id):
    err = _require_staff(request)
    if err:
        return err
    backup_dir = _backup_dir()
    path = backup_dir / f"backup_{backup_id}.json"
    if not path.is_file():
        return JsonResponse({"error": "Backup not found."}, status=404)
    try:
        path.unlink()
        audit_log(request.user, "delete", "backup", str(backup_id))
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
