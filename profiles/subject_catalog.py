"""Canonical BSIT subject, topic, and competency catalog for matching.

Stored `name` values must stay stable — they are saved on mentor/mentee profiles
and used as XGBoost MultiLabelBinarizer vocabulary keys.
"""

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

# Topic → competencies with zero cross-subject overlap.
CURRICULUM_MATRIX: list[dict] = [
    {
        "name": "Introduction to Computing",
        "code": "IT 111",
        "category": SUBJECT_CATEGORY_MAJOR,
        "topics": [
            {
                "name": "History & Hardware Evolution",
                "competencies": [
                    ("Computing Generations", "Identify computing hardware generations and their capabilities."),
                    ("Processor Architecture", "Describe CPU components and how instructions are executed."),
                    ("Memory & Storage Types", "Differentiate primary memory from secondary storage technologies."),
                ],
            },
            {
                "name": "Digital Logic & Data Representation",
                "competencies": [
                    ("Binary/Octal/Hex Conversions", "Convert values among binary, octal, decimal, and hexadecimal."),
                    ("Boolean Logic Gates", "Apply AND, OR, NOT, NAND, NOR, and XOR in simple circuits."),
                    ("Data Encoding (ASCII/Unicode)", "Explain how characters are represented with ASCII and Unicode."),
                ],
            },
            {
                "name": "Operating Systems & Architecture",
                "competencies": [
                    ("OS Fundamentals", "Explain the role of an operating system in managing hardware and software."),
                    ("Process Management", "Describe processes, scheduling, and basic concurrency concepts."),
                    ("File Systems & Permissions", "Use file-system structures and permission models safely."),
                ],
            },
            {
                "name": "Computer Networks Basics",
                "competencies": [
                    ("Network Topologies", "Compare common physical and logical network topologies."),
                    ("OSI Model Layers", "Map networking tasks to the OSI reference model."),
                    ("Client-Server Architecture", "Explain request-response roles in client-server systems."),
                ],
            },
        ],
    },
    {
        "name": "Computer Programming",
        "code": "IT 112",
        "category": SUBJECT_CATEGORY_MAJOR,
        "topics": [
            {
                "name": "Control Structures",
                "competencies": [
                    ("Loop Control", "Use for, while, and loop-control statements correctly."),
                    ("Conditional Logic", "Write branching logic with if/else and related operators."),
                    ("Iteration Patterns", "Choose iteration patterns that match the problem being solved."),
                ],
            },
            {
                "name": "Data Structures",
                "competencies": [
                    ("Array Creation", "Declare and initialize one-dimensional arrays."),
                    ("1D/2D Manipulation", "Read, update, and traverse 1D and 2D arrays."),
                    ("Linear/Binary Searching", "Implement linear and binary search on ordered data."),
                    ("Basic Sorting Algorithms", "Apply introductory sorting algorithms such as bubble or selection sort."),
                ],
            },
            {
                "name": "Modular Programming",
                "competencies": [
                    ("Function Definitions", "Define reusable functions with a clear purpose."),
                    ("Parameters & Return Values", "Pass arguments and return results from functions."),
                    ("Variable Scope & Lifetime", "Distinguish local, parameter, and global variable lifetimes."),
                ],
            },
            {
                "name": "Debugging & Execution",
                "competencies": [
                    ("Syntax Errors", "Locate and correct syntax errors before a program runs."),
                    ("Logic Troubleshooting", "Trace incorrect program behavior to a logical cause."),
                    ("Console Debugging Techniques", "Use print statements and console tools to inspect runtime state."),
                ],
            },
        ],
    },
    {
        "name": "IT Fundamentals",
        "code": "IT 113",
        "category": SUBJECT_CATEGORY_MAJOR,
        "topics": [
            {
                "name": "Web Markup",
                "competencies": [
                    ("HTML5 Semantic Elements", "Structure pages with HTML5 semantic tags."),
                    ("Forms & Inputs", "Build forms with appropriate input types and labels."),
                    ("Media & Tables", "Embed media and present tabular data accessibly."),
                ],
            },
            {
                "name": "Web Styling",
                "competencies": [
                    ("CSS Selectors", "Target elements using classes, IDs, and combinators."),
                    ("Box Model", "Apply margin, border, padding, and content sizing."),
                    ("Flexbox & Grid", "Build one- and two-dimensional layouts with Flexbox and Grid."),
                    ("Responsive Layouts", "Adapt layouts across common viewport sizes."),
                ],
            },
            {
                "name": "Client-Side Scripting",
                "competencies": [
                    ("JavaScript Syntax", "Use variables, types, and operators in JavaScript."),
                    ("DOM Manipulation", "Read and update page elements from JavaScript."),
                    ("Event Listeners", "Respond to user events such as click and input."),
                ],
            },
            {
                "name": "Command Line & Web Infra",
                "competencies": [
                    ("CLI Navigation", "Navigate directories and run basic command-line tools."),
                    ("Domain Name System (DNS)", "Explain how domain names resolve to hosts."),
                    ("HTTP Request Methods", "Distinguish GET, POST, PUT, PATCH, and DELETE."),
                ],
            },
        ],
    },
    {
        "name": "Intro to Human Computer Interaction",
        "code": "IT 115",
        "category": SUBJECT_CATEGORY_MAJOR,
        "topics": [
            {
                "name": "HCI Principles & Guidelines",
                "competencies": [
                    ("HCI Principles & Paradigms", "Apply core HCI principles and interaction paradigms."),
                    ("Guideline Categories of HCI", "Use established HCI guideline categories in critiques."),
                    ("System Prototype Proposal", "Write a focused proposal for an interactive system prototype."),
                ],
            },
            {
                "name": "Interaction Design & Cognitive Models",
                "competencies": [
                    ("Interaction Design Frameworks", "Select interaction-design frameworks for a given problem."),
                    ("Human Information Processing", "Relate interface decisions to human information processing."),
                ],
            },
            {
                "name": "User Research & Behavioral Mapping",
                "competencies": [
                    ("User Research & Analysis", "Plan and synthesize user research for design decisions."),
                    ("Customer Journey Mapping", "Map customer journeys across touchpoints."),
                    ("User Flow Diagrams", "Draw user flows that capture key tasks and decision points."),
                ],
            },
            {
                "name": "Prototyping & UI Tooling",
                "competencies": [
                    ("Wireframe Sketching", "Sketch low-fidelity wireframes before visual design."),
                    ("Figma UI Design", "Build interface screens in Figma."),
                    ("Design System & Components", "Reuse components from a consistent design system."),
                ],
            },
            {
                "name": "High-Fidelity Design & Documentation",
                "competencies": [
                    ("High-Fidelity Prototyping", "Produce interactive high-fidelity prototypes."),
                    ("Design Systems Documentation", "Document tokens, components, and usage rules."),
                ],
            },
        ],
    },
]

SUBJECT_CATALOG: list[dict[str, str]] = [
    {key: entry[key] for key in ("name", "code", "category")}
    for entry in CURRICULUM_MATRIX
] + [
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

SUBJECT_TOPIC_MAP: dict[str, list[str]] = {
    entry["name"]: [topic["name"] for topic in entry["topics"]]
    for entry in CURRICULUM_MATRIX
}

COMPETENCY_BY_TOPIC: dict[str, list[tuple[str, str]]] = {
    topic["name"]: list(topic["competencies"])
    for entry in CURRICULUM_MATRIX
    for topic in entry["topics"]
}

MAJOR_SUBJECT_NAMES: list[str] = [entry["name"] for entry in CURRICULUM_MATRIX]
TOPIC_VOCABULARY: list[str] = [
    topic["name"] for entry in CURRICULUM_MATRIX for topic in entry["topics"]
]
COMPETENCY_VOCABULARY: list[str] = [
    competency_name
    for entry in CURRICULUM_MATRIX
    for topic in entry["topics"]
    for competency_name, _description in topic["competencies"]
]

_SUBJECT_BY_NAME = {item["name"]: item for item in SUBJECT_CATALOG}
_COMPETENCY_TO_TOPIC: dict[str, str] = {
    competency_name: topic["name"]
    for entry in CURRICULUM_MATRIX
    for topic in entry["topics"]
    for competency_name, _description in topic["competencies"]
}
_TOPIC_TO_SUBJECT: dict[str, str] = {
    topic["name"]: entry["name"]
    for entry in CURRICULUM_MATRIX
    for topic in entry["topics"]
}


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


def competencies_for_subjects(subjects: Iterable[str] | None) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for subject_name in _normalise_list(subjects):
        for topic_name in SUBJECT_TOPIC_MAP.get(subject_name, []):
            for competency_name, _description in COMPETENCY_BY_TOPIC.get(topic_name, []):
                if competency_name in seen:
                    continue
                seen.add(competency_name)
                names.append(competency_name)
    return names


def topics_for_competencies(competency_names: Iterable[str] | None) -> list[str]:
    topics: list[str] = []
    seen: set[str] = set()
    for name in _normalise_list(competency_names):
        topic_name = _COMPETENCY_TO_TOPIC.get(name)
        if not topic_name or topic_name in seen:
            continue
        seen.add(topic_name)
        topics.append(topic_name)
    return topics


def subject_for_topic(topic_name: str) -> str | None:
    return _TOPIC_TO_SUBJECT.get(str(topic_name or "").strip())


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


def validate_curriculum_uniqueness() -> None:
    """Raise if topic or competency names collide across subjects."""
    topic_names = []
    competency_names = []
    for entry in CURRICULUM_MATRIX:
        for topic in entry["topics"]:
            topic_names.append(topic["name"])
            for competency_name, _description in topic["competencies"]:
                competency_names.append(competency_name)
    if len(topic_names) != len(set(topic_names)):
        raise ValueError("Curriculum topics are not unique across subjects.")
    if len(competency_names) != len(set(competency_names)):
        raise ValueError("Curriculum competencies are not unique across topics.")


def apply_curriculum(apps=None) -> dict[str, int]:
    """Replace major-subject topics and competencies with CURRICULUM_MATRIX."""
    validate_curriculum_uniqueness()
    if apps is None:
        from matching.models import Competency, Subject, Topic
        from matching.models import MatchingDatasetTopic, UserTopicPreference
        from profiles.models import MenteeCompetencyNeed, MentorCompetency
        from profiles.models import MenteeProfile, MentorProfile
    else:
        Competency = apps.get_model("matching", "Competency")
        Subject = apps.get_model("matching", "Subject")
        Topic = apps.get_model("matching", "Topic")
        MatchingDatasetTopic = apps.get_model("matching", "MatchingDatasetTopic")
        UserTopicPreference = apps.get_model("matching", "UserTopicPreference")
        MenteeCompetencyNeed = apps.get_model("profiles", "MenteeCompetencyNeed")
        MentorCompetency = apps.get_model("profiles", "MentorCompetency")
        MenteeProfile = apps.get_model("profiles", "MenteeProfile")
        MentorProfile = apps.get_model("profiles", "MentorProfile")

    UserTopicPreference.objects.all().delete()
    MatchingDatasetTopic.objects.all().delete()
    MentorCompetency.objects.all().delete()
    MenteeCompetencyNeed.objects.all().delete()

    for profile_model in (MentorProfile, MenteeProfile):
        try:
            through = profile_model.competencies.through
            through.objects.all().delete()
        except Exception:
            pass

    Competency.objects.all().delete()
    Topic.objects.all().delete()

    for catalog_item in SUBJECT_CATALOG:
        subject, created = Subject.objects.get_or_create(
            name=catalog_item["name"],
            defaults={
                "code": catalog_item["code"],
                "category": catalog_item["category"],
            },
        )
        updates = []
        if subject.code != catalog_item["code"]:
            subject.code = catalog_item["code"]
            updates.append("code")
        if getattr(subject, "category", None) != catalog_item["category"]:
            subject.category = catalog_item["category"]
            updates.append("category")
        if updates:
            subject.save(update_fields=updates)

    topic_count = 0
    competency_count = 0
    for entry in CURRICULUM_MATRIX:
        subject = Subject.objects.filter(name=entry["name"]).first()
        if not subject:
            continue
        for topic_entry in entry["topics"]:
            topic = Topic.objects.create(
                subject=subject,
                name=topic_entry["name"],
                status="active",
            )
            topic_count += 1
            for competency_name, description in topic_entry["competencies"]:
                Competency.objects.create(
                    topic=topic,
                    name=competency_name,
                    description=description,
                )
                competency_count += 1

    return {
        "subjects": Subject.objects.filter(category=SUBJECT_CATEGORY_MAJOR).count(),
        "topics": topic_count,
        "competencies": competency_count,
    }
