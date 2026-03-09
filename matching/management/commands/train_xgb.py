from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict, Any

import numpy as np
import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

try:
    from xgboost import XGBClassifier, XGBRegressor
except Exception as e:  # pragma: no cover
    XGBClassifier = None
    XGBRegressor = None

from matching.ml.features import build_features
from matching.ml.model_io import save_model


class Command(BaseCommand):
    help = "Train an XGBoost model for mentor-mentee matching from a CSV of pair examples."

    def add_arguments(self, parser):
        parser.add_argument("--input", required=True, help="Path to input CSV with labeled pairs")
        parser.add_argument("--target", default="label", help="Target column name (classification: 0/1) or regression score")
        parser.add_argument("--task", choices=["classification", "regression"], default="classification")
        parser.add_argument("--test-size", type=float, default=0.2, help="Test split size (0-1)")
        parser.add_argument("--random-state", type=int, default=42)
        parser.add_argument("--model-path", default=None, help="Optional path to save model (default: matching/ml/model.bin)")
        parser.add_argument("--meta-path", default=None, help="Optional path to save model metadata (default: matching/ml/model_meta.json)")
        # Simple model hyperparameters
        parser.add_argument("--n-estimators", type=int, default=300)
        parser.add_argument("--max-depth", type=int, default=5)
        parser.add_argument("--learning-rate", type=float, default=0.08)
        parser.add_argument("--subsample", type=float, default=0.9)
        parser.add_argument("--colsample-bytree", type=float, default=0.9)

    def handle(self, *args, **options):
        if XGBClassifier is None or XGBRegressor is None:
            raise CommandError("xgboost is not installed. Please install it and retry.")

        csv_path = Path(options["input"]).expanduser().resolve()
        if not csv_path.exists():
            raise CommandError(f"Input CSV not found: {csv_path}")

        target_col = options["target"]
        task = options["task"]
        test_size = float(options["test_size"])
        random_state = int(options["random_state"])

        df = pd.read_csv(csv_path)
        if target_col not in df.columns:
            raise CommandError(f"Target column '{target_col}' not found in CSV. Columns: {list(df.columns)}")

        # Build features per row
        feature_rows: List[Dict[str, float]] = []
        for _, row in df.iterrows():
            feats = build_features(row)
            feature_rows.append(feats)

        X = pd.DataFrame(feature_rows)
        y = df[target_col].values

        # Ensure no NaNs remain in X
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)

        X_train, X_val, y_train, y_val = train_test_split(
            X.values, y, test_size=test_size, random_state=random_state, stratify=y if task == "classification" else None
        )

        params = dict(
            n_estimators=int(options["n_estimators"]),
            max_depth=int(options["max_depth"]),
            learning_rate=float(options["learning_rate"]),
            subsample=float(options["subsample"]),
            colsample_bytree=float(options["colsample_bytree"]),
            random_state=random_state,
            n_jobs=0,
        )

        if task == "classification":
            model = XGBClassifier(
                objective="binary:logistic",
                eval_metric="logloss",
                **params,
            )
        else:
            model = XGBRegressor(
                objective="reg:squarederror",
                **params,
            )

        self.stdout.write(self.style.NOTICE(f"Training XGBoost {task} model on {X.shape[0]} samples, {X.shape[1]} features..."))
        model.fit(X_train, y_train)

        # Evaluation
        if task == "classification":
            pred_proba = model.predict_proba(X_val)[:, 1]
            pred = (pred_proba >= 0.5).astype(int)
            metrics = {
                "auc": float(roc_auc_score(y_val, pred_proba)) if len(np.unique(y_val)) > 1 else None,
                "accuracy": float(accuracy_score(y_val, pred)),
                "f1": float(f1_score(y_val, pred)) if len(np.unique(y_val)) > 1 else None,
            }
        else:
            pred = model.predict(X_val)
            metrics = {
                "rmse": float(mean_squared_error(y_val, pred, squared=False)),
                "r2": float(r2_score(y_val, pred)),
            }

        self.stdout.write(self.style.SUCCESS(f"Validation metrics: {json.dumps(metrics, indent=2)}"))

        # Save model and metadata
        feature_names = list(X.columns)
        meta: Dict[str, Any] = {
            "task": task,
            "target": target_col,
            "feature_names": feature_names,
            "metrics": metrics,
            "csv_path": str(csv_path),
            "params": params,
        }
        save_model(model, meta, model_path=options["model_path"], meta_path=options["meta_path"])
        self.stdout.write(self.style.SUCCESS("Model saved successfully."))
