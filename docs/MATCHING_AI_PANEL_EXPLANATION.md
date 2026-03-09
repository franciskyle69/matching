# Explaining the Matching AI to a Panel

## 1. What the Matching AI Does (Elevator pitch)

The system matches **mentees** (students who need help) with **mentors** (students or instructors who can help) in an academic mentoring setting. For each mentor–mentee pair we compute a **match score** between 0 and 1. Higher scores mean better fit. We use this score in two ways:

- **Recommendations**: Each mentee gets a ranked list of recommended mentors (by score).
- **Batch matching** (staff): We run a greedy algorithm that assigns each mentee to at most one mentor, preferring higher-scoring pairs and respecting mentor capacity.

The score can come from **two sources**:

1. **ML model (preferred)**  
   When a trained XGBoost model is available, we build the same features from mentor/mentee profiles and use the model’s output (e.g. probability of “good match”) as the score.

2. **Rule-based fallback**  
   If no model is loaded, we use a **weighted formula** based on subject overlap, topic overlap, difficulty alignment, and whether the mentor is an instructor. This is interpretable and gives a concrete example for the panel.

---

## 2. Example of the Calculation (Rule-Based Fallback)

Assume we use the **fallback formula** (no ML model). The score is:

**Score = 0.45 × (subject overlap) + 0.40 × (topic overlap) + 0.10 × (difficulty alignment) + 0.05 × (instructor bonus)**

Where:

- **Subject / topic overlap** = Jaccard similarity:  
  `|A ∩ B| / |A ∪ B|`  
  (number of common items divided by number of unique items across both sets).

- **Difficulty alignment** = how close mentee’s difficulty level (1–5) and mentor’s expertise level (1–5) are:  
  `1 − (min(|mentor_level − mentee_level|, 4) / 4)`  
  Same level → 1.0; one step apart → 0.75; two steps → 0.5; etc.

- **Instructor bonus** = 1.0 if the mentor’s role contains “instructor”, else 0.0.

---

### Worked example

**Mentee**

- Subjects: `["Computer Programming", "Introduction to Computing"]`  
- Topics: `["Arrays", "Loops"]`  
- Difficulty level: **3** (1–5 scale)

**Mentor**

- Subjects: `["Computer Programming", "IT Fundamentals"]`  
- Topics: `["Arrays", "Loops", "HTML"]`  
- Expertise level: **4**  
- Role: `"Senior IT Student"` (not instructor)

**Step 1 – Subject overlap (Jaccard)**

- Mentee subjects: `{computer programming, introduction to computing}`
- Mentor subjects: `{computer programming, it fundamentals}`
- Intersection: `{computer programming}` → size 1  
- Union: `{computer programming, introduction to computing, it fundamentals}` → size 3  
- **Subject Jaccard = 1/3 ≈ 0.333**

**Step 2 – Topic overlap (Jaccard)**

- Mentee topics: `{arrays, loops}`
- Mentor topics: `{arrays, loops, html}`
- Intersection: `{arrays, loops}` → size 2  
- Union: `{arrays, loops, html}` → size 3  
- **Topic Jaccard = 2/3 ≈ 0.667**

**Step 3 – Difficulty alignment**

- Mentee level 3, mentor level 4 → difference = 1  
- `min(1, 4) / 4 = 0.25` → **alignment = 1 − 0.25 = 0.75**

**Step 4 – Instructor bonus**

- Role is “Senior IT Student” → **instructor = 0.0**

**Step 5 – Final score**

- **Score = 0.45 × 0.333 + 0.40 × 0.667 + 0.10 × 0.75 + 0.05 × 0**  
- **Score = 0.45 × 0.333 + 0.40 × 0.667 + 0.10 × 0.75**  
- **Score ≈ 0.150 + 0.267 + 0.075 = 0.492**

So this pair would get a **match score of about 0.49**. In the UI and API this is rounded (e.g. to 4 decimal places).

---

## 3. When the ML Model Is Used

- The same **features** are built: `subjects_jaccard`, `topics_jaccard`, `difficulty_alignment`, `mentor_is_instructor`.
- The model is trained on a CSV of mentor–mentee pairs with a **label** (e.g. 1 = good match, 0 = bad match) or a regression target.
- At runtime we build the feature vector for a pair, pass it to the model, and use:
  - **Classification**: probability of class 1 as the score.
  - **Regression**: predicted value as the score (often scaled to [0, 1] in practice).

---

## 4. Possible Panel Questions and Suggested Answers

**Q1: How do you define “match” and where do the weights (0.45, 0.40, …) come from?**  
**A:** A “match” is a mentor–mentee pair that we consider suitable for mentoring (same or related subjects/topics, aligned difficulty). The weights in the fallback formula emphasize **subject fit** (0.45) and **topic fit** (0.40) because they matter most for learning; difficulty alignment (0.10) and instructor bonus (0.05) are secondary. These can be tuned; if we have labeled data, we train an XGBoost model so the effective “weights” are learned from data instead.

**Q2: Why Jaccard for subjects and topics?**  
**A:** Jaccard measures overlap relative to the total set size, so it’s bounded between 0 and 1 and is standard for set similarity. It naturally handles multiple subjects/topics per person and stays interpretable (e.g. “2 out of 3 topics in common”).

**Q3: How do you avoid assigning one mentee to many mentors or overloading one mentor?**  
**A:** For **recommendations**, we only rank mentors by score and show a list (e.g. top 10); we don’t assign. For **batch matching**, we use a greedy algorithm: we sort all pairs by score descending, then iterate and assign a mentee to a mentor only if that mentee isn’t already assigned and the mentor has remaining capacity. So each mentee gets at most one mentor, and each mentor gets at most their capacity number of mentees.

**Q4: Can you use the same score for both recommendations and batch matching?**  
**A:** Yes. The same `compute_score` function is used for building the recommendation list for a single mentee and for generating the candidate pairs in batch matching. The difference is how we use the scores: recommendations = sort and take top N; batch = greedy assignment with capacity and one-to-one constraints.

**Q5: How is the ML model trained and what data does it need?**  
**A:** We train an XGBoost model (classification or regression) from a CSV where each row is a mentor–mentee pair. The CSV must have columns that we can map to mentee/mentor subjects, topics, difficulty, expertise, and role, plus a target column (e.g. “label” 0/1 or a numeric score). We run `build_features` on each row to get the same features we use at runtime, then train and save the model and metadata (e.g. feature names, task type). The management command is `train_xgb` with `--input <csv>`, `--target label`, and `--task classification` (or regression).

**Q6: What if the model file is missing or fails to load?**  
**A:** The system falls back to the rule-based formula above. So matching still works without the ML model; we just use the fixed weights and Jaccard/alignment/instructor features.

**Q7: How do you handle capacity (e.g. one mentor can take only N mentees)?**  
**A:** Each mentor profile has a `capacity` (integer). In greedy matching, when we assign a mentee to a mentor we decrement that mentor’s capacity. We skip any pair whose mentor already has capacity 0. Recommendations do not enforce capacity; that’s only for the batch matching run.

**Q8: Why is “instructor” only 5% in the fallback?**  
**A:** We still want student mentors to get high scores if subject/topic fit is strong. The 5% gives a small bonus to instructors without dominating the score. The ML model can learn a different importance from data.

**Q9: How would you improve the system?**  
**A:** Examples: (1) Collect more labeled data and retrain the model periodically. (2) Add features (e.g. availability, language, past session outcomes). (3) Allow coordinators to set minimum score thresholds per run. (4) A/B test rule-based vs model-based matching on satisfaction or session completion.

---

## 5. One-Slide Summary for the Panel

- **Input:** Mentor and mentee profiles (subjects, topics, difficulty/expertise levels, role).
- **Scoring:** Either an XGBoost model (trained on labeled pairs) or a weighted formula: **0.45×subject Jaccard + 0.40×topic Jaccard + 0.10×difficulty alignment + 0.05×instructor**.
- **Output:** A score in [0, 1] per pair. Used for ranked recommendations per mentee and for greedy batch assignment (one mentee per mentor, respecting capacity).
- **Example:** Mentee with 2 subjects, 2 topics, level 3; mentor with 2/3 overlapping subjects, 2/3 overlapping topics, level 4, not instructor → **score ≈ 0.49**.

You can paste the worked example (Section 2) and the Q&A (Section 4) into your presentation or handout so the panel can see exactly how one score is computed and how you’d answer common questions.
