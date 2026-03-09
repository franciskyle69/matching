from __future__ import annotations

from dataclasses import dataclass
from typing import List, Tuple, Dict, Set, Any, Optional

import pandas as pd
from django.db.models import Count

from profiles.models import MentorProfile, MenteeProfile
from matching.models import MenteeMentorRequest
from matching.ml.features import build_features
from matching.ml.model_io import load_model


def _to_set(items) -> Set[str]:
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


def _difficulty_alignment(mentor_level, mentee_level) -> float:
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


def _normalise_gender(value: Any, default: str = "") -> str:
    text = str(value or "").strip().lower()
    if text in ("male", "female", "no_preference"):
        return text
    return default


def _parse_hhmm(value: str) -> Optional[int]:
    text = str(value or "").strip()
    parts = text.split(":")
    if len(parts) != 2:
        return None
    try:
        hour = int(parts[0])
        minute = int(parts[1])
    except (TypeError, ValueError):
        return None
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return hour * 60 + minute


def _parse_slot(slot: Any) -> Optional[Tuple[int, int]]:
    if not isinstance(slot, str):
        return None
    parts = slot.split("-")
    if len(parts) != 2:
        return None
    start = _parse_hhmm(parts[0])
    end = _parse_hhmm(parts[1])
    if start is None or end is None or start >= end:
        return None
    return start, end


def _normalise_slots(value: Any) -> List[Tuple[int, int]]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        raw_slots = list(value)
    elif isinstance(value, str):
        raw_slots = [part.strip() for part in value.split(",") if part.strip()]
    else:
        raw_slots = []

    slots: List[Tuple[int, int]] = []
    seen: Set[Tuple[int, int]] = set()
    for raw in raw_slots:
        parsed = _parse_slot(raw)
        if not parsed or parsed in seen:
            continue
        slots.append(parsed)
        seen.add(parsed)
    return slots


def _slots_overlap(a_slots: List[Tuple[int, int]], b_slots: List[Tuple[int, int]]) -> bool:
    if not a_slots or not b_slots:
        return False
    for a_start, a_end in a_slots:
        for b_start, b_end in b_slots:
            if max(a_start, b_start) < min(a_end, b_end):
                return True
    return False


def _format_minutes(total_minutes: int) -> str:
    hour = total_minutes // 60
    minute = total_minutes % 60
    return f"{hour:02d}:{minute:02d}"


def _format_slot(slot: Tuple[int, int]) -> str:
    return f"{_format_minutes(slot[0])}-{_format_minutes(slot[1])}"


def _accepted_mentee_counts(mentor_ids: List[int]) -> Dict[int, int]:
    if not mentor_ids:
        return {}
    rows = (
        MenteeMentorRequest.objects.filter(accepted=True, mentor_id__in=mentor_ids)
        .values("mentor_id")
        .annotate(total=Count("id"))
    )
    return {int(row["mentor_id"]): int(row["total"] or 0) for row in rows}


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

    preferred = _normalise_gender(
        getattr(mentee, "preferred_gender", "no_preference"),
        default="no_preference",
    )
    if preferred == "no_preference":
        gender_filtered = mentors
    else:
        gender_filtered = [
            mentor
            for mentor in mentors
            if _normalise_gender(getattr(mentor, "gender", "")) == preferred
        ]
    if not gender_filtered:
        return MentorFilterResult(
            mentors=[],
            empty_reason="gender_preference",
            suggested_time_slots=[],
        )

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

    suggested: List[Tuple[int, int]] = []
    seen_slots: Set[Tuple[int, int]] = set()
    for mentor in capacity_filtered:
        for slot in _normalise_slots(getattr(mentor, "availability", [])):
            if slot in seen_slots:
                continue
            seen_slots.add(slot)
            suggested.append(slot)
    suggested.sort(key=lambda item: (item[0], item[1]))
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


def _build_row(mentor: MentorProfile, mentee: MenteeProfile) -> Dict[str, Any]:
    return {
        "mentee_subjects": mentee.subjects or mentee.skills,
        "mentee_topics": mentee.topics or mentee.skills,
        "mentee_difficulty_level": mentee.difficulty_level,
        "mentor_role": mentor.role,
        "mentor_subjects": mentor.subjects or mentor.skills,
        "mentor_topics": mentor.topics or mentor.skills,
        "mentor_expertise_level": mentor.expertise_level,
    }


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

    task = meta.get("task", "classification")
    if task == "classification":
        proba = model.predict_proba(X.values)[0, 1]
        return float(proba)
    pred = model.predict(X.values)[0]
    return float(pred)


def compute_score(mentor: MentorProfile, mentee: MenteeProfile) -> float:
    model_score = _score_with_model(mentor, mentee)
    if model_score is not None:
        return model_score

    mentor_subjects = _to_set(mentor.subjects) or _to_set(mentor.skills)
    mentee_subjects = _to_set(mentee.subjects) or _to_set(mentee.skills)
    mentor_topics = _to_set(mentor.topics) or _to_set(mentor.skills)
    mentee_topics = _to_set(mentee.topics) or _to_set(mentee.skills)

    subjects = _jaccard(mentor_subjects, mentee_subjects)
    topics = _jaccard(mentor_topics, mentee_topics)
    difficulty = _difficulty_alignment(mentor.expertise_level, mentee.difficulty_level)
    instructor = _mentor_is_instructor(mentor.role)

    return 0.45 * subjects + 0.4 * topics + 0.1 * difficulty + 0.05 * instructor


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
    mentors: List[MentorProfile] = list(MentorProfile.objects.all())
    if not mentors:
        return [], {"empty_reason": "no_mentors", "suggested_time_slots": []}

    accepted_counts = _accepted_mentee_counts([m.id for m in mentors])
    filtered = _filter_mentors_for_mentee(
        mentee,
        mentors,
        accepted_counts=accepted_counts,
    )
    if not filtered.mentors:
        return [], {
            "empty_reason": filtered.empty_reason,
            "suggested_time_slots": filtered.suggested_time_slots or [],
        }

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

    meta: Dict[str, Any] = {"empty_reason": None, "suggested_time_slots": []}
    if not scored:
        meta["empty_reason"] = "no_candidates_after_filter"
    return scored, meta
