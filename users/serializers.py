"""
users/serializers.py
DRF Preference Update & Onboarding Serializers with strict role-based limiter validation.
"""

from rest_framework import serializers
from users.constants import (
    MAX_SUBJECTS,
    MAX_TOPICS_PER_SUBJECT,
    MAX_COMPETENCIES_PER_SUBJECT,
    MAX_COMPETENCIES_PER_TOPIC,
    MAX_COMPETENCIES_TOTAL,
    ROLE_PREFERENCE_LIMITS,
    get_role_preference_limits,
)

# Global Limits for Mentee Matching Profile & Preferences
MAX_TOTAL_SUBJECTS = 2
MAX_TOTAL_TOPICS = 6
MAX_TOTAL_COMPETENCIES = 6


class UserPreferenceUpdateSerializer(serializers.Serializer):
    """
    Serializer for PUT /api/user/preferences/ and onboarding preferences.
    Enforces strict role-based bound limits and hierarchy integrity:
    Subject -> Topic -> Competency.
    """
    subjects = serializers.ListField(required=False, default=list)
    topics = serializers.ListField(required=False, default=list)
    competencies = serializers.ListField(required=False, default=list)
    competency_ids = serializers.ListField(required=False, default=list)
    skills = serializers.ListField(required=False, default=list)
    availability = serializers.ListField(required=False, default=None)
    availability_slots = serializers.ListField(required=False, default=None)
    support_need = serializers.IntegerField(required=False, default=3, min_value=1, max_value=5)
    difficulty_level = serializers.IntegerField(required=False, default=None, allow_null=True)
    role = serializers.CharField(required=False, allow_blank=True)

    def validate_subjects(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Subjects must be provided as a list.")
        if len(value) > MAX_TOTAL_SUBJECTS:
            raise serializers.ValidationError(
                f"You can select a maximum of {MAX_TOTAL_SUBJECTS} subjects."
            )
        return value

    def validate_topics(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Topics must be provided as a list.")
        if len(value) > MAX_TOTAL_TOPICS:
            raise serializers.ValidationError(
                f"You can select a maximum of {MAX_TOTAL_TOPICS} topics total."
            )
        return value

    def validate_competencies(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Competencies must be provided as a list.")
        if len(value) > MAX_TOTAL_COMPETENCIES:
            raise serializers.ValidationError(
                f"You can select a maximum of {MAX_TOTAL_COMPETENCIES} competencies total."
            )
        return value

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
            return Topic.objects.select_related("subject").filter(id=int(item)).first()
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
            explicit_topic_id = None
            explicit_subject_id = None
            if isinstance(c, dict):
                explicit_topic_id = c.get("topic_id")
                explicit_subject_id = c.get("subject_id")

            comp = self._resolve_competency(c, allowed_topic_ids=topic_ids)
            if not comp:
                raise serializers.ValidationError({"competencies": f"Competency '{c}' could not be resolved."})

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
        avail_in_attrs = attrs.get("availability_slots")
        if avail_in_attrs is None and attrs.get("availability") is not None:
            avail_in_attrs = attrs.get("availability")
        elif not avail_in_attrs and attrs.get("availability"):
            avail_in_attrs = attrs.get("availability")
        availability = avail_in_attrs or []

        # 5. Strict Role-Based and Global Sparsity Count Validations
        # A. Subjects Count
        num_subjects = len(resolved_subjects)
        min_subjects = limits["minSubjects"]
        max_subjects = min(limits["maxSubjects"], MAX_TOTAL_SUBJECTS)
        if num_subjects < min_subjects:
            raise serializers.ValidationError({
                "subjects": f"{role_label} must select at least {min_subjects} subject{'s' if min_subjects > 1 else ''}."
            })
        if num_subjects > max_subjects:
            raise serializers.ValidationError({
                "subjects": f"You can select a maximum of {MAX_TOTAL_SUBJECTS} subjects."
            })

        if resolved_role == "MENTEE":
            # B. Global Topics Count for Mentee
            total_topics = len(resolved_topics)
            if total_topics > MAX_TOTAL_TOPICS:
                raise serializers.ValidationError({
                    "topics": f"You can select a maximum of {MAX_TOTAL_TOPICS} topics total."
                })
            min_topics = limits.get("minTopicsPerSubject", 1)
            if total_topics < min_topics:
                raise serializers.ValidationError({
                    "topics": f"{role_label} must select at least {min_topics} topic."
                })

            # C. Global Competencies Count for Mentee
            total_competencies = len(resolved_competencies)
            if total_competencies > MAX_TOTAL_COMPETENCIES:
                raise serializers.ValidationError({
                    "competencies": f"You can select a maximum of {MAX_TOTAL_COMPETENCIES} competencies total."
                })
            min_total_comps = limits.get("minTotalCompetencies", 1)
            if total_competencies < min_total_comps:
                raise serializers.ValidationError({
                    "competencies": f"{role_label} must select at least {min_total_comps} competenc{'ies' if min_total_comps > 1 else 'y'} total."
                })
        else:
            # B. Topics per Subject for Mentors
            topics_by_subject = {}
            for topic in attrs.get("topics", []):
                subj_id = getattr(topic, "subject_id", None)
                if subj_id is not None:
                    topics_by_subject[subj_id] = topics_by_subject.get(subj_id, 0) + 1
                    if topics_by_subject[subj_id] > MAX_TOPICS_PER_SUBJECT:
                        raise serializers.ValidationError({
                            "topics": f"You can select a maximum of {MAX_TOPICS_PER_SUBJECT} topics per subject."
                        })

            max_topics_per_subj = min(limits.get("maxTopicsPerSubject", MAX_TOPICS_PER_SUBJECT), MAX_TOPICS_PER_SUBJECT)
            min_topics_per_subj = limits.get("minTopicsPerSubject", 1)
            for s_id, subject in resolved_subjects.items():
                topics_in_subj = [t for t in resolved_topics.values() if t.subject_id == s_id]
                if len(topics_in_subj) > max_topics_per_subj:
                    raise serializers.ValidationError({
                        "topics": f"You can select a maximum of {MAX_TOPICS_PER_SUBJECT} topics per subject."
                    })
                if len(topics_in_subj) < min_topics_per_subj:
                    raise serializers.ValidationError({
                        "topics": f"{role_label} must select at least {min_topics_per_subj} topic{'s' if min_topics_per_subj > 1 else ''} for subject '{subject.name}'."
                    })

            # C. Competencies per Topic for Mentors
            comps_by_topic = {}
            for comp in attrs.get("competencies", []):
                top_id = getattr(comp, "topic_id", None)
                if top_id is not None:
                    comps_by_topic[top_id] = comps_by_topic.get(top_id, 0) + 1
                    if comps_by_topic[top_id] > MAX_COMPETENCIES_PER_TOPIC:
                        raise serializers.ValidationError({
                            "competencies": f"You can select a maximum of {MAX_COMPETENCIES_PER_TOPIC} competencies per topic."
                        })

            max_comps_per_topic = min(limits.get("maxCompetenciesPerTopic", MAX_COMPETENCIES_PER_TOPIC), MAX_COMPETENCIES_PER_TOPIC)
            min_comps_per_topic = limits.get("minCompetenciesPerTopic", 1)
            for t_id, topic in resolved_topics.items():
                comps_in_topic = [c for c in resolved_competencies.values() if c.topic_id == t_id]
                if len(comps_in_topic) > max_comps_per_topic:
                    raise serializers.ValidationError({
                        "competencies": f"You can select a maximum of {MAX_COMPETENCIES_PER_TOPIC} competencies per topic."
                    })
                if len(comps_in_topic) < min_comps_per_topic:
                    raise serializers.ValidationError({
                        "competencies": f"{role_label} must select at least {min_comps_per_topic} competenc{'ies' if min_comps_per_topic > 1 else 'y'} for topic '{topic.name}'."
                    })

            # D. Competencies per Subject for Mentors
            max_comps_per_subj = limits.get("maxCompetenciesPerSubject", MAX_COMPETENCIES_PER_SUBJECT)
            for s_id, subject in resolved_subjects.items():
                comps_in_subj = [c for c in resolved_competencies.values() if getattr(c.topic, "subject_id", None) == s_id]
                if len(comps_in_subj) > max_comps_per_subj:
                    raise serializers.ValidationError({
                        "competencies": f"{role_label} cannot select more than {max_comps_per_subj} competencies for subject '{subject.name}'."
                    })

            # E. Global Competency Limits
            total_competencies = len(resolved_competencies)
            min_total_comps = limits["minTotalCompetencies"]
            max_total_comps = min(limits.get("maxTotalCompetencies", MAX_COMPETENCIES_TOTAL), MAX_COMPETENCIES_TOTAL)
            if total_competencies > max_total_comps:
                raise serializers.ValidationError({
                    "competencies": f"You can select a maximum of {MAX_COMPETENCIES_TOTAL} competencies total."
                })
            if total_competencies < min_total_comps:
                raise serializers.ValidationError({
                    "competencies": f"{role_label} must select at least {min_total_comps} competenc{'ies' if min_total_comps > 1 else 'y'} total."
                })

        # F. Availability Slots (if provided in payload)
        if avail_in_attrs is not None:
            min_slots = limits["minAvailabilitySlots"]
            max_slots = limits["maxAvailabilitySlots"]
            if len(avail_in_attrs) < min_slots:
                raise serializers.ValidationError({
                    "availability": f"{role_label} must select at least {min_slots} availability slot{'s' if min_slots > 1 else ''}."
                })
            if len(avail_in_attrs) > max_slots:
                raise serializers.ValidationError({
                    "availability": f"{role_label} cannot select more than {max_slots} availability slots."
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


class MenteePreferenceSerializer(UserPreferenceUpdateSerializer):
    """
    Preference serializer specialized for Mentees with hard sparsity bounds.
    """
    MAX_TOTAL_SUBJECTS = MAX_TOTAL_SUBJECTS
    MAX_TOTAL_TOPICS = MAX_TOTAL_TOPICS
    MAX_TOTAL_COMPETENCIES = MAX_TOTAL_COMPETENCIES

    def validate(self, attrs):
        if not attrs.get("role"):
            attrs["role"] = "MENTEE"
        return super().validate(attrs)


class MentorPreferenceSerializer(UserPreferenceUpdateSerializer):
    """
    Preference serializer specialized for Mentors with hard sparsity bounds.
    """
    def validate(self, attrs):
        if not attrs.get("role"):
            attrs["role"] = "STUDENT_MENTOR"
        return super().validate(attrs)


class MenteeProfileUpdateSerializer(MenteePreferenceSerializer):
    """
    Serializer for updating mentee matching profile preferences with hard global sparsity bounds.
    """
    MAX_TOTAL_SUBJECTS = MAX_TOTAL_SUBJECTS
    MAX_TOTAL_TOPICS = MAX_TOTAL_TOPICS
    MAX_TOTAL_COMPETENCIES = MAX_TOTAL_COMPETENCIES


MentorProfileUpdateSerializer = MentorPreferenceSerializer
OnboardingPreferenceSerializer = UserPreferenceUpdateSerializer
