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
      description:
        "Can mentor complex scenarios and advanced project decisions.",
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
        label: "Mentor type",
        value:
          mentorProfile.role === "Instructor"
            ? "Instructor"
            : mentorProfile.role === "Senior IT Student"
              ? "Student mentor"
              : textOrFallback(mentorProfile.role, "Not set"),
      },
    ];
    if (mentorProfile.role === "Senior IT Student") {
      items.push({
        label: "Year level",
        value: mentorProfile.year_level
          ? Number(mentorProfile.year_level) === 3
            ? "3rd year"
            : Number(mentorProfile.year_level) === 4
              ? "4th year"
              : `Year ${mentorProfile.year_level}`
          : "Not set",
      });
    }

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

  const ACCOUNT_PROGRAMS = [
    { value: "BSIT", label: "BSIT — Information Technology" },
    { value: "BSCS", label: "BSCS — Computer Science" },
  ];
  const ACCOUNT_YEARS = [
    { value: 1, label: "1st Year" },
    { value: 2, label: "2nd Year" },
    { value: 3, label: "3rd Year" },
    { value: 4, label: "4th Year" },
  ];
  const ACCOUNT_INTERESTS = [
    "UI/UX Design",
    "Web Development",
    "Data Science",
    "Machine Learning",
    "Mobile Development",
    "Cybersecurity",
    "Cloud Computing",
    "Database",
    "Algorithms",
    "DevOps",
  ];

  function FieldError({ show, children }) {
    if (!show) return null;
    return (
      <p className="cp-onboard-error" role="alert">
        {children}
      </p>
    );
  }

  function AccountOnboardingForm({ ctx }) {
    const user = ctx.user;
    const isMentor = user.role === "mentor";
    const isMentee = user.role === "mentee";
    const menteeProfile = ctx.menteeProfile || {};
    const mentorProfile = ctx.mentorProfile || {};
    const saving = !!(ctx.completeProfileSaving);
    const Utils = (window.DashboardApp && window.DashboardApp.Utils) || {};
    const getAvatarInitials = Utils.getAvatarInitials || (() => "?");
    const initialTrack =
      mentorProfile.role === "Instructor"
        ? "faculty"
        : mentorProfile.role === "Senior IT Student"
          ? "student"
          : isMentee
            ? "student"
            : "";
    const [form, setForm] = useState({
      track: initialTrack,
      student_id_no:
        menteeProfile.student_id_no || mentorProfile.student_id_no || "",
      program: menteeProfile.program || mentorProfile.program || "BSIT",
      year_level: Number(menteeProfile.year_level || mentorProfile.year_level || 0),
      campus: menteeProfile.campus || "",
      contact_no: menteeProfile.contact_no || "",
      admission_type: menteeProfile.admission_type || "",
      sex: menteeProfile.sex || "",
      interests: Array.isArray(user.tags) ? [...user.tags] : [],
    });
    const [errors, setErrors] = useState({});
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const displayName =
      user.full_name ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.display_name ||
      user.email ||
      "PeerLink user";
    const initials = getAvatarInitials(displayName, user.email);
    const isGoogle = user.auth_provider === "google";

    function updateField(key, value) {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    function toggleInterest(name) {
      setForm((prev) => {
        const selected = prev.interests.includes(name)
          ? prev.interests.filter((item) => item !== name)
          : [...prev.interests, name];
        return { ...prev, interests: selected };
      });
      setErrors((prev) => {
        if (!prev.interests) return prev;
        const next = { ...prev };
        delete next.interests;
        return next;
      });
    }

    function validate() {
      const next = {};
      if (isMentor && form.track !== "student" && form.track !== "faculty") {
        next.track = "Choose Student or Faculty / Instructor.";
      }
      if (!String(form.student_id_no || "").trim()) {
        next.student_id_no = "Enter your institutional or student ID.";
      }
      if (isMentor && !form.program) {
        next.program = "Select your department or program.";
      }
      if (
        isMentor &&
        form.track !== "faculty" &&
        ![1, 2, 3, 4].includes(Number(form.year_level))
      ) {
        next.year_level = "Select your year level.";
      }
      if (!form.interests.length) {
        next.interests = "Select at least one mentoring interest.";
      }
      if (isMentee) {
        if (!form.campus) next.campus = "Select your campus.";
        if (String(form.contact_no || "").replace(/\D/g, "").length < 11) {
          next.contact_no = "Enter an 11-digit contact number.";
        }
        if (!form.sex) next.sex = "Select your sex.";
      }
      return next;
    }

    async function handleSubmit(event) {
      event.preventDefault();
      setSubmitAttempted(true);
      const nextErrors = validate();
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
      const result = await ctx.handleCompleteProfileSave({
        track: isMentee ? "student" : form.track,
        student_id_no: form.student_id_no,
        program: isMentee ? "BSIT" : form.program,
        year_level: isMentee
          ? 1
          : form.track === "faculty"
            ? 4
            : Number(form.year_level),
        campus: form.campus,
        contact_no: form.contact_no,
        sex: form.sex,
        interests: form.interests,
      });
      if (result && !result.ok) {
        setErrors(result.errors || {});
      }
    }

    const showYear = form.track !== "faculty";

    return (
      <div className="cp-onboard">
        <div className="cp-onboard-card">
          <div className="cp-onboard-progress" aria-label="Setup progress">
            <div className="cp-onboard-progress-meta">
              <span>Step 1 of 2</span>
              <span>Account details</span>
            </div>
            <div className="cp-onboard-progress-track">
              <span className="cp-onboard-progress-fill is-current" />
              <span className="cp-onboard-progress-fill" />
            </div>
          </div>

          <header className="cp-onboard-header">
            <p className="cp-onboard-eyebrow">Welcome to PeerLink</p>
            <h1 className="cp-onboard-title">
              Let&apos;s finish setting up your account.
            </h1>
            <p className="cp-onboard-copy">
              Google only shared your name and email. Add the school details we
              need before you can use the dashboard.
            </p>
          </header>

          <section className="cp-onboard-identity" aria-label="Google account">
            <div className="cp-onboard-avatar">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div>
              <p className="cp-onboard-identity-name">{displayName}</p>
              <p className="cp-onboard-identity-email">{user.email}</p>
              <p className="cp-onboard-identity-meta">
                {isGoogle ? "Signed in with Google" : "Account email"} · read-only
              </p>
            </div>
          </section>

          <form className="cp-onboard-form" onSubmit={handleSubmit} noValidate>
            {isMentor && (
              <fieldset className="cp-onboard-field">
                <legend>Role *</legend>
                <div className="cp-onboard-role-grid">
                  {[
                    {
                      id: "student",
                      title: "Student",
                      detail: "Senior IT student mentor",
                    },
                    {
                      id: "faculty",
                      title: "Faculty / Instructor",
                      detail: "Faculty member mentoring students",
                    },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={
                        "cp-onboard-role-card" +
                        (form.track === option.id ? " is-active" : "")
                      }
                      aria-pressed={form.track === option.id}
                      onClick={() => updateField("track", option.id)}
                    >
                      <strong>{option.title}</strong>
                      <span>{option.detail}</span>
                    </button>
                  ))}
                </div>
                <FieldError show={submitAttempted && errors.track}>
                  {errors.track}
                </FieldError>
              </fieldset>
            )}

            {isMentee && (
              <div className="cp-onboard-field">
                <label>Role</label>
                <p className="cp-onboard-locked">Student mentee</p>
              </div>
            )}

            {submitAttempted && Object.keys(errors).length > 0 && (
              <p className="cp-onboard-error cp-onboard-error-banner" role="alert">
                {errors.interests ||
                  "Some required fields still need a value. Check the highlighted items."}
              </p>
            )}

            <fieldset className="cp-onboard-field">
              <legend>Primary mentoring goals / interests *</legend>
              <div className="cp-onboard-chips">
                {ACCOUNT_INTERESTS.map((name) => {
                  const active = form.interests.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      className={
                        "cp-onboard-chip" + (active ? " is-active" : "")
                      }
                      aria-pressed={active}
                      onClick={() => toggleInterest(name)}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <FieldError show={submitAttempted && errors.interests}>
                {errors.interests}
              </FieldError>
            </fieldset>

            <div className="cp-onboard-grid">
              <div className="cp-onboard-field">
                <label htmlFor="cp-student-id">Institutional / Student ID *</label>
                <input
                  id="cp-student-id"
                  value={form.student_id_no}
                  onChange={(e) =>
                    updateField("student_id_no", e.target.value.slice(0, 20))
                  }
                  placeholder="2023-XXXX"
                />
                <FieldError show={submitAttempted && errors.student_id_no}>
                  {errors.student_id_no}
                </FieldError>
              </div>

              {isMentee ? (
                <div className="cp-onboard-field">
                  <label>Department / Program</label>
                  <p className="cp-onboard-locked">BSIT</p>
                </div>
              ) : (
                <div className="cp-onboard-field">
                  <label htmlFor="cp-program">Department / Program *</label>
                  <select
                    id="cp-program"
                    value={form.program}
                    onChange={(e) => updateField("program", e.target.value)}
                  >
                    <option value="">Select program</option>
                    {ACCOUNT_PROGRAMS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <FieldError show={submitAttempted && errors.program}>
                    {errors.program}
                  </FieldError>
                </div>
              )}

              {isMentee ? (
                <div className="cp-onboard-field">
                  <label>Year level</label>
                  <p className="cp-onboard-locked">1st Year</p>
                </div>
              ) : showYear ? (
                <div className="cp-onboard-field">
                  <label htmlFor="cp-year">Year level *</label>
                  <select
                    id="cp-year"
                    value={form.year_level || ""}
                    onChange={(e) =>
                      updateField("year_level", Number(e.target.value))
                    }
                  >
                    <option value="">Select year</option>
                    {ACCOUNT_YEARS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <FieldError show={submitAttempted && errors.year_level}>
                    {errors.year_level}
                  </FieldError>
                </div>
              ) : (
                <div className="cp-onboard-field">
                  <label>Position</label>
                  <p className="cp-onboard-locked">Faculty / Instructor</p>
                </div>
              )}

              {isMentee && (
                <>
                  <div className="cp-onboard-field">
                    <label htmlFor="cp-campus">Campus *</label>
                    <select
                      id="cp-campus"
                      value={form.campus}
                      onChange={(e) => updateField("campus", e.target.value)}
                    >
                      <option value="">Select campus</option>
                      {(
                        (window.DashboardApp &&
                          window.DashboardApp.CAMPUS_OPTIONS) ||
                        []
                      ).map((campus) => (
                        <option key={campus} value={campus}>
                          {campus}
                        </option>
                      ))}
                    </select>
                    <FieldError show={submitAttempted && errors.campus}>
                      {errors.campus}
                    </FieldError>
                  </div>
                  <div className="cp-onboard-field">
                    <label htmlFor="cp-contact">Contact No. *</label>
                    <input
                      id="cp-contact"
                      value={form.contact_no}
                      onChange={(e) =>
                        updateField(
                          "contact_no",
                          e.target.value.replace(/\D/g, "").slice(0, 11),
                        )
                      }
                      placeholder="11 digits"
                      inputMode="numeric"
                    />
                    <FieldError show={submitAttempted && errors.contact_no}>
                      {errors.contact_no}
                    </FieldError>
                  </div>
                  <div className="cp-onboard-field">
                    <label htmlFor="cp-sex">Sex *</label>
                    <select
                      id="cp-sex"
                      value={form.sex}
                      onChange={(e) => updateField("sex", e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <FieldError show={submitAttempted && errors.sex}>
                      {errors.sex}
                    </FieldError>
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              className="cp-onboard-submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save and continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  function CompleteProfilePage(props) {
    const embedded = !!(props && props.embedded);
    const ctx = useContext(AppContext);
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const user = ctx && ctx.user;
    const menteeProfile = (ctx && ctx.menteeProfile) || {};
    const setMenteeProfile = ctx && ctx.setMenteeProfile;
    const menteeProfileSaving = !!(ctx && ctx.menteeProfileSaving);
    const handleMenteeProfileSave = ctx && ctx.handleMenteeProfileSave;
    const mentorProfile = (ctx && ctx.mentorProfile) || {};
    const setMentorProfile = ctx && ctx.setMentorProfile;
    const mentorProfileSaving = !!(ctx && ctx.mentorProfileSaving);
    const handleMentorProfileSave = ctx && ctx.handleMentorProfileSave;

    const isMentee = !!(user && user.role === "mentee");
    const isMentor = !!(user && user.role === "mentor");

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

    const selectedSubjects = Array.isArray(mentorProfile.subjects)
      ? [...mentorProfile.subjects]
      : [];
    const subjectOptions =
      (window.DashboardApp && window.DashboardApp.MENTOR_SUBJECT_OPTIONS) || [];

    const allowedTopics = useMemo(
      () => getAllowedTopicsForSubjects(selectedSubjects),
      [getAllowedTopicsForSubjects, selectedSubjects],
    );

    const selectedTopics = filterTopicsForSubjects(
      selectedSubjects,
      mentorProfile.topics || [],
    );
    const majorSubjects = getMajorSubjectsFromSelection(selectedSubjects);
    const topicsEnabled = majorSubjects.length > 0;
    const needsTopics = selectionRequiresTopics(selectedSubjects);
    const hasExpertise =
      mentorProfile.expertise_level != null &&
      mentorProfile.expertise_level >= 1 &&
      mentorProfile.expertise_level <= 5;

    const visibleTopicOptions = useMemo(
      () => (topicsEnabled ? [...allowedTopics] : []),
      [allowedTopics, topicsEnabled],
    );
    const topicsSignature = useMemo(
      () => visibleTopicOptions.join("|"),
      [visibleTopicOptions],
    );

    if (!ctx || !user) return null;
    if (user.is_profile_complete === false && ctx.handleCompleteProfileSave) {
      return <AccountOnboardingForm ctx={ctx} />;
    }

    const mentorProgressSteps = [
      {
        id: "general",
        label: "General information",
        done: !!(
          user.email &&
          (user.full_name || user.display_name || user.username)
        ),
      },
      {
        id: "subjects",
        label: "Subjects selected",
        done: selectedSubjects.length > 0,
      },
      {
        id: "topics",
        label: "Competencies selected",
        done: !needsTopics || selectedTopics.length > 0,
      },
      {
        id: "expertise",
        label: "Expertise level",
        done: hasExpertise,
      },
    ];

    const profileCompletion = completionPercent(mentorProgressSteps);
    const canSubmitMentor =
      selectedSubjects.length > 0 &&
      (!needsTopics || selectedTopics.length > 0) &&
      hasExpertise;

    const expertiseLevel = EXPERTISE_LEVELS.find(
      (level) => level.value === mentorProfile.expertise_level,
    );

    const showSubjectError = submitAttempted && selectedSubjects.length === 0;
    const showTopicError =
      submitAttempted && needsTopics && selectedTopics.length === 0;
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
      <div
        className={
          "card complete-profile-page page-shell" +
          (embedded ? " is-embedded" : "")
        }
      >
        {!embedded && (
          <header className="complete-profile-header">
            <h1 className="page-title">Complete your profile</h1>
            <p className="page-subtitle complete-profile-subtitle">
              {isMentee
                ? "Coordinator approval requires your general information. Complete each field, then submit."
                : "Coordinator approval requires a complete mentor profile. Fill all required sections and submit for review."}
            </p>
          </header>
        )}

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
            <div className="form-grid complete-profile-mentee-grid responsive-form-row">
              <div className="form-group">
                <label htmlFor="complete-profile-campus">Campus *</label>
                <select
                  id="complete-profile-campus"
                  value={menteeProfile.campus || ""}
                  onChange={(e) =>
                    setMenteeProfile({
                      ...menteeProfile,
                      campus: e.target.value,
                    })
                  }
                >
                  <option value="">---------</option>
                  {(
                    (window.DashboardApp &&
                      window.DashboardApp.CAMPUS_OPTIONS) ||
                    []
                  ).map((campus) => (
                    <option key={campus} value={campus}>
                      {campus}
                    </option>
                  ))}
                  {menteeProfile.campus &&
                    !(
                      (window.DashboardApp &&
                        window.DashboardApp.CAMPUS_OPTIONS) ||
                      []
                    ).includes(menteeProfile.campus) && (
                      <option value={menteeProfile.campus}>
                        {menteeProfile.campus}
                      </option>
                    )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="complete-profile-student-id">
                  Student ID No. *
                </label>
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
                <label htmlFor="complete-profile-program">
                  Course / Program
                </label>
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
                  : embedded
                    ? "Save & continue"
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
              description="Choose major IT subjects and minor subjects (GE, NSTP, PE) you can confidently mentor."
            >
              <div className="complete-profile-inline-meta" aria-live="polite">
                <span>{selectedSubjects.length} selected</span>
              </div>

              {SubjectCategoryPicker ? (
                <SubjectCategoryPicker
                  selectedSubjects={selectedSubjects}
                  onToggle={toggleSubject}
                  showError={showSubjectError}
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
                          "complete-profile-subject-card" +
                          (active ? " is-active" : "")
                        }
                        aria-pressed={active}
                        onClick={() => toggleSubject(subject)}
                      >
                        <span className="complete-profile-subject-title">
                          {subject}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!SubjectCategoryPicker && showSubjectError && (
                <p className="complete-profile-error" role="alert">
                  Select at least one subject before submitting.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Topics Selection"
              description={
                needsTopics
                  ? "Pick topic areas that match your selected major subjects."
                  : "Competencies apply to major IT subjects. You selected only minor subjects, so competencies are optional."
              }
            >
              <div className="complete-profile-inline-meta" aria-live="polite">
                <span>{selectedTopics.length} selected</span>
              </div>

              <div
                className={
                  "complete-profile-topic-state" +
                  (topicsEnabled ? " is-ready" : " is-waiting")
                }
                aria-live="polite"
              >
                {!topicsEnabled ? (
                  <div
                    className="complete-profile-topic-placeholder"
                    role="status"
                  >
                    <p className="complete-profile-topic-placeholder-title">
                      Select a subject first
                    </p>
                    <p className="complete-profile-topic-placeholder-copy">
                      Choose at least one major IT subject to see its relevant
                      topics.
                    </p>
                  </div>
                ) : (
                  <div
                    key={topicsSignature}
                    className="complete-profile-topic-enter"
                  >
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
                      <p
                        className="field-helper complete-profile-helper"
                        role="status"
                      >
                        No topic presets found for the selected subject.
                      </p>
                    )}
                  </div>
                )}
              </div>

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
                <p
                  className="complete-profile-expertise-note"
                  aria-live="polite"
                >
                  {expertiseLevel.label}: {expertiseLevel.description}
                </p>
              ) : (
                <p
                  className="complete-profile-expertise-note"
                  aria-live="polite"
                >
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
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { CompleteProfilePage };
  }
})();
