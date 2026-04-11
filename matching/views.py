from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Prefetch
from django.utils import timezone

from profiles.models import MentorProfile, MenteeProfile
from .models import Subject, Topic, MentoringSession, Notification
from .forms import SubjectForm, MentoringSessionForm, MentoringSessionRescheduleForm


@login_required
def subject_list(request):
    if not request.user.is_staff:
        messages.error(request, "Admins only.")
        return redirect("home")
    subjects = Subject.objects.prefetch_related(
        Prefetch("topics", queryset=Topic.objects.order_by("name"))
    ).order_by("name")
    return render(request, "matching/subjects_list.html", {"subjects": subjects})


@login_required
def subject_create(request):
    if not request.user.is_staff:
        messages.error(request, "Admins only.")
        return redirect("home")
    messages.error(request, "Subject creation is disabled. Subjects are predefined.")
    return redirect("subjects_list")


@login_required
def subject_edit(request, subject_id: int):
    if not request.user.is_staff:
        messages.error(request, "Admins only.")
        return redirect("home")
    subject = get_object_or_404(
        Subject.objects.prefetch_related(Prefetch("topics", queryset=Topic.objects.order_by("name"))),
        id=subject_id,
    )
    if request.method == "POST":
        form = SubjectForm(request.POST, instance=subject)
        if form.is_valid():
            form.save()
            messages.success(request, "Subject updated.")
            return redirect("subjects_list")
    else:
        form = SubjectForm(instance=subject)
    return render(
        request,
        "matching/subject_form.html",
        {"form": form, "title": "Edit Subject", "subject": subject, "topics": subject.topics.all()},
    )


@login_required
def subject_delete(request, subject_id: int):
    if not request.user.is_staff:
        messages.error(request, "Admins only.")
        return redirect("home")
    messages.error(request, "Subject deletion is disabled. Subjects are predefined.")
    return redirect("subjects_list")


@login_required
def session_list(request):
    mentor = getattr(request.user, "mentor_profile", None)
    mentee = getattr(request.user, "mentee_profile", None)

    qs = MentoringSession.objects.select_related("mentor", "mentee", "subject")
    if mentor:
        qs = qs.filter(mentor=mentor)
    elif mentee:
        qs = qs.filter(mentee=mentee)
    else:
        qs = qs.none()

    upcoming = qs.filter(status="scheduled").order_by("scheduled_at")
    history = qs.exclude(status="scheduled").order_by("-scheduled_at")
    return render(
        request,
        "matching/sessions_list.html",
        {"upcoming": upcoming, "history": history, "is_mentor": bool(mentor)},
    )


@login_required
def session_create(request):
    mentor_profile = getattr(request.user, "mentor_profile", None)
    if not mentor_profile:
        messages.error(request, "Only mentors can schedule sessions.")
        return redirect("sessions_list")
    if not mentor_profile.approved:
        messages.error(request, "Your mentor account is pending admin approval.")
        return redirect("sessions_list")
    if request.method == "POST":
        form = MentoringSessionForm(request.POST)
        if form.is_valid():
            session = form.save(commit=False)
            session.mentor = mentor_profile
            start = session.scheduled_at
            end = start + timezone.timedelta(minutes=session.duration_minutes)

            def overlaps(existing_start, existing_end):
                return existing_start < end and start < existing_end

            mentor_sessions = MentoringSession.objects.filter(
                status="scheduled", mentor=session.mentor
            )
            mentee_sessions = MentoringSession.objects.filter(
                status="scheduled", mentee=session.mentee
            )
            conflict_found = False
            for s in list(mentor_sessions) + list(mentee_sessions):
                existing_start = s.scheduled_at
                existing_end = existing_start + timezone.timedelta(minutes=s.duration_minutes)
                if overlaps(existing_start, existing_end):
                    conflict_found = True
                    break

            if conflict_found:
                messages.error(request, "Schedule conflict detected. Please choose a different time.")
                return render(request, "matching/session_form.html", {"form": form})

            session.save()
            Notification.objects.create(
                user=session.mentor.user,
                message=f"New mentoring session scheduled with {session.mentee.user.username}.",
            )
            Notification.objects.create(
                user=session.mentee.user,
                message=f"New mentoring session scheduled with {session.mentor.user.username}.",
            )
            messages.success(request, "Session scheduled.")
            return redirect("sessions_list")
    else:
        form = MentoringSessionForm()
    return render(request, "matching/session_form.html", {"form": form})


@login_required
def session_reschedule(request, session_id: int):
    mentor_profile = getattr(request.user, "mentor_profile", None)
    if not mentor_profile:
        messages.error(request, "Only mentors can reschedule sessions.")
        return redirect("sessions_list")

    session = get_object_or_404(MentoringSession, id=session_id)
    if session.mentor_id != mentor_profile.id:
        messages.error(request, "You can only reschedule your own sessions.")
        return redirect("sessions_list")
    if session.status != "scheduled":
        messages.error(request, "Only scheduled sessions can be rescheduled.")
        return redirect("sessions_list")

    old_time = session.scheduled_at
    if request.method == "POST":
        form = MentoringSessionRescheduleForm(request.POST, instance=session)
        if form.is_valid():
            updated = form.save()
            if updated.scheduled_at != old_time:
                Notification.objects.create(
                    user=updated.mentee.user,
                    message=f"Your session with {updated.mentor.user.username} was rescheduled.",
                )
                Notification.objects.create(
                    user=updated.mentor.user,
                    message=f"Session with {updated.mentee.user.username} was rescheduled.",
                )
            messages.success(request, "Session updated.")
            return redirect("sessions_list")
    else:
        form = MentoringSessionRescheduleForm(instance=session)
    return render(request, "matching/session_reschedule.html", {"form": form, "session": session})


@login_required
def session_update_status(request, session_id: int, status: str):
    mentor_profile = getattr(request.user, "mentor_profile", None)
    if not mentor_profile:
        messages.error(request, "Only mentors can update sessions.")
        return redirect("sessions_list")

    session = get_object_or_404(MentoringSession, id=session_id)
    if session.mentor_id != mentor_profile.id:
        messages.error(request, "You can only update your own sessions.")
        return redirect("sessions_list")

    if status not in ("completed", "cancelled"):
        messages.error(request, "Invalid status.")
        return redirect("sessions_list")

    if request.method == "POST":
        session.status = status
        session.save()
        Notification.objects.create(
            user=session.mentee.user,
            message=f"Your session with {session.mentor.user.username} was marked {status}.",
        )
        messages.success(request, f"Session marked {status}.")
        return redirect("sessions_list")

    return render(
        request,
        "matching/session_update_status.html",
        {"session": session, "status": status},
    )


@login_required
def notifications_list(request):
    items = Notification.objects.filter(user=request.user).order_by("-created_at")
    return render(request, "matching/notifications_list.html", {"items": items})


@login_required
def notifications_mark_all_read(request):
    if request.method == "POST":
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        messages.success(request, "All notifications marked as read.")
    return redirect("notifications_list")


@login_required
def notification_mark_read(request, notification_id: int):
    item = get_object_or_404(Notification, id=notification_id, user=request.user)
    if request.method == "POST":
        item.is_read = True
        item.save()
        return redirect("notifications_list")
    return render(request, "matching/notification_mark_read.html", {"item": item})
