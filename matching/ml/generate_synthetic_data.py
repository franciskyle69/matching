from __future__ import annotations

"""
Generate synthetic mentor–mentee CSV rows for training the matching model.

Uses the same subject catalog as preferences (major IT + minor GE/NSTP/PE).
Topics are only sampled for major subjects; minor-only rows may have empty topics.

Run from the Django project root:

    python -m matching.ml.generate_synthetic_data --rows 2500 --split
    python manage.py train_xgb --input matching/ml/synthetic_train.csv
"""

import argparse
import csv
import random
import sys
from pathlib import Path

# Allow importing profiles.subject_catalog when run as __main__
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from profiles.subject_catalog import (  # noqa: E402
    SUBJECT_CATALOG,
    SUBJECT_TOPIC_MAP,
    is_minor_subject,
)

RNG = random.Random(42)

MAJOR_SUBJECTS = [e["name"] for e in SUBJECT_CATALOG if e["category"] == "major"]
MINOR_SUBJECTS = [e["name"] for e in SUBJECT_CATALOG if e["category"] != "major"]
GE_SUBJECTS = [e["name"] for e in SUBJECT_CATALOG if e["category"] == "ge"]
NSTP_SUBJECTS = [e["name"] for e in SUBJECT_CATALOG if e["category"] == "nstp"]
PE_SUBJECTS = [e["name"] for e in SUBJECT_CATALOG if e["category"] == "pe"]

TOPICS = sorted({topic for topics in SUBJECT_TOPIC_MAP.values() for topic in topics})
MENTOR_ROLES = ["Senior IT Student", "Instructor"]
SLOT_BLOCKS = ["08:00-10:00", "10:00-12:00", "13:00-15:00", "15:00-17:00", "18:00-20:00"]


def sample_subset(options: list[str], min_n: int, max_n: int) -> list[str]:
    if not options:
        return []
    max_n = min(max_n, len(options))
    min_n = min(min_n, max_n)
    if max_n <= 0:
        return []
    n = RNG.randint(min_n, max_n)
    return RNG.sample(options, n)


def topics_for_major_subjects(subject_names: list[str]) -> list[str]:
    allowed: list[str] = []
    seen: set[str] = set()
    for name in subject_names:
        if is_minor_subject(name):
            continue
        for topic in SUBJECT_TOPIC_MAP.get(name, []):
            if topic in seen:
                continue
            seen.add(topic)
            allowed.append(topic)
    return allowed


def _pick_minor_subjects() -> list[str]:
    """Sample 1–2 minor subjects, sometimes from the same category."""
    roll = RNG.random()
    if roll < 0.45:
        return sample_subset(GE_SUBJECTS, 1, 2)
    if roll < 0.75:
        return sample_subset(NSTP_SUBJECTS, 1, 1)
    return sample_subset(PE_SUBJECTS, 1, 2)


def _pick_major_subjects() -> list[str]:
    base_subjects = ["Computer Programming", "IT Fundamentals"]
    extra_subjects = [s for s in MAJOR_SUBJECTS if s not in base_subjects]
    subjects: set[str] = {RNG.choice(base_subjects)}
    if RNG.random() < 0.7:
        subjects.add(RNG.choice(base_subjects))
    if RNG.random() < 0.4:
        subjects.add(RNG.choice(extra_subjects))
    return sorted(subjects)


def sample_competencies_for_topics(topics: list[str], max_per_topic: int = 2) -> list[str]:
    out = []
    for topic in topics:
        labels = [
            f"{topic} Basics",
            f"{topic} Practice",
            f"{topic} Problem Solving",
        ]
        picks = sample_subset(labels, 1, min(max_per_topic, len(labels)))
        out.extend(picks)
    seen = set()
    deduped = []
    for item in out:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
    return deduped


def sample_availability() -> list[str]:
    return sample_subset(SLOT_BLOCKS, 1, 3)


def sample_mentee_row() -> dict:
    roll = RNG.random()
    subjects: list[str]

    if roll < 0.22:
        # Minor-only mentee (GE / NSTP / PE) — no topics
        subjects = _pick_minor_subjects()
        if RNG.random() < 0.35:
            subjects = sorted(set(subjects + sample_subset(_pick_minor_subjects(), 1, 1)))
        topics: list[str] = []
    elif roll < 0.55:
        # Major-focused mentee
        subjects = _pick_major_subjects()
        if RNG.random() < 0.18:
            subjects = sorted(set(subjects + _pick_minor_subjects()))
        allowed_topics = topics_for_major_subjects(subjects)
        topics = sample_subset(allowed_topics, 2, min(5, len(allowed_topics))) if allowed_topics else []
    else:
        # Mixed profile
        subjects = sorted(set(_pick_major_subjects() + _pick_minor_subjects()))
        allowed_topics = topics_for_major_subjects(subjects)
        topics = sample_subset(allowed_topics, 1, min(4, len(allowed_topics))) if allowed_topics else []

    difficulty_choices = [2, 3, 3, 4, 4, 5]
    difficulty_level = RNG.choice(difficulty_choices)
    competencies = sample_competencies_for_topics(topics, max_per_topic=2)
    availability = sample_availability()

    return {
        "mentee_subjects": ", ".join(subjects),
        "mentee_topics": ", ".join(topics),
        "mentee_competencies": ", ".join(competencies),
        "mentee_availability": ", ".join(availability),
        "mentee_difficulty_level": difficulty_level,
    }


def sample_mentor_row() -> dict:
    roll = RNG.random()
    role = RNG.choices(MENTOR_ROLES, weights=[0.7, 0.3], k=1)[0]

    if roll < 0.18:
        subjects = _pick_minor_subjects()
        if RNG.random() < 0.3:
            subjects = sorted(set(subjects + sample_subset(MINOR_SUBJECTS, 1, 2)))
        topics = []
    elif roll < 0.52:
        subjects = sample_subset(MAJOR_SUBJECTS, 1, 3)
        if RNG.random() < 0.22:
            subjects = sorted(set(subjects + _pick_minor_subjects()))
        allowed_topics = topics_for_major_subjects(subjects)
        topics = sample_subset(allowed_topics, 3, min(6, len(allowed_topics))) if allowed_topics else []
    else:
        subjects = sorted(set(sample_subset(MAJOR_SUBJECTS, 1, 2) + _pick_minor_subjects()))
        allowed_topics = topics_for_major_subjects(subjects)
        topics = sample_subset(allowed_topics, 2, min(5, len(allowed_topics))) if allowed_topics else []

    if role == "Instructor":
        expertise_level = RNG.choice([4, 4, 5, 5])
    else:
        expertise_level = RNG.choice([3, 3, 4, 4, 5])
    competencies = sample_competencies_for_topics(topics, max_per_topic=3)
    availability = sample_availability()
    years_experience = RNG.randint(1, 12)
    teaching_experience_years = RNG.randint(0, years_experience)

    return {
        "mentor_role": role,
        "mentor_subjects": ", ".join(subjects),
        "mentor_topics": ", ".join(topics),
        "mentor_competencies": ", ".join(competencies),
        "mentor_availability": ", ".join(availability),
        "mentor_years_experience": years_experience,
        "mentor_teaching_experience_years": teaching_experience_years,
        "mentor_expertise_level": expertise_level,
    }


def compute_label(mentee: dict, mentor: dict) -> int:
    mentee_subjects = {
        s.strip().lower() for s in str(mentee["mentee_subjects"]).split(",") if s.strip()
    }
    mentor_subjects = {
        s.strip().lower() for s in str(mentor["mentor_subjects"]).split(",") if s.strip()
    }
    subj_intersection = len(mentee_subjects & mentor_subjects)

    mentee_topics = {
        s.strip().lower() for s in str(mentee["mentee_topics"]).split(",") if s.strip()
    }
    mentor_topics = {
        s.strip().lower() for s in str(mentor["mentor_topics"]).split(",") if s.strip()
    }
    topic_intersection = len(mentee_topics & mentor_topics)

    mentee_diff = int(mentee["mentee_difficulty_level"])
    mentor_exp = int(mentor["mentor_expertise_level"])

    score = 0.0
    score += subj_intersection * 1.0
    score += topic_intersection * 0.5
    score += 0.5 if mentor_exp >= mentee_diff else -0.5

    # Minor-only pairs rely on subject overlap; empty topics should not penalize heavily
    mentee_has_major = any(not is_minor_subject(s) for s in mentee_subjects)
    if not mentee_has_major and subj_intersection >= 1 and mentor_exp >= mentee_diff:
        score += 0.75

    score += RNG.uniform(-0.5, 0.5)
    return 1 if score >= 1.5 else 0


def write_csv(output_path: Path, rows: list[dict]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "mentee_subjects",
        "mentee_topics",
        "mentee_competencies",
        "mentee_availability",
        "mentee_difficulty_level",
        "mentor_role",
        "mentor_subjects",
        "mentor_topics",
        "mentor_competencies",
        "mentor_availability",
        "mentor_years_experience",
        "mentor_teaching_experience_years",
        "mentor_expertise_level",
        "label",
    ]
    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def generate_rows(n_rows: int) -> list[dict]:
    rows = []
    for _ in range(n_rows):
        mentee = sample_mentee_row()
        mentor = sample_mentor_row()
        label = compute_label(mentee, mentor)
        rows.append({**mentee, **mentor, "label": label})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic mentor–mentee CSV data.")
    parser.add_argument("--rows", type=int, default=500, help="Total number of rows to generate")
    parser.add_argument("--split", action="store_true", help="Create train/val/test split CSVs")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    RNG.seed(args.seed)
    here = Path(__file__).resolve().parent

    if args.split:
        total = int(args.rows)
        train_n = int(total * 0.7)
        val_n = int(total * 0.15)
        test_n = total - train_n - val_n

        rows = generate_rows(total)
        write_csv(here / "synthetic_train.csv", rows[:train_n])
        write_csv(here / "synthetic_val.csv", rows[train_n : train_n + val_n])
        write_csv(here / "synthetic_test.csv", rows[train_n + val_n :])

        print(f"Train: {train_n} rows -> {here / 'synthetic_train.csv'}")
        print(f"Val: {val_n} rows -> {here / 'synthetic_val.csv'}")
        print(f"Test: {test_n} rows -> {here / 'synthetic_test.csv'}")
    else:
        output_path = here / "synthetic_pairs.csv"
        rows = generate_rows(int(args.rows))
        write_csv(output_path, rows)
        print(f"Synthetic dataset written to: {output_path}")


if __name__ == "__main__":
    main()
