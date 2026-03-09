from django.contrib import admin
from .models import MentorProfile, MenteeProfile
from matching.models import Notification


@admin.register(MentorProfile)
class MentorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "program", "year_level", "capacity", "approved")
    search_fields = ("user__username", "program")
    list_filter = ("program", "year_level", "approved")
    actions = ("approve_mentors",)

    def approve_mentors(self, request, queryset):
        updated = queryset.update(approved=True)
        for mentor in queryset:
            Notification.objects.create(
                user=mentor.user,
                message="Your mentor account has been approved.",
            )
        self.message_user(request, f"Approved {updated} mentor(s).")

    approve_mentors.short_description = "Approve selected mentors"


@admin.register(MenteeProfile)
class MenteeProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "program", "year_level")
    search_fields = ("user__username", "program")
    list_filter = ("program", "year_level")
