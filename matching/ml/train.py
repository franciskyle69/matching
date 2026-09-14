from __future__ import annotations

from typing import Dict, Any

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    roc_auc_score,
    precision_score,
    recall_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

try:
    from xgboost import XGBClassifier, XGBRegressor
except Exception:  # pragma: no cover
    XGBClassifier = None
    XGBRegressor = None


def train_xgboost(task: str, X_train, y_train, params: Dict[str, Any]):
    if XGBClassifier is None or XGBRegressor is None:
        raise RuntimeError("xgboost is not installed.")
    model_params = dict(params)
    if task == "classification":
        objective = model_params.pop("objective", "binary:logistic")
        eval_metric = model_params.pop("eval_metric", "logloss")
        model = XGBClassifier(
            objective=objective,
            eval_metric=eval_metric,
            **model_params,
        )
    else:
        objective = model_params.pop("objective", "reg:squarederror")
        eval_metric = model_params.pop("eval_metric", "rmse")
        model = XGBRegressor(
            objective=objective,
            eval_metric=eval_metric,
            **model_params,
        )
    model.fit(X_train, y_train)
    return model


def evaluate_model(task: str, model, X_val, y_val) -> Dict[str, Any]:
    if task == "classification":
        pred_proba = model.predict_proba(X_val)[:, 1]
        pred = (pred_proba >= 0.5).astype(int)
        return {
            "auc": float(roc_auc_score(y_val, pred_proba)) if len(np.unique(y_val)) > 1 else None,
            "accuracy": float(accuracy_score(y_val, pred)),
            "precision": float(precision_score(y_val, pred, zero_division=0)),
            "recall": float(recall_score(y_val, pred, zero_division=0)),
            "f1": float(f1_score(y_val, pred, zero_division=0)),
        }

    raw_pred = model.predict(X_val)
    pred = np.clip(raw_pred, 0.0, 1.0)
    try:
        from sklearn.metrics import root_mean_squared_error
        rmse = float(root_mean_squared_error(y_val, pred))
    except ImportError:
        rmse = float(mean_squared_error(y_val, pred, squared=False))

    return {
        "mae": float(mean_absolute_error(y_val, pred)),
        "rmse": rmse,
        "r2": float(r2_score(y_val, pred)),
    }

