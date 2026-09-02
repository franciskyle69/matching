"""XGBoost feature-engineering pipeline for mentor–mentee matching.

This module is the public entry point requested by the matching pipeline.
Implementation lives in `matching.ml.features` so existing imports keep working.
"""

from matching.ml.features import (  # noqa: F401
    COMPETENCY_VOCABULARY,
    MAJOR_SUBJECT_NAMES,
    academic_gap_score,
    availability_overlap_hours,
    availability_overlap_ratio,
    build_features,
    jaccard,
    multilabel_cosine,
)
