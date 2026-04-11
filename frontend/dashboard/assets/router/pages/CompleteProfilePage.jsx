(function () {
  "use strict";
  const React = window.React;
  const { useContext, useMemo, useState } = React;
  const AppContext = window.DashboardApp.AppContext;

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

  function completionPercent(steps) {
    if (!steps.length) return 0;
    const done = steps.filter((step) => step.done).length;
    return Math.round((done / steps.length) * 100);
  }

  function textOrFallback(value, fallback = "Not set") {
    const text = String(value || "").trim();
    return text || fallback;
  }

  function GeneralInfoCard({ user, mentorProfile }) {
    const fullName = textOrFallback(
      user.full_name ||
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.display_name,
      "Not available",
    );

    const items = [
      { label: "Full name", value: fullName },
      { label: "Email", value: textOrFallback(user.email, "Not available") },
      { label: "Program", value: textOrFallback(mentorProfile.program) },
      {
        label: "Year level",
        value: mentorProfile.year_level ? `Year ${mentorProfile.year_level}` : "Not set",
      },
    ];

    return (
      <div className="complete-profile-general-grid" role="list">
        {items.map((item) => (
          <article
            key={item.label}
            className="complete-profile-info-item"
            role="listitem"
          >
            <p className="complete-profile-info-label">{item.label}</p>
            <p className="complete-profile-info-value">{item.value}</p>
          </article>
        ))}
      </div>
    );
  }

  function CompleteProfilePage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;

    const {
      user,
      menteeProfile,
      setMenteeProfile,
      menteeProfileSaving,
      handleMenteeProfileSave,
      mentorProfile,
      setMentorProfile,
      mentorProfileSaving,
      handleMentorProfileSave,
    } = ctx;

    const isMentee = user.role === "mentee";
    const isMentor = user.role === "mentor";

    const SUBJECT_OPTIONS =
      (window.DashboardApp && window.DashboardApp.MENTOR_SUBJECT_OPTIONS) || [];
    const TOPIC_OPTIONS =
      (window.DashboardApp && window.DashboardApp.MENTOR_TOPIC_OPTIONS) || [];

    const getAllowedTopicsForSubjects =
      window.DashboardApp.getAllowedTopicsForSubjects || (() => []);
    const filterTopicsForSubjects =
      window.DashboardApp.filterTopicsForSubjects ||
      ((subjects, topics) => (Array.isArray(topics) ? [...topics] : []));

    const [submitAttempted, setSubmitAttempted] = useState(false);

    const selectedSubjects = Array.isArray(mentorProfile.subjects)
      ? [...mentorProfile.subjects]
      : [];

    const allowedTopics = useMemo(
      () => getAllowedTopicsForSubjects(selectedSubjects),
      [getAllowedTopicsForSubjects, selectedSubjects],
    );

    const selectedTopics = filterTopicsForSubjects(
      selectedSubjects,
      mentorProfile.topics || [],
    );

    const topicsEnabled = selectedSubjects.length > 0;
    const hasExpertise =
      mentorProfile.expertise_level != null &&
      mentorProfile.expertise_level >= 1 &&
      mentorProfile.expertise_level <= 5;

    const mentorProgressSteps = [
      {
        id: "general",
        label: "General information",
        done: !!(user.email && (user.full_name || user.display_name || user.username)),
      },
      {
        id: "subjects",
        label: "Subjects selected",
        done: selectedSubjects.length > 0,
      },
      {
        id: "topics",
        label: "Topics selected",
        done: selectedTopics.length > 0,
      },
      {
        id: "expertise",
        label: "Expertise level",
        done: hasExpertise,
      },
    ];

    const profileCompletion = completionPercent(mentorProgressSteps);
    const canSubmitMentor =
      selectedSubjects.length > 0 && selectedTopics.length > 0 && hasExpertise;

    const expertiseLevel = EXPERTISE_LEVELS.find(
      (level) => level.value === mentorProfile.expertise_level,
    );

    const showSubjectError = submitAttempted && selectedSubjects.length === 0;
    const showTopicError = submitAttempted && selectedTopics.length === 0;
    const showExpertiseError = submitAttempted && !hasExpertise;

    function toggleSubject(subject) {
      const nextSubjects = selectedSubjects.includes(subject)
        ? selectedSubjects.filter((item) => item !== subject)
        : [...selectedSubjects, subject];

      setMentorProfile({
        ...mentorProfile,
        subjects: nextSubjects,
        topics: filterTopicsForSubjects(nextSubjects, selectedTopics),
      });
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
    }

    async function handleMentorSubmit() {
      setSubmitAttempted(true);
      if (!canSubmitMentor) return;
      await handleMentorProfileSave();
    }

    return (
      <div className="card complete-profile-page">
        <header className="complete-profile-header">
          <h1 className="page-title">Complete your profile</h1>
          <p className="page-subtitle complete-profile-subtitle">
            {isMentee
              ? "Coordinator approval requires your general information. Complete each field, then submit."
              : "Coordinator approval requires a complete mentor profile. Fill all required sections and submit for review."}
          </p>
        </header>

        {isMentor && (
          <section
            className="complete-profile-progress"
            aria-label="Profile completion progress"
          >
            <div className="complete-profile-progress-head">
              <p className="complete-profile-progress-title">
                Profile Completion: {profileCompletion}%
              </p>
              <span className="complete-profile-progress-meta">
                {mentorProgressSteps.filter((step) => step.done).length}/
                {mentorProgressSteps.length} sections done
              </span>
            </div>

            <progress
              className="complete-profile-progress-bar"
              value={profileCompletion}
              max={100}
              aria-label="Profile completion percentage"
            />

            <ul
              className="complete-profile-progress-steps"
              aria-label="Completion checklist"
            >
              {mentorProgressSteps.map((step) => (
                <li
                  key={step.id}
                  className={
                    "complete-profile-progress-step" +
                    (step.done ? " is-done" : "")
                  }
                >
                  {step.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {isMentee && (
          <SectionCard
            title="General Information"
            description="Provide complete student details for coordinator review."
          >
            <div className="form-grid complete-profile-mentee-grid">
              <div className="form-group">
                <label htmlFor="complete-profile-campus">Campus *</label>
                <input
                  id="complete-profile-campus"
                  value={menteeProfile.campus}
                  onChange={(e) =>
                    setMenteeProfile({
                      ...menteeProfile,
                      campus: e.target.value,
                    })
                  }
                  placeholder="Campus"
                />
              </div>

              <div className="form-group">
                <label htmlFor="complete-profile-student-id">Student ID No. *</label>
                <input
                  id="complete-profile-student-id"
                  value={menteeProfile.student_id_no}
                  onChange={(e) =>
                    setMenteeProfile({
                      ...menteeProfile,
                      student_id_no: e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 10),
                    })
                  }
                  placeholder="10 digits only"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                />
              </div>

              <div className="form-group">
                <label htmlFor="complete-profile-program">Course / Program</label>
                <input
                  id="complete-profile-program"
                  value="BSIT"
                  readOnly
                  disabled
                />
              </div>

              <div className="form-group">
                <label htmlFor="complete-profile-year-level">Year level</label>
                <input
                  id="complete-profile-year-level"
                  type="text"
                  value="1st Year"
                  readOnly
                  disabled
                />
              </div>

              <div className="form-group">
                <label htmlFor="complete-profile-contact">Contact No. *</label>
                <input
                  id="complete-profile-contact"
                  value={menteeProfile.contact_no}
                  onChange={(e) =>
                    setMenteeProfile({
                      ...menteeProfile,
                      contact_no: e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 11),
                    })
                  }
                  placeholder="11 digits only"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                />
              </div>

              <div className="form-group">
                <label htmlFor="complete-profile-admission">Admission Type *</label>
                <select
                  id="complete-profile-admission"
                  value={menteeProfile.admission_type || ""}
                  onChange={(e) =>
                    setMenteeProfile({
                      ...menteeProfile,
                      admission_type: e.target.value,
                    })
                  }
                >
                  <option value="">Select admission type</option>
                  <option value="regular">Regular</option>
                  <option value="transferee">Transferee</option>
                  <option value="shiftee">Shiftee</option>
                  <option value="returnee">Returnee</option>
                  <option value="irregular">Irregular</option>
                  {menteeProfile.admission_type &&
                    ![
                      "regular",
                      "transferee",
                      "shiftee",
                      "returnee",
                      "irregular",
                    ].includes(String(menteeProfile.admission_type).toLowerCase()) && (
                      <option value={menteeProfile.admission_type}>
                        {menteeProfile.admission_type}
                      </option>
                    )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="complete-profile-sex">Sex *</label>
                <select
                  id="complete-profile-sex"
                  value={menteeProfile.sex || ""}
                  onChange={(e) =>
                    setMenteeProfile({
                      ...menteeProfile,
                      sex: e.target.value,
                    })
                  }
                >
                  <option value="">Select biological sex</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div className="btn-row complete-profile-actions">
              <button
                className="btn"
                onClick={handleMenteeProfileSave}
                disabled={menteeProfileSaving}
              >
                {menteeProfileSaving
                  ? "Saving..."
                  : "Save & Submit for Approval"}
              </button>
            </div>
          </SectionCard>
        )}

        {isMentor && (
          <div className="complete-profile-mentor-flow">
            <SectionCard
              title="General Information"
              description="Review your account and academic context before submitting for approval."
            >
              <GeneralInfoCard user={user} mentorProfile={mentorProfile} />
            </SectionCard>

            <SectionCard
              title="Subjects Selection"
              description="Choose all subjects you can confidently mentor."
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
                        "complete-profile-subject-card" +
                        (active ? " is-active" : "")
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
                  Select at least one subject before submitting.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Topics Selection"
              description="Pick topic areas that match your selected subjects."
            >
              <div className="complete-profile-inline-meta" aria-live="polite">
                <span>{selectedTopics.length} selected</span>
              </div>

              <div
                className={
                  "complete-profile-topic-wrap" +
                  (topicsEnabled ? "" : " is-disabled")
                }
                aria-disabled={!topicsEnabled}
              >
                <div
                  className="complete-profile-topic-chips"
                  role="list"
                  aria-label="Topic options"
                >
                  {TOPIC_OPTIONS.map((topic) => {
                    const disabled = !topicsEnabled || !allowedTopics.includes(topic);
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
                            ? "Select at least one matching subject to enable this topic"
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
                  Select one or more subjects first to unlock matching topics.
                </p>
              )}

              {showTopicError && (
                <p className="complete-profile-error" role="alert">
                  Select at least one topic before submitting.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Expertise Level"
              description="Select the level that best represents your mentoring confidence."
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
                      onClick={() =>
                        setMentorProfile({
                          ...mentorProfile,
                          expertise_level: level.value,
                        })
                      }
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
                  Select your expertise level before submitting.
                </p>
              )}
            </SectionCard>

            <div className="complete-profile-submit-row">
              <button
                className="btn complete-profile-submit-btn"
                onClick={handleMentorSubmit}
                disabled={mentorProfileSaving || !canSubmitMentor}
                aria-disabled={mentorProfileSaving || !canSubmitMentor}
              >
                {mentorProfileSaving
                  ? "Saving..."
                  : "Save & Submit for Approval"}
              </button>

              {!canSubmitMentor && submitAttempted && (
                <p
                  className="complete-profile-error complete-profile-error-summary"
                  role="alert"
                >
                  Complete all required sections before submitting for approval.
                </p>
              )}
            </div>
          </div>
        )}

        {!isMentee && !isMentor && (
          <SectionCard
            title="Profile Setup"
            description="No editable profile section is available for your role."
          >
            <p className="field-helper">
              Please contact an administrator if you believe this is incorrect.
            </p>
          </SectionCard>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["complete-profile"] = CompleteProfilePage;
})();
