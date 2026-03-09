from __future__ import annotations

"""
Utility script to generate a realistic synthetic CSV for training the
mentor–mentee matching model.

It follows the current feature schema used in `features.build_features`:

  mentee_subjects
  mentee_topics
  mentee_difficulty_level
  mentor_role
  mentor_subjects
  mentor_topics
  mentor_expertise_level
  label

Run from the Django project root:

    python -m matching.ml.generate_synthetic_data
    python -m matching.ml.generate_synthetic_data --rows 2500 --split
"""

import argparse
import csv
import random
from pathlib import Path


RNG = random.Random(42)

# Subjects and topics aligned with your Google Forms
SUBJECTS = [
    "Computer Programming",
    "Introduction to Computing",
    "Intro to Human Computer Interaction",
    "IT Fundamentals",
]

TOPICS = [
    "Arrays",
    "Loops",
    "Input and Output Handling",
    "Error Handling",
    "HTML",
    "CSS",
    "Javascript",
    "UI/UX",
]

MENTOR_ROLES = ["Senior IT Student", "Instructor"]


def sample_subset(options, min_n, max_n):
    n = RNG.randint(min_n, max_n)
    return RNG.sample(options, n)


def sample_mentee_row():
    """
    Generate a synthetic first‑year ITE mentee.
    Assumptions:
      - Most struggle with Computer Programming and IT Fundamentals.
      - Difficulty level is skewed towards moderate–high (3–5).
    """
    # Choose 1–3 subjects with challenges, biased to Programming & IT Fundamentals
    base_subjects = ["Computer Programming", "IT Fundamentals"]
    extra_subjects = [s for s in SUBJECTS if s not in base_subjects]
    subjects = set()
    subjects.add(RNG.choice(base_subjects))
    if RNG.random() < 0.7:
        subjects.add(RNG.choice(base_subjects))
    if RNG.random() < 0.4:
        subjects.add(RNG.choice(extra_subjects))

    # Choose 2–5 topics where mentee has difficulties
    topics = sample_subset(TOPICS, 2, 5)

    # Overall difficulty 2–5, skewed high
    difficulty_choices = [2, 3, 3, 4, 4, 5]
    difficulty_level = RNG.choice(difficulty_choices)

    return {
        "mentee_subjects": ", ".join(sorted(subjects)),
        "mentee_topics": ", ".join(sorted(topics)),
        "mentee_difficulty_level": difficulty_level,
    }


def sample_mentor_row():
    """
    Generate a synthetic mentor (senior student or instructor).
    Assumptions:
      - Instructors have higher expertise (4–5).
      - Senior students are more varied (3–5).
    """
    role = RNG.choices(MENTOR_ROLES, weights=[0.7, 0.3], k=1)[0]

    # Mentor expertise subjects: 1–3 subjects
    subjects = sample_subset(SUBJECTS, 1, 3)

    # Mentor expertise topics: 3–6 topics
    topics = sample_subset(TOPICS, 3, 6)

    if role == "Instructor":
        expertise_level = RNG.choice([4, 4, 5, 5])
    else:
        expertise_level = RNG.choice([3, 3, 4, 4, 5])

    return {
        "mentor_role": role,
        "mentor_subjects": ", ".join(sorted(subjects)),
        "mentor_topics": ", ".join(sorted(topics)),
        "mentor_expertise_level": expertise_level,
    }


def compute_label(mentee, mentor):
    """
    Heuristic label:
      - Good match (1) if subjects/topics overlap well and mentor expertise
        is at least the mentee difficulty level, with some noise.
      - Otherwise mostly 0, but allow a bit of randomness.
    """
    mentee_subjects = {s.strip().lower() for s in str(mentee["mentee_subjects"]).split(",") if s.strip()}
    mentor_subjects = {s.strip().lower() for s in str(mentor["mentor_subjects"]).split(",") if s.strip()}
    subj_intersection = len(mentee_subjects & mentor_subjects)

    mentee_topics = {s.strip().lower() for s in str(mentee["mentee_topics"]).split(",") if s.strip()}
    mentor_topics = {s.strip().lower() for s in str(mentor["mentor_topics"]).split(",") if s.strip()}
    topic_intersection = len(mentee_topics & mentor_topics)

    mentee_diff = int(mentee["mentee_difficulty_level"])
    mentor_exp = int(mentor["mentor_expertise_level"])

    score = 0
    score += subj_intersection
    score += 0.5 * topic_intersection
    score += 0.5 if mentor_exp >= mentee_diff else -0.5

    # Add small noise so labels are not perfectly deterministic
    score += RNG.uniform(-0.5, 0.5)

    return 1 if score >= 1.5 else 0


def write_csv(output_path: Path, rows) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "mentee_subjects",
        "mentee_topics",
        "mentee_difficulty_level",
        "mentor_role",
        "mentor_subjects",
        "mentor_topics",
        "mentor_expertise_level",
        "label",
    ]

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def generate_rows(n_rows: int):
    rows = []
    for _ in range(n_rows):
        mentee = sample_mentee_row()
        mentor = sample_mentor_row()
        label = compute_label(mentee, mentor)
        rows.append({**mentee, **mentor, "label": label})
    return rows


def main():
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
        write_csv(here / "synthetic_val.csv", rows[train_n:train_n + val_n])
        write_csv(here / "synthetic_test.csv", rows[train_n + val_n:])

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

