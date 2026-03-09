from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import MentorProfile, MenteeProfile


MATCHING_PROFILES_VERSION_KEY = "matching:profiles_version"


def _bump_matching_profiles_version():
    try:
        cache.incr(MATCHING_PROFILES_VERSION_KEY)
    except ValueError:
        # Key does not exist yet
        cache.set(MATCHING_PROFILES_VERSION_KEY, 1)


def _invalidate_approval_cache(sender, instance, update_fields=None, **kwargs):
    """Invalidate user approval cache when a profile's approved state may have changed."""
    if update_fields is not None and "approved" not in update_fields:
        return
    if getattr(instance, "id", None) is None:
        return
    if sender is MentorProfile:
        cache.delete(f"user_approval:mentor:{instance.id}")
    elif sender is MenteeProfile:
        cache.delete(f"user_approval:mentee:{instance.id}")


@receiver(post_save, sender=MentorProfile)
@receiver(post_delete, sender=MentorProfile)
@receiver(post_save, sender=MenteeProfile)
@receiver(post_delete, sender=MenteeProfile)
def _matching_profiles_changed(sender, **kwargs):
    _bump_matching_profiles_version()


@receiver(post_save, sender=MentorProfile)
@receiver(post_save, sender=MenteeProfile)
def _invalidate_approval_on_save(sender, instance, update_fields=None, **kwargs):
    _invalidate_approval_cache(sender, instance, update_fields=update_fields, **kwargs)

