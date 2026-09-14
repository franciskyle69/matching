from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple, Dict, Set, Any, Optional
import time

import pandas as pd
from django.core.cache import cache
from django.db.models import Count

from profiles.models import MentorProfile, MenteeProfile
from matching.models import MenteeMentorRequest, UserTopicPreference, Topic
from matching.ml.features import build_features
from matching.ml.model_io import load_model


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
    mentors: List[MentorProfile],
    accepted_counts: Optional[Dict[int, int]] = None,
) -> MentorFilterResult:
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

    mentee_slots = _normalise_slots(getattr(mentee, "availability", []))
    time_filtered: List[MentorProfile] = []
    for mentor in capacity_filtered:
        mentor_slots = _normalise_slots(getattr(mentor, "availability", []))
        if _slots_overlap(mentor_slots, mentee_slots):
            time_filtered.append(mentor)

    if time_filtered:
        return MentorFilterResult(mentors=time_filtered, empty_reason=None, suggested_time_slots=[])

    suggested: List[Slot] = []
    seen_slots: Set[Slot] = set()
    for mentor in capacity_filtered:
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


def _build_row(mentor: MentorProfile, mentee: MenteeProfile) -> Dict[str, Any]:
    mentor_competency_levels = {}
    if hasattr(mentor, "competency_levels"):
        mentor_competency_levels = {
            item.competency_id: int(item.proficiency_level)
            for item in mentor.competency_levels.all()
        }
    mentee_competency_needs = {}
    if hasattr(mentee, "competency_needs"):
        mentee_competency_needs = {
            item.competency_id: int(item.need_level)
            for item in mentee.competency_needs.all()
        }
    return {
        "mentee_subjects": mentee.subjects or mentee.skills,
        "mentee_topics": mentee.topics or mentee.skills,
        "mentee_competencies": list(
            mentee.competencies.values_list("name", flat=True)
        ) if hasattr(mentee, "competencies") else [],
        "mentee_difficulty_level": mentee.difficulty_level,
        "mentee_year_level": getattr(mentee, "year_level", 0) or 0,
        "mentee_competency_needs": mentee_competency_needs,
        "mentee_availability": getattr(mentee, "availability", []),
        "mentor_role": mentor.role,
        "mentor_subjects": mentor.subjects or mentor.skills,
        "mentor_topics": mentor.topics or mentor.skills,
        "mentor_competencies": list(
            mentor.competencies.values_list("name", flat=True)
        ) if hasattr(mentor, "competencies") else [],
        "mentor_expertise_level": mentor.expertise_level,
        "mentor_year_level": getattr(mentor, "year_level", 0) or 0,
        "mentor_competency_levels": mentor_competency_levels,
        "mentor_years_experience": getattr(mentor, "years_experience", 0) or 0,
        "mentor_teaching_experience_years": getattr(mentor, "teaching_experience_years", 0) or 0,
        "mentor_availability": getattr(mentor, "availability", []),
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
    mentor_competencies = _to_set(
        mentor.competencies.values_list("id", flat=True)
    ) if hasattr(mentor, "competencies") else set()
    mentee_competencies = _to_set(
        mentee.competencies.values_list("id", flat=True)
    ) if hasattr(mentee, "competencies") else set()
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


def _score_with_model(mentor: MentorProfile, mentee: MenteeProfile) -> Optional[float]:
    model, meta = _get_model()
    if model is None or meta is None:
        return None
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
    return max(0.0, min(1.0, score))


def compute_score(mentor: MentorProfile, mentee: MenteeProfile) -> float:
    model_score = _score_with_model(mentor, mentee)
    if model_score is not None:
        return model_score

    # Fallback when the XGBoost model is unavailable.
    return max(0.0, min(1.0, _heuristic_score(mentor, mentee)))


GROUP_MATCHING_DEFAULT_MIN_SCORE = 0.3


def run_greedy_matching(
    mode: str = "one_to_one",
    min_score: Optional[float] = None,
) -> List[Tuple[int, int, float]]:
    if mode == "group" and min_score is None:
        min_score = GROUP_MATCHING_DEFAULT_MIN_SCORE
    threshold = float(min_score) if mode == "group" and min_score is not None else 0.0

    mentors: List[MentorProfile] = list(MentorProfile.objects.all())
    mentees: List[MenteeProfile] = list(MenteeProfile.objects.all())
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
        for mentor in filtered.mentors:
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
    mentors: List[MentorProfile] = list(MentorProfile.objects.all())
    if not mentors:
        elapsed_ms = int((time.monotonic() - start) * 1000)
        return [], {
            "empty_reason": "no_mentors",
            "suggested_time_slots": [],
            "from_cache": False,
            "elapsed_ms": elapsed_ms,
        }

    # Use a global profiles version so that when any mentor/mentee profile changes,
    # cached recommendations are automatically invalidated.
    version = int(cache.get(MATCHING_PROFILES_VERSION_KEY, 1))
    cache_key = f"matching:recs:v3:mentee:{mentee.id}:limit:{int(limit or 0)}:min:{float(min_score or 0.0):.2f}"

    cached = cache.get(cache_key, version=version)
    if cached:
        mentor_ids = [item["mentor_id"] for item in cached.get("items", [])]
        mentor_map = MentorProfile.objects.in_bulk(mentor_ids)
        scored: List[Tuple[MentorProfile, float]] = []
        for item in cached.get("items", []):
            m = mentor_map.get(item["mentor_id"])
            if m is not None:
                scored.append((m, float(item.get("score", 0.0))))
        meta = dict(cached.get("meta", {}) or {})
        meta.setdefault("from_cache", True)
        elapsed_ms = int((time.monotonic() - start) * 1000)
        meta.setdefault("elapsed_ms", elapsed_ms)
        return scored, meta

    accepted_counts = _accepted_mentee_counts([m.id for m in mentors])
    filtered = _filter_mentors_for_mentee(
        mentee,
        mentors,
        accepted_counts=accepted_counts,
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

    scored: List[Tuple[MentorProfile, float]] = []
    threshold = float(min_score or 0.0)
    for mentor in filtered.mentors:
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
    return scored, meta
