from __future__ import annotations

from pathlib import Path
from typing import Dict, Any, List, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from matching.ml.features import build_features


def load_dataset(path: str | Path) -> pd.DataFrame:
    csv_path = Path(path).expanduser().resolve()
    return pd.read_csv(csv_path)


def build_feature_frame(df: pd.DataFrame, target_col: str) -> Tuple[pd.DataFrame, np.ndarray]:
    feature_rows: List[Dict[str, float]] = []
    for _, row in df.iterrows():
        feature_rows.append(build_features(row))
    X = pd.DataFrame(feature_rows)
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    y = df[target_col].values
    return X, y


def split_dataset(
    X: pd.DataFrame,
    y: np.ndarray,
    task: str,
    test_size: float = 0.2,
    random_state: int = 42,
):
    return train_test_split(
        X.values,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y if task == "classification" else None,
    )

