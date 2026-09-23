from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Tuple, Dict, Set, Any, Optional
import time

import pandas as pd
from django.core.cache import cache
from django.db.models import Count, QuerySet, Q

from profiles.models import MentorProfile, MenteeProfile
from matching.models import MenteeMentorRequest, UserTopicPreference, Topic
from matching.ml.features import build_features
from matching.ml.model_io import load_model

logger = logging.getLogger(__name__)

# Feature vector cache TTL: 24 hours (seconds).
_FV_CACHE_TTL = 60 * 60 * 24


def _to_set(items: Any) -> Set[str]:
    if not items:
        return set()
    if isinstance(items, list):
        return {str(x).strip().lower() for x in items if str(x).strip()}
    return {s.strip().lower() for s in str(items).split(",") if s.strip()}


def _jaccard(a: Set[str], b: Set[str]) -> float:
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0
    return inter / union


def _difficulty_alignment(mentor_level: Any, mentee_level: Any) -> float:
    try:
        ml = float(mentor_level)
        el = float(mentee_level)
    except Exception:
        return 0.0
    diff = min(abs(ml - el), 4.0)
    return 1.0 - diff / 4.0


def _mentor_is_instructor(role: str) -> float:
    r = (role or "").strip().lower()
    return 1.0 if "instructor" in r else 0.0


def _get_topic_support_map() -> Dict[str, int]:
    cache_key = "matching:topic_support_map:v1"
    cached = cache.get(cache_key)
    if isinstance(cached, dict):
        return cached
    rows = (
        UserTopicPreference.objects.filter(
            is_active_selection=True,
            topic__status=Topic.STATUS_ACTIVE,
        )
        .values("topic__name")
        .annotate(total=Count("id"))
    )
    support = {
        str(row.get("topic__name") or "").strip().lower(): int(row.get("total") or 0)
        for row in rows
        if str(row.get("topic__name") or "").strip()
    }
    cache.set(cache_key, support, timeout=300)
    return support


def _topic_overlap_confidence(mentor_topics: Set[str], mentee_topics: Set[str]) -> float:
    overlap = mentor_topics & mentee_topics
    if not overlap:
        return 1.0
    support_map = _get_topic_support_map()
    # New/rare topics should not dominate ranking until enough signal exists.
    minimum_support = 5
    confidences: List[float] = []
    for topic in overlap:
        count = int(support_map.get(topic, 0))
        confidences.append(min(1.0, count / minimum_support))
    return sum(confidences) / len(confidences) if confidences else 1.0


def _normalise_gender(value: Any, default: str = "") -> str:
    text = str(value or "").strip().lower()
    if text in ("male", "female", "no_preference"):
        return text
    return default


def _parse_hhmm(value: str) -> Optional[int]:
    text = str(value or "").strip()
    parts = text.split(":")
    if len(parts) < 2:
        return None
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except (TypeError, ValueError):
        return None
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return hour * 60 + minute


DAY_ORDER = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
_DAY_INDEX = {day.lower(): index for index, day in enumerate(DAY_ORDER)}
_ALL_DAYS = frozenset(range(len(DAY_ORDER)))

# A parsed slot is (frozenset_of_day_indexes, start_minutes, end_minutes).
Slot = Tuple[frozenset, int, int]


def _parse_days(value: str) -> frozenset:
    found = set()
    for token in str(value or "").split("/"):
        index = _DAY_INDEX.get(token.strip().lower()[:3])
        if index is not None:
            found.add(index)
    return frozenset(found)


def _parse_slot(slot: Any) -> Optional[Slot]:
    """Parse "Mon/Wed|08:00-12:00"; a missing day prefix means every day."""
    if not isinstance(slot, str):
        return None
    day_part, separator, time_part = slot.partition("|")
    if not separator:
        day_part, time_part = "", slot
    parts = time_part.split("-")
    if len(parts) != 2:
        return None
    start = _parse_hhmm(parts[0])
    end = _parse_hhmm(parts[1])
    if start is None or end is None or start >= end:
        return None
    days = _parse_days(day_part) if separator else frozenset()
    return (days or _ALL_DAYS), start, end


def _normalise_slots(value: Any) -> List[Slot]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        raw_slots = list(value)
    elif isinstance(value, str):
        raw_slots = [part.strip() for part in value.split(",") if part.strip()]
    else:
        raw_slots = []

    slots: List[Slot] = []
    seen: Set[Slot] = set()
    for raw in raw_slots:
        parsed = _parse_slot(raw)
        if not parsed or parsed in seen:
            continue
        slots.append(parsed)
        seen.add(parsed)
    return slots


def _slots_overlap(a_slots: List[Slot], b_slots: List[Slot]) -> bool:
    """Two slots overlap only when they share a day and their times intersect."""
    if not a_slots or not b_slots:
        return False
    for a_days, a_start, a_end in a_slots:
        for b_days, b_start, b_end in b_slots:
            if not (a_days & b_days):
                continue
            if max(a_start, b_start) < min(a_end, b_end):
                return True
    return False


def _format_minutes(total_minutes: int) -> str:
    hour = total_minutes // 60
    minute = total_minutes % 60
    return f"{hour:02d}:{minute:02d}"


def _format_slot(slot: Slot) -> str:
    days, start, end = slot
    times = f"{_format_minutes(start)}-{_format_minutes(end)}"
    if not days or days == _ALL_DAYS:
        return times
    labels = "/".join(DAY_ORDER[index] for index in sorted(days))
    return f"{labels}|{times}"


def _accepted_mentee_counts(mentor_ids: List[int]) -> Dict[int, int]:
    if not mentor_ids:
        return {}
    rows = (
        MenteeMentorRequest.objects.filter(accepted=True, mentor_id__in=mentor_ids)
        .values("mentor_id")
        .annotate(total=Count("id"))
    )
    return {int(row["mentor_id"]): int(row["total"] or 0) for row in rows}


MATCHING_PROFILES_VERSION_KEY = "matching:profiles_version"
MENTEE_RECS_CACHE_TIMEOUT = 300  # seconds


@dataclass
class MentorFilterResult:
    mentors: List[MentorProfile]
    empty_reason: Optional[str] = None
    suggested_time_slots: Optional[List[str]] = None


def _filter_mentors_for_mentee(
    mentee: MenteeProfile,
    mentors: Union[QuerySet, List[MentorProfile]],
    accepted_counts: Optional[Dict[int, int]] = None,
) -> MentorFilterResult:
    # SQL Pre-Filtering: If mentors is a QuerySet, pre-filter directly at the database level
    # so only mentors sharing >= 1 Subject or Topic with the mentee are evaluated.
    if isinstance(mentors, QuerySet):
        mentee_sex = _normalise_gender(getattr(mentee, "sex", ""), default="")
        if mentee_sex in ("male", "female"):
            mentors = mentors.filter(gender__iexact=mentee_sex)
        mentee_subjects = _to_set(getattr(mentee, "subjects", None)) or _to_set(getattr(mentee, "skills", None))
        mentee_topics = _to_set(getattr(mentee, "topics", None)) or _to_set(getattr(mentee, "skills", None))
        if mentee_subjects or mentee_topics:
            from django.db.models import Q
            q_academic = Q()
            for s in mentee_subjects:
                q_academic |= Q(subjects__icontains=s) | Q(skills__icontains=s)
            for t in mentee_topics:
                q_academic |= Q(topics__icontains=t) | Q(skills__icontains=t)
            mentors = mentors.filter(q_academic)
        mentors = list(mentors)

    if not mentors:
        return MentorFilterResult(mentors=[], empty_reason="no_mentors", suggested_time_slots=[])

    # Enforce same-gender matching by default:
    # mentee.sex -> mentor.gender. If mentee.sex is not set, skip gender filter.
    mentee_sex = _normalise_gender(getattr(mentee, "sex", ""), default="")
    if mentee_sex in ("male", "female"):
        gender_filtered = [
            mentor
            for mentor in mentors
            if _normalise_gender(getattr(mentor, "gender", ""), default="") == mentee_sex
        ]
        if not gender_filtered:
            return MentorFilterResult(
                mentors=[],
                empty_reason="gender_preference",
                suggested_time_slots=[],
            )
    else:
        gender_filtered = mentors

    counts = accepted_counts or _accepted_mentee_counts([m.id for m in gender_filtered])
    capacity_filtered: List[MentorProfile] = []
    for mentor in gender_filtered:
        cap = max(int(getattr(mentor, "capacity", 0) or 0), 0)
        current = int(counts.get(mentor.id, 0))
        if current < cap:
            capacity_filtered.append(mentor)
    if not capacity_filtered:
        return MentorFilterResult(mentors=[], empty_reason="all_full", suggested_time_slots=[])

    # Enforce mandatory academic prerequisite: mentor must share at least 1 Subject or Topic with mentee
    mentee_subjects = _to_set(getattr(mentee, "subjects", None)) or _to_set(getattr(mentee, "skills", None))
    mentee_topics = _to_set(getattr(mentee, "topics", None)) or _to_set(getattr(mentee, "skills", None))
    academic_filtered: List[MentorProfile] = []
    for mentor in capacity_filtered:
        mentor_subjects = _to_set(getattr(mentor, "subjects", None)) or _to_set(getattr(mentor, "skills", None))
        mentor_topics = _to_set(getattr(mentor, "topics", None)) or _to_set(getattr(mentor, "skills", None))
        has_subject_overlap = bool(mentee_subjects and mentor_subjects and (mentee_subjects & mentor_subjects))
        has_topic_overlap = bool(mentee_topics and mentor_topics and (mentee_topics & mentor_topics))
        if has_subject_overlap or has_topic_overlap:
            academic_filtered.append(mentor)

    if not academic_filtered:
        return MentorFilterResult(mentors=[], empty_reason="no_academic_overlap", suggested_time_slots=[])

    mentee_slots = _normalise_slots(getattr(mentee, "availability", []))
    time_filtered: List[MentorProfile] = []
    for mentor in academic_filtered:
        mentor_slots = _normalise_slots(getattr(mentor, "availability", []))
        if _slots_overlap(mentor_slots, mentee_slots):
            time_filtered.append(mentor)

    if time_filtered:
        return MentorFilterResult(mentors=time_filtered, empty_reason=None, suggested_time_slots=[])

    suggested: List[Slot] = []
    seen_slots: Set[Slot] = set()
    for mentor in academic_filtered:
        for slot in _normalise_slots(getattr(mentor, "availability", [])):
            if slot in seen_slots:
                continue
            seen_slots.add(slot)
            suggested.append(slot)
    suggested.sort(key=lambda item: (min(item[0]) if item[0] else 0, item[1], item[2]))
    suggested_labels = [_format_slot(slot) for slot in suggested[:8]]
    return MentorFilterResult(
        mentors=[],
        empty_reason="no_time_overlap",
        suggested_time_slots=suggested_labels,
    )


_MODEL: Optional[Any] = None
_META: Optional[Dict[str, Any]] = None
_MODEL_LOAD_ERROR: Optional[Exception] = None


def _get_model():
    global _MODEL, _META, _MODEL_LOAD_ERROR
    if _MODEL is not None and _META is not None:
        return _MODEL, _META
    if _MODEL_LOAD_ERROR is not None:
        return None, None
    try:
        _MODEL, _META = load_model()
        return _MODEL, _META
    except Exception as e:
        _MODEL_LOAD_ERROR = e
        return None, None


def reload_model():
    """Force reload of the XGBoost model and metadata from disk."""
    global _MODEL, _META, _MODEL_LOAD_ERROR
    _MODEL = None
    _META = None
    _MODEL_LOAD_ERROR = None
    return _get_model()


USER_VECTOR_CACHE_TTL = 86400  # 24 hours


def get_user_vector(user_id: int, profile: Optional[Union[MentorProfile, MenteeProfile]] = None) -> Dict[str, Any]:
    """Retrieve or compute and cache a user's feature vector in Redis/Django cache (24h TTL)."""
    cache_key = f"user_vector_{user_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    if profile is None:
        try:
            profile = MentorProfile.objects.filter(user_id=user_id).first() or MenteeProfile.objects.filter(user_id=user_id).first()
        except Exception:
            profile = None

    if profile is None:
        return {}

    is_mentor = isinstance(profile, MentorProfile)
    if is_mentor:
        comp_levels = {
            item.competency_id: int(item.proficiency_level)
            for item in getattr(profile, "competency_levels", []).all()
        } if hasattr(profile, "competency_levels") else {}
        comp_names = [getattr(c, "name", "") for c in getattr(profile, "competencies", []).all()] if hasattr(profile, "competencies") else []
        vector = {
            "role": getattr(profile, "role", ""),
            "subjects": getattr(profile, "subjects", []) or getattr(profile, "skills", []),
            "topics": getattr(profile, "topics", []) or getattr(profile, "skills", []),
            "competencies": comp_names,
            "expertise_level": getattr(profile, "expertise_level", 0) or 0,
            "year_level": getattr(profile, "year_level", 0) or 0,
            "competency_levels": comp_levels,
            "years_experience": getattr(profile, "years_experience", 0) or 0,
            "teaching_experience_years": getattr(profile, "teaching_experience_years", 0) or 0,
            "availability": getattr(profile, "availability", []),
        }
    else:
        comp_needs = {
            item.competency_id: int(item.need_level)
            for item in getattr(profile, "competency_needs", []).all()
        } if hasattr(profile, "competency_needs") else {}
        comp_names = [getattr(c, "name", "") for c in getattr(profile, "competencies", []).all()] if hasattr(profile, "competencies") else []
        vector = {
            "subjects": getattr(profile, "subjects", []) or getattr(profile, "skills", []),
            "topics": getattr(profile, "topics", []) or getattr(profile, "skills", []),
            "competencies": comp_names,
            "difficulty_level": getattr(profile, "difficulty_level", 0) or 0,
            "year_level": getattr(profile, "year_level", 0) or 0,
            "competency_needs": comp_needs,
            "availability": getattr(profile, "availability", []),
        }

    cache.set(cache_key, vector, timeout=USER_VECTOR_CACHE_TTL)
    return vector


def _build_row(mentor: MentorProfile, mentee: MenteeProfile) -> Dict[str, Any]:
    mentor_vec = get_user_vector(mentor.user_id, mentor)
    mentee_vec = get_user_vector(mentee.user_id, mentee)
    return {
        "mentee_subjects": mentee_vec.get("subjects", []),
        "mentee_topics": mentee_vec.get("topics", []),
        "mentee_competencies": mentee_vec.get("competencies", []),
        "mentee_difficulty_level": mentee_vec.get("difficulty_level", 0),
        "mentee_year_level": mentee_vec.get("year_level", 0),
        "mentee_competency_needs": mentee_vec.get("competency_needs", {}),
        "mentee_availability": mentee_vec.get("availability", []),
        "mentor_role": mentor_vec.get("role", ""),
        "mentor_subjects": mentor_vec.get("subjects", []),
        "mentor_topics": mentor_vec.get("topics", []),
        "mentor_competencies": mentor_vec.get("competencies", []),
        "mentor_expertise_level": mentor_vec.get("expertise_level", 0),
        "mentor_year_level": mentor_vec.get("year_level", 0),
        "mentor_competency_levels": mentor_vec.get("competency_levels", {}),
        "mentor_years_experience": mentor_vec.get("years_experience", 0),
        "mentor_teaching_experience_years": mentor_vec.get("teaching_experience_years", 0),
        "mentor_availability": mentor_vec.get("availability", []),
    }


def _heuristic_score(mentor: MentorProfile, mentee: MenteeProfile) -> float:
    """Feature-level ranking score that produces *differentiated* values.

    Directly measures how much overlap exists across subjects, topics,
    competencies, difficulty alignment, and role.
    """
    mentor_subjects = _to_set(mentor.subjects) or _to_set(mentor.skills)
    mentee_subjects = _to_set(mentee.subjects) or _to_set(mentee.skills)
    mentor_topics = _to_set(mentor.topics) or _to_set(mentor.skills)
    mentee_topics = _to_set(mentee.topics) or _to_set(mentee.skills)
    mentor_competencies = {
        c.id for c in getattr(mentor, "competencies", []).all()
    } if hasattr(mentor, "competencies") else set()
    mentee_competencies = {
        c.id for c in getattr(mentee, "competencies", []).all()
    } if hasattr(mentee, "competencies") else set()
    topic_confidence = _topic_overlap_confidence(mentor_topics, mentee_topics)

    subjects = _jaccard(mentor_subjects, mentee_subjects)
    topics = _jaccard(mentor_topics, mentee_topics)
    competencies = _jaccard(mentor_competencies, mentee_competencies)
    difficulty = _difficulty_alignment(mentor.expertise_level, mentee.difficulty_level)
    instructor = _mentor_is_instructor(mentor.role)

    weighted_topics = topics * topic_confidence
    return (
        0.4 * subjects
        + 0.25 * weighted_topics
        + 0.15 * competencies
        + 0.1 * difficulty
        + 0.05 * instructor
    )


def get_matching_profiles_version() -> int:
    return cache.get("matching:profiles_version", 1)


def invalidate_matching_cache_for_user(user_id: int):
    """Invalidate all cached user vectors and bump matching version to force real-time recalculation."""
    cache.delete(f"user_vector_{user_id}")
    try:
        cache.incr("matching:profiles_version")
    except Exception:
        cache.set("matching:profiles_version", 2)


def _score_with_model(mentor: MentorProfile, mentee: MenteeProfile) -> Optional[float]:
    model, meta = _get_model()
    if model is None or meta is None:
        return None

    # Check versioned feature vector cache first.
    version = get_matching_profiles_version()
    cache_key = f"matching:fv:v2:{version}:{mentor.id}:{mentee.id}"
    cached_score = cache.get(cache_key)
    if cached_score is not None:
        return float(cached_score)

    row = _build_row(mentor, mentee)
    feats = build_features(row)
    X = pd.DataFrame([feats])
    feature_names = meta.get("feature_names")
    if feature_names:
        X = X.reindex(columns=feature_names, fill_value=0.0)

    task = meta.get("task", "regression")
    if task == "classification":
        score = float(model.predict_proba(X.values)[0, 1])
    else:
        # Direct predicted continuous regression score in [0.0, 1.0]
        score = float(model.predict(X.values)[0])

    # Smooth confidence adjustment: scale continuous score smoothly using topic support
    # without pushing all values to 1.0
    mentor_topics = _to_set(mentor.topics) or _to_set(mentor.skills)
    mentee_topics = _to_set(mentee.topics) or _to_set(mentee.skills)
    if mentor_topics and mentee_topics and (mentor_topics & mentee_topics):
        topic_confidence = _topic_overlap_confidence(mentor_topics, mentee_topics)
        score *= (0.85 + 0.15 * topic_confidence)

    # Clip final values strictly between 0.0 and 1.0
    score = max(0.0, min(1.0, score))

    # Cache the computed score for 24h.
    cache.set(cache_key, score, timeout=_FV_CACHE_TTL)
    return score


def _batch_score_with_model(
    mentors: List[MentorProfile],
    mentee: MenteeProfile,
) -> Optional[Dict[int, float]]:
    """Score all *mentors* against a single *mentee* in one XGBoost call.

    Returns a dict mapping mentor_id → score, or ``None`` if the model is
    unavailable (callers should fall back to heuristic scoring).
    """
    model, meta = _get_model()
    if model is None or meta is None:
        return None
    if not mentors:
        return {}

    feature_names = meta.get("feature_names")
    task = meta.get("task", "regression")

    # ── 1. Check cache for each (mentor, mentee) pair. ──────────────
    version = get_matching_profiles_version()
    scores: Dict[int, float] = {}
    uncached_mentors: List[MentorProfile] = []
    for mentor in mentors:
        cache_key = f"matching:fv:v2:{version}:{mentor.id}:{mentee.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            scores[mentor.id] = float(cached)
        else:
            uncached_mentors.append(mentor)

    if not uncached_mentors:
        return scores

    # ── 2. Build feature rows for uncached mentors. ─────────────────
    rows = []
    for mentor in uncached_mentors:
        row = _build_row(mentor, mentee)
        feats = build_features(row)
        rows.append(feats)

    X = pd.DataFrame(rows)
    if feature_names:
        X = X.reindex(columns=feature_names, fill_value=0.0)

    # ── 3. Single batch prediction call via xgb.DMatrix ─────────────
    try:
        import xgboost as xgb
        dmatrix = xgb.DMatrix(X.values, feature_names=feature_names)
        booster = model.get_booster() if hasattr(model, "get_booster") else model
        raw_scores = booster.predict(dmatrix).tolist()
    except Exception:
        if task == "classification" and hasattr(model, "predict_proba"):
            raw_scores = model.predict_proba(X.values)[:, 1].tolist()
        else:
            raw_scores = model.predict(X.values).tolist()

    # ── 4. Post-process: confidence adjustment & caching. ──────────
    for mentor, raw in zip(uncached_mentors, raw_scores):
        score = float(raw)
        mentor_topics = _to_set(mentor.topics) or _to_set(mentor.skills)
        mentee_topics = _to_set(mentee.topics) or _to_set(mentee.skills)
        if mentor_topics and mentee_topics and (mentor_topics & mentee_topics):
            topic_confidence = _topic_overlap_confidence(mentor_topics, mentee_topics)
            score *= (0.85 + 0.15 * topic_confidence)
        score = max(0.0, min(1.0, score))
        scores[mentor.id] = score
        cache.set(f"matching:fv:v2:{version}:{mentor.id}:{mentee.id}", score, timeout=_FV_CACHE_TTL)

    return scores


def _overlapping_slots_formatted(a_slots: List[Slot], b_slots: List[Slot]) -> List[str]:
    overlaps: List[str] = []
    seen: Set[str] = set()
    for a_days, a_start, a_end in a_slots:
        for b_days, b_start, b_end in b_slots:
            shared_days = a_days & b_days
            if not shared_days:
                continue
            inter_start = max(a_start, b_start)
            inter_end = min(a_end, b_end)
            if inter_start < inter_end:
                slot_str = _format_slot((shared_days, inter_start, inter_end))
                if slot_str not in seen:
                    seen.add(slot_str)
                    overlaps.append(slot_str)
    return overlaps


def compute_score_breakdown(mentor: MentorProfile, mentee: MenteeProfile) -> Dict[str, Any]:
    """Calculate an explainable, transparent AI match score breakdown."""
    mentor_subjects = _to_set(mentor.subjects) or _to_set(mentor.skills)
    mentee_subjects = _to_set(mentee.subjects) or _to_set(mentee.skills)
    mentor_topics = _to_set(mentor.topics) or _to_set(mentor.skills)
    mentee_topics = _to_set(mentee.topics) or _to_set(mentee.skills)

    shared_subjects = sorted(list(mentor_subjects & mentee_subjects))
    shared_topics = sorted(list(mentor_topics & mentee_topics))
    subj_jaccard = _jaccard(mentor_subjects, mentee_subjects)
    top_jaccard = _jaccard(mentor_topics, mentee_topics)
    if not shared_subjects and not shared_topics:
        academic_pct = 0
        academic_summary = "No shared subjects"
    else:
        academic_pct = min(100, round((0.6 * subj_jaccard + 0.4 * top_jaccard) * 100))
        academic_summary = f"{len(shared_subjects)} shared subject(s), {len(shared_topics)} topic(s)"

    mentor_comp_ids = {c.id for c in getattr(mentor, "competencies", []).all()} if hasattr(mentor, "competencies") else set()
    mentee_comp_ids = {c.id for c in getattr(mentee, "competencies", []).all()} if hasattr(mentee, "competencies") else set()
    shared_comp_ids = mentor_comp_ids & mentee_comp_ids
    comp_jaccard = _jaccard(mentor_comp_ids, mentee_comp_ids)
    if not shared_comp_ids:
        competency_pct = 0
        competency_summary = "No shared competencies"
    else:
        competency_pct = min(100, round(comp_jaccard * 100))
        competency_summary = f"{len(shared_comp_ids)} verified competency matches"

    mentor_level = getattr(mentor, "expertise_level", None)
    mentee_level = getattr(mentee, "difficulty_level", None)
    diff_val = _difficulty_alignment(mentor_level, mentee_level)
    diff_pct = max(20, min(100, round(diff_val * 100)))

    mentor_slots = _normalise_slots(getattr(mentor, "availability", []))
    mentee_slots = _normalise_slots(getattr(mentee, "availability", []))
    overlap_slots = _overlapping_slots_formatted(mentor_slots, mentee_slots)
    has_overlap = len(overlap_slots) > 0
    if has_overlap:
        schedule_pct = 100
    elif not mentor_slots or not mentee_slots:
        schedule_pct = 75
    else:
        schedule_pct = 35

    model_score = _score_with_model(mentor, mentee)
    is_ml = model_score is not None
    final_score = model_score if is_ml else _heuristic_score(mentor, mentee)
    final_score = max(0.0, min(1.0, float(final_score)))
    overall_pct = max(0, min(100, round(final_score * 100)))

    # In relaxed fallback mode or zero-overlap scenarios, if there is no academic overlap,
    # overall fit cannot be positive
    if not shared_subjects and not shared_topics:
        final_score = 0.0
        overall_pct = 0
        tier, label = "low", "No Fit"
    elif overall_pct >= 88:
        tier, label = "high", "Exceptional Fit"
    elif overall_pct >= 75:
        tier, label = "high", "Strong Fit"
    elif overall_pct >= 60:
        tier, label = "medium", "Good Fit"
    else:
        tier, label = "low", "Moderate Fit"

    return {
        "overall_score": round(final_score, 4),
        "overall_percentage": overall_pct,
        "tier": tier,
        "tier_label": label,
        "algorithm": "XGBoost Machine Learning" if is_ml else "Heuristic Feature Alignment",
        "factors": {
            "academic": {
                "label": "Academic & Subject Fit",
                "score": academic_pct,
                "weight_pct": 40,
                "shared_subjects": shared_subjects,
                "shared_topics": shared_topics,
                "summary": academic_summary,
            },
            "competency": {
                "label": "Competency Alignment",
                "score": competency_pct,
                "weight_pct": 25,
                "shared_count": len(shared_comp_ids),
                "summary": competency_summary,
            },
            "difficulty": {
                "label": "Experience & Difficulty Balance",
                "score": diff_pct,
                "weight_pct": 15,
                "mentor_level": mentor_level,
                "mentee_level": mentee_level,
                "summary": f"Mentor expertise: {mentor_level or 'Standard'} • Mentee difficulty: {mentee_level or 'Standard'}",
            },
            "schedule": {
                "label": "Schedule Compatibility",
                "score": schedule_pct,
                "weight_pct": 20,
                "has_overlap": has_overlap,
                "overlapping_slots": overlap_slots,
                "summary": f"Compatible slots: {', '.join(overlap_slots[:3])}" if overlap_slots else ("Open mutual availability" if (not mentor_slots or not mentee_slots) else "Adjustable schedule"),
            },
        },
    }


def compute_score(mentor: MentorProfile, mentee: MenteeProfile) -> float:
    mentor_subjects = _to_set(mentor.subjects) or _to_set(mentor.skills)
    mentee_subjects = _to_set(mentee.subjects) or _to_set(mentee.skills)
    mentor_topics = _to_set(mentor.topics) or _to_set(mentor.skills)
    mentee_topics = _to_set(mentee.topics) or _to_set(mentee.skills)
    if not (mentor_subjects & mentee_subjects) and not (mentor_topics & mentee_topics):
        return 0.0

    model_score = _score_with_model(mentor, mentee)
    if model_score is not None:
        return model_score

    # Fallback when the XGBoost model is unavailable.
    return max(0.0, min(1.0, _heuristic_score(mentor, mentee)))


GROUP_MATCHING_DEFAULT_MIN_SCORE = 0.3


def _optimized_mentor_queryset():
    """Return a MentorProfile queryset with eager loading to avoid N+1 queries."""
    return MentorProfile.objects.select_related("user", "user__profile").prefetch_related(
        "competencies",
        "competency_levels",
        "competency_levels__competency",
        "interest_tags",
    )


def _optimized_mentee_queryset():
    """Return a MenteeProfile queryset with eager loading to avoid N+1 queries."""
    return MenteeProfile.objects.select_related("user", "user__profile").prefetch_related(
        "competencies",
        "competency_needs",
        "competency_needs__competency",
        "interest_tags",
    )


def run_greedy_matching(
    mode: str = "one_to_one",
    min_score: Optional[float] = None,
) -> List[Tuple[int, int, float]]:
    if mode == "group" and min_score is None:
        min_score = GROUP_MATCHING_DEFAULT_MIN_SCORE
    threshold = float(min_score) if mode == "group" and min_score is not None else 0.0

    mentors: List[MentorProfile] = list(_optimized_mentor_queryset())
    mentees: List[MenteeProfile] = list(_optimized_mentee_queryset())
    if not mentors or not mentees:
        return []

    accepted_counts = _accepted_mentee_counts([m.id for m in mentors])
    capacity: Dict[int, int] = {
        m.id: max(int(m.capacity or 0), 0) - int(accepted_counts.get(m.id, 0))
        for m in mentors
    }
    candidates: List[Tuple[int, int, float]] = []
    for mentee in mentees:
        filtered = _filter_mentors_for_mentee(
            mentee,
            mentors,
            accepted_counts=accepted_counts,
        )
        # Use batch scoring for all filtered mentors at once.
        batch_scores = _batch_score_with_model(filtered.mentors, mentee)
        for mentor in filtered.mentors:
            if batch_scores and mentor.id in batch_scores:
                score = batch_scores[mentor.id]
            else:
                score = compute_score(mentor, mentee)
            if score > 0 and (mode != "group" or score >= threshold):
                candidates.append((mentor.id, mentee.id, float(score)))

    candidates.sort(key=lambda x: x[2], reverse=True)

    assigned_mentees: Set[int] = set()
    results: List[Tuple[int, int, float]] = []

    for mid, eid, score in candidates:
        if eid in assigned_mentees:
            continue
        if capacity.get(mid, 0) <= 0:
            continue
        results.append((mid, eid, score))
        assigned_mentees.add(eid)
        capacity[mid] = capacity.get(mid, 0) - 1

    return results


def recommend_mentors_for_mentee(
    mentee: MenteeProfile,
    limit: int = 10,
    min_score: float = 0.0,
) -> List[Tuple[MentorProfile, float]]:
    scored, _ = recommend_mentors_for_mentee_with_meta(
        mentee=mentee,
        limit=limit,
        min_score=min_score,
    )
    return scored


def recommend_mentors_for_mentee_with_meta(
    mentee: MenteeProfile,
    limit: int = 10,
    min_score: float = 0.0,
) -> Tuple[List[Tuple[MentorProfile, float]], Dict[str, Any]]:
    start = time.monotonic()

    # Use a global profiles version so that when any mentor/mentee profile changes,
    # cached recommendations are automatically invalidated.
    version = int(cache.get(MATCHING_PROFILES_VERSION_KEY, 1))
    cache_key = f"matching:recs:v3:mentee:{mentee.id}:limit:{int(limit or 0)}:min:{float(min_score or 0.0):.2f}"

    cached = cache.get(cache_key, version=version)
    if cached:
        mentor_ids = [item["mentor_id"] for item in cached.get("items", [])]
        mentor_map = _optimized_mentor_queryset().in_bulk(mentor_ids)
        scored: List[Tuple[MentorProfile, float]] = []
        for item in cached.get("items", []):
            m = mentor_map.get(item["mentor_id"])
            if m is not None:
                scored.append((m, float(item.get("score", 0.0))))
        meta = dict(cached.get("meta", {}) or {})
        meta["from_cache"] = True
        elapsed_ms = int((time.monotonic() - start) * 1000)
        meta["elapsed_ms"] = elapsed_ms
        return scored, meta

    # Pass the optimized queryset to _filter_mentors_for_mentee for DB-level pre-filtering
    filtered = _filter_mentors_for_mentee(
        mentee,
        _optimized_mentor_queryset(),
        accepted_counts=None,
    )
    if not filtered.mentors:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        meta = {
            "empty_reason": filtered.empty_reason,
            "suggested_time_slots": filtered.suggested_time_slots or [],
            "from_cache": False,
            "elapsed_ms": elapsed_ms,
        }
        cache.set(
            cache_key,
            {"items": [], "meta": meta},
            timeout=MENTEE_RECS_CACHE_TIMEOUT,
            version=version,
        )
        return [], meta

    # ── Batch scoring: one XGBoost predict call for ALL filtered mentors. ──
    batch_scores = _batch_score_with_model(filtered.mentors, mentee)
    scored: List[Tuple[MentorProfile, float]] = []
    threshold = float(min_score or 0.0)
    for mentor in filtered.mentors:
        if batch_scores and mentor.id in batch_scores:
            score = batch_scores[mentor.id]
        else:
            # Fallback to per-mentor scoring (heuristic or model unavailable).
            score = compute_score(mentor, mentee)
        if score <= threshold:
            continue
        scored.append((mentor, float(score)))

    scored.sort(key=lambda x: x[1], reverse=True)
    if limit is not None and limit > 0:
        scored = scored[: int(limit)]

    elapsed_ms = int((time.monotonic() - start) * 1000)
    meta: Dict[str, Any] = {
        "empty_reason": None,
        "suggested_time_slots": [],
        "from_cache": False,
        "elapsed_ms": elapsed_ms,
    }
    if not scored:
        meta["empty_reason"] = "no_candidates_after_filter"

    cache_payload = {
        "items": [{"mentor_id": m.id, "score": s} for m, s in scored],
        "meta": meta,
    }
    cache.set(
        cache_key,
        cache_payload,
        timeout=MENTEE_RECS_CACHE_TIMEOUT,
        version=version,
    )
    logger.debug(
        "recommend_mentors elapsed=%dms mentors_evaluated=%d results=%d",
        elapsed_ms, len(filtered.mentors), len(scored),
    )
    return scored, meta
