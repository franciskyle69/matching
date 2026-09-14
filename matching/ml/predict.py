from __future__ import annotations

from typing import Dict, Any

import pandas as pd

from matching.ml.features import build_features


def predict_match_score(model, meta: Dict[str, Any], row: Dict[str, Any]) -> float:
    feats = build_features(row)
    X = pd.DataFrame([feats])
    feature_names = meta.get("feature_names")
    if feature_names:
        X = X.reindex(columns=feature_names, fill_value=0.0)

    task = meta.get("task", "regression")
    if task == "classification":
        score = float(model.predict_proba(X.values)[0, 1])
    else:
        score = float(model.predict(X.values)[0])
    return max(0.0, min(1.0, score))

