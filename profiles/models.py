from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User


def verification_document_upload_path(instance, filename):
    role = "mentor" if getattr(instance._meta, "model_name", "") == "mentorprofile" else "mentee"
    user_id = getattr(instance, "user_id", "unknown")
    return f"verification_documents/{role}/user_{user_id}/{filename}"


class InterestTag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class MentorProfile(models.Model):
    GENDER_CHOICES = (
        ("male", "Male"),
        ("female", "Female"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='mentor_profile')
    program = models.CharField(max_length=100)
    year_level = models.PositiveSmallIntegerField()
    gpa = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    avatar_url = models.URLField(blank=True, default="")
    cover_url = models.URLField(blank=True, default="")
    bio = models.TextField(max_length=200, blank=True, default="")
    skills = models.JSONField(default=list, blank=True)
    availability = models.JSONField(default=list, blank=True)
    interests = models.TextField(blank=True)
    interest_tags = models.ManyToManyField(InterestTag, blank=True, related_name="mentor_profiles")
    capacity = models.PositiveSmallIntegerField(default=1)
    role = models.CharField(max_length=50, blank=True)
    subjects = models.JSONField(default=list, blank=True)
    topics = models.JSONField(default=list, blank=True)
    competencies = models.ManyToManyField(
        "matching.Competency",
        blank=True,
        related_name="mentor_profiles",
    )
    years_experience = models.PositiveSmallIntegerField(null=True, blank=True)
    teaching_experience_years = models.PositiveSmallIntegerField(null=True, blank=True)
    expertise_level = models.PositiveSmallIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, default="")
    verification_document = models.FileField(
        upload_to=verification_document_upload_path,
        blank=True,
    )
    approved = models.BooleanField(default=False)

    def __str__(self):
        return f"MentorProfile<{self.user.username}>"


class MenteeProfile(models.Model):
    PREFERRED_GENDER_CHOICES = (
        ("male", "Male"),
        ("female", "Female"),
        ("no_preference", "No Preference"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='mentee_profile')
    program = models.CharField(max_length=100)
    year_level = models.PositiveSmallIntegerField()
    gpa = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    avatar_url = models.URLField(blank=True, default="")
    cover_url = models.URLField(blank=True, default="")
    bio = models.TextField(max_length=200, blank=True, default="")
    skills = models.JSONField(default=list, blank=True)
    availability = models.JSONField(default=list, blank=True)
    interests = models.TextField(blank=True)
    interest_tags = models.ManyToManyField(InterestTag, blank=True, related_name="mentee_profiles")
    campus = models.CharField(max_length=100, blank=True)
    student_id_no = models.CharField(max_length=10, blank=True)
    contact_no = models.CharField(max_length=11, blank=True)
    admission_type = models.CharField(max_length=100, blank=True)
    sex = models.CharField(max_length=10, blank=True)
    subjects = models.JSONField(default=list, blank=True)
    topics = models.JSONField(default=list, blank=True)
    competencies = models.ManyToManyField(
        "matching.Competency",
        blank=True,
        related_name="mentee_profiles",
    )
    preferred_learning_style = models.CharField(max_length=100, blank=True, default="")
    difficulty_level = models.PositiveSmallIntegerField(null=True, blank=True)
    preferred_gender = models.CharField(
        max_length=20,
        choices=PREFERRED_GENDER_CHOICES,
        default="no_preference",
    )
    verification_document = models.FileField(
        upload_to=verification_document_upload_path,
        blank=True,
    )
    approved = models.BooleanField(default=False)

    def __str__(self):
        return f"MenteeProfile<{self.user.username}>"


class MentorCompetency(models.Model):
    mentor = models.ForeignKey(
        MentorProfile,
        on_delete=models.CASCADE,
        related_name="competency_levels",
    )
    competency = models.ForeignKey(
        "matching.Competency",
        on_delete=models.CASCADE,
        related_name="mentor_competency_levels",
    )
    proficiency_level = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    class Meta:
        unique_together = ("mentor", "competency")
        indexes = [
            models.Index(fields=["mentor", "competency"], name="prof_mcomp_mentor_comp"),
        ]

    def __str__(self):
        return (
            f"MentorCompetency<mentor={self.mentor_id}, "
            f"competency={self.competency_id}, level={self.proficiency_level}>"
        )


class MenteeCompetencyNeed(models.Model):
    mentee = models.ForeignKey(
        MenteeProfile,
        on_delete=models.CASCADE,
        related_name="competency_needs",
    )
    competency = models.ForeignKey(
        "matching.Competency",
        on_delete=models.CASCADE,
        related_name="mentee_competency_needs",
    )
    need_level = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    class Meta:
        unique_together = ("mentee", "competency")
        indexes = [
            models.Index(fields=["mentee", "competency"], name="prof_mcneed_mentee_comp"),
        ]

    def __str__(self):
        return (
            f"MenteeCompetencyNeed<mentee={self.mentee_id}, "
            f"competency={self.competency_id}, level={self.need_level}>"
        )
