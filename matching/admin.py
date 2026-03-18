from django.contrib import admin

from .models import Subject, Topic, MentoringSession, Notification, MenteeMentorRequest, UserPost, PostComment


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("name", "subject")
    list_filter = ("subject",)
    search_fields = ("name", "subject__name")


@admin.register(MentoringSession)
class MentoringSessionAdmin(admin.ModelAdmin):
    list_display = ("mentor", "mentee", "subject", "topic", "scheduled_at", "status")
    list_filter = ("status", "subject", "topic")
    search_fields = ("mentor__user__username", "mentee__user__username")


@admin.register(MenteeMentorRequest)
class MenteeMentorRequestAdmin(admin.ModelAdmin):
    list_display = ("mentee", "mentor", "created_at")
    list_filter = ("created_at",)
    search_fields = ("mentee__user__username", "mentor__user__username")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "message", "is_read", "created_at")
    list_filter = ("is_read",)


@admin.register(UserPost)
class UserPostAdmin(admin.ModelAdmin):
    list_display = ("author", "category", "created_at")
    list_filter = ("category",)
    search_fields = ("author__username", "text")


@admin.register(PostComment)
class PostCommentAdmin(admin.ModelAdmin):
    list_display = ("author", "post", "created_at")
    list_filter = ("created_at",)
    search_fields = ("author__username", "content")
