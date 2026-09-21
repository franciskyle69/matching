"""
Admin configuration for accounts app.
Includes custom UserAdmin with bulk action for safe mentee account deletion.
"""

from django.contrib import admin
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.shortcuts import render
from django.template.response import TemplateResponse

from .models import UserProfile, MentorDocument, UserSecurityState
from .services.account_cleanup import (
    is_user_mentee,
    bulk_delete_mentees,
)

User = get_user_model()


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = "Profile"
    fk_name = "user"
    extra = 0


class UserSecurityStateInline(admin.TabularInline):
    model = UserSecurityState
    can_delete = False
    verbose_name_plural = "Security State"
    fk_name = "user"
    extra = 0


class MentorDocumentInline(admin.TabularInline):
    model = MentorDocument
    extra = 0
    readonly_fields = ("uploaded_at",)


# Unregister default UserAdmin if registered
if admin.site.is_registered(User):
    admin.site.unregister(User)


@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline, UserSecurityStateInline, MentorDocumentInline)
    actions = ["delete_selected_mentees"]

    @admin.action(description="Delete selected mentee accounts (with cascade & file cleanup)")
    def delete_selected_mentees(self, request, queryset):
        """
        Custom admin action to bulk-delete selected mentee accounts with confirmation.
        """
        # If the user confirmed via the intermediate confirmation page:
        if request.POST.get("confirmed") == "yes":
            mentees_to_delete = [u for u in queryset if is_user_mentee(u)]
            skipped_count = len(queryset) - len(mentees_to_delete)

            if not mentees_to_delete:
                self.message_user(
                    request,
                    "No valid mentee accounts were found among the selection to delete.",
                    level=messages.WARNING,
                )
                return None

            result = bulk_delete_mentees(queryset=mentees_to_delete, delete_files=True)
            deleted = result["deleted_count"]
            failed = result["failed_count"]

            msg = f"Successfully deleted {deleted} mentee account(s)."
            if skipped_count > 0:
                msg += f" {skipped_count} non-mentee account(s) were safely skipped."
            if failed > 0:
                msg += f" {failed} account(s) could not be deleted due to errors (check logs)."
                self.message_user(request, msg, level=messages.WARNING)
            else:
                self.message_user(request, msg, level=messages.SUCCESS)
            return None

        # Partition selection into eligible mentees and non-mentees
        mentees = [u for u in queryset if is_user_mentee(u)]
        non_mentees = [u for u in queryset if not is_user_mentee(u)]

        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "queryset": queryset,
            "mentees": mentees,
            "non_mentees": non_mentees,
            "action_checkbox_name": admin.helpers.ACTION_CHECKBOX_NAME,
        }
        return TemplateResponse(request, "admin/delete_mentees_confirmation.html", context)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "approval_status", "is_onboarded", "program", "year_level")
    list_filter = ("role", "approval_status", "is_onboarded", "program", "year_level")
    search_fields = ("user__username", "user__email", "student_id_no", "program")


@admin.register(MentorDocument)
class MentorDocumentAdmin(admin.ModelAdmin):
    list_display = ("user", "document_type", "cloudinary_public_id", "uploaded_at")
    list_filter = ("document_type", "uploaded_at")
    search_fields = ("user__username", "user__email", "cloudinary_public_id")
    readonly_fields = ("uploaded_at",)
