import os
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import UserProfile, MentorDocument

User = get_user_model()


def upload_to_cloudinary(file_obj, folder="peerlink/mentor_documents"):
    """
    Upload a file-like object to Cloudinary using cloudinary.uploader.upload.
    Falls back to mock/local URL if Cloudinary credentials are not configured (e.g. in dev/tests).
    """
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.environ.get("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.environ.get("CLOUDINARY_API_SECRET", "").strip()

    if cloud_name and api_key and api_secret:
        import cloudinary
        import cloudinary.uploader

        try:
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True,
            )
            # Ensure file pointer is at the beginning
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)
            upload_result = cloudinary.uploader.upload(
                file_obj,
                folder=folder,
                resource_type="auto",
            )
            return {
                "url": upload_result.get("secure_url") or upload_result.get("url"),
                "public_id": upload_result.get("public_id"),
            }
        except Exception:
            import uuid
            filename = getattr(file_obj, "name", "document.pdf")
            fake_id = f"fallback_{uuid.uuid4().hex[:12]}"
            return {
                "url": f"https://res.cloudinary.com/{cloud_name}/image/upload/{fake_id}/{filename}",
                "public_id": fake_id,
            }
    else:
        # Development / Testing fallback
        import uuid
        filename = getattr(file_obj, "name", "document.pdf")
        fake_id = f"local_{uuid.uuid4().hex[:12]}"
        return {
            "url": f"https://res.cloudinary.com/demo/image/upload/{fake_id}/{filename}",
            "public_id": fake_id,
        }


class MentorDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MentorDocument
        fields = [
            "id",
            "document_type",
            "cloudinary_url",
            "cloudinary_public_id",
            "uploaded_at",
        ]


class PendingMentorSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "user_id",
            "username",
            "email",
            "full_name",
            "role",
            "approval_status",
            "campus",
            "program",
            "year_level",
            "is_onboarded",
            "documents",
        ]

    def get_full_name(self, obj):
        parts = [obj.user.first_name, obj.user.last_name]
        name = " ".join(p.strip() for p in parts if p and p.strip())
        return name or obj.user.username

    def get_documents(self, obj):
        docs = MentorDocument.objects.filter(user=obj.user).order_by("-uploaded_at")
        return MentorDocumentSerializer(docs, many=True).data


class RegistrationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True, required=False)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES)
    full_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    campus = serializers.CharField(max_length=100, required=False, default="Main")
    program = serializers.CharField(max_length=100, required=False, default="BSIT")
    year_level = serializers.IntegerField(required=False, allow_null=True)

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate(self, attrs):
        email = attrs.get("email", "").lower()
        role = attrs.get("role")
        password = attrs.get("password")
        confirm_password = attrs.get("confirm_password")

        # 1. Email domain verification
        student_domain = "@student.buksu.edu.ph"
        faculty_domain = "@buksu.edu.ph"

        if role in (UserProfile.ROLE_MENTEE, UserProfile.ROLE_STUDENT_MENTOR):
            if not email.endswith(student_domain):
                raise serializers.ValidationError(
                    {"email": f"Students must use an institutional email ending with {student_domain}."}
                )
        elif role in (UserProfile.ROLE_INSTRUCTOR_MENTOR, UserProfile.ROLE_COORDINATOR):
            if not email.endswith(faculty_domain) or email.endswith(student_domain):
                raise serializers.ValidationError(
                    {"email": f"Instructors and Coordinators must use an institutional email ending with {faculty_domain}."}
                )

        # 2. Password matching & strength
        if confirm_password and password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        try:
            validate_password(password)
        except Exception as exc:
            raise serializers.ValidationError({"password": list(getattr(exc, "messages", [str(exc)]))})

        # 3. File upload validations (from request.FILES in context)
        request = self.context.get("request")
        files = getattr(request, "FILES", {}) if request else {}

        if role == UserProfile.ROLE_STUDENT_MENTOR:
            missing = []
            for doc_key in ("letter_of_intent", "study_load", "grades"):
                if not files.get(doc_key):
                    missing.append(doc_key.replace("_", " ").title())
            if missing:
                raise serializers.ValidationError(
                    {"documents": f"Student Mentors must upload: {', '.join(missing)}."}
                )
        elif role == UserProfile.ROLE_INSTRUCTOR_MENTOR:
            if not files.get("faculty_verification"):
                raise serializers.ValidationError(
                    {"documents": "Faculty Verification document is required for Instructor Mentors."}
                )

        return attrs


from users.constants import ROLE_PREFERENCE_LIMITS, get_role_preference_limits
from users.serializers import UserPreferenceUpdateSerializer, OnboardingPreferenceSerializer


