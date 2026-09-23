from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any

import joblib


DEFAULT_JSON_MODEL_PATH = Path(__file__).resolve().parent / 'model.json'
DEFAULT_BIN_MODEL_PATH = Path(__file__).resolve().parent / 'model.bin'
DEFAULT_MODEL_PATH = DEFAULT_JSON_MODEL_PATH if DEFAULT_JSON_MODEL_PATH.exists() else DEFAULT_BIN_MODEL_PATH
DEFAULT_META_PATH = Path(__file__).resolve().parent / 'model_meta.json'


def save_model(model: Any, meta: Dict[str, Any], model_path: str | Path | None = None, meta_path: str | Path | None = None) -> None:
    model_path = Path(model_path) if model_path else DEFAULT_JSON_MODEL_PATH
    meta_path = Path(meta_path) if meta_path else DEFAULT_META_PATH
    model_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.parent.mkdir(parents=True, exist_ok=True)

    str_path = str(model_path)
    if str_path.endswith('.json') and hasattr(model, 'save_model'):
        model.save_model(str_path)
    else:
        joblib.dump(model, model_path)

    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)


def load_model(model_path: str | Path | None = None, meta_path: str | Path | None = None):
    if model_path:
        model_path = Path(model_path)
    else:
        model_path = DEFAULT_JSON_MODEL_PATH if DEFAULT_JSON_MODEL_PATH.exists() else DEFAULT_BIN_MODEL_PATH

    meta_path = Path(meta_path) if meta_path else DEFAULT_META_PATH

    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)

    if str(model_path).endswith('.json'):
        import xgboost as xgb
        task = meta.get("task", "regression")
        if task == "classification":
            model = xgb.XGBClassifier()
        else:
            model = xgb.XGBRegressor()
        model.load_model(str(model_path))
        return model, meta

    model = joblib.load(model_path)
    return model, meta
