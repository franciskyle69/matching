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


ROLE_PREFERENCE_LIMITS = {
    UserProfile.ROLE_MENTEE: {
        "role_label": "Mentees",
        "min_subjects": 1,
        "max_subjects": 2,
        "min_topics_per_subject": 1,
        "max_topics_per_subject": 2,
        "min_competencies_per_topic": 1,
        "max_competencies_per_topic": 2,
        "min_global_competencies": 1,
        "max_global_competencies": 5,
        "min_availability_slots": 1,
        "max_availability_slots": 4,
    },
    UserProfile.ROLE_STUDENT_MENTOR: {
        "role_label": "Student Mentors",
        "min_subjects": 1,
        "max_subjects": 3,
        "min_topics_per_subject": 1,
        "max_topics_per_subject": 3,
        "min_competencies_per_topic": 1,
        "max_competencies_per_topic": 3,
        "min_global_competencies": 2,
        "max_global_competencies": 10,
        "min_availability_slots": 2,
        "max_availability_slots": 6,
    },
    UserProfile.ROLE_INSTRUCTOR_MENTOR: {
        "role_label": "Instructor Mentors",
        "min_subjects": 1,
        "max_subjects": 4,
        "min_topics_per_subject": 1,
        "max_topics_per_subject": 3,
        "min_competencies_per_topic": 1,
        "max_competencies_per_topic": 3,
        "min_global_competencies": 2,
        "max_global_competencies": 10,
        "min_availability_slots": 2,
        "max_availability_slots": 6,
    },
}


def get_role_preference_limits(role_str, user=None):
    normalized = str(role_str or "").strip().upper()
    if not normalized and user:
        profile = getattr(user, "profile", None)
        if profile and getattr(profile, "role", None):
            normalized = str(profile.role).strip().upper()
        elif getattr(user, "is_staff", False):
            normalized = UserProfile.ROLE_INSTRUCTOR_MENTOR
        elif hasattr(user, "mentor_profile"):
            mentor_profile = getattr(user, "mentor_profile")
            if getattr(mentor_profile, "role", "") == "Instructor":
                normalized = UserProfile.ROLE_INSTRUCTOR_MENTOR
            else:
                normalized = UserProfile.ROLE_STUDENT_MENTOR
        elif hasattr(user, "mentee_profile"):
            normalized = UserProfile.ROLE_MENTEE

    if normalized in (UserProfile.ROLE_MENTEE, "MENTEE"):
        return ROLE_PREFERENCE_LIMITS[UserProfile.ROLE_MENTEE], UserProfile.ROLE_MENTEE
    if normalized in (UserProfile.ROLE_INSTRUCTOR_MENTOR, "INSTRUCTOR_MENTOR", "INSTRUCTOR"):
        return ROLE_PREFERENCE_LIMITS[UserProfile.ROLE_INSTRUCTOR_MENTOR], UserProfile.ROLE_INSTRUCTOR_MENTOR
    if normalized in (UserProfile.ROLE_STUDENT_MENTOR, "STUDENT_MENTOR", "MENTOR"):
        return ROLE_PREFERENCE_LIMITS[UserProfile.ROLE_STUDENT_MENTOR], UserProfile.ROLE_STUDENT_MENTOR

    return ROLE_PREFERENCE_LIMITS[UserProfile.ROLE_MENTEE], UserProfile.ROLE_MENTEE


class OnboardingPreferenceSerializer(serializers.Serializer):
    subjects = serializers.ListField(required=False, default=list)
    topics = serializers.ListField(required=False, default=list)
    competencies = serializers.ListField(required=False, default=list)
    competency_ids = serializers.ListField(required=False, default=list)
    skills = serializers.ListField(required=False, default=list)
    availability = serializers.ListField(required=False, default=list)
    availability_slots = serializers.ListField(required=False, default=list)
    support_need = serializers.IntegerField(required=False, default=3, min_value=1, max_value=5)
    difficulty_level = serializers.IntegerField(required=False, default=None, allow_null=True)
    role = serializers.CharField(required=False, allow_blank=True)

    def _resolve_subject(self, item):
        from matching.models import Subject
        if isinstance(item, int) or (isinstance(item, str) and item.strip().isdigit()):
            return Subject.objects.filter(id=int(item)).first()
        if isinstance(item, dict):
            s_id = item.get("id") or item.get("subject_id")
            if s_id:
                return Subject.objects.filter(id=int(s_id)).first()
            item = item.get("name") or item.get("code") or ""
        s = str(item or "").strip()
        if not s:
            return None
        subj = Subject.objects.filter(name__iexact=s).first()
        if subj:
            return subj
        subj = Subject.objects.filter(code__iexact=s).first()
        if subj:
            return subj
        if " - " in s:
            code_part = s.split(" - ")[0].strip()
            subj = Subject.objects.filter(code__iexact=code_part).first()
            if subj:
                return subj
        return None

    def _resolve_topic(self, item, allowed_subject_ids=None):
        from matching.models import Topic
        if isinstance(item, int) or (isinstance(item, str) and item.strip().isdigit()):
            qs = Topic.objects.select_related("subject").filter(id=int(item))
            return qs.first()
        if isinstance(item, dict):
            t_id = item.get("id") or item.get("topic_id")
            if t_id:
                return Topic.objects.select_related("subject").filter(id=int(t_id)).first()
            item = item.get("name") or ""
        s = str(item or "").strip()
        if not s:
            return None
        qs = Topic.objects.select_related("subject").filter(name__iexact=s)
        if allowed_subject_ids:
            filtered = qs.filter(subject_id__in=allowed_subject_ids).first()
            if filtered:
                return filtered
        return qs.first()

    def _resolve_competency(self, item, allowed_topic_ids=None):
        from matching.models import Competency
        if isinstance(item, int) or (isinstance(item, str) and item.strip().isdigit()):
            return Competency.objects.select_related("topic", "topic__subject").filter(id=int(item)).first()
        if isinstance(item, dict):
            c_id = item.get("id") or item.get("competency_id")
            if c_id:
                return Competency.objects.select_related("topic", "topic__subject").filter(id=int(c_id)).first()
            item = item.get("name") or ""
        s = str(item or "").strip()
        if not s:
            return None
        qs = Competency.objects.select_related("topic", "topic__subject").filter(name__iexact=s)
        if allowed_topic_ids:
            filtered = qs.filter(topic_id__in=allowed_topic_ids).first()
            if filtered:
                return filtered
        return qs.first()

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None) or self.context.get("user")
        role_param = attrs.get("role") or self.context.get("role")
        limits, resolved_role = get_role_preference_limits(role_param, user=user)
        role_label = limits["role_label"]

        # 1. Resolve Subjects
        raw_subjects = attrs.get("subjects") or []
        resolved_subjects = {}
        for s in raw_subjects:
            subj = self._resolve_subject(s)
            if not subj:
                raise serializers.ValidationError({"subjects": f"Subject '{s}' could not be resolved."})
            resolved_subjects[subj.id] = subj

        # 2. Resolve Topics
        raw_topics = attrs.get("topics") or []
        resolved_topics = {}
        subject_ids = set(resolved_subjects.keys())

        for t in raw_topics:
            topic = self._resolve_topic(t, allowed_subject_ids=subject_ids)
            if not topic:
                raise serializers.ValidationError({"topics": f"Topic '{t}' could not be resolved."})
            # Hierarchy integrity: Topic must belong to a selected Subject
            if topic.subject_id not in subject_ids:
                subj_name = getattr(topic.subject, "name", "unknown")
                raise serializers.ValidationError({
                    "hierarchy": f"Hierarchy integrity violation: Topic '{topic.name}' belongs to subject '{subj_name}' which is not among the selected subjects."
                })
            resolved_topics[topic.id] = topic

        # 3. Resolve Competencies
        raw_competencies = attrs.get("competency_ids") or attrs.get("competencies") or attrs.get("skills") or []
        resolved_competencies = {}
        topic_ids = set(resolved_topics.keys())

        for c in raw_competencies:
            # Check if structured dictionary passed with explicit topic_id or subject_id
            explicit_topic_id = None
            explicit_subject_id = None
            if isinstance(c, dict):
                explicit_topic_id = c.get("topic_id")
                explicit_subject_id = c.get("subject_id")

            comp = self._resolve_competency(c, allowed_topic_ids=topic_ids)
            if not comp:
                raise serializers.ValidationError({"competencies": f"Competency '{c}' could not be resolved."})

            # Check explicit dictionary IDs if provided
            if explicit_topic_id is not None and comp.topic_id != int(explicit_topic_id):
                raise serializers.ValidationError({
                    "hierarchy": f"Hierarchy integrity violation: Competency '{comp.name}' (ID {comp.id}) does not belong to Topic (ID {explicit_topic_id})."
                })
            if explicit_subject_id is not None and getattr(comp.topic, "subject_id", None) != int(explicit_subject_id):
                raise serializers.ValidationError({
                    "hierarchy": f"Hierarchy integrity violation: Topic '{comp.topic.name}' (ID {comp.topic_id}) does not belong to Subject (ID {explicit_subject_id})."
                })

            # Hierarchy integrity: Competency's Topic must be in selected topics
            if topic_ids and comp.topic_id not in topic_ids:
                raise serializers.ValidationError({
                    "hierarchy": f"Hierarchy integrity violation: Competency '{comp.name}' belongs to topic '{comp.topic.name}' which is not among the selected topics."
                })

            # Hierarchy integrity: Competency's Topic's Subject must be in selected subjects
            if subject_ids and comp.topic.subject_id not in subject_ids:
                subj_name = getattr(comp.topic.subject, "name", "unknown")
                raise serializers.ValidationError({
                    "hierarchy": f"Hierarchy integrity violation: Competency '{comp.name}' belongs to subject '{subj_name}' which is not among the selected subjects."
                })

            # If topics weren't explicitly provided, auto-include the competency's topic
            if comp.topic_id not in resolved_topics:
                resolved_topics[comp.topic_id] = comp.topic

            # If subjects weren't explicitly provided, auto-include the topic's subject
            if comp.topic.subject_id not in resolved_subjects:
                resolved_subjects[comp.topic.subject_id] = comp.topic.subject

            resolved_competencies[comp.id] = comp

        # 4. Resolve Availability Slots
        availability = attrs.get("availability_slots") or attrs.get("availability") or []

        # 5. Rule-based Count Validations
        # A. Unique subjects count
        num_subjects = len(resolved_subjects)
        if num_subjects < limits["min_subjects"]:
            raise serializers.ValidationError({
                "subjects": f"{role_label} must select at least {limits['min_subjects']} subject{'s' if limits['min_subjects'] > 1 else ''}."
            })
        if num_subjects > limits["max_subjects"]:
            raise serializers.ValidationError({
                "subjects": f"{role_label} cannot select more than {limits['max_subjects']} subjects."
            })

        # B. Global competencies total
        num_competencies = len(resolved_competencies)
        if num_competencies < limits["min_global_competencies"]:
            raise serializers.ValidationError({
                "competencies": f"{role_label} must select at least {limits['min_global_competencies']} competenc{'ies' if limits['min_global_competencies'] > 1 else 'y'} total."
            })
        if num_competencies > limits["max_global_competencies"]:
            raise serializers.ValidationError({
                "competencies": f"{role_label} cannot select more than {limits['max_global_competencies']} competencies total."
            })

        # C. Availability slots
        num_slots = len(availability)
        if num_slots < limits["min_availability_slots"]:
            raise serializers.ValidationError({
                "availability": f"{role_label} must select at least {limits['min_availability_slots']} availability slot{'s' if limits['min_availability_slots'] > 1 else ''}."
            })
        if num_slots > limits["max_availability_slots"]:
            raise serializers.ValidationError({
                "availability": f"{role_label} cannot select more than {limits['max_availability_slots']} availability slots."
            })

        # D. Topics per subject
        for s_id, subject in resolved_subjects.items():
            subject_topics = [t for t in resolved_topics.values() if t.subject_id == s_id]
            if len(subject_topics) < limits["min_topics_per_subject"]:
                raise serializers.ValidationError({
                    "topics": f"{role_label} must select at least {limits['min_topics_per_subject']} topic{'s' if limits['min_topics_per_subject'] > 1 else ''} for subject '{subject.name}'."
                })
            if len(subject_topics) > limits["max_topics_per_subject"]:
                raise serializers.ValidationError({
                    "topics": f"{role_label} cannot select more than {limits['max_topics_per_subject']} topics for subject '{subject.name}'."
                })

        # E. Competencies per topic
        for t_id, topic in resolved_topics.items():
            topic_competencies = [comp for comp in resolved_competencies.values() if comp.topic_id == t_id]
            if len(topic_competencies) < limits["min_competencies_per_topic"]:
                raise serializers.ValidationError({
                    "competencies": f"{role_label} must select at least {limits['min_competencies_per_topic']} competenc{'ies' if limits['min_competencies_per_topic'] > 1 else 'y'} for topic '{topic.name}'."
                })
            if len(topic_competencies) > limits["max_competencies_per_topic"]:
                raise serializers.ValidationError({
                    "competencies": f"{role_label} cannot select more than {limits['max_competencies_per_topic']} competencies for topic '{topic.name}'."
                })


        attrs["resolved_role"] = resolved_role
        attrs["resolved_subjects"] = list(resolved_subjects.values())
        attrs["resolved_topics"] = list(resolved_topics.values())
        attrs["resolved_competencies"] = list(resolved_competencies.values())
        attrs["subject_names"] = [s.name for s in resolved_subjects.values()]
        attrs["topic_names"] = [t.name for t in resolved_topics.values()]
        attrs["competency_ids"] = [c.id for c in resolved_competencies.values()]
        attrs["availability_slots"] = availability
        return attrs

