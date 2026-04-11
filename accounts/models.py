from django.conf import settings
from django.db import models


class UserSecurityState(models.Model):
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="security_state")
	must_change_password = models.BooleanField(default=False, db_column="force_password_change")

	def __str__(self):
		return f"UserSecurityState<{self.user_id}>"


def get_user_display_name(user):
	parts = [getattr(user, "first_name", ""), getattr(user, "last_name", "")]
	display_name = " ".join(part.strip() for part in parts if part and part.strip())
	if display_name:
		return display_name
	return getattr(user, "email", "") or getattr(user, "username", "") or ""


def get_user_security_state(user, create=False):
	if not user or not getattr(user, "pk", None):
		return None
	state = getattr(user, "security_state", None)
	if state is not None:
		return state
	if not create:
		return None
	state, _ = UserSecurityState.objects.get_or_create(user=user)
	return state


def must_change_password(user):
	state = get_user_security_state(user, create=False)
	return bool(state and state.must_change_password)


def set_must_change_password(user, value=True):
	state = get_user_security_state(user, create=True)
	state.must_change_password = bool(value)
	state.save(update_fields=["must_change_password"])
	return state
