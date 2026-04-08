def get_user_display_name(user):
	parts = [getattr(user, "first_name", ""), getattr(user, "last_name", "")]
	display_name = " ".join(part.strip() for part in parts if part and part.strip())
	if display_name:
		return display_name
	return getattr(user, "email", "") or getattr(user, "username", "") or ""
