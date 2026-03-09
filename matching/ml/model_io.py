from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any

import joblib


DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / 'model.bin'
DEFAULT_META_PATH = Path(__file__).resolve().parent / 'model_meta.json'


def save_model(model: Any, meta: Dict[str, Any], model_path: str | Path | None = None, meta_path: str | Path | None = None) -> None:
    model_path = Path(model_path) if model_path else DEFAULT_MODEL_PATH
    meta_path = Path(meta_path) if meta_path else DEFAULT_META_PATH
    model_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)


def load_model(model_path: str | Path | None = None, meta_path: str | Path | None = None):
    model_path = Path(model_path) if model_path else DEFAULT_MODEL_PATH
    meta_path = Path(meta_path) if meta_path else DEFAULT_META_PATH
    model = joblib.load(model_path)
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    return model, meta
