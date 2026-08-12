from __future__ import annotations

import json
from pathlib import Path
from typing import List, Dict, Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from matching.ml.preprocessing import load_dataset, build_feature_frame, split_dataset
from matching.ml.train import train_xgboost, evaluate_model
from matching.ml.model_io import save_model
from matching.models import ModelMetadata, Topic


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
        csv_path = Path(options["input"]).expanduser().resolve()
        if not csv_path.exists():
            raise CommandError(f"Input CSV not found: {csv_path}")

        target_col = options["target"]
        task = options["task"]
        test_size = float(options["test_size"])
        random_state = int(options["random_state"])

        df = load_dataset(csv_path)
        if target_col not in df.columns:
            raise CommandError(f"Target column '{target_col}' not found in CSV. Columns: {list(df.columns)}")

        X, y = build_feature_frame(df, target_col)
        X_train, X_val, y_train, y_val = split_dataset(
            X,
            y,
            task=task,
            test_size=test_size,
            random_state=random_state,
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

        self.stdout.write(self.style.NOTICE(f"Training XGBoost {task} model on {X.shape[0]} samples, {X.shape[1]} features..."))
        try:
            model = train_xgboost(task=task, X_train=X_train, y_train=y_train, params=params)
        except RuntimeError as exc:
            raise CommandError(str(exc)) from exc

        metrics = evaluate_model(task=task, model=model, X_val=X_val, y_val=y_val)

        self.stdout.write(self.style.SUCCESS(f"Validation metrics: {json.dumps(metrics, indent=2)}"))

        # Save model and metadata
        feature_names = list(X.columns)
        model_path = (
            Path(options["model_path"]).expanduser().resolve()
            if options.get("model_path")
            else (Path(__file__).resolve().parents[2] / "ml" / "model.bin")
        )
        meta_path = (
            Path(options["meta_path"]).expanduser().resolve()
            if options.get("meta_path")
            else (Path(__file__).resolve().parents[2] / "ml" / "model_meta.json")
        )
        trained_at = timezone.now()
        version = trained_at.strftime("xgb-%Y%m%d-%H%M%S")
        meta: Dict[str, Any] = {
            "version": version,
            "task": task,
            "target": target_col,
            "feature_names": feature_names,
            "metrics": metrics,
            "csv_path": str(csv_path),
            "params": params,
            "trained_at": trained_at.isoformat(),
        }
        save_model(model, meta, model_path=model_path, meta_path=meta_path)

        topic_count_active = Topic.objects.filter(status=Topic.STATUS_ACTIVE).count()
        with transaction.atomic():
            ModelMetadata.objects.filter(status=ModelMetadata.STATUS_ACTIVE).update(
                status=ModelMetadata.STATUS_RETIRED,
            )
            ModelMetadata.objects.create(
                version=version,
                status=ModelMetadata.STATUS_ACTIVE,
                artifact_path=str(model_path),
                metrics=metrics,
                feature_names=feature_names,
                training_rows=int(X.shape[0]),
                topic_count_active_at_train=topic_count_active,
                trained_at=trained_at,
                created_by=None,
            )
        self.stdout.write(self.style.SUCCESS("Model saved successfully."))
