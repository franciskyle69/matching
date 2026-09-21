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
	STATUS_PENDING = "PENDING"
	STATUS_PENDING_APPROVAL = "PENDING_APPROVAL"
	STATUS_REJECTED = "REJECTED"
	APPROVAL_CHOICES = [
		(STATUS_PENDING, "Pending Approval"),
		(STATUS_ACTIVE, "Active / Approved"),
		(STATUS_REJECTED, "Rejected"),
	]
	APPROVAL_STATUS_CHOICES = [
		(STATUS_PENDING, "Pending Approval"),
		(STATUS_ACTIVE, "Active / Approved"),
		(STATUS_REJECTED, "Rejected"),
		(STATUS_PENDING_APPROVAL, "Pending Approval"),
	]

	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="profile",
	)
	role = models.CharField(max_length=20, choices=ROLE_CHOICES)
	approval_status = models.CharField(
		max_length=20,
		choices=APPROVAL_CHOICES,
		default=STATUS_PENDING,
		db_index=True,
	)
	is_onboarded = models.BooleanField(default=False, db_index=True)
	is_email_verified = models.BooleanField(default=False, db_index=True)
	student_id_no = models.CharField(max_length=20, blank=True, default="")
	contact_no = models.CharField(max_length=11, blank=True, default="")
	admission_type = models.CharField(max_length=100, blank=True, default="")
	sex = models.CharField(max_length=10, blank=True, default="")
	campus = models.CharField(max_length=100, blank=True, default="Main")
	program = models.CharField(max_length=100, blank=True, default="BSIT")
	year_level = models.PositiveSmallIntegerField(null=True, blank=True)
	bio = models.TextField(max_length=200, blank=True, default="")
	avatar_url = models.URLField(max_length=500, blank=True, default="")
	interest_tags = models.ManyToManyField(
		"profiles.InterestTag",
		blank=True,
		related_name="user_profiles",
	)

	def save(self, *args, **kwargs):
		if not self.pk and not self.approval_status:
			if self.role == self.ROLE_COORDINATOR or (self.user_id and getattr(self.user, "is_staff", False)):
				self.approval_status = self.STATUS_ACTIVE
			else:
				self.approval_status = self.STATUS_PENDING
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
	DOC_PROOF_OF_ENROLLMENT = "PROOF_OF_ENROLLMENT"
	DOC_STUDENT_ID = "STUDENT_ID"
	DOC_CERTIFICATE = "CERTIFICATE"
	DOC_APPLICATION = "APPLICATION"
	DOCUMENT_TYPE_CHOICES = [
		(DOC_LETTER_OF_INTENT, "Letter of Intent"),
		(DOC_STUDY_LOAD, "Study Load"),
		(DOC_GRADES, "Grades"),
		(DOC_FACULTY_VERIFICATION, "Faculty Verification"),
		(DOC_PROOF_OF_ENROLLMENT, "Proof of Enrollment"),
		(DOC_STUDENT_ID, "Student / Employee ID Card"),
		(DOC_CERTIFICATE, "Certificate"),
		(DOC_APPLICATION, "Application Form"),
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
	approval_status = UserProfile.STATUS_PENDING
	if getattr(user, "is_staff", False) or getattr(user, "is_superuser", False):
		role = UserProfile.ROLE_COORDINATOR
		approval_status = UserProfile.STATUS_ACTIVE
	elif hasattr(user, "mentor_profile"):
		m = user.mentor_profile
		is_inst = "instructor" in str(getattr(m, "role", "")).lower() or (
			user.email and user.email.lower().endswith("@buksu.edu.ph") and not user.email.lower().endswith("@student.buksu.edu.ph")
		)
		role = UserProfile.ROLE_INSTRUCTOR_MENTOR if is_inst else UserProfile.ROLE_STUDENT_MENTOR
		approval_status = UserProfile.STATUS_ACTIVE if getattr(m, "approved", False) else UserProfile.STATUS_PENDING
	elif hasattr(user, "mentee_profile"):
		m = user.mentee_profile
		role = UserProfile.ROLE_MENTEE
		approval_status = UserProfile.STATUS_ACTIVE if getattr(m, "approved", False) else UserProfile.STATUS_PENDING

	sec = getattr(user, "security_state", None)
	is_onboarded = bool(sec and sec.is_onboarded)
	is_email_verified = bool(getattr(user, "is_staff", False) or getattr(user, "is_superuser", False))
	if not is_email_verified:
		try:
			from allauth.account.models import EmailAddress
			is_email_verified = EmailAddress.objects.filter(user=user, verified=True).exists()
		except Exception:
			pass
	profile, _ = UserProfile.objects.get_or_create(
		user=user,
		defaults={
			"role": role,
			"approval_status": approval_status,
			"is_onboarded": is_onboarded,
			"is_email_verified": is_email_verified,
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


from django.contrib.auth import get_user_model
_UserModel = get_user_model()

if not hasattr(_UserModel, "approval_status"):
	def _user_get_approval_status(self):
		profile = getattr(self, "profile", None)
		if profile is not None and getattr(profile, "approval_status", None):
			return profile.approval_status
		if getattr(self, "is_staff", False) or getattr(self, "is_superuser", False):
			return UserProfile.STATUS_ACTIVE
		if hasattr(self, "mentor_profile") and getattr(self.mentor_profile, "approved", False):
			return UserProfile.STATUS_ACTIVE
		if hasattr(self, "mentee_profile") and getattr(self.mentee_profile, "approved", False):
			return UserProfile.STATUS_ACTIVE
		return UserProfile.STATUS_PENDING

	def _user_set_approval_status(self, value):
		profile = getattr(self, "profile", None)
		if profile is not None:
			profile.approval_status = value
			try:
				profile.save(update_fields=["approval_status"])
			except Exception:
				pass

	_UserModel.approval_status = property(_user_get_approval_status, _user_set_approval_status)

if not hasattr(_UserModel, "is_onboarded"):
	def _user_get_is_onboarded(self):
		profile = getattr(self, "profile", None)
		if profile is not None:
			return bool(profile.is_onboarded)
		return False

	def _user_set_is_onboarded(self, value):
		profile = getattr(self, "profile", None)
		if profile is not None:
			profile.is_onboarded = bool(value)

	_UserModel.is_onboarded = property(_user_get_is_onboarded, _user_set_is_onboarded)

if not hasattr(_UserModel, "is_email_verified"):
	def _user_get_is_email_verified(self):
		profile = getattr(self, "profile", None)
		if profile is not None:
			return bool(getattr(profile, "is_email_verified", False))
		return False

	def _user_set_is_email_verified(self, value):
		profile = getattr(self, "profile", None)
		if profile is not None:
			profile.is_email_verified = bool(value)
			try:
				profile.save(update_fields=["is_email_verified"])
			except Exception:
				pass

	_UserModel.is_email_verified = property(_user_get_is_email_verified, _user_set_is_email_verified)


