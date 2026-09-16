import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DeleteIcon from "@mui/icons-material/Delete";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import TextField from "@mui/material/TextField";

(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useMemo, useRef, useState } = React;
  const AppContext = window.DashboardApp.AppContext;

  const SubjectCategoryPicker =
    window.DashboardApp && window.DashboardApp.SubjectCategoryPicker;
  const SelectionCatalog =
    window.DashboardApp && window.DashboardApp.SelectionCatalog;
  const getMajorSubjectsFromSelection =
    window.DashboardApp.getMajorSubjectsFromSelection || ((s) => s || []);

  const TimePickerField =
    window.DashboardApp && window.DashboardApp.TimePickerField;
  const formatTimeLabel =
    (window.DashboardApp && window.DashboardApp.formatTimeLabel) ||
    ((hhmm) => String(hhmm || ""));

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

  const CAMPUS_TZ_LABEL = "UTC+08:00 (Manila / Singapore)";
  const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const WEEKDAY_TO_TOKEN = WEEKDAYS.reduce((acc, label) => {
    const token = DAY_ORDER.find((day) => DAY_LABELS[day] === label);
    if (token) acc[label] = token;
    return acc;
  }, {});

  function slotDateLabel(slot) {
    const parsed = parseSlot(slot);
    if (!parsed || !parsed.days.length) return "Every day";
    if (parsed.days.length === 1) {
      return `${DAY_LABELS[parsed.days[0]] || parsed.days[0]} (weekly)`;
    }
    return `${parsed.days.map((day) => DAY_LABELS[day] || day).join(", ")} (weekly)`;
  }

  function slotTimeLabel(slot) {
    const parsed = parseSlot(slot);
    if (!parsed) return formatSlotLabel(slot);
    return `${formatTimeLabel(parsed.start)} – ${formatTimeLabel(parsed.end)}`;
  }

  function AvailabilitySection({
    slots,
    selectedDay,
    startTime,
    endTime,
    error,
    onSelectedDayChange,
    onStartTimeChange,
    onEndTimeChange,
    onAddSlot,
    onRemoveSlot,
  }) {
    return (
      <>
        <span className="pref-timezone pref-timezone--inline">
          🌐 Local timezone: {CAMPUS_TZ_LABEL}
        </span>
        <div className="pref-avail-builder responsive-form-row">
          <TextField
            select
            label="Select day"
            value={selectedDay}
            onChange={(event) => onSelectedDayChange(event.target.value)}
            fullWidth
            size="small"
            className="pref-day-field"
            slotProps={{
              select: { displayEmpty: true },
              inputLabel: { shrink: true },
            }}
          >
            <MenuItem value="">
              Select day
            </MenuItem>
            {WEEKDAYS.map((day) => (
              <MenuItem key={day} value={day}>
                {day}
              </MenuItem>
            ))}
          </TextField>
          {TimePickerField ? (
            <>
              <TimePickerField
                id="pref-avail-start"
                label="Start time"
                value={startTime}
                min={MIN_AVAILABLE_TIME}
                max={MAX_AVAILABLE_TIME}
                onChange={(event) => onStartTimeChange(event.target.value)}
              />
              <TimePickerField
                id="pref-avail-end"
                label="End time"
                value={endTime}
                min={MIN_AVAILABLE_TIME}
                max={MAX_AVAILABLE_TIME}
                onChange={(event) => onEndTimeChange(event.target.value)}
              />
            </>
          ) : (
            <>
              <TextField
                label="Start time"
                type="time"
                value={startTime}
                onChange={(event) => onStartTimeChange(event.target.value)}
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                inputProps={{ min: MIN_AVAILABLE_TIME, max: MAX_AVAILABLE_TIME, step: 60 }}
              />
              <TextField
                label="End time"
                type="time"
                value={endTime}
                onChange={(event) => onEndTimeChange(event.target.value)}
                fullWidth
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                inputProps={{ min: MIN_AVAILABLE_TIME, max: MAX_AVAILABLE_TIME, step: 60 }}
              />
            </>
          )}
          <Button
            variant="contained"
            className="pref-add-slot-btn mobile-full-width"
            onClick={onAddSlot}
            disabled={!selectedDay || !startTime || !endTime}
          >
            Add slot
          </Button>
        </div>
        {error ? (
          <p className="complete-profile-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="pref-avail-slot-list" aria-live="polite">
          {!Array.isArray(slots) || slots.length === 0 ? (
            <p className="pref-slot-empty">
              No availability added yet. Select a weekday and time range above.
            </p>
          ) : (
            slots.map((slot, index) => (
              <div key={slot + "-" + index} className="availability-slot-row">
                <div className="availability-slot-main">
                  <span className="availability-slot-date">
                    <CalendarTodayIcon className="availability-slot-icon" aria-hidden="true" />
                    {slotDateLabel(slot)}
                  </span>
                  <span className="availability-slot-time">
                    <AccessTimeIcon className="availability-slot-icon" aria-hidden="true" />
                    {slotTimeLabel(slot)}
                  </span>
                </div>
                <IconButton
                  size="small"
                  className="availability-slot-remove"
                  aria-label="Remove availability slot"
                  onClick={() => onRemoveSlot(index)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  const DIFFICULTY_OPTIONS = [
    {
      value: 1,
      label: "Minor Help",
      helper: "You mostly feel on track and only need occasional check-ins.",
    },
    {
      value: 2,
      label: "Minor Help",
      helper: "You understand the basics but need guidance on tougher concepts.",
    },
    {
      value: 3,
      label: "Moderate Mentorship",
      helper: "You often need mentor support to stay on pace and build confidence.",
    },
    {
      value: 4,
      label: "Intensive Support",
      helper: "You need consistent, structured support to keep progressing.",
    },
    {
      value: 5,
      label: "Intensive Support",
      helper: "You need immediate, frequent help to avoid falling behind.",
    },
  ];

  function getGroupedSupportLabel(level) {
    const n = Number(level);
    if (!n || n < 1) return "Not set";
    if (n <= 2) return "Minor Help";
    if (n === 3) return "Moderate Mentorship";
    return "Intensive Support";
  }

  function SectionCard({ title, description, children }) {
    return (
      <section className="mp-section pref-section-card preferences-card">
        <h2 className="preferences-card-title">{title}</h2>
        {description ? (
          <p className="preferences-card-subtitle">{description}</p>
        ) : null}
        {children}
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

  function MentoringPreferencesPage(props) {
    const embedded = !!(props && props.embedded);
    const ctx = useContext(AppContext);
    const user = ctx && ctx.user;
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

    const savedSnapshotRef = useRef(serializePreferences(menteeMatching));
    const hasUserEditedRef = useRef(false);
    const [savedAt, setSavedAt] = useState(0);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [availabilityError, setAvailabilityError] = useState("");
    const [selectedDay, setSelectedDay] = useState("");
    const [availStartTime, setAvailStartTime] = useState("09:00");
    const [availEndTime, setAvailEndTime] = useState("10:00");

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
    const [collapsedSubjects, setCollapsedSubjects] = useState([]);
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

    const selectedDifficulty = DIFFICULTY_OPTIONS.find(
      (item) => item.value === Number(menteeMatching.difficulty_level),
    );
    const selectedSlots = Array.isArray(menteeMatching.availability)
      ? menteeMatching.availability
      : [];
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

    function setSupportNeed(value) {
      markDirty();
      setMenteeMatching({
        ...menteeMatching,
        difficulty_level: Number(value),
      });
    }

    function handleAddAvailabilitySlot() {
      markDirty();
      if (!selectedDay || !availStartTime || !availEndTime) {
        setAvailabilityError("Select a day, start time, and end time.");
        return;
      }
      const dayToken = WEEKDAY_TO_TOKEN[selectedDay];
      if (!dayToken) {
        setAvailabilityError("Select a valid weekday.");
        return;
      }
      const update = buildAvailabilityUpdate(
        selectedSlots,
        { days: [dayToken], start: availStartTime, end: availEndTime },
        null,
      );
      if (!update.next) {
        setAvailabilityError(update.error || "Unable to add that slot.");
        return;
      }
      setAvailabilityError("");
      setMenteeMatching({ ...menteeMatching, availability: update.next });
      setSelectedDay("");
    }

    function removeAvailabilitySlot(index) {
      markDirty();
      const next = selectedSlots.filter((_, itemIndex) => itemIndex !== index);
      setMenteeMatching({ ...menteeMatching, availability: next });
    }

    async function handleSave() {
      setSubmitAttempted(true);
      const availability = Array.isArray(menteeMatching.availability)
        ? menteeMatching.availability
        : [];
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
        setSelectedDay("");
        setAvailStartTime("09:00");
        setAvailEndTime("10:00");
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
        <div className="mentoring-preferences-page page-shell">
          <h1 className="page-title">Mentoring Preferences</h1>
          <p className="page-subtitle">
            This page is available for student accounts only.
          </p>
        </div>
      );
    }

    return (
      <div
        className={
          "mentoring-preferences-page page-shell" +
          (embedded ? " is-embedded" : "")
        }
      >
        {!embedded && (
          <header className="kasandigan-header">
            <div className="kasandigan-header-content">
              <div className="kasandigan-badge">
                <span className="kasandigan-badge-dot" />
                <span>Academic Mentoring Unit • Preferences</span>
              </div>
              <h1 className="kasandigan-title">Mentoring Preferences</h1>
              <p className="kasandigan-subtitle">
                Set the criteria, subjects, and topics we use to match you with mentors.
              </p>
            </div>
            <div className="kasandigan-header-actions">
              <span className="kasandigan-badge kasandigan-badge--role">
                <span className="kasandigan-badge-dot" />
                <span>Student Mentee</span>
              </span>
            </div>
          </header>
        )}

        <div className="pref-stack">
          <SectionCard
            title="Mentorship role & support need"
            description="Tell us how much mentoring support you need so we can match you with the right mentor."
          >
            <div className="pref-role-row" role="group" aria-label="Mentorship role">
              <span className="pref-role-pill is-active">Mentee (learning)</span>
            </div>
            <div className="pref-slider-label">
              <span>Support need</span>
              <span className="pref-slider-level">
                {getGroupedSupportLabel(menteeMatching.difficulty_level)}
              </span>
            </div>
            <Slider
              className="pref-slider"
              min={1}
              max={5}
              step={1}
              marks={DIFFICULTY_OPTIONS.map((option) => ({
                value: option.value,
                label: String(option.value),
              }))}
              value={menteeMatching.difficulty_level || 1}
              onChange={(_, value) => setSupportNeed(value)}
              aria-label="Support need"
              aria-valuetext={
                selectedDifficulty
                  ? `Level ${selectedDifficulty.value}, ${selectedDifficulty.label}`
                  : "Support need not set"
              }
            />
            <div
              className="pref-support-levels"
              role="list"
              aria-label="Support level descriptions"
            >
              {DIFFICULTY_OPTIONS.map((option) => {
                const active =
                  option.value === Number(menteeMatching.difficulty_level || 1);
                return (
                  <div
                    key={option.value}
                    className={
                      "pref-support-level-item" + (active ? " is-active" : "")
                    }
                    role="listitem"
                    aria-current={active ? "true" : undefined}
                  >
                    <span className="pref-support-level-num">{option.value}</span>
                    <div className="pref-support-level-copy">
                      <span className="pref-support-level-title">
                        {option.label}
                      </span>
                      <p className="pref-support-level-desc">{option.helper}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {showDifficultyError && (
              <p className="complete-profile-error" role="alert">
                Select a support need before saving.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Subject & competency alignment"
            description="Browse and select the subjects, topics, and competencies you want help with."
          >
            <div className="pref-browse-section">
              <p className="pref-field-label">Subjects</p>
              {SubjectCategoryPicker ? (
                <SubjectCategoryPicker
                  selectedSubjects={selectedSubjects}
                  onToggle={toggleSubject}
                  showError={showSubjectError}
                />
              ) : (
                <p className="field-helper">Subject picker is unavailable.</p>
              )}
            </div>

            {hasSelectedSubject && (
              <div className="pref-field-gap pref-browse-section">
                <p className="pref-field-label">Topics</p>
                {selectionLoading && (
                  <p className="field-helper complete-profile-helper" role="status">
                    Loading topics for the selected subjects.
                  </p>
                )}
                {!selectionLoading && topicOptions.length === 0 ? (
                  <p className="field-helper complete-profile-helper" role="status">
                    No topics are defined for these subjects yet.
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
                      const panelId = `pref-topics-panel-${groupKey.replace(/\W+/g, "-")}`;
                      return (
                        <section
                          key={groupKey}
                          className={"mp-subject-accordion" + (open ? " is-open" : "")}
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
                          {active ? <span className="mp-chip-check">✓</span> : null}
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
              </div>
            )}

            {selectedTopicCount > 0 && (
              <div className="pref-field-gap pref-browse-section">
                <p className="pref-field-label">Competencies</p>
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
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Availability"
            description="Set your recurring weekly availability for mentoring sessions."
          >
            <AvailabilitySection
              slots={selectedSlots}
              selectedDay={selectedDay}
              startTime={availStartTime}
              endTime={availEndTime}
              error={availabilityError}
              onSelectedDayChange={setSelectedDay}
              onStartTimeChange={setAvailStartTime}
              onEndTimeChange={setAvailEndTime}
              onAddSlot={handleAddAvailabilitySlot}
              onRemoveSlot={removeAvailabilitySlot}
            />
          </SectionCard>
        </div>

        <div
          className={
            "mp-sticky-bar pref-save-bar" +
            (justSaved && isPristine
              ? " is-saved"
              : !isPristine
                ? " is-dirty"
                : "")
          }
          role="status"
        >
          <div className="mp-sticky-meta">
            <p className="mp-sticky-title">
              {justSaved && isPristine
                ? "Saved"
                : !isPristine
                  ? "Unsaved changes"
                  : "Ready to save"}
            </p>
            <p className="mp-sticky-subtitle">
              {justSaved && isPristine
                ? "Your mentoring preferences were updated."
                : "Save to keep these updates, or reset to the last saved version."}
            </p>
            {submitAttempted && !canSave && !isPristine && (
              <p
                className="complete-profile-error complete-profile-error-summary"
                role="alert"
              >
                Finish subjects, topics, competencies, and support need before saving.
              </p>
            )}
          </div>
          <div className="mp-sticky-actions">
            <Button
              variant="text"
              className="pref-save-reset"
              onClick={handleReset}
              disabled={menteeMatchingSaving || isPristine}
            >
              Reset to last saved
            </Button>
            <Button
              variant="contained"
              className="pref-save-primary"
              onClick={handleSave}
              disabled={menteeMatchingSaving}
            >
              {menteeMatchingSaving
                ? "Saving..."
                : embedded
                  ? "Save & finish"
                  : "Save preferences"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentoring-preferences"] = MentoringPreferencesPage;
})();
