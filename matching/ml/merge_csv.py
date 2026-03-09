"""
Merge multiple mentor-mentee CSV files into one.
Useful for combining synthetic data with real exports or appending new rows.

Usage (from project root):

    python -m matching.ml.merge_csv file1.csv file2.csv -o combined.csv
    python -m matching.ml.merge_csv matching/ml/synthetic_train.csv my_data.csv -o matching/ml/combined_train.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Merge mentor-mentee CSV files into one.")
    parser.add_argument("inputs", nargs="+", help="Paths to CSV files to merge")
    parser.add_argument("-o", "--output", required=True, help="Output CSV path")
    parser.add_argument("--no-header", action="store_true", help="Inputs have no header (use first file's row as header)")
    args = parser.parse_args()

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = None
    rows = []

    for path in args.inputs:
        p = Path(path).expanduser().resolve()
        if not p.exists():
            raise FileNotFoundError(f"Input file not found: {p}")
        with p.open("r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            if fieldnames is None:
                fieldnames = reader.fieldnames
            for row in reader:
                if fieldnames and all(k in row for k in fieldnames):
                    rows.append(row)

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames or [])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Merged {len(rows)} rows into {output_path}")


if __name__ == "__main__":
    main()
