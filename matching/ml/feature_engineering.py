"""XGBoost feature-engineering pipeline for mentor–mentee matching.

This module is the public entry point requested by the matching pipeline.
Implementation lives in `matching.ml.features` so existing imports keep working.
"""

from matching.ml.features import (  # noqa: F401
    COMPETENCY_VOCABULARY,
    MAJOR_SUBJECT_NAMES,
    MAX_SUBJECTS,
    MAX_TOPICS_PER_SUBJECT,
    MAX_TOPICS_TOTAL,
    MAX_COMPETENCIES_PER_TOPIC,
    MAX_COMPETENCIES_TOTAL,
    academic_gap_score,
    availability_overlap_hours,
    availability_overlap_ratio,
    build_features,
    jaccard,
    multilabel_cosine,
)
