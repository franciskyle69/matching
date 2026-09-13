from django.conf import settings
from django.db import models


class UserSecurityState(models.Model):
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="security_state")
	must_change_password = models.BooleanField(default=False, db_column="force_password_change")
	is_onboarded = models.BooleanField(default=False)

	def __str__(self):
		return f"UserSecurityState<{self.user_id}>"


class UserProfile(models.Model):
	ROLE_MENTEE = "MENTEE"
	ROLE_STUDENT_MENTOR = "STUDENT_MENTOR"
	ROLE_INSTRUCTOR_MENTOR = "INSTRUCTOR_MENTOR"
	ROLE_COORDINATOR = "COORDINATOR"
	ROLE_CHOICES = [
		(ROLE_MENTEE, "Mentee"),
		(ROLE_STUDENT_MENTOR, "Student Mentor"),
		(ROLE_INSTRUCTOR_MENTOR, "Instructor Mentor"),
		(ROLE_COORDINATOR, "Coordinator"),
	]

	STATUS_ACTIVE = "ACTIVE"
	STATUS_PENDING_APPROVAL = "PENDING_APPROVAL"
	STATUS_REJECTED = "REJECTED"
	APPROVAL_STATUS_CHOICES = [
		(STATUS_ACTIVE, "Active"),
		(STATUS_PENDING_APPROVAL, "Pending Approval"),
		(STATUS_REJECTED, "Rejected"),
	]

	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="profile",
	)
	role = models.CharField(max_length=20, choices=ROLE_CHOICES)
	approval_status = models.CharField(
		max_length=20,
		choices=APPROVAL_STATUS_CHOICES,
		default=STATUS_ACTIVE,
	)
	is_onboarded = models.BooleanField(default=False)
	campus = models.CharField(max_length=100, blank=True, default="")
	program = models.CharField(max_length=100, blank=True, default="BSIT")
	year_level = models.PositiveSmallIntegerField(null=True, blank=True)

	def save(self, *args, **kwargs):
		if not self.pk and not self.approval_status:
			if self.role in (self.ROLE_STUDENT_MENTOR, self.ROLE_INSTRUCTOR_MENTOR):
				self.approval_status = self.STATUS_PENDING_APPROVAL
			else:
				self.approval_status = self.STATUS_ACTIVE
		super().save(*args, **kwargs)
		# Keep UserSecurityState.is_onboarded in sync
		try:
			sec_state, _ = UserSecurityState.objects.get_or_create(user=self.user)
			if sec_state.is_onboarded != self.is_onboarded:
				sec_state.is_onboarded = self.is_onboarded
				sec_state.save(update_fields=["is_onboarded"])
		except Exception:
			pass

	def __str__(self):
		return f"UserProfile<{self.user.username}:{self.role}:{self.approval_status}>"


class MentorDocument(models.Model):
	DOC_LETTER_OF_INTENT = "LETTER_OF_INTENT"
	DOC_STUDY_LOAD = "STUDY_LOAD"
	DOC_GRADES = "GRADES"
	DOC_FACULTY_VERIFICATION = "FACULTY_VERIFICATION"
	DOCUMENT_TYPE_CHOICES = [
		(DOC_LETTER_OF_INTENT, "Letter of Intent"),
		(DOC_STUDY_LOAD, "Study Load"),
		(DOC_GRADES, "Grades"),
		(DOC_FACULTY_VERIFICATION, "Faculty Verification"),
	]

	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="documents",
	)
	document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
	cloudinary_url = models.URLField(max_length=500)
	cloudinary_public_id = models.CharField(max_length=255)
	uploaded_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-uploaded_at"]
		indexes = [
			models.Index(fields=["user", "document_type"], name="acc_doc_user_type"),
		]

	def __str__(self):
		return f"MentorDocument<{self.user.username}:{self.document_type}>"


def get_user_profile(user, create_default=True):
	if not user or not getattr(user, "pk", None):
		return None
	profile = getattr(user, "profile", None)
	if profile is not None:
		return profile
	if not create_default:
		return None
	role = UserProfile.ROLE_MENTEE
	approval_status = UserProfile.STATUS_ACTIVE
	if getattr(user, "is_staff", False):
		role = UserProfile.ROLE_COORDINATOR
		approval_status = UserProfile.STATUS_ACTIVE
	elif hasattr(user, "mentor_profile"):
		m = user.mentor_profile
		is_inst = "instructor" in str(getattr(m, "role", "")).lower() or (
			user.email and user.email.lower().endswith("@buksu.edu.ph") and not user.email.lower().endswith("@student.buksu.edu.ph")
		)
		role = UserProfile.ROLE_INSTRUCTOR_MENTOR if is_inst else UserProfile.ROLE_STUDENT_MENTOR
		approval_status = UserProfile.STATUS_ACTIVE if getattr(m, "approved", False) else UserProfile.STATUS_PENDING_APPROVAL
	elif hasattr(user, "mentee_profile"):
		m = user.mentee_profile
		role = UserProfile.ROLE_MENTEE
		approval_status = UserProfile.STATUS_ACTIVE if getattr(m, "approved", False) else UserProfile.STATUS_PENDING_APPROVAL

	sec = getattr(user, "security_state", None)
	is_onboarded = bool(sec and sec.is_onboarded)
	profile, _ = UserProfile.objects.get_or_create(
		user=user,
		defaults={
			"role": role,
			"approval_status": approval_status,
			"is_onboarded": is_onboarded,
		},
	)
	return profile


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
