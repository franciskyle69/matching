from __future__ import annotations

"""
Generate synthetic mentor–mentee CSV rows for training the matching model.

Uses the canonical BSIT curriculum matrix in profiles.subject_catalog.

Run from the Django project root:

    python -m matching.ml.generate_synthetic_data --rows 2500 --split
    python manage.py train_xgb --input matching/ml/synthetic_train.csv
"""

import argparse
import csv
import random
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from profiles.subject_catalog import (  # noqa: E402
    COMPETENCY_BY_TOPIC,
    CORE_SUBJECT_NAMES,
    SUBJECT_TOPIC_MAP,
)
from matching.ml.features import (  # noqa: E402
    MAX_COMPETENCIES_PER_TOPIC,
    MAX_COMPETENCIES_TOTAL,
    MAX_SUBJECTS,
    MAX_TOPICS_PER_SUBJECT,
    MAX_TOPICS_TOTAL,
    SUBJECT_VECTOR_DIMENSION,
)

RNG = random.Random(42)

if SUBJECT_VECTOR_DIMENSION != len(CORE_SUBJECT_NAMES):
    raise ValueError("The synthetic generator requires the four core BSIT subjects.")

MENTOR_ROLES = ["Senior IT Student", "Instructor"]
SLOT_BLOCKS = [
    "Mon|09:00-11:00",
    "Tue|10:00-12:00",
    "Wed|13:00-15:00",
    "Thu|15:00-17:00",
    "Fri|18:00-20:00",
    "Sat|09:00-11:00",
]


def sample_subset(options: list[str], min_n: int, max_n: int) -> list[str]:
    if not options:
        return []
    max_n = min(max_n, len(options))
    min_n = min(min_n, max_n)
    if max_n <= 0:
        return []
    n = RNG.randint(min_n, max_n)
    return RNG.sample(options, n)


def _pick_core_subjects(min_n: int = 1) -> list[str]:
    return sample_subset(list(CORE_SUBJECT_NAMES), min_n, MAX_SUBJECTS)


def _sample_topics_and_competencies(subjects: list[str]) -> tuple[list[str], list[str]]:
    topics: list[str] = []
    competencies: list[str] = []
    for subject in subjects:
        subject_topics = sample_subset(
            SUBJECT_TOPIC_MAP.get(subject, []),
            1,
            MAX_TOPICS_PER_SUBJECT,
        )
        topics.extend(subject_topics)
        for topic in subject_topics:
            remaining = MAX_COMPETENCIES_TOTAL - len(competencies)
            if remaining <= 0:
                break
            topic_competencies = [name for name, _description in COMPETENCY_BY_TOPIC.get(topic, [])]
            competencies.extend(
                sample_subset(
                    topic_competencies,
                    1,
                    min(MAX_COMPETENCIES_PER_TOPIC, remaining),
                )
            )
    return topics[:MAX_TOPICS_TOTAL], competencies[:MAX_COMPETENCIES_TOTAL]


def sample_availability() -> list[str]:
    return sample_subset(SLOT_BLOCKS, 2, 4)


def sample_mentee_row() -> dict:
    subjects = _pick_core_subjects()
    topics, competencies = _sample_topics_and_competencies(subjects)

    return {
        "mentee_subjects": ", ".join(subjects),
        "mentee_topics": ", ".join(topics),
        "mentee_competencies": ", ".join(competencies),
        "mentee_availability": ", ".join(sample_availability()),
        "mentee_difficulty_level": RNG.choice([2, 3, 3, 4, 4, 5]),
        "mentee_year_level": 1,
    }


def sample_mentor_row() -> dict:
    role = RNG.choices(MENTOR_ROLES, weights=[0.35, 0.65], k=1)[0]
    subjects = _pick_core_subjects(2)
    topics, competencies = _sample_topics_and_competencies(subjects)

    if role == "Instructor":
        year_level = 4
        expertise_level = RNG.choice([4, 4, 5, 5])
        years_experience = RNG.randint(3, 15)
        teaching_experience_years = RNG.randint(2, years_experience)
    else:
        year_level = RNG.choice([3, 4])
        expertise_level = RNG.choice([3, 3, 4, 4, 5])
        years_experience = RNG.randint(1, 4)
        teaching_experience_years = RNG.randint(0, years_experience)

    return {
        "mentor_role": role,
        "mentor_subjects": ", ".join(subjects),
        "mentor_topics": ", ".join(topics),
        "mentor_competencies": ", ".join(competencies),
        "mentor_availability": ", ".join(sample_availability()),
        "mentor_years_experience": years_experience,
        "mentor_teaching_experience_years": teaching_experience_years,
        "mentor_expertise_level": expertise_level,
        "mentor_year_level": year_level,
    }


from matching.ml.features import availability_overlap_ratio  # noqa: E402


def _token_set(value: str) -> set[str]:
    return {part.strip().lower() for part in str(value or "").split(",") if part.strip()}


def _jaccard_sets(a: set[str], b: set[str]) -> float:
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def compute_target_score(mentee: dict, mentor: dict) -> float:
    mentee_subjects = _token_set(mentee.get("mentee_subjects", ""))
    mentor_subjects = _token_set(mentor.get("mentor_subjects", ""))
    mentee_topics = _token_set(mentee.get("mentee_topics", ""))
    mentor_topics = _token_set(mentor.get("mentor_topics", ""))
    mentee_competencies = _token_set(mentee.get("mentee_competencies", ""))
    mentor_competencies = _token_set(mentor.get("mentor_competencies", ""))

    subj_jaccard = _jaccard_sets(mentee_subjects, mentor_subjects)
    sched_overlap = availability_overlap_ratio(
        mentee.get("mentee_availability", ""),
        mentor.get("mentor_availability", ""),
    )

    mentee_diff = int(mentee.get("mentee_difficulty_level", 3))
    mentor_exp = int(mentor.get("mentor_expertise_level", 3))
    diff_alignment = max(0.0, 1.0 - abs(mentor_exp - mentee_diff) / 4.0)

    academic_gap = int(mentor.get("mentor_year_level", 4)) - int(mentee.get("mentee_year_level", 1))
    role_factor = (
        1.0
        if mentor.get("mentor_role") == "Instructor"
        else min(1.0, max(0.0, academic_gap / 3.0))
    )

    has_topics = bool(mentee_topics)
    if has_topics:
        topic_jaccard = _jaccard_sets(mentee_topics, mentor_topics)
        comp_jaccard = _jaccard_sets(mentee_competencies, mentor_competencies)
        raw_score = (
            0.35 * subj_jaccard
            + 0.25 * topic_jaccard
            + 0.20 * comp_jaccard
            + 0.10 * sched_overlap
            + 0.05 * diff_alignment
            + 0.05 * role_factor
        )
    else:
        raw_score = (
            0.65 * subj_jaccard
            + 0.15 * sched_overlap
            + 0.10 * diff_alignment
            + 0.10 * role_factor
        )

    # Small continuous variance for a smooth, natural distribution across [0.0, 1.0]
    variance = RNG.uniform(-0.02, 0.02)
    score = max(0.0, min(1.0, raw_score + variance))
    return round(score, 4)


def sample_aligned_mentor(mentee: dict, alignment: str = "high") -> dict:
    role = RNG.choices(MENTOR_ROLES, weights=[0.35, 0.65], k=1)[0]
    mentee_subjs = [s.strip() for s in mentee["mentee_subjects"].split(",") if s.strip()]
    mentee_avail = [s.strip() for s in mentee["mentee_availability"].split(",") if s.strip()]

    if alignment == "high":
        mentor_subjs = list(dict.fromkeys(mentee_subjs + _pick_core_subjects()))[:MAX_SUBJECTS]
        mentor_topics, mentor_comps = _sample_topics_and_competencies(mentor_subjs)
        mentor_avail = sorted(set(mentee_avail[:2] + sample_availability()[:2]))
        exp = RNG.choice([4, 5])
    elif alignment == "medium":
        shared = mentee_subjs[: max(1, len(mentee_subjs) // 2)]
        mentor_subjs = list(dict.fromkeys(shared + _pick_core_subjects()))[:MAX_SUBJECTS]
        mentor_topics, mentor_comps = _sample_topics_and_competencies(mentor_subjs)
        mentor_avail = sample_availability()
        exp = RNG.choice([3, 4])
    else:
        return sample_mentor_row()

    if role == "Instructor":
        year_level = 4
        years_experience = RNG.randint(3, 15)
        teaching_exp = RNG.randint(2, years_experience)
    else:
        year_level = RNG.choice([3, 4])
        years_experience = RNG.randint(1, 4)
        teaching_exp = RNG.randint(0, years_experience)

    return {
        "mentor_role": role,
        "mentor_subjects": ", ".join(mentor_subjs),
        "mentor_topics": ", ".join(mentor_topics),
        "mentor_competencies": ", ".join(mentor_comps),
        "mentor_availability": ", ".join(mentor_avail),
        "mentor_years_experience": years_experience,
        "mentor_teaching_experience_years": teaching_exp,
        "mentor_expertise_level": exp,
        "mentor_year_level": year_level,
    }


def write_csv(output_path: Path, rows: list[dict]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "mentee_subjects",
        "mentee_topics",
        "mentee_competencies",
        "mentee_availability",
        "mentee_difficulty_level",
        "mentee_year_level",
        "mentor_role",
        "mentor_subjects",
        "mentor_topics",
        "mentor_competencies",
        "mentor_availability",
        "mentor_years_experience",
        "mentor_teaching_experience_years",
        "mentor_expertise_level",
        "mentor_year_level",
        "target_score",
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
        mode = RNG.choices(["random", "medium", "high"], weights=[0.35, 0.35, 0.30], k=1)[0]
        if mode == "random":
            mentor = sample_mentor_row()
        else:
            mentor = sample_aligned_mentor(mentee, mode)
        target_score = compute_target_score(mentee, mentor)
        rows.append({**mentee, **mentor, "target_score": target_score})
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic mentor–mentee CSV data.")
    parser.add_argument("--rows", type=int, default=500, help="Total number of rows to generate")
    parser.add_argument(
        "--split",
        action="store_true",
        help="Deprecated; the complete export is always written",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    RNG.seed(args.seed)
    here = Path(__file__).resolve().parent

    total = int(args.rows)
    train_n = int(total * 0.7)
    val_n = int(total * 0.15)
    test_n = total - train_n - val_n

    rows = generate_rows(total)
    write_csv(here / "synthetic_pairs.csv", rows)
    write_csv(here / "synthetic_train.csv", rows[:train_n])
    write_csv(here / "synthetic_val.csv", rows[train_n : train_n + val_n])
    write_csv(here / "synthetic_test.csv", rows[train_n + val_n :])

    print(f"Pairs: {total} rows -> {here / 'synthetic_pairs.csv'}")
    print(f"Train: {train_n} rows -> {here / 'synthetic_train.csv'}")
    print(f"Val: {val_n} rows -> {here / 'synthetic_val.csv'}")
    print(f"Test: {test_n} rows -> {here / 'synthetic_test.csv'}")


if __name__ == "__main__":
    main()
