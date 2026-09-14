# Adding More Dataset for Mentor–Mentee Matching

> Important: synthetic data is for pipeline bootstrapping only.  
> Production model quality must be validated with historical, human-reviewed
> matching outcomes before claiming accuracy.

The XGBoost matching model is trained on a CSV of **mentor–mentee pairs** with a continuous **target_score** float (0.0 to 1.0 representing match quality). You can add more data in several ways.

---

## 1. Generate more synthetic data

From the **project root** (where `manage.py` is):

```bash
# Generate 500 rows into synthetic_pairs.csv (default)
python -m matching.ml.generate_synthetic_data

# Generate 2500 rows and split into train / val / test
python -m matching.ml.generate_synthetic_data --rows 2500 --split

# Custom seed for different random data
python -m matching.ml.generate_synthetic_data --rows 1000 --seed 123
```

- **Without `--split`**: writes a single file `matching/ml/synthetic_pairs.csv`.
- **With `--split`**: overwrites `synthetic_train.csv`, `synthetic_val.csv`, and `synthetic_test.csv` (70% / 15% / 15%).
- Includes **major IT subjects** and **minor subjects** (GE, NSTP, PE) from `profiles/subject_catalog.py`.

Then train on the train set:

```bash
python manage.py train_xgb --input matching/ml/synthetic_train.csv
```

---

## 2. Use your own CSV (e.g. from Google Forms)

Your CSV must have these **column names** (and a **target_score** column):

| Column | Description |
|--------|-------------|
| `mentee_subjects` | Comma-separated subjects where mentee has challenges (e.g. `Computer Programming, IT Fundamentals`) |
| `mentee_topics` | Comma-separated topics (e.g. `Arrays, Loops, HTML`) |
| `mentee_competencies` | Comma-separated competency names (short labels) |
| `mentee_availability` | Comma-separated time slots (e.g. `08:00-10:00, 13:00-15:00`) |
| `mentee_difficulty_level` | 1–5 |
| `mentor_role` | e.g. `Senior IT Student` or `Instructor` |
| `mentor_subjects` | Comma-separated subjects mentor can teach |
| `mentor_topics` | Comma-separated topics mentor has expertise in |
| `mentor_competencies` | Comma-separated competency names mentor can teach |
| `mentor_availability` | Comma-separated mentor time slots |
| `mentor_years_experience` | Numeric years of overall experience |
| `mentor_teaching_experience_years` | Numeric teaching experience years |
| `mentor_expertise_level` | 1–5 |
| `target_score` | Continuous match score (0.0 to 1.0) |

- Legacy CSVs with a binary `label` (0 or 1) are also backwards-compatible.

- Subjects/topics can match the ones in `profiles/subject_catalog.py` (major IT + minor GE/NSTP/PE).
- Minor-only rows may leave `mentee_topics` / `mentor_topics` empty; matching still uses subject overlap.
- Example minor subject value: `GE 108: Understanding the Self`
- Save your file (e.g. `my_data.csv`) and train:

```bash
python manage.py train_xgb --input path/to/my_data.csv
```

To **combine** your file with the existing synthetic data, use the merge script below.

---

## 3. Combine multiple CSV files

To merge several datasets (e.g. `synthetic_train.csv` + a new export) into one file for training:

```bash
# From project root
python -m matching.ml.merge_csv matching/ml/synthetic_train.csv matching/ml/my_export.csv -o matching/ml/combined_train.csv
```

Then train:

```bash
python manage.py train_xgb --input matching/ml/combined_train.csv
```

---

## 4. Append rows to an existing CSV

- **Option A:** Open `synthetic_train.csv` (or your main CSV) in Excel/Sheets and add rows with the same columns and formats.
- **Option B:** Use the merge script with two files where the second is your “extra” rows:

```bash
python -m matching.ml.merge_csv matching/ml/synthetic_train.csv matching/ml/extra_rows.csv -o matching/ml/synthetic_train.csv
```

(Back up `synthetic_train.csv` first if you don’t want to overwrite it; or use a different `-o` path.)

---

## Summary

| Goal | Action |
|------|--------|
| More synthetic data | `python -m matching.ml.generate_synthetic_data --rows 2500 --split` then `train_xgb --input matching/ml/synthetic_train.csv` |
| Real data from forms | Export to CSV with the columns above, then `train_xgb --input path/to/file.csv` |
| Mix synthetic + real | `python -m matching.ml.merge_csv train.csv real.csv -o combined.csv` then `train_xgb --input combined.csv` |

After adding data, always re-run training so the saved model uses the new dataset:

```bash
python manage.py train_xgb --input matching/ml/synthetic_train.csv
```
