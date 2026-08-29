from django.contrib import admin
from .models import MentorProfile, MenteeProfile, InterestTag, VerificationDocument
from matching.models import Notification


class MentorVerificationDocumentInline(admin.TabularInline):
    model = VerificationDocument
    fk_name = "mentor"
    extra = 0
    fields = ("kind", "file", "original_name", "uploaded_at")
    readonly_fields = ("uploaded_at",)
    exclude = ("mentee",)


class MenteeVerificationDocumentInline(admin.TabularInline):
    model = VerificationDocument
    fk_name = "mentee"
    extra = 0
    fields = ("kind", "file", "original_name", "uploaded_at")
    readonly_fields = ("uploaded_at",)
    exclude = ("mentor",)


@admin.register(MentorProfile)
class MentorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "program", "year_level", "capacity", "approved")
    search_fields = ("user__username", "program")
    list_filter = ("program", "year_level", "approved")
    inlines = (MentorVerificationDocumentInline,)
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
    inlines = (MenteeVerificationDocumentInline,)


@admin.register(InterestTag)
class InterestTagAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
