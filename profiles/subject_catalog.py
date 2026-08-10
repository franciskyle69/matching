"""Canonical subject catalog for mentoring preferences and matching."""

from __future__ import annotations

from typing import Iterable

SUBJECT_CATEGORY_MAJOR = "major"
SUBJECT_CATEGORY_GE = "ge"
SUBJECT_CATEGORY_NSTP = "nstp"
SUBJECT_CATEGORY_PE = "pe"

SUBJECT_CATEGORY_LABELS = {
    SUBJECT_CATEGORY_MAJOR: "Major subjects",
    SUBJECT_CATEGORY_GE: "General Education (GE)",
    SUBJECT_CATEGORY_NSTP: "NSTP",
    SUBJECT_CATEGORY_PE: "Physical Education (PE)",
}

SUBJECT_CATEGORY_ORDER = (
    SUBJECT_CATEGORY_MAJOR,
    SUBJECT_CATEGORY_GE,
    SUBJECT_CATEGORY_NSTP,
    SUBJECT_CATEGORY_PE,
)

# Stored `name` values must stay stable — they are saved on mentor/mentee profiles.
SUBJECT_CATALOG: list[dict[str, str]] = [
    {
        "name": "Computer Programming",
        "code": "IT 112",
        "category": SUBJECT_CATEGORY_MAJOR,
    },
    {
        "name": "Introduction to Computing",
        "code": "IT 111",
        "category": SUBJECT_CATEGORY_MAJOR,
    },
    {
        "name": "IT Fundamentals",
        "code": "IT 113",
        "category": SUBJECT_CATEGORY_MAJOR,
    },
    {
        "name": "Intro to Human Computer Interaction",
        "code": "IT 115",
        "category": SUBJECT_CATEGORY_MAJOR,
    },
    {
        "name": "GE 108: Understanding the Self",
        "code": "GE 108",
        "category": SUBJECT_CATEGORY_GE,
    },
    {
        "name": "GE 104: Readings in Philippine History",
        "code": "GE 104",
        "category": SUBJECT_CATEGORY_GE,
    },
    {
        "name": "GE EL 108: Philippine Indigenous Communities",
        "code": "GE EL 108",
        "category": SUBJECT_CATEGORY_GE,
    },
    {
        "name": "GE 105: Mathematics in the Modern World",
        "code": "GE 105",
        "category": SUBJECT_CATEGORY_GE,
    },
    {
        "name": "NSTP 1: Civic Welfare Training Service",
        "code": "NSTP 1",
        "category": SUBJECT_CATEGORY_NSTP,
    },
    {
        "name": "NSTP 2: Civic Welfare Training Service",
        "code": "NSTP 2",
        "category": SUBJECT_CATEGORY_NSTP,
    },
    {
        "name": "PE 1: PATH FIT 1 - Movement Enhancement",
        "code": "PE 1",
        "category": SUBJECT_CATEGORY_PE,
    },
    {
        "name": "PE 2: PATH FIT 2 - Fitness Exercises",
        "code": "PE 2",
        "category": SUBJECT_CATEGORY_PE,
    },
]

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

_SUBJECT_BY_NAME = {item["name"]: item for item in SUBJECT_CATALOG}


def get_subject_choices() -> list[tuple[str, str]]:
    return [(item["name"], item["name"]) for item in SUBJECT_CATALOG]


def get_subject_by_name(name: str) -> dict[str, str] | None:
    return _SUBJECT_BY_NAME.get(str(name or "").strip())


def get_subject_category(name: str) -> str:
    item = get_subject_by_name(name)
    return item["category"] if item else SUBJECT_CATEGORY_MAJOR


def is_minor_subject(name: str) -> bool:
    return get_subject_category(name) != SUBJECT_CATEGORY_MAJOR


def subjects_requiring_topics(subjects: Iterable[str] | None) -> list[str]:
    return [name for name in _normalise_list(subjects) if not is_minor_subject(name)]


def selection_requires_topics(subjects: Iterable[str] | None) -> bool:
    return bool(subjects_requiring_topics(subjects))


def serialize_subject_catalog() -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for entry in SUBJECT_CATALOG:
        category = entry["category"]
        items.append(
            {
                "name": entry["name"],
                "code": entry["code"],
                "category": category,
                "category_label": SUBJECT_CATEGORY_LABELS.get(category, category),
                "is_minor": category != SUBJECT_CATEGORY_MAJOR,
            }
        )
    return items


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
