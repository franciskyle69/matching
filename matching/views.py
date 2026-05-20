from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Prefetch

from .models import Subject, Topic, Notification
from .forms import SubjectForm


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
