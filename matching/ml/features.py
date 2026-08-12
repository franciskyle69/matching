from __future__ import annotations

from typing import Iterable, Set, Dict, Any, List, Tuple

import numpy as np


def _to_set(items: Any) -> Set[str]:
    """
    Normalise checkbox / comma-separated values into a lowercase set.
    This works with Google Forms exports where multiple choices are stored
    in a single string like: "Arrays, Loops, HTML".
    """
    if items is None or (isinstance(items, float) and np.isnan(items)):
        return set()
    if isinstance(items, (list, tuple)):
        return {str(x).strip().lower() for x in items if str(x).strip()}
    s = str(items)
    if not s:
        return set()
    return {p.strip().lower() for p in s.split(",") if p.strip()}


def jaccard(a: Iterable[str], b: Iterable[str]) -> float:
    a = set(a)
    b = set(b)
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    if union == 0:
        return 0.0
    return inter / union


def rating_alignment(mentee_rating: Any, mentor_rating: Any, max_diff: float = 4.0) -> float:
    """
    Turn mentee difficulty (1–5) and mentor expertise (1–5) into a [0,1] score.
    1.0 means perfectly aligned, 0.0 means very far apart.
    """
    try:
        md = float(mentee_rating)
        mr = float(mentor_rating)
    except Exception:
        return 0.0
    diff = min(abs(md - mr), max_diff)
    return 1.0 - diff / max_diff


def mentor_is_instructor(role: Any) -> float:
    """
    Simple binary feature: 1.0 if mentor role is Instructor, else 0.0.
    """
    r = (str(role) or "").strip().lower()
    return 1.0 if "instructor" in r else 0.0


def overlap_ratio(a: Iterable[str], b: Iterable[str]) -> float:
    a_set = set(a)
    b_set = set(b)
    if not a_set:
        return 0.0
    return len(a_set & b_set) / max(len(a_set), 1)


def _coerce_level_map(value: Any) -> Dict[int, int]:
    if isinstance(value, dict):
        items = value.items()
    elif isinstance(value, list):
        # Also accept [{"competency_id": 1, "need_level": 4}, ...]
        out: Dict[int, int] = {}
        for row in value:
            if not isinstance(row, dict):
                continue
            cid = row.get("competency_id")
            level = row.get("need_level", row.get("proficiency_level"))
            try:
                cid_int = int(cid)
                level_int = int(level)
            except (TypeError, ValueError):
                continue
            if cid_int > 0 and 1 <= level_int <= 5:
                out[cid_int] = level_int
        return out
    else:
        return {}

    out: Dict[int, int] = {}
    for key, value_level in items:
        try:
            cid_int = int(key)
            level_int = int(value_level)
        except (TypeError, ValueError):
            continue
        if cid_int > 0 and 1 <= level_int <= 5:
            out[cid_int] = level_int
    return out


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coerce_slots(value: Any) -> List[Tuple[int, int]]:
    if value is None:
        return []
    raw_slots = value if isinstance(value, list) else str(value).split(",")
    out: List[Tuple[int, int]] = []
    for raw in raw_slots:
        text = str(raw or "").strip()
        parts = text.split("-")
        if len(parts) != 2:
            continue
        start = _hhmm_to_minutes(parts[0])
        end = _hhmm_to_minutes(parts[1])
        if start is None or end is None or start >= end:
            continue
        out.append((start, end))
    return out


def _hhmm_to_minutes(value: str):
    parts = str(value or "").strip().split(":")
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


def availability_overlap_ratio(mentee_slots: Any, mentor_slots: Any) -> float:
    mentee_ranges = _coerce_slots(mentee_slots)
    mentor_ranges = _coerce_slots(mentor_slots)
    if not mentee_ranges or not mentor_ranges:
        return 0.0
    overlap = 0
    mentee_total = sum(end - start for start, end in mentee_ranges)
    if mentee_total <= 0:
        return 0.0
    for m_start, m_end in mentee_ranges:
        for t_start, t_end in mentor_ranges:
            start = max(m_start, t_start)
            end = min(m_end, t_end)
            if start < end:
                overlap += end - start
    return min(1.0, overlap / mentee_total)


def build_features(row: Dict[str, Any]) -> Dict[str, float]:
    """
    Build features using only fields that come from your actual Google Forms.

    Expected CSV columns (you can rename the exported headers to these):
      - mentee_subjects         -> checkbox subjects where mentee has challenges
      - mentee_topics           -> checkbox topics where mentee has difficulties
      - mentee_difficulty_level -> 1–5 overall difficulty rating
      - mentor_role             -> "Senior IT Student" / "Instructor"
      - mentor_subjects         -> subjects mentor has expertise in
      - mentor_topics           -> topics mentor has technical expertise in
      - mentor_expertise_level  -> 1–5 expertise self‑rating

    Plus a separate "label" column used as the target in training.
    """

    mentee_subjects = _to_set(row.get("mentee_subjects"))
    mentee_topics = _to_set(row.get("mentee_topics"))
    mentee_competencies = _to_set(row.get("mentee_competencies"))
    mentor_subjects = _to_set(row.get("mentor_subjects"))
    mentor_topics = _to_set(row.get("mentor_topics"))
    mentor_competencies = _to_set(row.get("mentor_competencies"))
    mentee_competency_needs = _coerce_level_map(row.get("mentee_competency_needs"))
    mentor_competency_levels = _coerce_level_map(row.get("mentor_competency_levels"))

    shared_competency_ids = set(mentee_competency_needs.keys()) & set(
        mentor_competency_levels.keys()
    )
    if shared_competency_ids:
        mentor_levels_on_needed = [
            mentor_competency_levels[cid] for cid in shared_competency_ids
        ]
        mentee_need_levels_on_shared = [
            mentee_competency_needs[cid] for cid in shared_competency_ids
        ]
        proficiency_need_gap = np.mean(
            [
                max(0.0, mentor_competency_levels[cid] - mentee_competency_needs[cid])
                for cid in shared_competency_ids
            ]
        )
        proficiency_need_alignment = np.mean(
            [
                1.0 - min(abs(mentor_competency_levels[cid] - mentee_competency_needs[cid]), 4) / 4
                for cid in shared_competency_ids
            ]
        )
    else:
        mentor_levels_on_needed = []
        mentee_need_levels_on_shared = []
        proficiency_need_gap = 0.0
        proficiency_need_alignment = 0.0

    features: Dict[str, float] = {
        # How well do mentor subjects cover mentee’s struggling subjects?
        "subjects_jaccard": jaccard(mentee_subjects, mentor_subjects),
        # How well do mentor topics cover mentee’s topic‑level difficulties?
        "topics_jaccard": jaccard(mentee_topics, mentor_topics),
        # How well do mentor competencies match mentee competency needs?
        "competencies_jaccard": jaccard(mentee_competencies, mentor_competencies),
        "subject_match_binary": 1.0 if jaccard(mentee_subjects, mentor_subjects) > 0 else 0.0,
        "topic_overlap_ratio": overlap_ratio(mentee_topics, mentor_topics),
        "topic_overlap_count": float(len(mentee_topics & mentor_topics)),
        "competency_overlap_ratio": overlap_ratio(mentee_competencies, mentor_competencies),
        "competency_overlap_count": float(len(mentee_competencies & mentor_competencies)),
        # Are the mentor and mentee difficulty/expertise levels aligned?
        "difficulty_alignment": rating_alignment(
            row.get("mentee_difficulty_level"), row.get("mentor_expertise_level")
        ),
        # Distinguish instructors from student mentors.
        "mentor_is_instructor": mentor_is_instructor(row.get("mentor_role")),
        "mentor_avg_proficiency_on_needed": _safe_float(
            np.mean(mentor_levels_on_needed) if mentor_levels_on_needed else 0.0
        ),
        "mentee_avg_need_on_shared": _safe_float(
            np.mean(mentee_need_levels_on_shared) if mentee_need_levels_on_shared else 0.0
        ),
        "proficiency_need_gap": _safe_float(proficiency_need_gap),
        "proficiency_need_alignment": _safe_float(proficiency_need_alignment),
        "mentor_years_experience": _safe_float(row.get("mentor_years_experience"), 0.0),
        "mentor_teaching_experience_years": _safe_float(
            row.get("mentor_teaching_experience_years"), 0.0
        ),
        "availability_overlap_ratio": availability_overlap_ratio(
            row.get("mentee_availability"),
            row.get("mentor_availability"),
        ),
    }

    return features
