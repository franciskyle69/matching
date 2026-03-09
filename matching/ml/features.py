from __future__ import annotations

from typing import Iterable, Set, Dict, Any

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
    mentor_subjects = _to_set(row.get("mentor_subjects"))
    mentor_topics = _to_set(row.get("mentor_topics"))

    features: Dict[str, float] = {
        # How well do mentor subjects cover mentee’s struggling subjects?
        "subjects_jaccard": jaccard(mentee_subjects, mentor_subjects),
        # How well do mentor topics cover mentee’s topic‑level difficulties?
        "topics_jaccard": jaccard(mentee_topics, mentor_topics),
        # Are the mentor and mentee difficulty/expertise levels aligned?
        "difficulty_alignment": rating_alignment(
            row.get("mentee_difficulty_level"), row.get("mentor_expertise_level")
        ),
        # Distinguish instructors from student mentors.
        "mentor_is_instructor": mentor_is_instructor(row.get("mentor_role")),
    }

    return features
