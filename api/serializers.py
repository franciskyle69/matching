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


def _build_absolute_file_url(url, request=None):
    if not url:
        return ""
    clean = str(url).strip()
    if clean.startswith("http://") and not clean.startswith("http://localhost") and not clean.startswith("http://127.0.0.1"):
        clean = "https://" + clean[7:]
    if clean.startswith("https://") or clean.startswith("http://"):
        return clean
    normalized = clean if clean.startswith("/") else f"/{clean}"
    if request:
        abs_url = request.build_absolute_uri(normalized)
        if abs_url.startswith("http://") and not abs_url.startswith("http://localhost") and not abs_url.startswith("http://127.0.0.1"):
            abs_url = "https://" + abs_url[7:]
        return abs_url
    return normalized


def _get_file_info(name, url):
    target = f"{name or ''} {url or ''}".lower()
    is_image = any(target.endswith(ext) or f"{ext}?" in target for ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"])
    if is_image:
        return True, "Image"
    if ".pdf" in target:
        return False, "PDF"
    return False, "Document"


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


class UserApprovalSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    role_label = serializers.SerializerMethodField()
    role_type = serializers.SerializerMethodField()
    subjects = serializers.SerializerMethodField()
    topics = serializers.SerializerMethodField()
    competencies = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    expertise_level = serializers.SerializerMethodField()
    difficulty_level = serializers.SerializerMethodField()
    availability = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()
    proof_of_enrollment_url = serializers.SerializerMethodField()
    id_card_url = serializers.SerializerMethodField()
    verification_document_url = serializers.SerializerMethodField()
    verification_documents = serializers.SerializerMethodField()
    verification_documents_by_kind = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "user_id",
            "username",
            "email",
            "full_name",
            "student_id_no",
            "contact_no",
            "department",
            "program",
            "year_level",
            "campus",
            "admission_type",
            "sex",
            "role",
            "role_label",
            "role_type",
            "approval_status",
            "is_onboarded",
            "subjects",
            "topics",
            "competencies",
            "skills",
            "expertise_level",
            "difficulty_level",
            "availability",
            "documents",
            "proof_of_enrollment_url",
            "id_card_url",
            "verification_document_url",
            "verification_documents",
            "verification_documents_by_kind",
        ]

    def to_representation(self, instance):
        from accounts.models import UserProfile
        if not isinstance(instance, UserProfile):
            profile = getattr(instance, "userprofile", None) or UserProfile.objects.filter(user=instance).first()
            if profile:
                return super().to_representation(profile)
        return super().to_representation(instance)

    def _get_user_and_profile(self, obj):
        from accounts.models import UserProfile
        if isinstance(obj, UserProfile):
            return obj.user, obj
        user = obj
        profile = getattr(user, "userprofile", None) or getattr(user, "mentor_profile", None) or getattr(user, "mentee_profile", None)
        return user, profile

    def get_full_name(self, obj):
        user, _ = self._get_user_and_profile(obj)
        if not user:
            return ""
        parts = [user.first_name, user.last_name]
        name = " ".join(p.strip() for p in parts if p and p.strip())
        return name or user.username or ""

    def get_department(self, obj):
        dept = getattr(obj, "department", "") or ""
        if dept:
            return dept
        prog = getattr(obj, "program", "") or ""
        if prog:
            return prog if "Department" in prog else f"{prog} Department"
        return "Information Technology"

    def get_role_label(self, obj):
        _, profile = self._get_user_and_profile(obj)
        role = getattr(profile, "role", None) or getattr(obj, "role", "")
        return dict(UserProfile.ROLE_CHOICES).get(role, role)

    def get_role_type(self, obj):
        _, profile = self._get_user_and_profile(obj)
        role = getattr(profile, "role", None) or getattr(obj, "role", "")
        if role in (UserProfile.ROLE_STUDENT_MENTOR, UserProfile.ROLE_INSTRUCTOR_MENTOR):
            return "mentor"
        return "mentee"

    def _get_profile(self, obj):
        user, _ = self._get_user_and_profile(obj)
        if not user:
            return None
        return getattr(user, "mentor_profile", None) or getattr(user, "mentee_profile", None)

    def get_subjects(self, obj):
        prof = self._get_profile(obj)
        subs = getattr(prof, "subjects", []) if prof else []
        return list(subs) if isinstance(subs, (list, tuple)) else ([subs] if subs else [])

    def get_topics(self, obj):
        prof = self._get_profile(obj)
        tops = getattr(prof, "topics", []) if prof else []
        return list(tops) if isinstance(tops, (list, tuple)) else ([tops] if tops else [])

    def get_competencies(self, obj):
        prof = self._get_profile(obj)
        if not prof:
            return []
        if hasattr(prof, "competency_levels"):
            return list(prof.competency_levels.values_list("competency__name", flat=True))
        if hasattr(prof, "competency_needs"):
            return list(prof.competency_needs.values_list("competency__name", flat=True))
        return self.get_topics(obj)

    def get_skills(self, obj):
        comps = self.get_competencies(obj)
        return comps if comps else self.get_topics(obj)

    def get_expertise_level(self, obj):
        user, _ = self._get_user_and_profile(obj)
        mentor_prof = getattr(user, "mentor_profile", None) if user else None
        return getattr(mentor_prof, "expertise_level", None)

    def get_difficulty_level(self, obj):
        user, _ = self._get_user_and_profile(obj)
        mentee_prof = getattr(user, "mentee_profile", None) if user else None
        return getattr(mentee_prof, "difficulty_level", None)

    def get_availability(self, obj):
        prof = self._get_profile(obj)
        return getattr(prof, "availability", []) if prof else []

    def _get_unified_documents(self, obj):
        if hasattr(obj, "_cached_unified_docs"):
            return obj._cached_unified_docs

        user, _ = self._get_user_and_profile(obj)
        request = self.context.get("request")
        docs = []

        # 1. Cloudinary MentorDocument records
        if user:
            for md in MentorDocument.objects.filter(user=user).order_by("-uploaded_at"):
                label = dict(MentorDocument.DOCUMENT_TYPE_CHOICES).get(md.document_type, md.document_type)
                url = _build_absolute_file_url(md.cloudinary_url, request)
                url_filename = url.split("?")[0].rsplit("/", 1)[-1] if "/" in url else ""
                ext = ("." + url_filename.rsplit(".", 1)[-1].lower()) if "." in url_filename else ""
                name = url_filename or f"{label}{ext or '.pdf'}"
                is_img, ftype = _get_file_info(name, url)
                docs.append({
                    "id": md.id,
                    "kind": md.document_type.lower(),
                    "label": label,
                    "name": name,
                    "url": url,
                    "file_type": ftype,
                    "is_image": is_img,
                    "source": "cloudinary",
                })

        # 2. Django Media / VerificationDocument records
        prof = self._get_profile(obj)
        if prof and hasattr(prof, "verification_documents"):
            from profiles.models import VERIFICATION_DOCUMENT_KIND_LABELS, public_file_url
            for vd in prof.verification_documents.all():
                label = VERIFICATION_DOCUMENT_KIND_LABELS.get(vd.kind, "Verification Document")
                name = vd.original_name or (vd.file.name.rsplit("/", 1)[-1] if vd.file else label)
                raw_url = public_file_url(vd.file, request)
                url = _build_absolute_file_url(raw_url, request)
                is_img, ftype = _get_file_info(name, url)
                docs.append({
                    "id": vd.id,
                    "kind": vd.kind,
                    "label": label,
                    "name": name,
                    "url": url,
                    "file_type": ftype,
                    "is_image": is_img,
                    "source": "media",
                })

        # 3. Fallback single verification_document on profile
        if prof and getattr(prof, "verification_document", None):
            f = prof.verification_document
            from profiles.models import public_file_url
            name = f.name.rsplit("/", 1)[-1] if f.name else "Verification Document"
            raw_url = public_file_url(f, request)
            url = _build_absolute_file_url(raw_url, request)
            if not any(d["url"] == url for d in docs):
                is_img, ftype = _get_file_info(name, url)
                docs.append({
                    "id": None,
                    "kind": "application",
                    "label": "Verification Document",
                    "name": name,
                    "url": url,
                    "file_type": ftype,
                    "is_image": is_img,
                    "source": "media",
                })

        obj._cached_unified_docs = docs
        return docs

    def get_documents(self, obj):
        return self._get_unified_documents(obj)

    def get_proof_of_enrollment_url(self, obj):
        docs = self._get_unified_documents(obj)
        for d in docs:
            k = d.get("kind", "").lower()
            if any(term in k for term in ["study_load", "study", "enrollment", "load", "grade"]):
                return d.get("url", "")
        return docs[0]["url"] if docs else ""

    def get_id_card_url(self, obj):
        docs = self._get_unified_documents(obj)
        for d in docs:
            k = d.get("kind", "").lower()
            if any(term in k for term in ["faculty_verification", "id_card", "id", "card", "application"]):
                return d.get("url", "")
        return docs[0]["url"] if docs else ""

    def get_verification_document_url(self, obj):
        docs = self._get_unified_documents(obj)
        return docs[0]["url"] if docs else ""

    def get_verification_documents(self, obj):
        return self._get_unified_documents(obj)

    def get_verification_documents_by_kind(self, obj):
        grouped = {}
        for d in self._get_unified_documents(obj):
            grouped.setdefault(d.get("kind", "other"), []).append(d)
        return grouped


PendingUserSerializer = UserApprovalSerializer


class PendingMentorSerializer(UserApprovalSerializer):
    pass



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


from users.constants import (
    MAX_SUBJECTS,
    MAX_TOPICS_PER_SUBJECT,
    MAX_COMPETENCIES_PER_SUBJECT,
    MAX_COMPETENCIES_PER_TOPIC,
    ROLE_PREFERENCE_LIMITS,
    get_role_preference_limits,
)
from users.serializers import (
    MAX_SUBJECTS,
    MAX_TOPICS_PER_SUBJECT,
    MAX_COMPETENCIES_PER_SUBJECT,
    UserPreferenceUpdateSerializer,
    OnboardingPreferenceSerializer,
    MenteePreferenceSerializer,
    MentorPreferenceSerializer,
)



