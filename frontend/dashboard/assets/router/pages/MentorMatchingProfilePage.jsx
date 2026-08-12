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

  const MIN_AVAILABLE_TIME = "07:00";
  const MAX_AVAILABLE_TIME = "22:00";

  function serializeMentorQuestionnaire(profile) {
    return JSON.stringify({
      subjects: profile.subjects || [],
      topics: profile.topics || [],
      competency_ids: profile.competency_ids || [],
      competency_levels: profile.competency_levels || {},
      expertise_level: profile.expertise_level ?? null,
      years_experience: profile.years_experience ?? null,
      teaching_experience_years: profile.teaching_experience_years ?? null,
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
    if (
      startMinutes == null ||
      endMinutes == null ||
      startMinutes >= endMinutes
    ) {
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
        error:
          "Choose a valid range where start time is earlier than end time.",
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
      subjectsData,
      mentorProfileSaving,
      handleMentorProfileSave,
    } = ctx;
    const Utils = window.DashboardApp.Utils || {};
    const fetchJSON = Utils.fetchJSON;

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

    const selectedSubjectName = Array.isArray(mentorProfile.subjects)
      ? String(mentorProfile.subjects[0] || "").trim()
      : "";
    const selectedSubject =
      subjectsData.find((subject) => subject.name === selectedSubjectName) ||
      null;
    const subjectOptions = useMemo(
      () =>
        [...(Array.isArray(subjectsData) ? subjectsData : [])]
          .filter((subject) => String(subject.category || "major") === "major")
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
      [subjectsData],
    );
    const [topicOptions, setTopicOptions] = useState([]);
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
    const hasSelectedSubject = !!selectedSubjectName;
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
        .map((topicId) => topicOptions.find((topic) => topic.id === topicId))
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

    async function loadSelectionOptions(subjectId) {
      if (!subjectId) {
        setTopicOptions([]);
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
      setSelectionLoading(true);
      try {
        const topicsResult = await fetchJSON(
          `/api/topics/?subject_id=${subjectId}`,
        );
        const topics =
          topicsResult.ok && Array.isArray(topicsResult.data?.items)
            ? topicsResult.data.items
            : [];
        setTopicOptions(topics);
        const topicIds = topics.map((topic) => topic.id).filter(Boolean);
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
        const competenciesResult = await fetchJSON(
          `/api/competencies/?topic_ids=${topicIds.join(",")}`,
        );
        const competencies =
          competenciesResult.ok && Array.isArray(competenciesResult.data?.items)
            ? competenciesResult.data.items
            : [];
        const grouped = {};
        competencies.forEach((competency) => {
          const topicId = Number(competency.topic_id || 0);
          if (!topicId) return;
          if (!grouped[topicId]) grouped[topicId] = [];
          grouped[topicId].push(competency);
        });
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
        }
      } finally {
        setSelectionLoading(false);
      }
    }

    useEffect(() => {
      if (!hasSelectedSubject || !selectedSubject) {
        setTopicOptions([]);
        setCompetencyMap({});
        setSelectedTopicIds([]);
        setSelectedCompetencyIds([]);
        return;
      }
      loadSelectionOptions(selectedSubject.id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSelectedSubject, selectedSubject?.id]);

    const canSave =
      hasSelectedSubject &&
      (!needsTopics || selectedTopicCount > 0) &&
      (!needsCompetencies || selectedCompetencyCount > 0) &&
      expertiseLevel != null;

    const showSubjectError = false;
    const showTopicError = false;
    const showCompetencyError = false;
    const showExpertiseError = false;

    function handleSubjectChange(nextSubjectName) {
      hydrateSelectionRef.current = false;
      setTopicOptions([]);
      setCompetencyMap({});
      setSelectedTopicIds([]);
      setSelectedCompetencyIds([]);
      setMentorProfile({
        ...mentorProfile,
        subjects: nextSubjectName ? [nextSubjectName] : [],
        topics: [],
        competency_ids: [],
        competency_levels: {},
      });
      if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
    }

    function toggleTopic(topic) {
      const topicId = Number(topic?.id || 0);
      if (!topicId) return;
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
      if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
    }

    function toggleCompetency(competency) {
      const competencyId = Number(competency?.id || 0);
      if (!competencyId) return;
      if (!selectedTopicIds.includes(Number(competency.topic_id || 0))) return;
      const nextCompetencyIds = selectedCompetencyIds.includes(competencyId)
        ? selectedCompetencyIds.filter((item) => item !== competencyId)
        : [...selectedCompetencyIds, competencyId];
      applyCompetencySelection(nextCompetencyIds);
      if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
    }

    function setCompetencyLevel(competencyId, level) {
      const nextLevel = Number(level);
      if (!Number.isFinite(nextLevel) || nextLevel < 1 || nextLevel > 5) return;
      setMentorProfile((prev) => ({
        ...prev,
        competency_levels: {
          ...(prev.competency_levels && typeof prev.competency_levels === "object"
            ? prev.competency_levels
            : {}),
          [competencyId]: nextLevel,
        },
      }));
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
            Keep your subjects, competencies, expertise, capacity, and
            availability up to date so we can recommend the right mentees for
            you.
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
                if (ctx.mentorProfilePristine)
                  ctx.mentorProfilePristine = false;
              }}
            >
              <option value="">Select role</option>
              <option value="Senior IT Student">Senior IT Student</option>
              <option value="Instructor">Instructor</option>
            </select>
          </div>
        </SectionCard>

        <SectionCard
          title="Subject"
          description="Select one subject first. Topics and competencies will load from the database for that subject."
        >
          <div className="form-group">
            <label htmlFor="mentor-subject">Subject</label>
            <select
              id="mentor-subject"
              value={selectedSubjectName}
              onChange={(event) => handleSubjectChange(event.target.value)}
            >
              <option value="">Select a subject</option>
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.name}>
                  {subject.code
                    ? `${subject.code} · ${subject.name}`
                    : subject.name}
                </option>
              ))}
            </select>
          </div>
        </SectionCard>

        {hasSelectedSubject && (
          <SectionCard
            title="Topics"
            description="Select the topics connected to the chosen subject."
          >
            <div className="complete-profile-inline-meta" aria-live="polite">
              <span>{selectedTopicCount} selected</span>
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
            ) : (
              <div className="complete-profile-topic-wrap">
                <div
                  className="complete-profile-topic-chips"
                  role="list"
                  aria-label="Topic options"
                >
                  {topicOptions.map((topic) => {
                    const active = selectedTopicIds.includes(topic.id);
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        role="listitem"
                        className={
                          "complete-profile-topic-chip" +
                          (active ? " is-active" : "")
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
              </div>
            )}
          </SectionCard>
        )}

        {selectedTopicCount > 0 && (
          <SectionCard
            title="Competencies"
            description="Select the specific competencies you want help with under each chosen topic."
          >
            <div className="complete-profile-inline-meta" aria-live="polite">
              <span>{selectedCompetencyCount} selected</span>
            </div>
            <div className="mp-competency-groups">
              {selectedTopicIds.map((topicId) => {
                const topic = topicOptions.find((item) => item.id === topicId);
                const competencies = competencyMap[topicId] || [];
                if (!topic) return null;
                return (
                  <section key={topicId} className="mp-competency-group">
                    <h3 className="mp-competency-group-title">{topic.name}</h3>
                    <div
                      className="mp-competency-grid"
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
                              className={
                                "mp-competency-chip" +
                                (active ? " is-active" : "")
                              }
                              aria-pressed={active}
                              title={competency.description || competency.name}
                              onClick={() => toggleCompetency(competency)}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                readOnly
                                tabIndex={-1}
                              />
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
            {selectedCompetencyCount > 0 && (
              <div className="form-grid">
                {selectedCompetencyIds.map((competencyId) => {
                  const competency = competencyLookup.get(competencyId);
                  if (!competency) return null;
                  const value =
                    mentorProfile.competency_levels &&
                    mentorProfile.competency_levels[competencyId] != null
                      ? mentorProfile.competency_levels[competencyId]
                      : mentorProfile.expertise_level || 3;
                  return (
                    <div key={competencyId} className="form-group">
                      <label htmlFor={`mentor-competency-level-${competencyId}`}>
                        {competency.name} proficiency
                      </label>
                      <select
                        id={`mentor-competency-level-${competencyId}`}
                        value={value}
                        onChange={(event) =>
                          setCompetencyLevel(competencyId, event.target.value)
                        }
                      >
                        <option value={1}>1 - Beginner</option>
                        <option value={2}>2 - Novice</option>
                        <option value={3}>3 - Intermediate</option>
                        <option value={4}>4 - Advanced</option>
                        <option value={5}>5 - Expert</option>
                      </select>
                    </div>
                  );
                })}
              </div>
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
                    if (ctx.mentorProfilePristine)
                      ctx.mentorProfilePristine = false;
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
                if (ctx.mentorProfilePristine)
                  ctx.mentorProfilePristine = false;
              }}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Experience"
          description="Provide experience details to improve ranking quality."
        >
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="mentor-years-experience">Years of experience</label>
              <input
                id="mentor-years-experience"
                type="number"
                min={0}
                max={50}
                value={mentorProfile.years_experience ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMentorProfile({
                    ...mentorProfile,
                    years_experience:
                      raw === "" ? null : Math.max(0, Math.min(50, Number(raw))),
                  });
                  if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
                }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="mentor-teaching-years">
                Teaching experience (years)
              </label>
              <input
                id="mentor-teaching-years"
                type="number"
                min={0}
                max={50}
                value={mentorProfile.teaching_experience_years ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMentorProfile({
                    ...mentorProfile,
                    teaching_experience_years:
                      raw === "" ? null : Math.max(0, Math.min(50, Number(raw))),
                  });
                  if (ctx.mentorProfilePristine) ctx.mentorProfilePristine = false;
                }}
              />
            </div>
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
                if (ctx.mentorProfilePristine)
                  ctx.mentorProfilePristine = false;
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
                if (ctx.mentorProfilePristine)
                  ctx.mentorProfilePristine = false;
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
                          if (ctx.mentorProfilePristine)
                            ctx.mentorProfilePristine = false;
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
  window.DashboardApp.Pages["mentor-matching-profile"] =
    MentorMatchingProfilePage;
})();
