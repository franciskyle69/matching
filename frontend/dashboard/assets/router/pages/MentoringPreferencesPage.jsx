(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useMemo, useRef, useState } = React;
  const AppContext = window.DashboardApp.AppContext;

  const SUBJECT_OPTIONS =
    (window.DashboardApp && window.DashboardApp.MENTOR_SUBJECT_OPTIONS) || [];
  const TOPIC_OPTIONS =
    (window.DashboardApp && window.DashboardApp.MENTOR_TOPIC_OPTIONS) || [];
  const getAllowedTopicsForSubjects =
    window.DashboardApp.getAllowedTopicsForSubjects || (() => []);
  const filterTopicsForSubjects =
    window.DashboardApp.filterTopicsForSubjects ||
    ((subjects, topics) => (Array.isArray(topics) ? [...topics] : []));

  const MIN_AVAILABLE_TIME = "07:00";
  const MAX_AVAILABLE_TIME = "22:00";

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

  function serializePreferences(profile) {
    return JSON.stringify({
      subjects: profile.subjects || [],
      topics: profile.topics || [],
      difficulty_level: profile.difficulty_level ?? null,
      availability: profile.availability || [],
    });
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

  function MentoringPreferencesPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;

    const {
      user,
      setActiveTab,
      menteeMatching,
      setMenteeMatching,
      menteeMatchingSaving,
      handleMenteeMatchingSave,
    } = ctx;

    if (user.role !== "mentee") {
      return (
        <div className="card complete-profile-page">
          <h1 className="page-title">Mentoring preferences</h1>
          <p className="page-subtitle">
            This page is available for student accounts only.
          </p>
        </div>
      );
    }

    const generalInfoDone = !!user.mentee_general_info_completed;
    const savedRef = useRef(serializePreferences(menteeMatching));
    const [savedAt, setSavedAt] = useState(0);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [availabilityError, setAvailabilityError] = useState("");
    const [availabilityDraft, setAvailabilityDraft] = useState({
      start: "",
      end: "",
    });
    const [availabilityEditingIndex, setAvailabilityEditingIndex] =
      useState(null);

    useEffect(() => {
      if (!menteeMatchingSaving) {
        savedRef.current = serializePreferences(menteeMatching);
      }
    }, [menteeMatching, menteeMatchingSaving]);

    const isPristine =
      savedRef.current === serializePreferences(menteeMatching);
    const justSaved = savedAt > 0 && Date.now() - savedAt < 2500;

    const selectedSubjects = Array.isArray(menteeMatching.subjects)
      ? [...menteeMatching.subjects]
      : [];
    const allowedTopics = useMemo(
      () => getAllowedTopicsForSubjects(selectedSubjects),
      [selectedSubjects],
    );
    const selectedTopics = filterTopicsForSubjects(
      selectedSubjects,
      menteeMatching.topics || [],
    );
    const topicsEnabled = selectedSubjects.length > 0;
    const hasDifficulty =
      menteeMatching.difficulty_level != null &&
      menteeMatching.difficulty_level >= 1 &&
      menteeMatching.difficulty_level <= 5;

    const canSave =
      selectedSubjects.length > 0 &&
      selectedTopics.length > 0 &&
      hasDifficulty;

    const showSubjectError = submitAttempted && selectedSubjects.length === 0;
    const showTopicError = submitAttempted && selectedTopics.length === 0;
    const showDifficultyError = submitAttempted && !hasDifficulty;

    function toggleSubject(subject) {
      const nextSubjects = selectedSubjects.includes(subject)
        ? selectedSubjects.filter((item) => item !== subject)
        : [...selectedSubjects, subject];
      setMenteeMatching({
        ...menteeMatching,
        subjects: nextSubjects,
        topics: filterTopicsForSubjects(nextSubjects, selectedTopics),
      });
    }

    function toggleTopic(topic) {
      if (!topicsEnabled || !allowedTopics.includes(topic)) return;
      const nextTopics = selectedTopics.includes(topic)
        ? selectedTopics.filter((item) => item !== topic)
        : [...selectedTopics, topic];
      setMenteeMatching({
        ...menteeMatching,
        topics: filterTopicsForSubjects(selectedSubjects, nextTopics),
      });
    }

    async function handleSave() {
      setSubmitAttempted(true);
      if (!canSave) return;
      const saved = await handleMenteeMatchingSave();
      if (saved) setSavedAt(Date.now());
    }

    if (!generalInfoDone) {
      return (
        <div className="card complete-profile-page">
          <header className="complete-profile-header">
            <h1 className="page-title">Mentoring preferences</h1>
            <p className="page-subtitle complete-profile-subtitle">
              Tell us which subjects you want mentoring in so we can recommend
              the right mentors for you.
            </p>
          </header>
          <section className="complete-profile-section">
            <p className="field-helper">
              Complete your student profile first, then return here to choose
              your mentoring subjects.
            </p>
            <div className="btn-row complete-profile-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setActiveTab("complete-profile")}
              >
                Complete student profile
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className="card complete-profile-page mentoring-preferences-page">
        <header className="complete-profile-header">
          <h1 className="page-title">Mentoring preferences</h1>
          <p className="page-subtitle complete-profile-subtitle">
            Choose the subjects you want to receive mentoring in, the topics
            you find challenging, and when you are usually available.
          </p>
        </header>

        <SectionCard
          title="Subjects for mentoring"
          description="Select every subject where you would like support from a mentor."
        >
          <div className="complete-profile-inline-meta" aria-live="polite">
            <span>{selectedSubjects.length} selected</span>
          </div>
          <div
            className="complete-profile-subject-grid"
            role="list"
            aria-label="Subject options"
          >
            {SUBJECT_OPTIONS.map((subject) => {
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
          {showSubjectError && (
            <p className="complete-profile-error" role="alert">
              Select at least one subject.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Topics you find challenging"
          description="Pick the specific areas where you need the most help."
        >
          <div className="complete-profile-inline-meta" aria-live="polite">
            <span>{selectedTopics.length} selected</span>
          </div>
          <div
            className={
              "complete-profile-topic-wrap" + (topicsEnabled ? "" : " is-disabled")
            }
            aria-disabled={!topicsEnabled}
          >
            <div
              className="complete-profile-topic-chips"
              role="list"
              aria-label="Topic options"
            >
              {TOPIC_OPTIONS.map((topic) => {
                const disabled =
                  !topicsEnabled || !allowedTopics.includes(topic);
                const active = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    role="listitem"
                    className={
                      "complete-profile-topic-chip" +
                      (active ? " is-active" : "") +
                      (disabled ? " is-disabled" : "")
                    }
                    disabled={disabled}
                    aria-pressed={active}
                    title={
                      disabled
                        ? "Select at least one subject first to enable this topic"
                        : `Toggle ${topic}`
                    }
                    onClick={() => toggleTopic(topic)}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>
          {!topicsEnabled && (
            <p className="field-helper complete-profile-helper" role="status">
              Select one or more subjects first to unlock topics.
            </p>
          )}
          {showTopicError && (
            <p className="complete-profile-error" role="alert">
              Select at least one topic.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="How difficult these subjects feel"
          description="1 = the course feels manageable right now, 5 = you need substantial help."
        >
          <div
            className="complete-profile-expertise-group mentoring-preferences-levels"
            role="radiogroup"
            aria-label="Difficulty level"
          >
            {[1, 2, 3, 4, 5].map((level) => {
              const active = menteeMatching.difficulty_level === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={
                    "complete-profile-expertise-option" + (active ? " is-active" : "")
                  }
                  onClick={() =>
                    setMenteeMatching({
                      ...menteeMatching,
                      difficulty_level: level,
                    })
                  }
                >
                  <span className="complete-profile-expertise-label">Level</span>
                  <span className="complete-profile-expertise-value">{level}</span>
                </button>
              );
            })}
          </div>
          {showDifficultyError && (
            <p className="complete-profile-error" role="alert">
              Select a difficulty level before saving.
            </p>
          )}
        </SectionCard>

        <SectionCard
          title="Available time"
          description="Add one or more time ranges between 7:00 AM and 10:00 PM when you can meet."
        >
          <div className="time-range-row">
            <TimePickerField
              id="mentoring-prefs-start"
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
              id="mentoring-prefs-end"
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
                  menteeMatching.availability,
                  availabilityDraft,
                  availabilityEditingIndex,
                );
                if (!next) {
                  setAvailabilityError(error);
                  return;
                }
                setAvailabilityError("");
                setMenteeMatching({ ...menteeMatching, availability: next });
                setAvailabilityDraft({ start: "", end: "" });
                setAvailabilityEditingIndex(null);
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
          {Array.isArray(menteeMatching.availability) &&
            menteeMatching.availability.length > 0 && (
              <div className="availability-list" aria-live="polite">
                {menteeMatching.availability.map((slot, idx) => (
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
                          const next = menteeMatching.availability.filter(
                            (_, i) => i !== idx,
                          );
                          setMenteeMatching({
                            ...menteeMatching,
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
            disabled={menteeMatchingSaving || (isPristine && canSave)}
          >
            {menteeMatchingSaving
              ? "Saving..."
              : isPristine && canSave
                ? "No changes yet"
                : "Save preferences"}
          </button>
          {justSaved && (
            <p
              className="matching-inline-feedback matching-inline-feedback--success"
              role="status"
            >
              Your mentoring preferences were saved.
            </p>
          )}
          {submitAttempted && !canSave && (
            <p
              className="complete-profile-error complete-profile-error-summary"
              role="alert"
            >
              Select at least one subject, one topic, and a difficulty level
              before saving.
            </p>
          )}
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentoring-preferences"] = MentoringPreferencesPage;
})();
