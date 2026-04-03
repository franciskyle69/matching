"""Shared subject/topic rules for questionnaire forms and API validation."""

from __future__ import annotations

from typing import Iterable


SUBJECT_TOPIC_MAP = {
    "Computer Programming": [
        "Arrays",
        "Loops",
        "Input and Output Handling",
        "Error Handling",
        "Javascript",
    ],
    "Introduction to Computing": [
        "Arrays",
        "Loops",
        "Input and Output Handling",
        "Error Handling",
    ],
    "Intro to Human Computer Interaction": ["UI/UX"],
    "IT Fundamentals": ["HTML", "CSS", "Javascript"],
}


def _normalise_list(values: Iterable[str] | None) -> list[str]:
    if not values:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def get_allowed_topics(subjects: Iterable[str] | None) -> list[str]:
    """Return the topic options allowed for the selected subjects."""
    allowed: list[str] = []
    seen: set[str] = set()
    for subject in _normalise_list(subjects):
        for topic in SUBJECT_TOPIC_MAP.get(subject, []):
            if topic in seen:
                continue
            seen.add(topic)
            allowed.append(topic)
    return allowed


def filter_topics_for_subjects(subjects: Iterable[str] | None, topics: Iterable[str] | None) -> list[str]:
    """Keep only topics that belong to one of the selected subjects."""
    allowed = set(get_allowed_topics(subjects))
    if not allowed:
      return []
    return [topic for topic in _normalise_list(topics) if topic in allowed]