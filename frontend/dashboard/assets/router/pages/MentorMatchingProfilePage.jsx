(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useRef, useState } = React;
  const AppContext = window.DashboardApp.AppContext;

  const SubjectCategoryPicker =
    window.DashboardApp && window.DashboardApp.SubjectCategoryPicker;
  const selectionRequiresTopics =
    window.DashboardApp.selectionRequiresTopics || (() => true);
  const getMajorSubjectsFromSelection =
    window.DashboardApp.getMajorSubjectsFromSelection || ((s) => s || []);
  const getAllowedTopicsForSubjects =
    window.DashboardApp.getAllowedTopicsForSubjects || (() => []);
  const filterTopicsForSubjects =
    window.DashboardApp.filterTopicsForSubjects ||
    ((subjects, topics) => (Array.isArray(topics) ? [...topics] : []));

  const EXPERTISE_LEVELS = [
    {
      value: 1,
      label: "Beginner",
      description: "Can guide fundamentals with close structure and examples.",
    },
    {
      value: 2,
      label: "Novice",
      description: "Comfortable with basics and common classroom exercises.",
    },
    {
      value: 3,
      label: "Intermediate",
      description: "Can explain concepts, debug issues, and scaffold projects.",
    },
    {
      value: 4,
      label: "Advanced",
      description: "Confident with deeper topics and practical implementation.",
    },
    {
      value: 5,
      label: "Expert",
      description: "Can mentor complex scenarios and advanced project decisions.",
    },
  ];

  const MIN_AVAILABLE_TIME = "07:00";
  const MAX_AVAILABLE_TIME = "22:00";

  function serializeMentorQuestionnaire(profile) {
    return JSON.stringify({
      subjects: profile.subjects || [],
      topics: profile.topics || [],
      expertise_level: profile.expertise_level ?? null,
      role: profile.role || "",
      capacity: profile.capacity ?? 3,
      gender: profile.gender || "",
      availability: profile.availability || [],
    });
  }

  function SectionCard({ title, description, children }) {
    return (
      <section className="complete-profile-section">
        <div className="complete-profile-section-head">
          <h2 className="complete-profile-section-title">{title}</h2>
          {description ? (
            <p className="complete-profile-section-help">{description}</p>
          ) : null}
        </div>
        <div className="complete-profile-section-body">{children}</div>
      </section>
    );
  }

  function toMinutes(hhmm) {
    const parts = String(hhmm || "").split(":");
    if (parts.length !== 2) return null;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (
      !Number.isFinite(h) ||
      !Number.isFinite(m) ||
      h < 0 ||
      h > 23 ||
      m < 0 ||
      m > 59
    ) {
      return null;
    }
    return h * 60 + m;
  }

  function toSingleAvailabilityRange(start, end) {
    const s = toMinutes(start);
    const e = toMinutes(end);
    const min = toMinutes(MIN_AVAILABLE_TIME);
    const max = toMinutes(MAX_AVAILABLE_TIME);
    if (s == null || e == null || min == null || max == null) return [];
    if (s < min || e > max || s >= e) return [];
    return [`${start}-${end}`];
  }

  function parseAvailabilityRange(slot) {
    const text = String(slot || "");
    const parts = text.split("-");
    if (parts.length !== 2) return null;
    const start = parts[0];
    const end = parts[1];
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (startMinutes == null || endMinutes == null || startMinutes >= endMinutes) {
      return null;
    }
    return { start, end, startMinutes, endMinutes };
  }

  function rangesOverlap(a, b) {
    return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
  }

  function formatTimeLabel(hhmm) {
    const minutes = toMinutes(hhmm);
    if (minutes == null) return String(hhmm || "");
    const h24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const suffix = h24 >= 12 ? "PM" : "AM";
    const h12 = ((h24 + 11) % 12) + 1;
    return `${h12}:${String(mins).padStart(2, "0")} ${suffix}`;
  }

  function formatAvailabilityLabel(slot) {
    const parsed = parseAvailabilityRange(slot);
    if (!parsed) return String(slot || "");
    return `${formatTimeLabel(parsed.start)} - ${formatTimeLabel(parsed.end)}`;
  }

  function sortAvailabilityRanges(slots) {
    return [...slots].sort((a, b) => {
      const one = parseAvailabilityRange(a);
      const two = parseAvailabilityRange(b);
      if (!one || !two) return String(a).localeCompare(String(b));
      return one.startMinutes - two.startMinutes;
    });
  }

  function buildAvailabilityUpdate(currentAvailability, draft, editingIndex) {
    if (!draft.start || !draft.end) {
      return {
        error: "Select both start and end time before adding a timeframe.",
        next: null,
      };
    }

    const newSlots = toSingleAvailabilityRange(draft.start, draft.end);
    if (!Array.isArray(newSlots) || newSlots.length === 0) {
      return {
        error: "Choose a valid range where start time is earlier than end time.",
        next: null,
      };
    }

    const newSlot = newSlots[0];
    const parsedNewSlot = parseAvailabilityRange(newSlot);
    if (!parsedNewSlot) {
      return { error: "Choose a valid timeframe.", next: null };
    }

    const current = Array.isArray(currentAvailability)
      ? [...currentAvailability]
      : [];

    const hasDuplicate = current.some(
      (slot, idx) => idx !== editingIndex && String(slot) === newSlot,
    );
    if (hasDuplicate) {
      return { error: "That timeframe already exists.", next: null };
    }

    const hasOverlap = current.some((slot, idx) => {
      if (idx === editingIndex) return false;
      const parsed = parseAvailabilityRange(slot);
      if (!parsed) return false;
      return rangesOverlap(parsedNewSlot, parsed);
    });
    if (hasOverlap) {
      return {
        error: "Timeframes cannot overlap with existing ranges.",
        next: null,
      };
    }

    const next = [...current];
    if (
      editingIndex != null &&
      editingIndex >= 0 &&
      editingIndex < next.length
    ) {
      next[editingIndex] = newSlot;
    } else {
      next.push(newSlot);
    }

    return { error: "", next: sortAvailabilityRanges(next) };
  }

  function TimePickerField({ id, label, value, min, max, onChange }) {
    const inputRef = useRef(null);
    const [pickerSupported, setPickerSupported] = useState(false);

    useEffect(() => {
      const node = inputRef.current;
      setPickerSupported(!!node && typeof node.showPicker === "function");
    }, []);

    function openPicker() {
      const node = inputRef.current;
      if (!node) return;
      if (pickerSupported && typeof node.showPicker === "function") {
        try {
          node.showPicker();
        } catch (_) {
          setPickerSupported(false);
        }
      }
    }

    return (
      <div className="time-field">
        <label htmlFor={id}>{label}</label>
        <div
          className="time-input-wrapper"
          onClick={(e) => {
            const node = inputRef.current;
            if (!node) return;
            if (e.target !== node) node.focus();
            if (pickerSupported) openPicker();
          }}
        >
          <input
            ref={inputRef}
            id={id}
            type="time"
            className="time-input"
            min={min}
            max={max}
            value={value}
            readOnly={pickerSupported}
            onClick={openPicker}
            onFocus={() => {
              if (pickerSupported) openPicker();
            }}
            onKeyDown={(e) => {
              if (pickerSupported) e.preventDefault();
            }}
            onChange={onChange}
          />
        </div>
      </div>
    );
  }

  function MentorMatchingProfilePage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;

    const {
      mentorProfile,
      setMentorProfile,
      mentorProfileSaving,
      handleMentorProfileSave,
    } = ctx;

    const [savedAt, setSavedAt] = useState(0);
    const [availabilityDraft, setAvailabilityDraft] = useState({
      start: "",
      end: "",
    });
    const [availabilityEditingIndex, setAvailabilityEditingIndex] =
      useState(null);
    const [availabilityError, setAvailabilityError] = useState("");
    const savedRef = useRef(serializeMentorQuestionnaire(mentorProfile));

    useEffect(() => {
      if (!mentorProfileSaving) {
        savedRef.current = serializeMentorQuestionnaire(mentorProfile);
      }
    }, [mentorProfile, mentorProfileSaving]);

    const isPristine =
      savedRef.current === serializeMentorQuestionnaire(mentorProfile);
    const justSaved = savedAt > 0 && Date.now() - savedAt < 2000;

    const selectedSubjects = Array.isArray(mentorProfile.subjects)
      ? mentorProfile.subjects
      : [];
    const subjectOptions =
      (window.DashboardApp && window.DashboardApp.MENTOR_SUBJECT_OPTIONS) || [];
    const selectedTopics = Array.isArray(mentorProfile.topics)
      ? mentorProfile.topics
      : [];
    const allowedTopics = getAllowedTopicsForSubjects(selectedSubjects);
    const majorSubjects = getMajorSubjectsFromSelection(selectedSubjects);
    const topicsEnabled = majorSubjects.length > 0;
    const visibleTopicOptions = topicsEnabled ? [...allowedTopics] : [];
    const topicsSignature = visibleTopicOptions.join("|");
    const needsTopics = selectionRequiresTopics(selectedSubjects);
    const expertiseLevel = EXPERTISE_LEVELS.find(
      (level) => level.value === mentorProfile.expertise_level,
    );

    function toggleSubject(subject) {
      const nextSubjects = selectedSubjects.includes(subject)
        ? selectedSubjects.filter((item) => item !== subject)
        : [...selectedSubjects, subject];
      setMentorProfile({
        ...mentorProfile,
        subjects: nextSubjects,
        topics: filterTopicsForSubjects(nextSubjects, selectedTopics),
      });
      if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
    }

    function toggleTopic(topic) {
      if (!topicsEnabled || !allowedTopics.includes(topic)) return;
      const nextTopics = selectedTopics.includes(topic)
        ? selectedTopics.filter((item) => item !== topic)
        : [...selectedTopics, topic];
      setMentorProfile({
        ...mentorProfile,
        topics: filterTopicsForSubjects(selectedSubjects, nextTopics),
      });
      if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
    }

    async function handleSave() {
      const saved = await handleMentorProfileSave();
      if (saved) {
        setSavedAt(Date.now());
        savedRef.current = serializeMentorQuestionnaire(mentorProfile);
      }
    }

    return (
      <div className="card complete-profile-page mentor-matching-profile-page page-shell">
        <header className="complete-profile-header">
          <h1 className="page-title">Mentor matching profile</h1>
          <p className="page-subtitle complete-profile-subtitle">
            Keep your subjects, topics, expertise, capacity, and availability up
            to date so we can recommend the right mentees for you.
          </p>
        </header>

        <SectionCard
          title="Mentor role"
          description="Tell us whether you mentor as a senior IT student or an instructor."
        >
          <div className="form-group">
            <label htmlFor="mentor-matching-role">Role</label>
            <select
              id="mentor-matching-role"
              value={mentorProfile.role || ""}
              onChange={(e) => {
                setMentorProfile({ ...mentorProfile, role: e.target.value });
                if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
              }}
            >
              <option value="">Select role</option>
              <option value="Senior IT Student">Senior IT Student</option>
              <option value="Instructor">Instructor</option>
            </select>
          </div>
        </SectionCard>

        <SectionCard
          title="Subjects you can help with"
          description="Pick major IT subjects and minor subjects (GE, NSTP, PE) where you feel comfortable guiding mentees."
        >
          <div className="complete-profile-inline-meta" aria-live="polite">
            <span>{selectedSubjects.length} selected</span>
          </div>
          {SubjectCategoryPicker ? (
            <SubjectCategoryPicker
              selectedSubjects={selectedSubjects}
              onToggle={toggleSubject}
            />
          ) : (
            <div
              className="complete-profile-subject-grid"
              role="list"
              aria-label="Subject options"
            >
              {subjectOptions.map((subject) => {
                const active = selectedSubjects.includes(subject);
                return (
                  <button
                    key={subject}
                    type="button"
                    role="listitem"
                    className={
                      "complete-profile-subject-card" + (active ? " is-active" : "")
                    }
                    aria-pressed={active}
                    onClick={() => toggleSubject(subject)}
                  >
                    <span className="complete-profile-subject-title">{subject}</span>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Topics you can mentor on"
          description={
            needsTopics
              ? "Choose specific concepts you enjoy explaining in your selected major subjects."
              : "Topics apply to major IT subjects. You selected only minor subjects, so topics are optional."
          }
        >
          <div className="complete-profile-inline-meta" aria-live="polite">
            <span>{selectedTopics.length} selected</span>
          </div>
          {!topicsEnabled ? (
            <p className="field-helper complete-profile-helper" role="status">
              Select a subject first. Topic options will appear once you choose at least one major IT subject.
            </p>
          ) : (
            <div key={topicsSignature} className="complete-profile-topic-enter">
              <div className="complete-profile-topic-wrap">
                <div
                  className="complete-profile-topic-chips"
                  role="list"
                  aria-label="Topic options"
                >
                  {visibleTopicOptions.map((topic) => {
                    const active = selectedTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        type="button"
                        role="listitem"
                        className={
                          "complete-profile-topic-chip" +
                          (active ? " is-active" : "")
                        }
                        aria-pressed={active}
                        title={`Toggle ${topic}`}
                        onClick={() => toggleTopic(topic)}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
              </div>
              {visibleTopicOptions.length === 0 && (
                <p className="field-helper complete-profile-helper" role="status">
                  No topic presets found for the selected subject.
                </p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Expertise level"
          description="1 = just starting to tutor in these subjects, 5 = very experienced and confident mentoring others."
        >
          <div
            className="complete-profile-expertise-group"
            role="radiogroup"
            aria-label="Expertise level"
          >
            {EXPERTISE_LEVELS.map((level) => {
              const active = mentorProfile.expertise_level === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={
                    "complete-profile-expertise-option" + (active ? " is-active" : "")
                  }
                  onClick={() => {
                    setMentorProfile({
                      ...mentorProfile,
                      expertise_level: level.value,
                    });
                    if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
                  }}
                >
                  <span className="complete-profile-expertise-label">
                    {level.label}
                  </span>
                  <span className="complete-profile-expertise-value">
                    {level.value}
                  </span>
                </button>
              );
            })}
          </div>
          {expertiseLevel ? (
            <p className="complete-profile-expertise-note" aria-live="polite">
              {expertiseLevel.label}: {expertiseLevel.description}
            </p>
          ) : (
            <p className="complete-profile-expertise-note" aria-live="polite">
              Choose one level from Beginner to Expert.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Maximum mentees"
          description="We will not assign you more mentees than this number."
        >
          <div className="form-group">
            <label htmlFor="mentor-matching-capacity">Max mentees</label>
            <input
              id="mentor-matching-capacity"
              type="number"
              min={1}
              max={5}
              value={mentorProfile.capacity ?? 3}
              onChange={(e) => {
                const raw = Number(e.target.value || 1);
                const clamped = Math.max(1, Math.min(5, raw));
                setMentorProfile({ ...mentorProfile, capacity: clamped });
                if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
              }}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Biological sex"
          description="Used only for matching preferences when mentees request a specific mentor gender."
        >
          <div className="form-group">
            <label htmlFor="mentor-matching-gender">Biological sex</label>
            <select
              id="mentor-matching-gender"
              value={mentorProfile.gender || ""}
              onChange={(e) => {
                setMentorProfile({ ...mentorProfile, gender: e.target.value });
                if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
              }}
            >
              <option value="">Select biological sex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </SectionCard>

        <SectionCard
          title="Available time"
          description="Add one or more time ranges between 7:00 AM and 10:00 PM when you can meet."
        >
          <div className="time-range-row">
            <TimePickerField
              id="mentor-matching-start"
              label="Start time"
              min={MIN_AVAILABLE_TIME}
              max={MAX_AVAILABLE_TIME}
              value={availabilityDraft.start}
              onChange={(e) => {
                setAvailabilityError("");
                setAvailabilityDraft({
                  ...availabilityDraft,
                  start: e.target.value,
                });
              }}
            />
            <TimePickerField
              id="mentor-matching-end"
              label="End time"
              min={MIN_AVAILABLE_TIME}
              max={MAX_AVAILABLE_TIME}
              value={availabilityDraft.end}
              onChange={(e) => {
                setAvailabilityError("");
                setAvailabilityDraft({
                  ...availabilityDraft,
                  end: e.target.value,
                });
              }}
            />
          </div>
          <div className="btn-row" style={{ marginTop: "8px" }}>
            <button
              type="button"
              className="btn secondary small"
              disabled={!availabilityDraft.start || !availabilityDraft.end}
              onClick={() => {
                const { error, next } = buildAvailabilityUpdate(
                  mentorProfile.availability,
                  availabilityDraft,
                  availabilityEditingIndex,
                );
                if (!next) {
                  setAvailabilityError(error);
                  return;
                }
                setAvailabilityError("");
                setMentorProfile({ ...mentorProfile, availability: next });
                setAvailabilityDraft({ start: "", end: "" });
                setAvailabilityEditingIndex(null);
                if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
              }}
            >
              {availabilityEditingIndex != null
                ? "Update timeframe"
                : "Add timeframe"}
            </button>
            {availabilityEditingIndex != null && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setAvailabilityEditingIndex(null);
                  setAvailabilityDraft({ start: "", end: "" });
                  setAvailabilityError("");
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
          {availabilityError && (
            <p className="complete-profile-error" role="alert">
              {availabilityError}
            </p>
          )}
          <p className="field-helper">
            You can add multiple availability ranges. We&apos;ll match you with
            people whose times overlap these ranges.
          </p>
          {Array.isArray(mentorProfile.availability) &&
            mentorProfile.availability.length > 0 && (
              <div className="availability-list" aria-live="polite">
                {mentorProfile.availability.map((slot, idx) => (
                  <div
                    key={`${slot}-${idx}`}
                    className={
                      "availability-item" +
                      (availabilityEditingIndex === idx ? " is-editing" : "")
                    }
                  >
                    <span className="availability-item-label">
                      {formatAvailabilityLabel(slot)}
                    </span>
                    <div className="availability-item-actions">
                      <button
                        type="button"
                        className="availability-action-btn"
                        onClick={() => {
                          const parsed = parseAvailabilityRange(slot);
                          if (!parsed) return;
                          setAvailabilityDraft({
                            start: parsed.start,
                            end: parsed.end,
                          });
                          setAvailabilityEditingIndex(idx);
                          setAvailabilityError("");
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="availability-action-btn availability-action-btn--danger"
                        onClick={() => {
                          const next = mentorProfile.availability.filter(
                            (_, i) => i !== idx,
                          );
                          setMentorProfile({
                            ...mentorProfile,
                            availability: next,
                          });
                          if (availabilityEditingIndex === idx) {
                            setAvailabilityEditingIndex(null);
                            setAvailabilityDraft({ start: "", end: "" });
                          } else if (
                            availabilityEditingIndex != null &&
                            availabilityEditingIndex > idx
                          ) {
                            setAvailabilityEditingIndex(
                              availabilityEditingIndex - 1,
                            );
                          }
                          if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </SectionCard>

        <div className="complete-profile-submit-row">
          <button
            type="button"
            className="btn complete-profile-submit-btn"
            onClick={handleSave}
            disabled={mentorProfileSaving || isPristine}
          >
            {mentorProfileSaving
              ? "Saving..."
              : isPristine
                ? "No changes yet"
                : "Save matching profile"}
          </button>
          {justSaved && (
            <p
              className="matching-inline-feedback matching-inline-feedback--success"
              role="status"
            >
              Your mentor matching profile was saved.
            </p>
          )}
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentor-matching-profile"] = MentorMatchingProfilePage;
})();
