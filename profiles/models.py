from django.db import models
from django.contrib.auth.models import User


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
    skills = models.JSONField(default=list, blank=True)
    availability = models.JSONField(default=list, blank=True)
    interests = models.TextField(blank=True)
    capacity = models.PositiveSmallIntegerField(default=1)
    role = models.CharField(max_length=50, blank=True)
    subjects = models.JSONField(default=list, blank=True)
    topics = models.JSONField(default=list, blank=True)
    expertise_level = models.PositiveSmallIntegerField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, default="")
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
    skills = models.JSONField(default=list, blank=True)
    availability = models.JSONField(default=list, blank=True)
    interests = models.TextField(blank=True)
    campus = models.CharField(max_length=100, blank=True)
    student_id_no = models.CharField(max_length=10, blank=True)
    contact_no = models.CharField(max_length=11, blank=True)
    admission_type = models.CharField(max_length=100, blank=True)
    sex = models.CharField(max_length=10, blank=True)
    subjects = models.JSONField(default=list, blank=True)
    topics = models.JSONField(default=list, blank=True)
    difficulty_level = models.PositiveSmallIntegerField(null=True, blank=True)
    preferred_gender = models.CharField(
        max_length=20,
        choices=PREFERRED_GENDER_CHOICES,
        default="no_preference",
    )
    approved = models.BooleanField(default=False)

    def __str__(self):
        return f"MenteeProfile<{self.user.username}>"
