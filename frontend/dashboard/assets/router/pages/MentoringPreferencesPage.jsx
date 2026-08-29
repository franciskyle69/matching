(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useMemo, useRef, useState } = React;
  const AppContext = window.DashboardApp.AppContext;

  const SubjectCategoryPicker =
    window.DashboardApp && window.DashboardApp.SubjectCategoryPicker;
  const TimePickerField =
    window.DashboardApp && window.DashboardApp.TimePickerField;
  const SelectionCatalog =
    window.DashboardApp && window.DashboardApp.SelectionCatalog;
  const formatTimeLabel =
    (window.DashboardApp && window.DashboardApp.formatTimeLabel) ||
    ((hhmm) => String(hhmm || ""));
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
      competency_ids: profile.competency_ids || [],
    competency_needs: profile.competency_needs || {},
      difficulty_level: profile.difficulty_level ?? null,
    preferred_learning_style: profile.preferred_learning_style || "",
      availability: profile.availability || [],
    });
  }

  function toMinutes(hhmm) {
    const parts = String(hhmm || "").trim().split(":");
    if (parts.length < 2) return null;
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

  function formatHhmm(hhmm) {
    const mins = toMinutes(hhmm);
    if (mins == null) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function toSingleAvailabilityRange(start, end) {
    const s = toMinutes(start);
    const e = toMinutes(end);
    const min = toMinutes(MIN_AVAILABLE_TIME);
    const max = toMinutes(MAX_AVAILABLE_TIME);
    if (s == null || e == null || min == null || max == null) return [];
    if (s < min || e > max || s >= e) return [];
    return [`${formatHhmm(start)}-${formatHhmm(end)}`];
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

  function MentoringPreferencesPage(props) {
    const embedded = !!(props && props.embedded);
    const ctx = useContext(AppContext);
    const user = ctx && ctx.user;
    const setActiveTab = ctx && ctx.setActiveTab;
    const menteeMatching = (ctx && ctx.menteeMatching) || {
      subjects: [],
      topics: [],
      competency_ids: [],
      competency_needs: {},
      difficulty_level: null,
      preferred_learning_style: "",
      availability: [],
    };
    const setMenteeMatching = ctx && ctx.setMenteeMatching;
    const menteeMatchingSaving = !!(ctx && ctx.menteeMatchingSaving);
    const handleMenteeMatchingSave = ctx && ctx.handleMenteeMatchingSave;
    const setUnsavedChangesDirty = ctx && ctx.setUnsavedChangesDirty;

    const generalInfoDone = !!(user && user.mentee_general_info_completed);
    const savedSnapshotRef = useRef(serializePreferences(menteeMatching));
    const hasUserEditedRef = useRef(false);
    const [savedAt, setSavedAt] = useState(0);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [availabilityError, setAvailabilityError] = useState("");
    const [availabilityDraft, setAvailabilityDraft] = useState({
      start: "",
      end: "",
    });
    const [availabilityEditingIndex, setAvailabilityEditingIndex] =
      useState(null);

    const serializedPrefs = serializePreferences(menteeMatching);
    if (!hasUserEditedRef.current) {
      savedSnapshotRef.current = serializedPrefs;
    }
    const isPristine = savedSnapshotRef.current === serializedPrefs;
    const justSaved = savedAt > 0;

    useEffect(() => {
      if (!savedAt) return undefined;
      const timeoutId = window.setTimeout(() => setSavedAt(0), 2200);
      return () => window.clearTimeout(timeoutId);
    }, [savedAt]);

    function markDirty() {
      hasUserEditedRef.current = true;
    }

    useEffect(() => {
      if (typeof setUnsavedChangesDirty === "function") {
        setUnsavedChangesDirty(!isPristine);
      }
    }, [isPristine]);

    useEffect(() => {
      return () => {
        if (typeof setUnsavedChangesDirty === "function") {
          setUnsavedChangesDirty(false);
        }
      };
    }, []);

    useEffect(() => {
      function onBeforeUnload(event) {
        if (isPristine) return;
        event.preventDefault();
        event.returnValue = "";
      }
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [isPristine]);

    const selectedSubjects = Array.isArray(menteeMatching.subjects)
      ? menteeMatching.subjects.filter((item) => String(item || "").trim())
      : [];
    const selectedMajorSubjects = useMemo(
      () => getMajorSubjectsFromSelection(selectedSubjects),
      [selectedSubjects],
    );
    const [topicOptions, setTopicOptions] = useState([]);
    const [topicGroups, setTopicGroups] = useState([]);
    const [competencyMap, setCompetencyMap] = useState({});
    const [selectedTopicIds, setSelectedTopicIds] = useState([]);
    const [selectedCompetencyIds, setSelectedCompetencyIds] = useState(
      Array.isArray(menteeMatching.competency_ids)
        ? [...menteeMatching.competency_ids]
        : [],
    );
    const [selectionLoading, setSelectionLoading] = useState(false);
    const hydrateSelectionRef = useRef(true);

    const competencyLookup = useMemo(() => {
      const map = new Map();
      Object.values(competencyMap).forEach((items) => {
        (Array.isArray(items) ? items : []).forEach((item) => {
          map.set(item.id, item);
        });
      });
      return map;
    }, [competencyMap]);
    const hasSelectedSubject = selectedMajorSubjects.length > 0;
    const needsTopics = topicOptions.length > 0;
    const needsCompetencies = selectedTopicIds.length > 0;
    const selectedTopicCount = selectedTopicIds.length;
    const selectedCompetencyCount = selectedCompetencyIds.length;
    const selectedTopicLookup = useMemo(
      () => new Map((Array.isArray(topicOptions) ? topicOptions : []).map((topic) => [topic.id, topic])),
      [topicOptions],
    );
    const hasDifficulty =
      menteeMatching.difficulty_level != null &&
      menteeMatching.difficulty_level >= 1 &&
      menteeMatching.difficulty_level <= 5;

    function applyCompetencySelection(nextIds, nextTopicIdsOverride) {
      const nextCompetencyIds = Array.from(new Set(nextIds));
      const topicIdsForState = Array.isArray(nextTopicIdsOverride)
        ? [...nextTopicIdsOverride]
        : [...selectedTopicIds];
      const nextTopicNames = topicIdsForState
        .map((topicId) => selectedTopicLookup.get(topicId))
        .filter(Boolean)
        .map((topic) => topic.name)
        .filter(Boolean);
      const previousNeeds =
        menteeMatching.competency_needs &&
        typeof menteeMatching.competency_needs === "object"
          ? menteeMatching.competency_needs
          : {};
      const defaultNeed = Number(menteeMatching.difficulty_level || 3);
      const nextNeeds = {};
      nextCompetencyIds.forEach((competencyId) => {
        const prevNeed = Number(previousNeeds[competencyId]);
        nextNeeds[competencyId] =
          Number.isFinite(prevNeed) && prevNeed >= 1 && prevNeed <= 5
            ? prevNeed
            : defaultNeed;
      });
      setSelectedCompetencyIds(nextCompetencyIds);
      setMenteeMatching((prev) => ({
        ...prev,
        competency_ids: nextCompetencyIds,
        competency_needs: nextNeeds,
        topics: nextTopicNames,
      }));
    }

    function applySelectionOptions(options) {
      const uniqueTopics = Array.isArray(options.topics) ? options.topics : [];
      setTopicOptions(uniqueTopics);
      setTopicGroups(Array.isArray(options.topicGroups) ? options.topicGroups : []);

      const topicIds = uniqueTopics.map((topic) => topic.id).filter(Boolean);
      if (!topicIds.length) {
        setCompetencyMap({});
        setSelectedTopicIds([]);
        setSelectedCompetencyIds([]);
        setMenteeMatching({
          ...menteeMatching,
          topics: [],
          competency_ids: [],
          competency_needs: {},
        });
        return;
      }

      const competencies = Array.isArray(options.competencies)
        ? options.competencies
        : [];
      const grouped = options.competenciesByTopicId || {};
      setCompetencyMap(grouped);

      if (hydrateSelectionRef.current) {
        const savedIds = new Set(
          (Array.isArray(menteeMatching.competency_ids)
            ? menteeMatching.competency_ids
            : [])
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item) && item > 0),
        );
        const nextCompetencyIds = [];
        const nextTopicIds = new Set();
        competencies.forEach((competency) => {
          if (!savedIds.has(Number(competency.id))) return;
          nextCompetencyIds.push(competency.id);
          if (competency.topic_id) nextTopicIds.add(competency.topic_id);
        });
        const hydratedTopicIds = Array.from(nextTopicIds);
        setSelectedTopicIds(hydratedTopicIds);
        applyCompetencySelection(nextCompetencyIds, hydratedTopicIds);
        hydrateSelectionRef.current = false;
      } else {
        const validTopicIds = new Set(topicIds);
        const nextTopicIds = selectedTopicIds.filter((id) =>
          validTopicIds.has(id),
        );
        const allowedCompetencyIds = new Set(
          nextTopicIds.flatMap((topicItemId) =>
            (grouped[topicItemId] || []).map((competency) => competency.id),
          ),
        );
        const nextCompetencyIds = selectedCompetencyIds.filter((id) =>
          allowedCompetencyIds.has(id),
        );
        setSelectedTopicIds(nextTopicIds);
        applyCompetencySelection(nextCompetencyIds, nextTopicIds);
      }
    }

    async function loadSelectionOptions(subjectNames) {
      if (!Array.isArray(subjectNames) || subjectNames.length === 0) {
        setTopicOptions([]);
        setTopicGroups([]);
        setCompetencyMap({});
        setSelectedTopicIds([]);
        setSelectedCompetencyIds([]);
        setMenteeMatching({
          ...menteeMatching,
          subjects: [],
          topics: [],
          competency_ids: [],
          competency_needs: {},
        });
        return;
      }

      const prefetched = SelectionCatalog.peek(subjectNames);
      if (prefetched) {
        applySelectionOptions(prefetched);
        return;
      }

      setSelectionLoading(true);
      try {
        applySelectionOptions(await SelectionCatalog.load(subjectNames));
      } finally {
        setSelectionLoading(false);
      }
    }

    useEffect(() => {
      SelectionCatalog.prefetch();
    }, []);

    useEffect(() => {
      if (!hasSelectedSubject) {
        setTopicOptions([]);
        setTopicGroups([]);
        setCompetencyMap({});
        setSelectedTopicIds([]);
        setSelectedCompetencyIds([]);
        return;
      }
      loadSelectionOptions(selectedMajorSubjects);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSelectedSubject, selectedMajorSubjects.join(",")]);

    const canSave =
      hasSelectedSubject &&
      (!needsTopics || selectedTopicCount > 0) &&
      (!needsCompetencies || selectedCompetencyCount > 0) &&
      hasDifficulty;

    const showSubjectError = submitAttempted && !hasSelectedSubject;
    const showTopicError = submitAttempted && needsTopics && selectedTopicCount === 0;
    const showCompetencyError =
      submitAttempted && needsCompetencies && selectedCompetencyCount === 0;
    const showDifficultyError = submitAttempted && !hasDifficulty;
    const progressSteps = [
      { id: "subject", label: "Subject", done: hasSelectedSubject },
      { id: "topics", label: "Topics", done: !needsTopics || selectedTopicCount > 0 },
      {
        id: "competencies",
        label: "Competencies",
        done: !needsCompetencies || selectedCompetencyCount > 0,
      },
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

    function toggleSubject(subjectName) {
      markDirty();
      const nextSubjects = selectedSubjects.includes(subjectName)
        ? selectedSubjects.filter((item) => item !== subjectName)
        : [...selectedSubjects, subjectName];
      setMenteeMatching({
        ...menteeMatching,
        subjects: nextSubjects,
      });
    }

    function toggleTopic(topic) {
      const topicId = Number(topic?.id || 0);
      if (!topicId) return;
      markDirty();
      const nextTopicIds = selectedTopicIds.includes(topicId)
        ? selectedTopicIds.filter((item) => item !== topicId)
        : [...selectedTopicIds, topicId];
      const allowedCompetencyIds = new Set(
        nextTopicIds.flatMap((topicItemId) =>
          (competencyMap[topicItemId] || []).map((competency) => competency.id),
        ),
      );
      setSelectedTopicIds(nextTopicIds);
      applyCompetencySelection(
        selectedCompetencyIds.filter((competencyId) => allowedCompetencyIds.has(competencyId)),
        nextTopicIds,
      );
    }

    function toggleCompetency(competency) {
      const competencyId = Number(competency?.id || 0);
      if (!competencyId) return;
      if (!selectedTopicIds.includes(Number(competency.topic_id || 0))) return;
      markDirty();
      const nextCompetencyIds = selectedCompetencyIds.includes(competencyId)
        ? selectedCompetencyIds.filter((item) => item !== competencyId)
        : [...selectedCompetencyIds, competencyId];
      applyCompetencySelection(nextCompetencyIds);
    }

    function isQuickAvailabilitySelected(range) {
      const slot = `${range.start}-${range.end}`;
      return Array.isArray(menteeMatching.availability)
        ? menteeMatching.availability.includes(slot)
        : false;
    }

    function applyQuickAvailability(range) {
      markDirty();
      const slot = `${range.start}-${range.end}`;
      const current = Array.isArray(menteeMatching.availability)
        ? [...menteeMatching.availability]
        : [];
      if (current.includes(slot)) {
        setMenteeMatching({
          ...menteeMatching,
          availability: current.filter((item) => item !== slot),
        });
        return;
      }

      const update = buildAvailabilityUpdate(
        current,
        { start: range.start, end: range.end },
        null,
      );
      if (!update.next) {
        setAvailabilityError(update.error || "Unable to add availability range.");
        return;
      }
      setAvailabilityError("");
      setMenteeMatching({ ...menteeMatching, availability: update.next });
    }

    async function handleSave() {
      setSubmitAttempted(true);
      let availability = Array.isArray(menteeMatching.availability)
        ? menteeMatching.availability
        : [];
      if (availabilityDraft.start && availabilityDraft.end) {
        const { error, next } = buildAvailabilityUpdate(
          availability,
          availabilityDraft,
          availabilityEditingIndex,
        );
        if (!next) {
          setAvailabilityError(error);
          return;
        }
        availability = next;
        setAvailabilityError("");
        setMenteeMatching({ ...menteeMatching, availability });
        setAvailabilityDraft({ start: "", end: "" });
        setAvailabilityEditingIndex(null);
        markDirty();
      }
      if (!canSave) return;
      const saved = await handleMenteeMatchingSave({ availability });
      if (saved) {
        hasUserEditedRef.current = false;
        savedSnapshotRef.current = serializePreferences({
          ...menteeMatching,
          availability,
        });
        setSavedAt(Date.now());
      }
    }

    function handleReset() {
      if (isPristine) return;
      try {
        const parsed = JSON.parse(savedSnapshotRef.current || "{}");
        const subjects = Array.isArray(parsed.subjects) ? parsed.subjects : [];
        const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
        const competencyIds = Array.isArray(parsed.competency_ids)
          ? parsed.competency_ids
          : [];
        const competencyNeeds =
          parsed.competency_needs && typeof parsed.competency_needs === "object"
            ? parsed.competency_needs
            : {};
        const nextTopicIds = new Set();
        competencyIds.forEach((competencyId) => {
          const competency = competencyLookup.get(competencyId);
          if (competency?.topic_id) {
            nextTopicIds.add(competency.topic_id);
          }
        });

        setMenteeMatching({
          ...menteeMatching,
          subjects,
          topics,
          competency_ids: competencyIds,
          competency_needs: competencyNeeds,
          difficulty_level:
            parsed.difficulty_level == null ? null : Number(parsed.difficulty_level),
          preferred_learning_style: parsed.preferred_learning_style || "",
          availability: Array.isArray(parsed.availability) ? parsed.availability : [],
        });
        setSelectedTopicIds(Array.from(nextTopicIds));
        setSelectedCompetencyIds(competencyIds);
        hydrateSelectionRef.current = true;
        setAvailabilityDraft({ start: "", end: "" });
        setAvailabilityEditingIndex(null);
        setAvailabilityError("");
        setSubmitAttempted(false);
        hasUserEditedRef.current = false;
      } catch (error) {
        console.warn("Unable to restore saved mentoring preferences", error);
      }
    }

    if (!ctx || !user) return null;

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

    return (
      <div
        className={
          "card mentoring-preferences-page page-shell" +
          (embedded ? " is-embedded" : "")
        }
      >
        {!embedded && (
          <header className="complete-profile-header">
            <h1 className="page-title">Mentoring preferences</h1>
            <p className="page-subtitle">
              These preferences help us find mentors that best match your academic needs.
            </p>
          </header>
        )}

        <div className="mp-layout">
          <div className="mp-main">
        <SectionCard
          title="Subject"
          description="Select every subject you want mentoring in. Topics and competencies will load for each selected subject."
        >
          <div className="mp-inline-meta" aria-live="polite">
            {selectedMajorSubjects.length} selected
          </div>
          {SubjectCategoryPicker ? (
            <SubjectCategoryPicker
              selectedSubjects={selectedSubjects}
              onToggle={toggleSubject}
              showError={showSubjectError}
            />
          ) : (
            <p className="field-helper">Subject picker is unavailable.</p>
          )}
          {showSubjectError && (
            <p className="complete-profile-error" role="alert">
              Select a subject before continuing.
            </p>
          )}
        </SectionCard>

            {hasSelectedSubject && (
              <SectionCard
                title="Topics"
                description="Select the topics connected to your selected subjects."
              >
                <div className="mp-inline-meta" aria-live="polite">
                  {selectedTopicCount} selected
                </div>
                {selectionLoading && (
                  <p className="field-helper complete-profile-helper" role="status">
                    Loading topics for the selected subject.
                  </p>
                )}
                {topicOptions.length === 0 ? (
                  <p className="field-helper complete-profile-helper" role="status">
                    No topics are defined for this subject yet.
                  </p>
                ) : topicGroups.length > 0 ? (
                  <div className="mp-competency-groups">
                    {topicGroups.map((group) => (
                      <section
                        key={group.subjectId ?? group.subjectName}
                        className="mp-competency-group"
                      >
                        <h3 className="mp-competency-group-title">{group.subjectName}</h3>
                        <div
                          className="complete-profile-topic-chips"
                          role="list"
                          aria-label={`${group.subjectName} topics`}
                        >
                          {(group.topics || []).map((topic) => {
                            const active = selectedTopicIds.includes(topic.id);
                            return (
                              <button
                                key={topic.id}
                                type="button"
                                role="listitem"
                                className={
                                  "complete-profile-topic-chip" + (active ? " is-active" : "")
                                }
                                aria-pressed={active}
                                onClick={() => toggleTopic(topic)}
                              >
                                {active ? <span className="mp-chip-check">✓</span> : null}
                                {topic.name}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="complete-profile-topic-wrap">
                    <div className="complete-profile-topic-chips" role="list" aria-label="Topic options">
                      {topicOptions.map((topic) => {
                        const active = selectedTopicIds.includes(topic.id);
                        return (
                          <button
                            key={topic.id}
                            type="button"
                            role="listitem"
                            className={
                              "complete-profile-topic-chip" + (active ? " is-active" : "")
                            }
                            aria-pressed={active}
                            onClick={() => toggleTopic(topic)}
                          >
                            {active ? <span className="mp-chip-check">✓</span> : null}
                            {topic.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {showTopicError && (
                  <p className="complete-profile-error" role="alert">
                    Select at least one topic.
                  </p>
                )}
              </SectionCard>
            )}

            {selectedTopicCount > 0 && (
              <SectionCard
                title="Competencies"
                description="Select the specific competencies you want help with under each chosen topic."
              >
                <div className="mp-inline-meta" aria-live="polite">
                  {selectedCompetencyCount} selected
                </div>
                <div className="mp-competency-groups">
                  {selectedTopicIds.map((topicId) => {
                    const topic = selectedTopicLookup.get(topicId);
                    const competencies = competencyMap[topicId] || [];
                    if (!topic) return null;
                    return (
                      <section key={topicId} className="mp-competency-group">
                        <h3 className="mp-competency-group-title">{topic.name}</h3>
                        <div
                          className="complete-profile-topic-chips"
                          role="list"
                          aria-label={`${topic.name} competencies`}
                        >
                          {competencies.length > 0 ? (
                            competencies.map((competency) => {
                              const active = selectedCompetencyIds.includes(competency.id);
                              return (
                                <button
                                  key={competency.id}
                                  type="button"
                                  role="listitem"
                                  className={
                                    "complete-profile-topic-chip" +
                                    (active ? " is-active" : "")
                                  }
                                  aria-pressed={active}
                                  title={competency.description || competency.name}
                                  onClick={() => toggleCompetency(competency)}
                                >
                                  {active ? <span className="mp-chip-check">✓</span> : null}
                                  <span>{competency.name}</span>
                                </button>
                              );
                            })
                          ) : (
                            <p className="field-helper complete-profile-helper" role="status">
                              No competencies are defined for this topic yet.
                            </p>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
                {showCompetencyError && (
                  <p className="complete-profile-error" role="alert">
                    Select at least one competency.
                  </p>
                )}
              </SectionCard>
            )}

            <SectionCard
              title="Learning Style"
              description="Optional: share your preferred learning style to improve mentor compatibility."
            >
              <div className="form-group">
                <label htmlFor="mentee-learning-style">Preferred learning style</label>
                <input
                  id="mentee-learning-style"
                  value={menteeMatching.preferred_learning_style || ""}
                  onChange={(e) => {
                    markDirty();
                    setMenteeMatching({
                      ...menteeMatching,
                      preferred_learning_style: e.target.value,
                    });
                  }}
                  placeholder="e.g., visual, hands-on, guided practice"
                />
              </div>
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
                      onClick={() => {
                        markDirty();
                        setMenteeMatching({
                          ...menteeMatching,
                          difficulty_level: option.value,
                        });
                      }}
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
                    markDirty();
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
                              markDirty();
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
                <dd>{selectedTopicCount}</dd>
              </div>
              <div className="mp-preview-row">
                <dt>Competencies Selected</dt>
                <dd>{selectedCompetencyCount}</dd>
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

        {(!isPristine || justSaved) && (
        <div
          className={
            "mp-sticky-bar" +
            (justSaved && isPristine ? " is-saved" : " is-dirty")
          }
          role="status"
        >
          <div className="mp-sticky-meta">
            <p className="mp-sticky-title">
              {justSaved && isPristine ? "Saved" : "Unsaved changes"}
            </p>
            <p className="mp-sticky-subtitle">
              {justSaved && isPristine
                ? "Your mentoring preferences were updated."
                : "Save to keep these updates, or discard to revert."}
            </p>
            {submitAttempted && !canSave && !isPristine && (
              <p className="complete-profile-error complete-profile-error-summary" role="alert">
                {needsTopics
                  ? needsCompetencies
                    ? "Select a subject, a topic, a competency, and a difficulty level before saving."
                    : "Select a subject, a topic, and a difficulty level before saving."
                  : "Select at least one subject and a difficulty level before saving."}
              </p>
            )}
          </div>
          {!(justSaved && isPristine) && (
          <div className="mp-sticky-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={handleReset}
              disabled={menteeMatchingSaving}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleSave}
              disabled={menteeMatchingSaving}
            >
              {menteeMatchingSaving
                ? "Saving..."
                : embedded
                  ? "Save & finish"
                  : "Save"}
            </button>
          </div>
          )}
        </div>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentoring-preferences"] = MentoringPreferencesPage;
})();
