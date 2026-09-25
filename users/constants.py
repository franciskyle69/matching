"""
users/constants.py
Centralized role-based matching preference and availability limit configurations.
"""

from typing import Dict, Any, Tuple, Optional

# Global Sparsity Constants
MAX_SUBJECTS = 2
MAX_TOPICS_PER_SUBJECT = 3
MAX_COMPETENCIES_PER_TOPIC = 2
MAX_COMPETENCIES_TOTAL = 6
MAX_COMPETENCIES_PER_SUBJECT = 6

ROLE_PREFERENCE_LIMITS: Dict[str, Dict[str, Any]] = {
    "MENTEE": {
        # Strict camelCase keys as specified
        "maxSubjects": MAX_SUBJECTS,
        "minSubjects": 1,
        "maxTopicsPerSubject": MAX_TOPICS_PER_SUBJECT,
        "maxCompetenciesPerSubject": MAX_COMPETENCIES_PER_SUBJECT,
        "maxCompetenciesPerTopic": MAX_COMPETENCIES_PER_TOPIC,
        "minTotalCompetencies": 1,
        "maxTotalCompetencies": MAX_COMPETENCIES_TOTAL,
        # Snake_case aliases for backwards compatibility
        "min_subjects": 1,
        "max_subjects": MAX_SUBJECTS,
        "min_topics_per_subject": 1,
        "max_topics_per_subject": MAX_TOPICS_PER_SUBJECT,
        "max_competencies_per_subject": MAX_COMPETENCIES_PER_SUBJECT,
        "min_competencies_per_topic": 1,
        "max_competencies_per_topic": MAX_COMPETENCIES_PER_TOPIC,
        "min_total_competencies": 1,
        "max_total_competencies": MAX_COMPETENCIES_TOTAL,
        "min_global_competencies": 1,
        "max_global_competencies": MAX_COMPETENCIES_TOTAL,
        "min_availability_slots": 1,
        "max_availability_slots": 4,
        "minAvailabilitySlots": 1,
        "maxAvailabilitySlots": 4,
        "role_label": "Mentees",
        "label": "Mentee",
    },
    "STUDENT_MENTOR": {
        "maxSubjects": MAX_SUBJECTS,
        "minSubjects": 1,
        "maxTopicsPerSubject": MAX_TOPICS_PER_SUBJECT,
        "maxCompetenciesPerSubject": MAX_COMPETENCIES_PER_SUBJECT,
        "maxCompetenciesPerTopic": MAX_COMPETENCIES_PER_TOPIC,
        "minTotalCompetencies": 2,
        "maxTotalCompetencies": MAX_COMPETENCIES_TOTAL,
        "min_subjects": 1,
        "max_subjects": MAX_SUBJECTS,
        "min_topics_per_subject": 1,
        "max_topics_per_subject": MAX_TOPICS_PER_SUBJECT,
        "max_competencies_per_subject": MAX_COMPETENCIES_PER_SUBJECT,
        "min_competencies_per_topic": 1,
        "max_competencies_per_topic": MAX_COMPETENCIES_PER_TOPIC,
        "min_total_competencies": 2,
        "max_total_competencies": MAX_COMPETENCIES_TOTAL,
        "min_global_competencies": 2,
        "max_global_competencies": MAX_COMPETENCIES_TOTAL,
        "min_availability_slots": 2,
        "max_availability_slots": 6,
        "minAvailabilitySlots": 2,
        "maxAvailabilitySlots": 6,
        "role_label": "Student Mentors",
        "label": "Student Mentor",
    },
    "INSTRUCTOR_MENTOR": {
        "maxSubjects": MAX_SUBJECTS,
        "minSubjects": 1,
        "maxTopicsPerSubject": MAX_TOPICS_PER_SUBJECT,
        "maxCompetenciesPerSubject": MAX_COMPETENCIES_PER_SUBJECT,
        "maxCompetenciesPerTopic": MAX_COMPETENCIES_PER_TOPIC,
        "minTotalCompetencies": 2,
        "maxTotalCompetencies": MAX_COMPETENCIES_TOTAL,
        "min_subjects": 1,
        "max_subjects": MAX_SUBJECTS,
        "min_topics_per_subject": 1,
        "max_topics_per_subject": MAX_TOPICS_PER_SUBJECT,
        "max_competencies_per_subject": MAX_COMPETENCIES_PER_SUBJECT,
        "min_competencies_per_topic": 1,
        "max_competencies_per_topic": MAX_COMPETENCIES_PER_TOPIC,
        "min_total_competencies": 2,
        "max_total_competencies": MAX_COMPETENCIES_TOTAL,
        "min_global_competencies": 2,
        "max_global_competencies": MAX_COMPETENCIES_TOTAL,
        "min_availability_slots": 2,
        "max_availability_slots": 6,
        "minAvailabilitySlots": 2,
        "maxAvailabilitySlots": 6,
        "role_label": "Instructor Mentors",
        "label": "Instructor Mentor",
    },
}


def get_role_preference_limits(role_str: Optional[str] = None, user: Any = None) -> Tuple[Dict[str, Any], str]:
    """
    Resolve the applicable preference limits dictionary and normalized role string.
    Extracts authenticated user.role or user.profile.mentor_type / user.mentor_profile.role.
    """
    normalized = str(role_str or "").strip().upper()

    if not normalized and user:
        # 1. Direct user.role attribute if present
        if getattr(user, "role", None):
            normalized = str(user.role).strip().upper()

        # 2. Check user.profile
        profile = getattr(user, "profile", None)
        if profile:
            mentor_type = str(getattr(profile, "mentor_type", "") or "").strip().upper()
            if mentor_type in ("INSTRUCTOR", "INSTRUCTOR_MENTOR", "FACULTY"):
                normalized = "INSTRUCTOR_MENTOR"
            elif mentor_type in ("STUDENT", "STUDENT_MENTOR", "PEER"):
                normalized = "STUDENT_MENTOR"
            elif getattr(profile, "role", None):
                normalized = str(profile.role).strip().upper()

        # 3. Check specialized mentor or mentee profile models
        if not normalized or normalized in ("MENTOR", "USER"):
            mentor_prof = getattr(user, "mentor_profile", None)
            if mentor_prof:
                m_role = str(getattr(mentor_prof, "role", "") or "").strip().upper()
                if "INSTRUCTOR" in m_role or "FACULTY" in m_role:
                    normalized = "INSTRUCTOR_MENTOR"
                else:
                    normalized = "STUDENT_MENTOR"
            elif getattr(user, "mentee_profile", None):
                normalized = "MENTEE"
            elif getattr(user, "is_staff", False):
                normalized = "INSTRUCTOR_MENTOR"

    if normalized in ("INSTRUCTOR_MENTOR", "INSTRUCTOR", "FACULTY"):
        return ROLE_PREFERENCE_LIMITS["INSTRUCTOR_MENTOR"], "INSTRUCTOR_MENTOR"
    if normalized in ("STUDENT_MENTOR", "MENTOR", "PEER"):
        return ROLE_PREFERENCE_LIMITS["STUDENT_MENTOR"], "STUDENT_MENTOR"
    if normalized in ("MENTEE", "STUDENT"):
        return ROLE_PREFERENCE_LIMITS["MENTEE"], "MENTEE"

    return ROLE_PREFERENCE_LIMITS["MENTEE"], "MENTEE"
