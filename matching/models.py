from django.db import models
from django.contrib.auth.models import User

from profiles.models import MentorProfile, MenteeProfile


class Subject(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.name


class Topic(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name="topics")
    name = models.CharField(max_length=150)

    class Meta:
        unique_together = ("subject", "name")

    def __str__(self) -> str:
        return f"{self.subject.name} - {self.name}"


class MentoringSession(models.Model):
    STATUS_CHOICES = (
        ("scheduled", "Scheduled"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    )

    mentor = models.ForeignKey(MentorProfile, on_delete=models.CASCADE)
    mentee = models.ForeignKey(MenteeProfile, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, null=True, blank=True, on_delete=models.SET_NULL)
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.SET_NULL)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(default=60)
    notes = models.TextField(blank=True, help_text="Agenda or materials when scheduling.")
    meeting_notes = models.TextField(blank=True, help_text="Notes taken during or after the session.")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="scheduled")
    reminder_24h_sent = models.BooleanField(default=False)
    reminder_1h_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["mentor", "scheduled_at"]),
            models.Index(fields=["mentee", "scheduled_at"]),
            models.Index(fields=["status", "scheduled_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(duration_minutes__gte=15),
                name="session_duration_minutes_gte_15",
            ),
        ]

    def __str__(self) -> str:
        return f"Session({self.mentor_id}->{self.mentee_id} at {self.scheduled_at})"


class MenteeMentorRequest(models.Model):
    """Tracks when a mentee chooses a mentor; mentor can accept to make the pairing official."""
    mentee = models.ForeignKey(MenteeProfile, on_delete=models.CASCADE)
    mentor = models.ForeignKey(MentorProfile, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted = models.BooleanField(default=False)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("mentee", "mentor")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["mentor", "-created_at"], name="matching_mmr_mentor_created"),
            models.Index(fields=["mentor", "accepted"], name="matching_mmr_mentor_accepted"),
        ]

    def __str__(self) -> str:
        return f"MenteeRequest({self.mentee_id}->{self.mentor_id})"


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    action_tab = models.CharField(max_length=50, blank=True, default="", help_text="Tab to open when notification is clicked (e.g. matching, sessions).")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read"], name="matching_notif_user_read"),
        ]

    def __str__(self) -> str:
        return f"Notification<{self.user_id}>"


class Announcement(models.Model):
    """Mentor-posted announcement. If recipients exist, only they see it; else all mentees with sessions see it."""
    mentor = models.ForeignKey(MentorProfile, on_delete=models.CASCADE, related_name="announcements")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True, help_text="Soft delete; when set, hidden from lists.")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["mentor", "-created_at"], name="matching_ann_mentor_created"),
        ]

    def __str__(self) -> str:
        return f"Announcement<{self.mentor_id} @ {self.created_at}>"


class AnnouncementRecipient(models.Model):
    """Optional: restrict an announcement to specific user(s). Empty = visible to all mentor's mentees."""
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name="recipients")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="announcement_recipient_entries")

    class Meta:
        unique_together = [("announcement", "user")]
        indexes = [
            models.Index(fields=["announcement"], name="matching_ann_recip_ann"),
            models.Index(fields=["user"], name="matching_ann_recip_user"),
        ]

    def __str__(self) -> str:
        return f"AnnouncementRecipient(ann={self.announcement_id} user={self.user_id})"


class Comment(models.Model):
    """Comment on an announcement or a session (Google Classroom-style)."""
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    # Exactly one of session or announcement must be set
    session = models.ForeignKey(
        MentoringSession, on_delete=models.CASCADE, null=True, blank=True, related_name="comments"
    )
    announcement = models.ForeignKey(
        Announcement, on_delete=models.CASCADE, null=True, blank=True, related_name="comments"
    )

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["session"], name="matching_cmt_session"),
            models.Index(fields=["announcement"], name="matching_cmt_announcement"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    (models.Q(session__isnull=False) & models.Q(announcement__isnull=True))
                    | (models.Q(session__isnull=True) & models.Q(announcement__isnull=False))
                ),
                name="comment_session_xor_announcement",
            ),
        ]

    def __str__(self) -> str:
        return f"Comment<{self.author_id} on session={self.session_id} ann={self.announcement_id}>"


class UserPost(models.Model):
    CATEGORY_CHOICES = (
        ("achievement", "Achievement"),
        ("project", "Project"),
        ("update", "Update"),
    )
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to="posts/%Y/%m/", blank=True, null=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="update")
    likes = models.ManyToManyField(User, related_name="liked_posts", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["author", "-created_at"], name="userpost_author_created"),
        ]

    def __str__(self) -> str:
        return f"Post<{self.author_id} {self.category} @ {self.created_at}>"


class PostComment(models.Model):
    post = models.ForeignKey(UserPost, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="post_comments")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["post", "created_at"], name="postcmt_post_created"),
        ]

    def __str__(self) -> str:
        return f"PostComment<{self.author_id} on post={self.post_id}>"


class AuditLog(models.Model):
    """Simple audit trail: who did what to which model."""
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="audit_logs")
    action = models.CharField(max_length=32)  # e.g. create, update, delete, approve
    model_name = models.CharField(max_length=64)  # e.g. session, announcement, mentor_approval
    object_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["model_name", "object_id"], name="audit_model_object")]

    def __str__(self) -> str:
        return f"Audit<{self.action} {self.model_name}:{self.object_id} by {self.user_id}>"
