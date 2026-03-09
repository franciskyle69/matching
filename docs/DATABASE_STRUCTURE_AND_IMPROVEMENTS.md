# Database Structure and Improvement Notes

## Current structure (summary)

| App       | Model               | Purpose |
|----------|---------------------|--------|
| **profiles** | MentorProfile   | OneToOne User; program, year_level, capacity, role, **subjects/topics/skills/availability (JSON)**, expertise_level, approved |
| **profiles** | MenteeProfile   | OneToOne User; program, year_level, **subjects/topics/skills (JSON)**, difficulty_level, campus, contact, approved |
| **matching** | Subject         | Canonical list: name, description |
| **matching** | Topic           | FK to Subject; name (unique per subject) |
| **matching** | MentoringSession| mentor, mentee, subject, topic (FKs), scheduled_at, duration_minutes, status, reminder flags |
| **matching** | MenteeMentorRequest | mentee, mentor (unique together); when a mentee “chooses” a mentor |
| **matching** | Notification    | user, message, is_read, action_tab, created_at |

Django’s **User** (auth) is used for login; profiles extend it per role.

---

## Improvements already applied

1. **Indexes**
   - **Notification**: `(user, is_read)` — speeds up unread count and “my notifications” queries.
   - **MenteeMentorRequest**: `(mentor, -created_at)` — speeds up “mentees who requested me” for mentors.
   - **MentoringSession**: already has indexes on `(mentor, scheduled_at)`, `(mentee, scheduled_at)`, `(status, scheduled_at)`.

2. **Ordering**
   - **Notification**: `Meta.ordering = ["-created_at"]` so default list order is newest first.

3. **Constraints**
   - **MentoringSession**: `duration_minutes >= 15` (CheckConstraint).
   - **MenteeMentorRequest**: `unique_together = ("mentee", "mentor")`.
   - **Topic**: `unique_together = ("subject", "name")`.

---

## Recommended next steps (optional)

### 1. Normalize subjects/topics on profiles (high impact)

**Issue:** Mentor and Mentee profiles store **subjects** and **topics** as **JSON lists of strings**. The matching app has canonical **Subject** and **Topic** models. That leads to:

- No referential integrity (typos, "Intro to Computing" vs "Introduction to Computing").
- Matching uses string Jaccard; overlap could be done on IDs if profiles pointed to Subject/Topic.
- Sessions already use Subject/Topic FKs, so the domain model is split.

**Improvement:** Add ManyToMany from MentorProfile and MenteeProfile to **Subject** and **Topic** (separate M2M for subjects and for topics), and keep or drop the JSON fields after migration.

- **Migration:** Add `MentorProfile.subjects_m2m` (M2M to Subject) and `MentorProfile.topics_m2m` (M2M to Topic); same for MenteeProfile. Backfill from existing JSON by matching names to `Subject.name` / `Topic.name`. Then switch matching logic and API to use the M2M; once stable, remove the old JSON fields (or keep as denormalized cache if you prefer).
- **Benefit:** Single source of truth, FK-based overlap in matching, admin/dropdowns driven by Subject/Topic.

### 2. Prevent double-booking (optional)

If a mentor (or mentee) should not have two sessions at the same time, add either:

- A **database constraint**: e.g. a unique constraint on `(mentor_id, scheduled_at)` (and similarly for mentee if desired), or  
- **Application-level checks** in session create/reschedule: reject if the new time overlaps an existing session for that mentor/mentee.

A unique on `(mentor_id, scheduled_at)` is simple but assumes one session per mentor per clock-time; if you allow back-to-back 30-min slots, use overlap checks in code instead.

### 3. Index for approvals (optional)

If the approvals list often filters by `approved=False`, add an index on **MentorProfile** and **MenteeProfile** on `approved` (e.g. `indexes = [models.Index(fields=["approved"])]`). Only add if you measure slow queries on that filter.

### 4. Program / campus as lookup tables (optional)

If you want dropdowns and reporting by program or campus, replace `program` / `campus` CharFields with ForeignKeys to a **Program** or **Campus** model. Low priority unless you need strict consistency or analytics.

---

## Schema improvements (PostgreSQL)

These changes align the database with best practice and with the Django models. Prefer **Django migrations** so the schema stays in sync with code; use the raw SQL only if you need to patch an existing DB without running migrations.

### 1. Indexes (query performance)

| Table | Index | Purpose |
|-------|--------|--------|
| `matching_notification` | `(user_id, is_read)` | Unread count, “my notifications” list |
| `matching_menteementorrequest` | `(mentor_id, created_at DESC)` | “Mentees who requested me” for mentors |
| `matching_mentoringsession` | `(mentor_id, scheduled_at)` | Mentor’s schedule |
| `matching_mentoringsession` | `(mentee_id, scheduled_at)` | Mentee’s schedule |
| `matching_mentoringsession` | `(status, scheduled_at)` | Upcoming by status |
| `django_session` | `(expire_date)` | Session cleanup / expiry queries |

**Django:** Already defined on `Notification`, `MenteeMentorRequest`, and `MentoringSession` in `matching/models.py`. Apply migrations so these exist in the DB.

**Raw SQL (only if migrations are not run):**

```sql
-- matching (use if indexes are missing)
CREATE INDEX IF NOT EXISTS matching_notif_user_read ON matching_notification (user_id, is_read);
CREATE INDEX IF NOT EXISTS matching_mmr_mentor_created ON matching_menteementorrequest (mentor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matching_mentoringsession_mentor_scheduled ON matching_mentoringsession (mentor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS matching_mentoringsession_mentee_scheduled ON matching_mentoringsession (mentee_id, scheduled_at);
CREATE INDEX IF NOT EXISTS matching_mentoringsession_status_scheduled ON matching_mentoringsession (status, scheduled_at);

-- session cleanup
CREATE INDEX IF NOT EXISTS django_session_expire_date_idx ON django_session (expire_date);
```

### 2. Unique constraints

- **matching_topic:** One topic name per subject — `UNIQUE (subject_id, name)`.  
  Django: `unique_together = ("subject", "name")`; ensure the migration has been applied.

- **matching_menteementorrequest:** One request per mentee–mentor pair — `UNIQUE (mentee_id, mentor_id)`.  
  Django: `unique_together = ("mentee", "mentor")`; ensure the migration has been applied.

**Raw SQL (only if missing):**

```sql
CREATE UNIQUE INDEX IF NOT EXISTS matching_topic_subject_name_uniq ON matching_topic (subject_id, name);
ALTER TABLE matching_menteementorrequest ADD CONSTRAINT matching_mmr_mentee_mentor_uniq UNIQUE (mentee_id, mentor_id);
```

### 3. Session duration constraint

Business rule: session length at least 15 minutes. The schema you showed has `CHECK (duration_minutes >= 0)`; the app expects `>= 15`.

**Django:** `CheckConstraint(condition=Q(duration_minutes__gte=15), name="session_duration_minutes_gte_15")` in `MentoringSession`. Apply the migration.

**Raw SQL (only if you are not using that migration):**

```sql
ALTER TABLE matching_mentoringsession DROP CONSTRAINT IF EXISTS matching_mentoringsession_duration_minutes_check;
ALTER TABLE matching_mentoringsession ADD CONSTRAINT session_duration_minutes_gte_15 CHECK (duration_minutes >= 15);
```

### 4. Notification `action_tab` default

So inserts don’t require `action_tab` when it’s empty:

**Django:** `action_tab = CharField(..., default="")` is set in the model; run migrations so the column has a default.

**Raw SQL:**

```sql
ALTER TABLE matching_notification ALTER COLUMN action_tab SET DEFAULT '';
```

### 5. Optional: partial indexes

For very large tables, partial indexes can reduce size and speed up specific queries:

```sql
-- Unread notifications only (for badge / “mark all read”)
CREATE INDEX IF NOT EXISTS matching_notification_unread_idx
ON matching_notification (user_id) WHERE is_read = false;

-- Pending approvals (if you list unapproved profiles often)
CREATE INDEX IF NOT EXISTS profiles_mentorprofile_pending ON profiles_mentorprofile (id) WHERE approved = false;
CREATE INDEX IF NOT EXISTS profiles_menteeprofile_pending ON profiles_menteeprofile (id) WHERE approved = false;
```

Django does not create partial indexes via `Meta.indexes`; add these in a migration using `migrations.RunSQL` or a one-off script if you want them.

### 6. Summary checklist

| Improvement | Prefer | Optional SQL |
|-------------|--------|---------------|
| Notification (user_id, is_read) index | Django migration 0007 | Above |
| MenteeMentorRequest (mentor_id, created_at DESC) index | Django migration 0007 | Above |
| MentoringSession indexes | Django migrations (0005) | Above |
| Session expire_date index | New migration or RunSQL | Above |
| Topic unique (subject, name) | Django model | Above |
| MenteeMentorRequest unique (mentee, mentor) | Django model | Above |
| duration_minutes >= 15 | Django constraint | Above |
| action_tab default '' | Django default=="" | Above |
| Partial indexes (unread, pending) | RunSQL in migration | Above |

---

Run:

```bash
python manage.py migrate matching
```

This applies `0007_notification_ordering_indexes` (indexes + Notification ordering).

---

## Summary

- **Done:** Indexes on Notification and MenteeMentorRequest, default ordering for Notification; existing session indexes and constraints are in good shape.
- **Next:** Consider normalizing profile subjects/topics to Subject/Topic via M2M for integrity and simpler matching; optionally add double-booking prevention and indexes for approval lists if needed.
