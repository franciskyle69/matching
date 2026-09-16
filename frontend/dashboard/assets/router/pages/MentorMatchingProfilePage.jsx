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
  const getMentorRoleBadgeMeta =
    (window.DashboardApp.Utils &&
      window.DashboardApp.Utils.getMentorRoleBadgeMeta) ||
    (() => null);
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
      description:
        "Can mentor complex scenarios and advanced project decisions.",
    },
  ];

  const Availability = window.DashboardApp.Availability;
  const {
    DAY_ORDER,
    DAY_LABELS,
    MIN_AVAILABLE_TIME,
    MAX_AVAILABLE_TIME,
    parseSlot,
    formatSlotLabel,
    buildAvailabilityUpdate,
  } = Availability;

  const EXPERIENCE_BUCKETS = [
    { id: "lt1", label: "<1 yr", value: 0, min: 0, max: 0 },
    { id: "1to3", label: "1-3 yrs", value: 2, min: 1, max: 3 },
    { id: "3to5", label: "3-5 yrs", value: 4, min: 4, max: 5 },
    { id: "5plus", label: "5+ yrs", value: 6, min: 6, max: Infinity },
  ];

  function bucketForYears(years) {
    if (years == null || years === "") return null;
    const value = Number(years);
    if (!Number.isFinite(value)) return null;
    return (
      EXPERIENCE_BUCKETS.find(
        (bucket) => value >= bucket.min && value <= bucket.max,
      ) || null
    );
  }

  function serializeMentorQuestionnaire(profile) {
    return JSON.stringify({
      subjects: profile.subjects || [],
      topics: profile.topics || [],
      competency_ids: profile.competency_ids || [],
      competency_levels: profile.competency_levels || {},
      expertise_level: profile.expertise_level ?? null,
      years_experience: profile.years_experience ?? null,
      teaching_experience_years: profile.teaching_experience_years ?? null,
      capacity: profile.capacity ?? 5,
      year_level: profile.year_level ?? 0,
      availability: profile.availability || [],
    });
  }

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

  function ExperienceChipField({ label, hint, value, onChange }) {
    const activeBucket = bucketForYears(value);
    const groupId = `mp-exp-${String(label).replace(/\s+/g, "-").toLowerCase()}`;

    return (
      <div className="mp-experience-field">
        <span className="mp-field-label" id={groupId}>
          {label}
        </span>
        <div className="mp-chip-row" role="radiogroup" aria-labelledby={groupId}>
          {EXPERIENCE_BUCKETS.map((bucket) => {
            const active = activeBucket && activeBucket.id === bucket.id;
            return (
              <button
                key={bucket.id}
                type="button"
                role="radio"
                aria-checked={!!active}
                className={"mp-pill" + (active ? " is-active" : "")}
                onClick={() => onChange(active ? null : bucket.value)}
              >
                {bucket.label}
              </button>
            );
          })}
        </div>
        <p className="mp-field-hint">
          {activeBucket
            ? `${hint} Currently recorded as ${value} year${Number(value) === 1 ? "" : "s"}.`
            : hint}
        </p>
      </div>
    );
  }

  function DayPicker({ selectedDays, onToggle, onPreset }) {
    const weekdaysSelected =
      selectedDays.length === 5 &&
      selectedDays.every((day) => day !== "Sat" && day !== "Sun");
    const everyDaySelected = selectedDays.length === DAY_ORDER.length;

    return (
      <div className="mp-day-picker">
        <div className="mp-day-picker-head">
          <span className="mp-field-label" id="mp-day-picker-label">
            Days
          </span>
          <div className="mp-day-presets">
            <button
              type="button"
              className={
                "mp-day-preset" + (weekdaysSelected ? " is-active" : "")
              }
              onClick={() => onPreset(["Mon", "Tue", "Wed", "Thu", "Fri"])}
            >
              Weekdays
            </button>
            <button
              type="button"
              className={
                "mp-day-preset" + (everyDaySelected ? " is-active" : "")
              }
              onClick={() => onPreset([...DAY_ORDER])}
            >
              Every day
            </button>
          </div>
        </div>
        <div
          className="mp-day-chips"
          role="group"
          aria-labelledby="mp-day-picker-label"
        >
          {DAY_ORDER.map((day) => {
            const active = selectedDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                role="checkbox"
                aria-checked={active}
                aria-label={DAY_LABELS[day]}
                className={"mp-day-chip" + (active ? " is-active" : "")}
                onClick={() => onToggle(day)}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function MentorMatchingProfilePage(props) {
    const embedded = !!(props && props.embedded);
    const ctx = useContext(AppContext);
    const mentorProfile = (ctx && ctx.mentorProfile) || {
      subjects: [],
      topics: [],
      competency_ids: [],
      competency_levels: {},
      expertise_level: null,
      years_experience: null,
      teaching_experience_years: null,
      role: "",
      capacity: 5,
      gender: "",
      year_level: 0,
      availability: [],
    };
    const setMentorProfile = ctx && ctx.setMentorProfile;
    const mentorProfileSaving = !!(ctx && ctx.mentorProfileSaving);
    const handleMentorProfileSave = ctx && ctx.handleMentorProfileSave;
    const setUnsavedChangesDirty = ctx && ctx.setUnsavedChangesDirty;

    const [savedAt, setSavedAt] = useState(0);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [availabilityDraft, setAvailabilityDraft] = useState({
      days: [],
      start: "",
      end: "",
    });
    const [availabilityEditingIndex, setAvailabilityEditingIndex] =
      useState(null);
    const [availabilityError, setAvailabilityError] = useState("");
    const [collapsedSubjects, setCollapsedSubjects] = useState([]);
    const savedRef = useRef(serializeMentorQuestionnaire(mentorProfile));
    const hasUserEditedRef = useRef(false);

    const serializedProfile = serializeMentorQuestionnaire(mentorProfile);
    if (!hasUserEditedRef.current) {
      savedRef.current = serializedProfile;
    }
    const isPristine = savedRef.current === serializedProfile;
    const justSaved = savedAt > 0;

    useEffect(() => {
      if (!savedAt) return undefined;
      const timeoutId = window.setTimeout(() => setSavedAt(0), 2200);
      return () => window.clearTimeout(timeoutId);
    }, [savedAt]);

    function markDirty() {
      hasUserEditedRef.current = true;
      if (ctx && ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
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

    const selectedSubjects = Array.isArray(mentorProfile.subjects)
      ? mentorProfile.subjects.filter((item) => String(item || "").trim())
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
      Array.isArray(mentorProfile.competency_ids)
        ? [...mentorProfile.competency_ids]
        : [],
    );
    const [selectionLoading, setSelectionLoading] = useState(false);
    const hydrateSelectionRef = useRef(true);

    const competencyLookup = useMemo(() => {
      const map = new Map();
      Object.values(competencyMap).forEach((items) => {
        (Array.isArray(items) ? items : []).forEach((item) =>
          map.set(item.id, item),
        );
      });
      return map;
    }, [competencyMap]);
    const selectedTopicLookup = useMemo(
      () =>
        new Map(
          (Array.isArray(topicOptions) ? topicOptions : []).map((topic) => [
            topic.id,
            topic,
          ]),
        ),
      [topicOptions],
    );
    const hasSelectedSubject = selectedMajorSubjects.length > 0;
    const needsTopics = topicOptions.length > 0;
    const needsCompetencies = selectedTopicIds.length > 0;
    const selectedTopicCount = selectedTopicIds.length;
    const selectedCompetencyCount = selectedCompetencyIds.length;
    const expertiseLevel = EXPERTISE_LEVELS.find(
      (level) => level.value === mentorProfile.expertise_level,
    );

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
      const previousLevels =
        mentorProfile.competency_levels &&
        typeof mentorProfile.competency_levels === "object"
          ? mentorProfile.competency_levels
          : {};
      const defaultLevel = Number(mentorProfile.expertise_level || 3);
      const nextLevels = {};
      nextCompetencyIds.forEach((competencyId) => {
        const prevLevel = Number(previousLevels[competencyId]);
        nextLevels[competencyId] =
          Number.isFinite(prevLevel) && prevLevel >= 1 && prevLevel <= 5
            ? prevLevel
            : defaultLevel;
      });
      setSelectedCompetencyIds(nextCompetencyIds);
      setMentorProfile((prev) => ({
        ...prev,
        competency_ids: nextCompetencyIds,
        competency_levels: nextLevels,
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
        setMentorProfile({
          ...mentorProfile,
          topics: [],
          competency_ids: [],
          competency_levels: {},
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
          (Array.isArray(mentorProfile.competency_ids)
            ? mentorProfile.competency_ids
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
        setMentorProfile({
          ...mentorProfile,
          subjects: [],
          topics: [],
          competency_ids: [],
          competency_levels: {},
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
      expertiseLevel != null;

    const availabilitySummary = Array.isArray(mentorProfile.availability)
      ? mentorProfile.availability
      : [];

    /* Student mentors are ranked on expertise and competencies rather than
       years worked, so the experience questions do not apply to them. */
    const mentorRoleMeta = getMentorRoleBadgeMeta(
      mentorProfile.role || (ctx.user && ctx.user.mentor_role) || "",
    );
    const isStudentMentor = !!mentorRoleMeta && mentorRoleMeta.kind === "student";
    const showExperience = !isStudentMentor;

    const completionSteps = [
      {
        id: "subjects",
        label: "Subjects",
        done: selectedSubjects.length > 0,
        value: selectedSubjects.length || "Not set",
      },
      {
        id: "topics",
        label: "Topics",
        done: selectedTopicCount > 0,
        value: selectedTopicCount || "Not set",
      },
      {
        id: "competencies",
        label: "Competencies",
        done: selectedCompetencyCount > 0,
        value: selectedCompetencyCount || "Not set",
      },
      {
        id: "expertise",
        label: "Expertise level",
        done: expertiseLevel != null,
        value: expertiseLevel ? expertiseLevel.label : "Not set",
      },
      ...(showExperience
        ? [
            {
              id: "experience",
              label: "Experience",
              done: mentorProfile.years_experience != null,
              value:
                bucketForYears(mentorProfile.years_experience)?.label ||
                "Not set",
            },
          ]
        : []),
      {
        id: "availability",
        label: "Availability",
        done: availabilitySummary.length > 0,
        value: availabilitySummary.length
          ? `${availabilitySummary.length} range${availabilitySummary.length === 1 ? "" : "s"}`
          : "Not set",
      },
    ];
    const completedSteps = completionSteps.filter((step) => step.done).length;
    const completionPercent = Math.round(
      (completedSteps / completionSteps.length) * 100,
    );

    const showSubjectError = submitAttempted && !hasSelectedSubject;
    const showTopicError = submitAttempted && needsTopics && selectedTopicCount === 0;
    const showCompetencyError =
      submitAttempted && needsCompetencies && selectedCompetencyCount === 0;
    const showExpertiseError = submitAttempted && expertiseLevel == null;

    function toggleSubject(subjectName) {
      markDirty();
      const nextSubjects = selectedSubjects.includes(subjectName)
        ? selectedSubjects.filter((item) => item !== subjectName)
        : [...selectedSubjects, subjectName];
      setMentorProfile({
        ...mentorProfile,
        subjects: nextSubjects,
      });
    }

    function toggleSubjectPanel(groupKey) {
      setCollapsedSubjects((prev) =>
        prev.includes(groupKey)
          ? prev.filter((item) => item !== groupKey)
          : [...prev, groupKey],
      );
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
        selectedCompetencyIds.filter((competencyId) =>
          allowedCompetencyIds.has(competencyId),
        ),
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

    async function handleSave() {
      setSubmitAttempted(true);
      let availability = Array.isArray(mentorProfile.availability)
        ? mentorProfile.availability
        : [];
      if (
        availabilityDraft.days.length > 0 &&
        availabilityDraft.start &&
        availabilityDraft.end
      ) {
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
        setMentorProfile({ ...mentorProfile, availability });
        setAvailabilityDraft({ days: [], start: "", end: "" });
        setAvailabilityEditingIndex(null);
        markDirty();
      }
      if (!canSave) return;
      const saved = await handleMentorProfileSave({ availability });
      if (saved) {
        hasUserEditedRef.current = false;
        setSavedAt(Date.now());
        savedRef.current = serializeMentorQuestionnaire({
          ...mentorProfile,
          availability,
        });
      }
    }

    function handleReset() {
      if (isPristine) return;
      try {
        const parsed = JSON.parse(savedRef.current || "{}");
        const subjects = Array.isArray(parsed.subjects) ? parsed.subjects : [];
        const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
        const competencyIds = Array.isArray(parsed.competency_ids)
          ? parsed.competency_ids
          : [];
        const competencyLevels =
          parsed.competency_levels && typeof parsed.competency_levels === "object"
            ? parsed.competency_levels
            : {};
        const nextTopicIds = new Set();
        competencyIds.forEach((competencyId) => {
          const competency = competencyLookup.get(competencyId);
          if (competency?.topic_id) {
            nextTopicIds.add(competency.topic_id);
          }
        });
        setMentorProfile({
          ...mentorProfile,
          subjects,
          topics,
          competency_ids: competencyIds,
          competency_levels: competencyLevels,
          expertise_level:
            parsed.expertise_level == null ? null : Number(parsed.expertise_level),
          years_experience:
            parsed.years_experience == null
              ? null
              : Number(parsed.years_experience),
          teaching_experience_years:
            parsed.teaching_experience_years == null
              ? null
              : Number(parsed.teaching_experience_years),
          capacity: 5,
          availability: Array.isArray(parsed.availability)
            ? parsed.availability
            : [],
        });
        setSelectedTopicIds(Array.from(nextTopicIds));
        setSelectedCompetencyIds(competencyIds);
        hydrateSelectionRef.current = true;
        setAvailabilityDraft({ days: [], start: "", end: "" });
        setAvailabilityEditingIndex(null);
        setAvailabilityError("");
        setSubmitAttempted(false);
        hasUserEditedRef.current = false;
      } catch (error) {
        console.warn("Unable to restore saved mentor matching profile", error);
      }
    }

    if (!ctx || !ctx.user) return null;

    return (
      <div
        className={
          "mentoring-preferences-page mentor-matching-profile-page page-shell" +
          (embedded ? " is-embedded" : "")
        }
      >
        {!embedded && (
          <header className="kasandigan-header">
            <div className="kasandigan-header-content">
              <div className="kasandigan-badge">
                <span className="kasandigan-badge-dot" />
                <span>Academic Mentoring Unit • Mentor Profile</span>
              </div>
              <h1 className="kasandigan-title">Mentor Matching Profile</h1>
              <p className="kasandigan-subtitle">
                Keep your subjects, competencies, expertise, and availability up to date so we can recommend the right mentees for you.
              </p>
            </div>
            <div className="kasandigan-header-actions">
              <span className="kasandigan-badge">
                <span className="kasandigan-badge-dot" style={{ background: "#0ea5e9" }} />
                <span>Peer Mentor</span>
              </span>
            </div>
          </header>
        )}

        <div className="mp-layout">
          <div className="mp-main">
        <SectionCard
          title="Subject"
          description="Select every subject you can mentor. Topics and competencies will load for each selected subject."
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
              <div className="mp-subject-accordions">
                {topicGroups.map((group) => {
                  const groupTopics = group.topics || [];
                  const groupKey = String(group.subjectId ?? group.subjectName);
                  const selectedInGroup = groupTopics.filter((topic) =>
                    selectedTopicIds.includes(topic.id),
                  ).length;
                  const open = !collapsedSubjects.includes(groupKey);
                  const panelId = `mp-topics-panel-${groupKey.replace(/\W+/g, "-")}`;
                  return (
                    <section
                      key={groupKey}
                      className={
                        "mp-subject-accordion" + (open ? " is-open" : "")
                      }
                    >
                      <button
                        type="button"
                        className="mp-subject-accordion-head"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => toggleSubjectPanel(groupKey)}
                      >
                        <span className="mp-subject-accordion-chevron" aria-hidden="true">
                          ▸
                        </span>
                        <span className="mp-subject-accordion-title">
                          {group.subjectName}
                        </span>
                        <span className="mp-subject-accordion-count">
                          {selectedInGroup} / {groupTopics.length} selected
                        </span>
                      </button>
                      {open && (
                        <div
                          className="mp-subject-accordion-body"
                          id={panelId}
                          role="list"
                          aria-label={`${group.subjectName} topics`}
                        >
                          {groupTopics.map((topic) => {
                            const active = selectedTopicIds.includes(topic.id);
                            return (
                              <button
                                key={topic.id}
                                type="button"
                                role="listitem"
                                className={
                                  "mp-pill" + (active ? " is-active" : "")
                                }
                                aria-pressed={active}
                                onClick={() => toggleTopic(topic)}
                              >
                                {active ? (
                                  <span className="mp-chip-check">✓</span>
                                ) : null}
                                {topic.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="mp-chip-row" role="list" aria-label="Topic options">
                {topicOptions.map((topic) => {
                  const active = selectedTopicIds.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      role="listitem"
                      className={"mp-pill" + (active ? " is-active" : "")}
                      aria-pressed={active}
                      onClick={() => toggleTopic(topic)}
                    >
                      {active ? (
                        <span className="mp-chip-check">✓</span>
                      ) : null}
                      {topic.name}
                    </button>
                  );
                })}
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
            description="Select the specific competencies you can mentor under each chosen topic."
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
                      className="mp-chip-row"
                      role="list"
                      aria-label={`${topic.name} competencies`}
                    >
                      {competencies.length > 0 ? (
                        competencies.map((competency) => {
                          const active = selectedCompetencyIds.includes(
                            competency.id,
                          );
                          return (
                            <button
                              key={competency.id}
                              type="button"
                              role="listitem"
                              className={"mp-pill" + (active ? " is-active" : "")}
                              aria-pressed={active}
                              title={competency.description || competency.name}
                              onClick={() => toggleCompetency(competency)}
                            >
                              {active ? (
                                <span className="mp-chip-check">✓</span>
                              ) : null}
                              <span>{competency.name}</span>
                            </button>
                          );
                        })
                      ) : (
                        <p
                          className="field-helper complete-profile-helper"
                          role="status"
                        >
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
                    "complete-profile-expertise-option" +
                    (active ? " is-active" : "")
                  }
                  onClick={() => {
                    setMentorProfile({
                      ...mentorProfile,
                      expertise_level: level.value,
                    });
                    markDirty();
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
          {showExpertiseError && (
            <p className="complete-profile-error" role="alert">
              Select your expertise level before saving.
            </p>
          )}
        </SectionCard>

        {showExperience && (
          <SectionCard
            title="Experience"
            description="Pick the range that matches your background. This improves ranking quality."
          >
            <div className="mp-experience-grid">
              <ExperienceChipField
                label="Years of experience"
                hint="Overall time working in these subjects."
                value={mentorProfile.years_experience}
                onChange={(next) => {
                  setMentorProfile({
                    ...mentorProfile,
                    years_experience: next,
                  });
                  markDirty();
                }}
              />
              <ExperienceChipField
                label="Teaching experience"
                hint="Time spent tutoring, demonstrating, or teaching."
                value={mentorProfile.teaching_experience_years}
                onChange={(next) => {
                  setMentorProfile({
                    ...mentorProfile,
                    teaching_experience_years: next,
                  });
                  markDirty();
                }}
              />
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Available time"
          description="Pick the days you can meet, then a time range between 7:00 AM and 10:00 PM."
        >
          <div className="mp-availability-composer">
            <DayPicker
              selectedDays={availabilityDraft.days}
              onToggle={(day) => {
                setAvailabilityError("");
                setAvailabilityDraft((prev) => ({
                  ...prev,
                  days: prev.days.includes(day)
                    ? prev.days.filter((item) => item !== day)
                    : DAY_ORDER.filter(
                        (item) => item === day || prev.days.includes(item),
                      ),
                }));
              }}
              onPreset={(days) => {
                setAvailabilityError("");
                setAvailabilityDraft((prev) => {
                  const same =
                    prev.days.length === days.length &&
                    days.every((day) => prev.days.includes(day));
                  return { ...prev, days: same ? [] : days };
                });
              }}
            />
            <div className="time-range-row responsive-form-row">
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
          </div>
          <div className="btn-row mp-availability-actions">
            <button
              type="button"
              className="btn secondary small"
              disabled={
                availabilityDraft.days.length === 0 ||
                !availabilityDraft.start ||
                !availabilityDraft.end
              }
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
                setAvailabilityDraft({ days: [], start: "", end: "" });
                setAvailabilityEditingIndex(null);
                markDirty();
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
                  setAvailabilityDraft({ days: [], start: "", end: "" });
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
            You can add multiple ranges. We&apos;ll match you with people whose
            days and times overlap yours.
          </p>
          {Array.isArray(mentorProfile.availability) &&
            mentorProfile.availability.length > 0 && (
              <div className="availability-list mp-availability-list" aria-live="polite">
                {mentorProfile.availability.map((slot, idx) => (
                  <div
                    key={`${slot}-${idx}`}
                    className={
                      "availability-item mp-availability-item" +
                      (availabilityEditingIndex === idx ? " is-editing" : "")
                    }
                  >
                    <span className="availability-item-label">
                      {formatSlotLabel(slot)}
                    </span>
                    <div className="availability-item-actions">
                      <button
                        type="button"
                        className="availability-action-btn"
                        onClick={() => {
                          const parsed = parseSlot(slot);
                          if (!parsed) return;
                          setAvailabilityDraft({
                            days: parsed.hasExplicitDays
                              ? [...parsed.days]
                              : [...DAY_ORDER],
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
                            setAvailabilityDraft({ days: [], start: "", end: "" });
                          } else if (
                            availabilityEditingIndex != null &&
                            availabilityEditingIndex > idx
                          ) {
                            setAvailabilityEditingIndex(
                              availabilityEditingIndex - 1,
                            );
                          }
                          markDirty();
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

          <aside className="mp-preview matching-card">
            <h3 className="mp-preview-title">Your Matching Profile</h3>

            <div className="mp-progress">
              <div className="mp-progress-head">
                <span className="mp-progress-value">
                  {completionPercent}% Complete
                </span>
                <span className="mp-progress-meta">
                  {completedSteps} of {completionSteps.length}
                </span>
              </div>
              <div
                className="mp-progress-track"
                role="progressbar"
                aria-valuenow={completionPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Profile completeness"
              >
                <div
                  className="mp-progress-fill"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <dl className="mp-preview-list">
              {completionSteps.map((step) => (
                <div
                  key={step.id}
                  className={
                    "mp-preview-row" + (step.done ? " is-done" : "")
                  }
                >
                  <dt>
                    <span className="mp-preview-check" aria-hidden="true">
                      {step.done ? "✓" : "○"}
                    </span>
                    {step.label}
                  </dt>
                  <dd>{step.value}</dd>
                </div>
              ))}
            </dl>

            {availabilitySummary.length > 0 && (
              <ul className="mp-preview-slots">
                {availabilitySummary.map((slot, idx) => (
                  <li key={`${slot}-${idx}`}>{formatSlotLabel(slot)}</li>
                ))}
              </ul>
            )}

            <div className="mp-preview-actions">
              <button
                type="button"
                className="btn mp-save-preferences"
                onClick={handleSave}
                disabled={mentorProfileSaving}
              >
                {mentorProfileSaving
                  ? "Saving…"
                  : embedded
                    ? "Save & finish"
                    : "Save Preferences"}
              </button>
              {!isPristine && (
                <button
                  type="button"
                  className="btn secondary small mp-preview-discard"
                  onClick={handleReset}
                  disabled={mentorProfileSaving}
                >
                  Discard changes
                </button>
              )}
              <p className="mp-preview-status" aria-live="polite">
                {justSaved && isPristine
                  ? "All changes saved."
                  : isPristine
                    ? "No unsaved changes."
                    : "You have unsaved changes."}
              </p>
            </div>
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
                ? "Your mentor matching profile was updated."
                : "Use Save Preferences in the summary panel to keep these updates."}
            </p>
            {submitAttempted && !canSave && !isPristine && (
              <p
                className="complete-profile-error complete-profile-error-summary"
                role="alert"
              >
                {needsTopics
                  ? needsCompetencies
                    ? "Select a subject, a topic, a competency, and an expertise level before saving."
                    : "Select a subject, a topic, and an expertise level before saving."
                  : "Select at least one subject and an expertise level before saving."}
              </p>
            )}
          </div>
        </div>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentor-matching-profile"] =
    MentorMatchingProfilePage;
})();
