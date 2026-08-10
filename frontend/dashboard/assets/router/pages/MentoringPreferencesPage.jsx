(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useMemo, useRef, useState } = React;
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

  const MIN_AVAILABLE_TIME = "07:00";
  const MAX_AVAILABLE_TIME = "22:00";
  const QUICK_AVAILABILITY = [
    { id: "morning", label: "Morning", start: "08:00", end: "11:00" },
    { id: "afternoon", label: "Afternoon", start: "13:00", end: "16:00" },
    { id: "evening", label: "Evening", start: "18:00", end: "21:00" },
  ];
  const DIFFICULTY_OPTIONS = [
    { value: 1, label: "Comfortable", helper: "You mostly feel on track in these subjects." },
    { value: 2, label: "Minor Help", helper: "You need occasional guidance on tougher concepts." },
    { value: 3, label: "Moderate", helper: "You often need mentor support to progress." },
    { value: 4, label: "Significant", helper: "You need consistent support to stay confident." },
    { value: 5, label: "Urgent", helper: "You need immediate help to avoid falling behind." },
  ];

  function SectionCard({ title, description, children }) {
    return (
      <section className="mp-section">
        <div className="mp-section-head">
          <h2 className="mp-section-title">{title}</h2>
          {description ? (
            <p className="mp-section-help">{description}</p>
          ) : null}
        </div>
        <div className="mp-section-body">{children}</div>
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
        <div className="card mentoring-preferences-page page-shell">
          <h1 className="page-title">Mentoring preferences</h1>
          <p className="page-subtitle">
            This page is available for student accounts only.
          </p>
        </div>
      );
    }

    const generalInfoDone = !!user.mentee_general_info_completed;
    const savedSnapshotRef = useRef(serializePreferences(menteeMatching));
    const [savedAt, setSavedAt] = useState(0);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [availabilityError, setAvailabilityError] = useState("");
    const [availabilityDraft, setAvailabilityDraft] = useState({
      start: "",
      end: "",
    });
    const [availabilityEditingIndex, setAvailabilityEditingIndex] =
      useState(null);

    const isPristine =
      savedSnapshotRef.current === serializePreferences(menteeMatching);
    const justSaved = savedAt > 0 && Date.now() - savedAt < 2500;

    const selectedSubjects = Array.isArray(menteeMatching.subjects)
      ? [...menteeMatching.subjects]
      : [];
    const subjectOptions =
      (window.DashboardApp && window.DashboardApp.MENTOR_SUBJECT_OPTIONS) || [];
    const allowedTopics = useMemo(
      () => getAllowedTopicsForSubjects(selectedSubjects),
      [selectedSubjects],
    );
    const majorSubjects = getMajorSubjectsFromSelection(selectedSubjects);
    const selectedTopics = filterTopicsForSubjects(
      selectedSubjects,
      menteeMatching.topics || [],
    );
    const topicsEnabled = majorSubjects.length > 0;
    const needsTopics = selectionRequiresTopics(selectedSubjects);
    const visibleTopicOptions = useMemo(
      () => (topicsEnabled ? [...allowedTopics] : []),
      [allowedTopics, topicsEnabled],
    );
    const topicsSignature = useMemo(
      () => visibleTopicOptions.join("|"),
      [visibleTopicOptions],
    );
    const [topicAnimationKey, setTopicAnimationKey] = useState(0);
    const hasDifficulty =
      menteeMatching.difficulty_level != null &&
      menteeMatching.difficulty_level >= 1 &&
      menteeMatching.difficulty_level <= 5;

    const canSave =
      selectedSubjects.length > 0 &&
      (!needsTopics || selectedTopics.length > 0) &&
      hasDifficulty;

    const showSubjectError = submitAttempted && selectedSubjects.length === 0;
    const showTopicError =
      submitAttempted && needsTopics && selectedTopics.length === 0;
    const showDifficultyError = submitAttempted && !hasDifficulty;
    const progressSteps = [
      { id: "subjects", label: "Subjects", done: selectedSubjects.length > 0 },
      { id: "topics", label: "Topics", done: !needsTopics || selectedTopics.length > 0 },
      { id: "difficulty", label: "Difficulty", done: hasDifficulty },
      {
        id: "availability",
        label: "Availability",
        done: Array.isArray(menteeMatching.availability) && menteeMatching.availability.length > 0,
      },
    ];
    const selectedDifficulty = DIFFICULTY_OPTIONS.find(
      (item) => item.value === menteeMatching.difficulty_level,
    );

    useEffect(() => {
      setTopicAnimationKey((prev) => prev + 1);
    }, [topicsEnabled, topicsSignature]);

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
      if (saved) {
        savedSnapshotRef.current = serializePreferences(menteeMatching);
        setSavedAt(Date.now());
      }
    }

    function handleReset() {
      if (isPristine) return;
      try {
        const parsed = JSON.parse(savedSnapshotRef.current || "{}");
        setMenteeMatching({
          ...menteeMatching,
          subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
          topics: Array.isArray(parsed.topics) ? parsed.topics : [],
          difficulty_level:
            parsed.difficulty_level == null ? null : Number(parsed.difficulty_level),
          availability: Array.isArray(parsed.availability) ? parsed.availability : [],
        });
        setAvailabilityDraft({ start: "", end: "" });
        setAvailabilityEditingIndex(null);
        setAvailabilityError("");
        setSubmitAttempted(false);
      } catch {
        // Keep current form values if snapshot parsing fails.
      }
    }

    function applyQuickAvailability(range) {
      const { error, next } = buildAvailabilityUpdate(
        menteeMatching.availability,
        { start: range.start, end: range.end },
        null,
      );
      if (!next) {
        setAvailabilityError(error);
        return;
      }
      setAvailabilityError("");
      setMenteeMatching({
        ...menteeMatching,
        availability: next,
      });
    }

    function isQuickAvailabilitySelected(range) {
      const slots = Array.isArray(menteeMatching.availability)
        ? menteeMatching.availability
        : [];
      return slots.includes(range.start + "-" + range.end);
    }

    if (!generalInfoDone) {
      return (
        <div className="card mentoring-preferences-page page-shell">
          <header className="mp-header">
            <h1 className="mp-page-title">Mentoring Preferences</h1>
            <p className="mp-page-subtitle">
              Tell us which subjects you want mentoring in so we can recommend
              the right mentors for you.
            </p>
          </header>
          <section className="mp-section">
            <p className="field-helper">
              Complete your student profile first, then return here to choose
              your mentoring subjects.
            </p>
            <div className="btn-row mp-action-row">
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
      <div className="card mentoring-preferences-page page-shell">
        <header className="mp-header">
          <h1 className="mp-page-title">Mentoring Preferences</h1>
          <p className="mp-page-subtitle">
            Build your mentoring profile to receive better mentor recommendations.
          </p>
          <ol className="mp-progress-track" aria-label="Mentoring preference setup progress">
            {progressSteps.map((step) => (
              <li
                key={step.id}
                className={"mp-progress-step" + (step.done ? " is-done" : "")}
              >
                <span className="mp-progress-dot" aria-hidden="true" />
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        </header>

        <div className="mp-layout">
          <div className="mp-main">
            <SectionCard
              title="Subjects"
              description="Choose major IT subjects and minor categories (GE, NSTP, PE) you want mentoring support for."
            >
              <div className="mp-inline-meta" aria-live="polite">
                {selectedSubjects.length} selected
              </div>
              {SubjectCategoryPicker ? (
                <SubjectCategoryPicker
                  selectedSubjects={selectedSubjects}
                  onToggle={toggleSubject}
                  showError={showSubjectError}
                />
              ) : (
                <div className="complete-profile-subject-grid" role="list" aria-label="Subject options">
                  {subjectOptions.map((subject) => {
                    const active = selectedSubjects.includes(subject);
                    return (
                      <button
                        key={subject}
                        type="button"
                        role="listitem"
                        className={"complete-profile-subject-card" + (active ? " is-active" : "")}
                        aria-pressed={active}
                        onClick={() => toggleSubject(subject)}
                      >
                        <span className="complete-profile-subject-title">{subject}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!SubjectCategoryPicker && showSubjectError && (
                <p className="complete-profile-error" role="alert">
                  Select at least one subject.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Topics"
              description="Select topics where you would like additional guidance."
            >
              <div className="mp-inline-meta" aria-live="polite">
                {selectedTopics.length} selected
              </div>
              <div
                className={
                  "mp-topic-field-shell" + (topicsEnabled ? " is-ready" : " is-waiting")
                }
                aria-live="polite"
              >
                {!topicsEnabled ? (
                  <div className="mp-topic-placeholder" role="status">
                    <p className="mp-topic-placeholder-title">Select a subject first</p>
                    <p className="mp-topic-placeholder-copy">
                      Choose at least one major IT subject, then matching topic options
                      will appear here.
                    </p>
                  </div>
                ) : (
                  <div key={topicAnimationKey} className="mp-topic-field-enter">
                    <div className="complete-profile-topic-wrap">
                      <div className="complete-profile-topic-chips" role="list" aria-label="Topic options">
                        {visibleTopicOptions.map((topic) => {
                          const active = selectedTopics.includes(topic);
                          return (
                            <button
                              key={topic}
                              type="button"
                              role="listitem"
                              className={
                                "complete-profile-topic-chip" + (active ? " is-active" : "")
                              }
                              aria-pressed={active}
                              title={"Toggle " + topic}
                              onClick={() => toggleTopic(topic)}
                            >
                              {active ? <span className="mp-chip-check">✓</span> : null}
                              {topic}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {visibleTopicOptions.length === 0 && (
                      <p className="field-helper complete-profile-helper" role="status">
                        No topic presets found for the selected subject. You can continue
                        with subject and difficulty selection.
                      </p>
                    )}
                  </div>
                )}
              </div>
              {showTopicError && (
                <p className="complete-profile-error" role="alert">
                  Select at least one topic.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Difficulty"
              description="How much support do you currently need for these subjects?"
            >
              <div className="mp-difficulty-segmented" role="radiogroup" aria-label="Difficulty level">
                {DIFFICULTY_OPTIONS.map((option) => {
                  const active = menteeMatching.difficulty_level === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={"mp-difficulty-option" + (active ? " is-active" : "")}
                      onClick={() =>
                        setMenteeMatching({
                          ...menteeMatching,
                          difficulty_level: option.value,
                        })
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mp-difficulty-helper" aria-live="polite">
                {selectedDifficulty
                  ? selectedDifficulty.helper
                  : "Select one level from Comfortable to Urgent."}
              </p>
              {showDifficultyError && (
                <p className="complete-profile-error" role="alert">
                  Select a difficulty level before saving.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Available Time"
              description="Pick quick time windows or add custom ranges between 7:00 AM and 10:00 PM."
            >
              <div className="mp-quick-availability">
                {QUICK_AVAILABILITY.map((range) => (
                  <button
                    key={range.id}
                    type="button"
                    className={
                      "mp-quick-chip" +
                      (isQuickAvailabilitySelected(range) ? " is-active" : "")
                    }
                    onClick={() => applyQuickAvailability(range)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>

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
              <div className="btn-row mp-availability-actions">
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
                  {availabilityEditingIndex != null ? "Update range" : "Add range"}
                </button>
                {availabilityEditingIndex != null && (
                  <button
                    type="button"
                    className="btn secondary small"
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
                  <div className="availability-list mp-availability-list" aria-live="polite">
                    {menteeMatching.availability.map((slot, idx) => (
                      <div
                        key={slot + "-" + idx}
                        className={
                          "availability-item mp-availability-item" +
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
                                setAvailabilityEditingIndex(availabilityEditingIndex - 1);
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
          </div>

          <aside className="mp-preview">
            <h3 className="mp-preview-title">Your Matching Profile</h3>
            <p className="mp-preview-copy">
              These preferences help us find mentors that best match your academic needs.
            </p>
            <dl className="mp-preview-list">
              <div className="mp-preview-row">
                <dt>Subjects Selected</dt>
                <dd>{selectedSubjects.length}</dd>
              </div>
              <div className="mp-preview-row">
                <dt>Topics Selected</dt>
                <dd>{selectedTopics.length}</dd>
              </div>
              <div className="mp-preview-row">
                <dt>Difficulty Level</dt>
                <dd>{selectedDifficulty ? selectedDifficulty.label : "Not set"}</dd>
              </div>
              <div className="mp-preview-row">
                <dt>Availability</dt>
                <dd>
                  {Array.isArray(menteeMatching.availability) &&
                  menteeMatching.availability.length > 0
                    ? menteeMatching.availability.length + " range(s)"
                    : "Not set"}
                </dd>
              </div>
            </dl>
          </aside>
        </div>

        <div className="mp-sticky-bar">
          <div className="mp-sticky-meta">
            <p className="mp-sticky-title">
              {isPristine ? "All changes saved" : "Unsaved changes"}
            </p>
            <p className="mp-sticky-subtitle">
              {isPristine
                ? "Your mentoring profile is up to date."
                : "Review and save to improve your mentor recommendations."}
            </p>
            {submitAttempted && !canSave && (
              <p className="complete-profile-error complete-profile-error-summary" role="alert">
                {needsTopics
                  ? "Select at least one subject, one topic, and a difficulty level before saving."
                  : "Select at least one subject and a difficulty level before saving."}
              </p>
            )}
            {justSaved && (
              <p className="matching-inline-feedback matching-inline-feedback--success" role="status">
                Your mentoring preferences were saved.
              </p>
            )}
          </div>
          <div className="mp-sticky-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={handleReset}
              disabled={isPristine || menteeMatchingSaving}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleSave}
              disabled={menteeMatchingSaving || (isPristine && canSave)}
            >
              {menteeMatchingSaving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentoring-preferences"] = MentoringPreferencesPage;
})();
