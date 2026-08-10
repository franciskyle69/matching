"""Shared subject/topic rules for questionnaire forms and API validation."""

from __future__ import annotations

from typing import Iterable

from .subject_catalog import (
    SUBJECT_TOPIC_MAP,
    subjects_requiring_topics,
)


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
    """
    Return allowed active topics for selected major subjects.

    Uses DB-backed Subject/Topic definitions when available. Falls back to
    static subject_catalog mappings for resilience during migration/bootstrap.
    """
    selected_major_subjects = _normalise_list(subjects_requiring_topics(subjects))
    if not selected_major_subjects:
        return []

    try:
        from matching.models import Topic, Subject

        subjects_by_name = {
            item.name: item
            for item in Subject.objects.filter(name__in=selected_major_subjects)
        }
        allowed: list[str] = []
        seen: set[str] = set()
        for subject_name in selected_major_subjects:
            subject = subjects_by_name.get(subject_name)
            if not subject or subject.category != Subject.CATEGORY_MAJOR:
                continue
            rows = Topic.objects.filter(
                subject_id=subject.id,
                status=Topic.STATUS_ACTIVE,
            ).order_by("name")
            for row in rows:
                topic_name = str(row.name or "").strip()
                if not topic_name or topic_name in seen:
                    continue
                seen.add(topic_name)
                allowed.append(topic_name)
        return allowed
    except Exception:
        allowed: list[str] = []
        seen: set[str] = set()
        for subject in selected_major_subjects:
            for topic in SUBJECT_TOPIC_MAP.get(subject, []):
                if topic in seen:
                    continue
                seen.add(topic)
                allowed.append(topic)
        return allowed


def filter_topics_for_subjects(subjects: Iterable[str] | None, topics: Iterable[str] | None) -> list[str]:
    """Keep only topics that belong to one of the selected major subjects."""
    allowed = set(get_allowed_topics(subjects))
    if not allowed:
        return []
    return [topic for topic in _normalise_list(topics) if topic in allowed]