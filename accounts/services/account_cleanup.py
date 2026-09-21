"""
Service utility for safe cleanup and deletion of mentee accounts and associated resources.
"""
import logging
import os
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, ProtectedError
from django.core.cache import cache

from accounts.models import UserProfile, MentorDocument

logger = logging.getLogger(__name__)
User = get_user_model()


def get_mentee_queryset():
    """
    Returns a safe QuerySet of all User accounts with the mentee role.
    Strictly excludes superusers, staff, coordinators, and mentors to prevent accidental deletion.
    """
    mentee_filter = (
        Q(profile__role__iexact=UserProfile.ROLE_MENTEE)
        | Q(mentee_profile__isnull=False)
    )
    return (
        User.objects.filter(mentee_filter)
        .exclude(is_superuser=True)
        .exclude(is_staff=True)
        .exclude(profile__role__iexact=UserProfile.ROLE_COORDINATOR)
        .exclude(profile__role__iexact=UserProfile.ROLE_STUDENT_MENTOR)
        .exclude(profile__role__iexact=UserProfile.ROLE_INSTRUCTOR_MENTOR)
        .exclude(mentor_profile__isnull=False)
        .distinct()
        .order_by("id")
    )


def is_user_mentee(user):
    """
    Checks if a user instance is a mentee without being a coordinator, staff, or mentor.
    """
    if not user or user.is_superuser or user.is_staff:
        return False

    profile = getattr(user, "profile", None)
    role = (getattr(profile, "role", "") or "").upper()
    if role == UserProfile.ROLE_COORDINATOR:
        return False
    if role in (UserProfile.ROLE_STUDENT_MENTOR, UserProfile.ROLE_INSTRUCTOR_MENTOR):
        return False
    if hasattr(user, "mentor_profile"):
        return False

    return role == UserProfile.ROLE_MENTEE or hasattr(user, "mentee_profile")


def cleanup_user_uploaded_files(user):
    """
    Cleans up remote Cloudinary assets and local files for a user before account deletion.
    Handles:
    - MentorDocument records and Cloudinary assets
    - MenteeProfile verification documents
    - Media files associated with the user
    """
    # 1. Cloudinary assets recorded in MentorDocument
    try:
        docs = list(MentorDocument.objects.filter(user=user))
        if docs:
            has_cloudinary_config = bool(
                os.environ.get("CLOUDINARY_CLOUD_NAME")
                and os.environ.get("CLOUDINARY_API_KEY")
                and os.environ.get("CLOUDINARY_API_SECRET")
            )
            if has_cloudinary_config:
                try:
                    import cloudinary
                    import cloudinary.uploader

                    cloudinary.config(
                        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip(),
                        api_key=os.environ.get("CLOUDINARY_API_KEY", "").strip(),
                        api_secret=os.environ.get("CLOUDINARY_API_SECRET", "").strip(),
                    )
                    for doc in docs:
                        pid = getattr(doc, "cloudinary_public_id", None)
                        if pid:
                            try:
                                cloudinary.uploader.destroy(pid, resource_type="raw")
                            except Exception:
                                pass
                            try:
                                cloudinary.uploader.destroy(pid, resource_type="image")
                            except Exception:
                                pass
                except Exception as c_err:
                    logger.warning(f"Cloudinary cleanup failed for user {user.id}: {c_err}")
    except Exception as doc_err:
        logger.warning(f"Error querying MentorDocument for user {user.id}: {doc_err}")

    # 2. Verification documents on MenteeProfile
    try:
        mentee_profile = getattr(user, "mentee_profile", None)
        if mentee_profile:
            # Multi-document relation
            if hasattr(mentee_profile, "verification_documents"):
                for vdoc in mentee_profile.verification_documents.all():
                    if getattr(vdoc, "file", None):
                        try:
                            vdoc.file.delete(save=False)
                        except Exception as f_err:
                            logger.warning(f"Failed to delete verification doc {vdoc.id}: {f_err}")

            # Legacy single file field
            legacy_file = getattr(mentee_profile, "verification_document", None)
            if legacy_file:
                try:
                    legacy_file.delete(save=False)
                except Exception as f_err:
                    logger.warning(f"Failed to delete legacy verification doc for user {user.id}: {f_err}")
    except Exception as mp_err:
        logger.warning(f"Error during MenteeProfile file cleanup for user {user.id}: {mp_err}")

    # 3. CloudinaryMediaFile entries (if path includes user ID)
    try:
        from api.models import CloudinaryMediaFile
        CloudinaryMediaFile.objects.filter(path__icontains=f"user_{user.id}").delete()
    except Exception:
        pass


def delete_single_mentee(user, delete_files=True):
    """
    Safely deletes a single mentee user and cascades associated records.
    Returns (success: bool, message: str).
    """
    if not is_user_mentee(user):
        return (
            False,
            f"User '{user.username}' (ID {user.id}) is not an eligible mentee (may be staff, coordinator, or mentor). Deletion skipped for safety.",
        )

    username = user.username
    user_id = user.id

    if delete_files:
        cleanup_user_uploaded_files(user)

    # Invalidate caches
    try:
        cache.delete(f"api:me:v1:{user_id}")
    except Exception:
        pass

    try:
        with transaction.atomic():
            user.delete()
        return True, f"Successfully deleted mentee account '{username}' (ID: {user_id})."
    except ProtectedError as pe:
        protected_list = list(pe.protected_objects)
        repr_list = [f"{obj._meta.label}:{getattr(obj, 'pk', repr(obj))}" for obj in protected_list[:5]]
        more_count = max(0, len(protected_list) - 5)
        more_str = f" and {more_count} more" if more_count > 0 else ""
        err_msg = (
            f"ProtectedError: Cannot delete '{username}' (ID: {user_id}) because it is referenced "
            f"by protected database objects: {', '.join(repr_list)}{more_str}."
        )
        logger.error(err_msg)
        return False, err_msg
    except Exception as exc:
        err_msg = f"Unexpected error deleting '{username}' (ID: {user_id}): {exc}"
        logger.error(err_msg, exc_info=True)
        return False, err_msg


def bulk_delete_mentees(queryset=None, delete_files=True):
    """
    Bulk-deletes mentee accounts in the provided queryset (or all mentees if None).
    Returns a summary dictionary:
      {
        "total_targeted": int,
        "deleted_count": int,
        "failed_count": int,
        "results": list of {"user_id": int, "username": str, "success": bool, "message": str}
      }
    """
    if queryset is None:
        queryset = get_mentee_queryset()

    targeted_users = list(queryset)
    total_targeted = len(targeted_users)
    deleted_count = 0
    failed_count = 0
    results = []

    for user in targeted_users:
        u_id = user.id
        u_name = user.username
        success, msg = delete_single_mentee(user, delete_files=delete_files)
        if success:
            deleted_count += 1
        else:
            failed_count += 1
        results.append({
            "user_id": u_id,
            "username": u_name,
            "success": success,
            "message": msg,
        })

    return {
        "total_targeted": total_targeted,
        "deleted_count": deleted_count,
        "failed_count": failed_count,
        "results": results,
    }
