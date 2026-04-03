(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const { getCookie, fetchJSON, DashboardIcon } =
    window.DashboardApp.Utils || {};

  const BIO_MAX = 200;
  const MAX_TAGS = 8;
  const getAllowedTopicsForSubjects =
    window.DashboardApp.getAllowedTopicsForSubjects || (() => []);
  const filterTopicsForSubjects =
    window.DashboardApp.filterTopicsForSubjects ||
    ((subjects, topics) => (Array.isArray(topics) ? [...topics] : []));

  /** Inline pencil (always visible; avoids cache/missing DashboardIcon on Bio card) */
  function BioInterestsHeaderIcon() {
    return (
      <svg
        className="settings-bio-header-icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    );
  }

  function BioAndInterestsCard({ bio, tags, onBioSave, onTagsSave }) {
    const [bioText, setBioText] = useState(bio);
    const [bioSaving, setBioSaving] = useState(false);
    const [localTags, setLocalTags] = useState(tags);
    const [tagInput, setTagInput] = useState("");
    const [tagsSaving, setTagsSaving] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [tagError, setTagError] = useState("");
    const suggestionsRef = useRef(null);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
      setBioText(bio);
    }, [bio]);
    useEffect(() => {
      setLocalTags(tags);
    }, [tags]);

    useEffect(() => {
      function handleClickOutside(e) {
        if (
          suggestionsRef.current &&
          !suggestionsRef.current.contains(e.target) &&
          inputRef.current &&
          !inputRef.current.contains(e.target)
        ) {
          setShowSuggestions(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleTagInputChange(value) {
      setTagInput(value);
      setTagError("");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length > 0) {
        debounceRef.current = setTimeout(async () => {
          const res = await fetchJSON(
            `/api/tags/suggestions/?q=${encodeURIComponent(value.trim())}`,
          );
          if (res.ok) {
            const existing = new Set(localTags.map((t) => t.toLowerCase()));
            setSuggestions(
              (res.data.suggestions || []).filter(
                (s) => !existing.has(s.toLowerCase()),
              ),
            );
            setShowSuggestions(true);
          }
        }, 250);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }

    function addTag(name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (localTags.length >= MAX_TAGS) {
        setTagError("Maximum " + MAX_TAGS + " tags allowed.");
        return;
      }
      if (localTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        setTagError("Tag already added.");
        return;
      }
      setLocalTags([...localTags, trimmed]);
      setTagInput("");
      setSuggestions([]);
      setShowSuggestions(false);
      setTagError("");
    }

    function removeTag(idx) {
      setLocalTags(localTags.filter((_, i) => i !== idx));
      setTagError("");
    }

    function handleTagKeyDown(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag(tagInput);
      }
    }

    async function saveBio() {
      setBioSaving(true);
      await onBioSave(bioText);
      setBioSaving(false);
    }

    async function saveTags() {
      setTagsSaving(true);
      await onTagsSave(localTags);
      setTagsSaving(false);
    }

    const bioChanged = bioText !== bio;
    const tagsChanged = JSON.stringify(localTags) !== JSON.stringify(tags);

    return (
      <div className="settings-card settings-card--bio">
        <div className="settings-card-header">
          <div className="settings-card-header-main">
            <div className="settings-card-icon">
              <BioInterestsHeaderIcon />
            </div>
            <div>
              <h2
                className="section-title"
                style={{ borderBottom: "none", paddingBottom: 0 }}
              >
                Bio & Interests
              </h2>
              <p className="page-subtitle settings-card-subtitle-tight">
                Tell others about yourself and what you&apos;re interested in.
              </p>
            </div>
          </div>
        </div>

        <div className="settings-bio-section">
          <div className="settings-section-label">Bio</div>
          <div className="form-group settings-bio-form-group">
            <textarea
              className="bio-textarea"
              value={bioText}
              onChange={(e) => setBioText(e.target.value.slice(0, BIO_MAX))}
              placeholder="Write a short bio about yourself..."
              rows={4}
              maxLength={BIO_MAX}
            />
            <div className="settings-bio-toolbar">
              <div className="bio-char-count">
                <span
                  className={
                    bioText.length > BIO_MAX - 20 ? "bio-char-warn" : ""
                  }
                >
                  {bioText.length}
                </span>
                /{BIO_MAX}
              </div>
              <button
                type="button"
                className="btn small"
                onClick={saveBio}
                disabled={bioSaving || !bioChanged}
              >
                {bioSaving
                  ? "Saving\u2026"
                  : bioChanged
                    ? "Save bio"
                    : "No changes"}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-bio-divider" role="presentation" />

        <div className="settings-tags-section">
          <div className="settings-section-label">Interests / Tags</div>
          <p className="field-helper settings-tags-helper">
            Add up to {MAX_TAGS} tags. Type and press Enter or select from
            suggestions.
          </p>

          <div className="tag-input-container">
            <div className="tag-input-pills">
              {localTags.map((t, i) => (
                <span key={t + i} className="sp-tag-pill sp-tag-pill--editable">
                  {t}
                  <button
                    type="button"
                    className="sp-tag-remove"
                    onClick={() => removeTag(i)}
                    aria-label={"Remove " + t}
                  >
                    &times;
                  </button>
                </span>
              ))}
              {localTags.length < MAX_TAGS && (
                <input
                  ref={inputRef}
                  type="text"
                  className="tag-input-field"
                  value={tagInput}
                  onChange={(e) => handleTagInputChange(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onFocus={() => {
                    if (tagInput.trim()) setShowSuggestions(true);
                  }}
                  placeholder={
                    localTags.length === 0
                      ? "e.g. Python, Web Dev, UI/UX"
                      : "Add tag\u2026"
                  }
                />
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="tag-suggestions" ref={suggestionsRef}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="tag-suggestion-item"
                    onClick={() => addTag(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {tagError && <p className="sp-file-error">{tagError}</p>}

          <div className="settings-tags-toolbar">
            <button
              type="button"
              className="btn small"
              onClick={saveTags}
              disabled={tagsSaving || !tagsChanged}
            >
              {tagsSaving
                ? "Saving\u2026"
                : tagsChanged
                  ? "Save interests"
                  : "No changes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function SettingsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      user,
      settingsForm,
      setSettingsForm,
      settingsSaving,
      handleSettingsSave,
      handleBioSave,
      handleTagsSave,
      handleAvatarChange,
      avatarUploading,
      menteeProfile,
      setMenteeProfile,
      menteeProfileSaving,
      handleMenteeProfileSave,
      mentorProfile,
      setMentorProfile,
      mentorProfileSaving,
      handleMentorProfileSave,
      menteeMatching,
      setMenteeMatching,
      menteeMatchingSaving,
      handleMenteeMatchingSave,
    } = ctx;

    const [mentorProfileSavedAt, setMentorProfileSavedAt] = useState(0);
    const [menteeMatchingSavedAt, setMenteeMatchingSavedAt] = useState(0);
    const [mentorAvailabilityError, setMentorAvailabilityError] = useState("");
    const [menteeAvailabilityError, setMenteeAvailabilityError] = useState("");

    const mentorProfilePristine =
      !user.mentor_questionnaire_completed && mentorProfileSavedAt === 0
        ? true
        : mentorProfileSavedAt !== 0 &&
          JSON.stringify({
            subjects: mentorProfile.subjects || [],
            topics: mentorProfile.topics || [],
            expertise_level: mentorProfile.expertise_level ?? null,
            role: mentorProfile.role || "",
            capacity: mentorProfile.capacity ?? 3,
            gender: mentorProfile.gender || "",
            availability: mentorProfile.availability || [],
          }) ===
            JSON.stringify({
              subjects: mentorProfile.subjects || [],
              topics: mentorProfile.topics || [],
              expertise_level: mentorProfile.expertise_level ?? null,
              role: mentorProfile.role || "",
              capacity: mentorProfile.capacity ?? 3,
              gender: mentorProfile.gender || "",
              availability: mentorProfile.availability || [],
            });

    const menteeMatchingPristine =
      !user.mentee_questionnaire_completed && menteeMatchingSavedAt === 0
        ? true
        : menteeMatchingSavedAt !== 0 &&
          JSON.stringify({
            subjects: menteeMatching.subjects || [],
            topics: menteeMatching.topics || [],
            difficulty_level: menteeMatching.difficulty_level ?? null,
            availability: menteeMatching.availability || [],
          }) ===
            JSON.stringify({
              subjects: menteeMatching.subjects || [],
              topics: menteeMatching.topics || [],
              difficulty_level: menteeMatching.difficulty_level ?? null,
              availability: menteeMatching.availability || [],
            });

    const mentorProfileJustSaved =
      mentorProfileSavedAt > 0 && Date.now() - mentorProfileSavedAt < 2000;
    const menteeMatchingJustSaved =
      menteeMatchingSavedAt > 0 && Date.now() - menteeMatchingSavedAt < 2000;

    const SUBJECT_CHOICES = [
      "Computer Programming",
      "Introduction to Computing",
      "Intro to Human Computer Interaction",
      "IT Fundamentals",
    ];
    const TOPIC_CHOICES = [
      "Arrays",
      "Loops",
      "Input and Output Handling",
      "Error Handling",
      "HTML",
      "CSS",
      "Javascript",
      "UI/UX",
    ];
    const MIN_AVAILABLE_TIME = "08:00";
    const MAX_AVAILABLE_TIME = "20:00";

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
      )
        return null;
      return h * 60 + m;
    }

    function firstAvailabilityRange(
      slots,
      fallbackStart = "08:00",
      fallbackEnd = "17:00",
    ) {
      const first =
        Array.isArray(slots) && slots.length > 0 ? String(slots[0]) : "";
      const parts = first.split("-");
      if (parts.length !== 2) return { start: fallbackStart, end: fallbackEnd };
      return { start: parts[0], end: parts[1] };
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

    const [mentorAvailabilityDraft, setMentorAvailabilityDraft] = useState(() =>
      firstAvailabilityRange(mentorProfile.availability, "08:00", "17:00"),
    );
    const [menteeAvailabilityDraft, setMenteeAvailabilityDraft] = useState(() =>
      firstAvailabilityRange(menteeMatching.availability, "08:00", "17:00"),
    );

    useEffect(() => {
      setMentorAvailabilityDraft(
        firstAvailabilityRange(mentorProfile.availability, "08:00", "17:00"),
      );
    }, [mentorProfile.availability]);

    useEffect(() => {
      setMenteeAvailabilityDraft(
        firstAvailabilityRange(menteeMatching.availability, "08:00", "17:00"),
      );
    }, [menteeMatching.availability]);

    return (
      <div
        className={
          "home-dashboard-space settings-page-shell" +
          (user.role === "mentee"
            ? " settings-page-shell--mentee"
            : user.role === "mentor"
              ? " settings-page-shell--mentor"
              : "")
        }
      >
        <div className="settings-page-grid">
          <div className="settings-card settings-card--account">
            <div className="settings-card-header">
              <div className="settings-card-header-main">
                <div className="settings-card-icon">
                  <DashboardIcon name="user" size={20} />
                </div>
                <div>
                  <h1 className="page-title">Account settings</h1>
                  <p className="page-subtitle">
                    Update your profile details used across the dashboard.
                  </p>
                </div>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Username</label>
                <input
                  value={settingsForm.username}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      username: e.target.value,
                    })
                  }
                  placeholder="Your username"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={settingsForm.email}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, email: e.target.value })
                  }
                  placeholder="your@email.com"
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Profile picture</label>
                <div className="settings-avatar-row">
                  <button
                    type="button"
                    className="settings-avatar-uploader"
                    onClick={() => {
                      const input = document.getElementById(
                        "settings-avatar-input",
                      );
                      if (input) input.click();
                    }}
                  >
                    <div className="settings-avatar-preview">
                      {settingsForm.avatar_url ? (
                        <img
                          src={settingsForm.avatar_url}
                          alt="Profile preview"
                          className="settings-avatar-img"
                        />
                      ) : (
                        <div className="settings-avatar-fallback">
                          {(settingsForm.username || user.username || "?")
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="settings-avatar-overlay">
                      <span
                        className="settings-avatar-overlay-icon"
                        aria-hidden="true"
                      >
                        <DashboardIcon name="camera" size={18} />
                      </span>
                      <span className="settings-avatar-overlay-text">
                        {avatarUploading ? "Uploading…" : "Change photo"}
                      </span>
                    </div>
                  </button>
                  <div className="settings-avatar-meta">
                    <input
                      id="settings-avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={avatarUploading}
                      style={{ display: "none" }}
                    />
                    <p className="field-helper">
                      Use a clear, front-facing photo so mentees and mentors can
                      recognize you.
                    </p>
                    <p className="field-helper">
                      Recommended: square image, at least 256×256px.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="btn-row settings-card-footer">
              <button
                className="btn"
                onClick={handleSettingsSave}
                disabled={settingsSaving}
              >
                {settingsSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
          <BioAndInterestsCard
            bio={settingsForm.bio || ""}
            tags={Array.isArray(settingsForm.tags) ? settingsForm.tags : []}
            onBioSave={handleBioSave}
            onTagsSave={handleTagsSave}
          />

          {user.role === "mentee" && (
            <div className="settings-card settings-card--general">
              <div className="settings-card-header">
                <div className="settings-card-header-main">
                  <div className="settings-card-icon">
                    <DashboardIcon name="clipboardList" size={20} />
                  </div>
                  <div>
                    <h2 className="section-title">General information</h2>
                    <p className="page-subtitle">
                      Some fields are managed by the school and shown for
                      reference only.
                    </p>
                  </div>
                </div>
              </div>

              <div className="settings-section-label">Identity</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Campus *</label>
                  <input
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
                  <label>Student ID No. *</label>
                  <input
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
              </div>

              <div className="settings-section-label">Program details</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Course / Program (read only)</label>
                  <input
                    value={menteeProfile.program}
                    readOnly
                    disabled
                    placeholder="e.g. BSIT"
                  />
                  <p className="field-helper">
                    Set by your school. Contact an administrator if this is
                    incorrect.
                  </p>
                </div>
                <div className="form-group">
                  <label>Year level (read only)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={menteeProfile.year_level}
                    readOnly
                    disabled
                    placeholder="1"
                  />
                  <p className="field-helper">
                    Set by your school. Contact an administrator if this is
                    incorrect.
                  </p>
                </div>
              </div>

              <div className="settings-section-label">Contact</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Contact No. *</label>
                  <input
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
                  <label>Admission Type *</label>
                  <input
                    value={menteeProfile.admission_type}
                    onChange={(e) =>
                      setMenteeProfile({
                        ...menteeProfile,
                        admission_type: e.target.value,
                      })
                    }
                    placeholder="e.g. Regular, Transferee"
                  />
                </div>
              </div>

              <div className="settings-section-label">Personal</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Biological sex *</label>
                  <select
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

              <div className="btn-row" style={{ marginTop: "16px" }}>
                <button
                  className="btn"
                  onClick={handleMenteeProfileSave}
                  disabled={menteeProfileSaving}
                >
                  {menteeProfileSaving
                    ? "Saving..."
                    : "Save general information"}
                </button>
              </div>
            </div>
          )}
          {(user.role === "mentor" || user.role === "mentee") && (
            <div className="matching-questionnaire-card settings-card settings-card--matching settings-card--full-width">
              <div className="settings-card-header">
                <div className="settings-card-header-main">
                  <div className="settings-card-icon">
                    <DashboardIcon name="sparkles" size={20} />
                  </div>
                  <div>
                    <h2
                      className="section-title"
                      style={{ borderBottom: "none", paddingBottom: 0 }}
                    >
                      Matching questionnaire
                    </h2>
                    <p className="page-subtitle matching-questionnaire-subtitle">
                      Keep your mentoring preferences up to date so we can
                      recommend the best mentors and mentees for you.
                    </p>
                  </div>
                </div>
              </div>

              {user.role === "mentor" && (
                <div className="matching-questionnaire-flow">
                  <section className="matching-section-card">
                    <div className="settings-section-label">Mentor role</div>
                    <div className="form-group">
                      <label>Role</label>
                      <select
                        value={mentorProfile.role || ""}
                        onChange={(e) =>
                          setMentorProfile({
                            ...mentorProfile,
                            role: e.target.value,
                          })
                        }
                      >
                        <option value="">Select role</option>
                        <option value="Senior IT Student">
                          Senior IT Student
                        </option>
                        <option value="Instructor">Instructor</option>
                      </select>
                    </div>
                  </section>

                  <section className="matching-section-card">
                    <div className="settings-section-label">
                      Subjects you can help with
                    </div>
                    <p className="field-helper">
                      Pick the subjects where you feel comfortable guiding
                      mentees.
                    </p>
                    <div className="checkbox-group matching-questionnaire-pill-group">
                      {SUBJECT_CHOICES.map((label) => {
                        const checked =
                          Array.isArray(mentorProfile.subjects) &&
                          mentorProfile.subjects.includes(label);
                        return (
                          <label key={label} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={!!checked}
                              onChange={(e) => {
                                const current = Array.isArray(
                                  mentorProfile.subjects,
                                )
                                  ? [...mentorProfile.subjects]
                                  : [];
                                if (e.target.checked) {
                                  if (!current.includes(label))
                                    current.push(label);
                                } else {
                                  const idx = current.indexOf(label);
                                  if (idx >= 0) current.splice(idx, 1);
                                }
                                setMentorProfile({
                                  ...mentorProfile,
                                  subjects: current,
                                  topics: filterTopicsForSubjects(
                                    current,
                                    mentorProfile.topics || [],
                                  ),
                                });
                                if (ctx.mentorProfilePristine)
                                  ctx.mentorProfilePristine = false;
                              }}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </section>

                  <section className="matching-section-card">
                    <div className="settings-section-label">
                      Topics you can mentor on
                    </div>
                    <p className="field-helper">
                      Choose specific concepts you enjoy explaining the most.
                    </p>
                    <div className="checkbox-group matching-questionnaire-pill-group">
                      {(() => {
                        const allowedTopics = getAllowedTopicsForSubjects(
                          mentorProfile.subjects || [],
                        );
                        const topicEnabled = allowedTopics.length > 0;
                        return TOPIC_CHOICES.map((label) => {
                          const checked =
                            Array.isArray(mentorProfile.topics) &&
                            mentorProfile.topics.includes(label);
                          const disabled =
                            !topicEnabled || !allowedTopics.includes(label);
                          return (
                            <label
                              key={label}
                              className={
                                "checkbox-row" +
                                (disabled ? " checkbox-row--disabled" : "")
                              }
                            >
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={!!checked}
                                onChange={(e) => {
                                  if (disabled) return;
                                  const current = Array.isArray(
                                    mentorProfile.topics,
                                  )
                                    ? [...mentorProfile.topics]
                                    : [];
                                  if (e.target.checked) {
                                    if (!current.includes(label))
                                      current.push(label);
                                  } else {
                                    const idx = current.indexOf(label);
                                    if (idx >= 0) current.splice(idx, 1);
                                  }
                                  setMentorProfile({
                                    ...mentorProfile,
                                    topics: filterTopicsForSubjects(
                                      mentorProfile.subjects || [],
                                      current,
                                    ),
                                  });
                                  if (ctx.mentorProfilePristine)
                                    ctx.mentorProfilePristine = false;
                                }}
                              />
                              {label}
                            </label>
                          );
                        });
                      })()}
                    </div>
                    <p className="field-helper">
                      Select one or more subjects first to unlock matching
                      topics.
                    </p>
                  </section>

                  <section className="matching-section-card">
                    <div className="settings-section-label">
                      Expertise level (1–5)
                    </div>
                    <p className="field-helper">
                      1 = just starting to tutor in these subjects, 5 = very
                      experienced and confident mentoring others.
                    </p>
                    <div className="checkbox-group matching-questionnaire-levels">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n} className="checkbox-row">
                          <input
                            type="radio"
                            name="mentor-expertise"
                            checked={mentorProfile.expertise_level === n}
                            onChange={() =>
                              setMentorProfile({
                                ...mentorProfile,
                                expertise_level: n,
                              })
                            }
                          />
                          {n}
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="matching-section-card">
                    <div className="settings-section-label">
                      Maximum mentees you can handle
                    </div>
                    <p className="field-helper">
                      We will not assign you more mentees than this number.
                    </p>
                    <div className="form-group">
                      <label>Max mentees</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={mentorProfile.capacity ?? 3}
                        onChange={(e) => {
                          const raw = Number(e.target.value || 1);
                          const clamped = Math.max(1, Math.min(5, raw));
                          setMentorProfile({
                            ...mentorProfile,
                            capacity: clamped,
                          });
                        }}
                      />
                    </div>
                  </section>

                  <section className="matching-section-card">
                    <div className="settings-section-label">Biological sex</div>
                    <div className="form-group">
                      <label>Biological sex</label>
                      <select
                        value={mentorProfile.gender || ""}
                        onChange={(e) =>
                          setMentorProfile({
                            ...mentorProfile,
                            gender: e.target.value,
                          })
                        }
                      >
                        <option value="">Select biological sex</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                  </section>

                  <section className="matching-section-card">
                    <div className="settings-section-label">Available time</div>
                    <p className="field-helper">
                      Add one or more time ranges between 08:00 and 20:00.
                    </p>
                    <div className="time-range-row">
                      <div className="time-field">
                        <label>Start time</label>
                        <div className="time-input-wrapper">
                          <input
                            type="time"
                            className="time-input"
                            min={MIN_AVAILABLE_TIME}
                            max={MAX_AVAILABLE_TIME}
                            value={mentorAvailabilityDraft.start}
                            onChange={(e) => {
                              setMentorAvailabilityError("");
                              setMentorAvailabilityDraft({
                                ...mentorAvailabilityDraft,
                                start: e.target.value,
                              });
                            }}
                          />
                        </div>
                      </div>
                      <div className="time-field">
                        <label>End time</label>
                        <div className="time-input-wrapper">
                          <input
                            type="time"
                            className="time-input"
                            min={MIN_AVAILABLE_TIME}
                            max={MAX_AVAILABLE_TIME}
                            value={mentorAvailabilityDraft.end}
                            onChange={(e) => {
                              setMentorAvailabilityError("");
                              setMentorAvailabilityDraft({
                                ...mentorAvailabilityDraft,
                                end: e.target.value,
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className="btn-row"
                      style={{ marginTop: "8px", marginBottom: "4px" }}
                    >
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => {
                          const newSlots = toSingleAvailabilityRange(
                            mentorAvailabilityDraft.start,
                            mentorAvailabilityDraft.end,
                          );
                          if (
                            !Array.isArray(newSlots) ||
                            newSlots.length === 0
                          ) {
                            setMentorAvailabilityError(
                              "Choose a valid range where start time is earlier than end time.",
                            );
                            return;
                          }
                          setMentorAvailabilityError("");
                          const current = Array.isArray(
                            mentorProfile.availability,
                          )
                            ? [...mentorProfile.availability]
                            : [];
                          newSlots.forEach((slot) => {
                            if (!current.includes(slot)) current.push(slot);
                          });
                          const updated = {
                            ...mentorProfile,
                            availability: current,
                          };
                          setMentorProfile(updated);
                        }}
                      >
                        Add timeframe
                      </button>
                    </div>
                    {mentorAvailabilityError && (
                      <p
                        className="matching-inline-feedback matching-inline-feedback--error"
                        role="alert"
                      >
                        {mentorAvailabilityError}
                      </p>
                    )}
                    <p className="field-helper">
                      You can add multiple availability ranges between 08:00 and
                      20:00. We&apos;ll match you with people whose times
                      overlap these ranges.
                    </p>
                    {Array.isArray(mentorProfile.availability) &&
                      mentorProfile.availability.length > 0 && (
                        <div className="availability-tags">
                          {mentorProfile.availability.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              className="availability-tag"
                              onClick={() => {
                                const next = mentorProfile.availability.filter(
                                  (s) => s !== slot,
                                );
                                setMentorProfile({
                                  ...mentorProfile,
                                  availability: next,
                                });
                              }}
                            >
                              <span>{slot}</span>
                              <span
                                className="availability-tag-remove"
                                aria-hidden="true"
                              >
                                ×
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                  </section>

                  <div
                    className="btn-row matching-questionnaire-actions"
                    style={{
                      marginTop: "16px",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="btn"
                      onClick={async () => {
                        await handleMentorProfileSave();
                        setMentorProfileSavedAt(Date.now());
                      }}
                      type="button"
                      disabled={mentorProfileSaving || mentorProfilePristine}
                    >
                      {mentorProfileSaving
                        ? "Saving..."
                        : mentorProfilePristine
                          ? "No changes yet"
                          : "Save mentor questionnaire"}
                    </button>
                  </div>
                  <p
                    className="matching-inline-feedback matching-inline-feedback--success"
                    role="status"
                    aria-live="polite"
                  >
                    {mentorProfileSaving
                      ? "Saving mentor questionnaire..."
                      : mentorProfileJustSaved
                        ? "Mentor questionnaire saved successfully."
                        : ""}
                  </p>
                </div>
              )}

              {user.role === "mentee" && (
                <div className="matching-questionnaire-flow">
                  {user.mentee_general_info_completed ? (
                    <>
                      <section className="matching-section-card">
                        <div className="settings-section-label">
                          Subjects you find challenging
                        </div>
                        <div className="checkbox-group matching-questionnaire-pill-group">
                          {SUBJECT_CHOICES.map((label) => {
                            const checked =
                              Array.isArray(menteeMatching.subjects) &&
                              menteeMatching.subjects.includes(label);
                            return (
                              <label key={label} className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={!!checked}
                                  onChange={(e) => {
                                    const current = Array.isArray(
                                      menteeMatching.subjects,
                                    )
                                      ? [...menteeMatching.subjects]
                                      : [];
                                    if (e.target.checked) {
                                      if (!current.includes(label))
                                        current.push(label);
                                    } else {
                                      const idx = current.indexOf(label);
                                      if (idx >= 0) current.splice(idx, 1);
                                    }
                                    setMenteeMatching({
                                      ...menteeMatching,
                                      subjects: current,
                                      topics: filterTopicsForSubjects(
                                        current,
                                        menteeMatching.topics || [],
                                      ),
                                    });
                                  }}
                                />
                                {label}
                              </label>
                            );
                          })}
                        </div>
                      </section>

                      <section className="matching-section-card">
                        <div className="settings-section-label">
                          Topics you have difficulty with
                        </div>
                        <div className="checkbox-group matching-questionnaire-pill-group">
                          {(() => {
                            const allowedTopics = getAllowedTopicsForSubjects(
                              menteeMatching.subjects || [],
                            );
                            const topicEnabled = allowedTopics.length > 0;
                            return TOPIC_CHOICES.map((label) => {
                              const checked =
                                Array.isArray(menteeMatching.topics) &&
                                menteeMatching.topics.includes(label);
                              const disabled =
                                !topicEnabled || !allowedTopics.includes(label);
                              return (
                                <label
                                  key={label}
                                  className={
                                    "checkbox-row" +
                                    (disabled ? " checkbox-row--disabled" : "")
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={!!checked}
                                    onChange={(e) => {
                                      if (disabled) return;
                                      const current = Array.isArray(
                                        menteeMatching.topics,
                                      )
                                        ? [...menteeMatching.topics]
                                        : [];
                                      if (e.target.checked) {
                                        if (!current.includes(label))
                                          current.push(label);
                                      } else {
                                        const idx = current.indexOf(label);
                                        if (idx >= 0) current.splice(idx, 1);
                                      }
                                      setMenteeMatching({
                                        ...menteeMatching,
                                        topics: filterTopicsForSubjects(
                                          menteeMatching.subjects || [],
                                          current,
                                        ),
                                      });
                                    }}
                                  />
                                  {label}
                                </label>
                              );
                            });
                          })()}
                        </div>
                        <p className="field-helper">
                          Select one or more subjects first to unlock matching
                          topics.
                        </p>
                      </section>

                      <section className="matching-section-card">
                        <div className="settings-section-label">
                          Difficulty level (1–5)
                        </div>
                        <p className="field-helper">
                          1 = course feels very easy right now, 5 = you&apos;re
                          finding it very difficult and need a lot of help.
                        </p>
                        <div className="checkbox-group matching-questionnaire-levels">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <label key={n} className="checkbox-row">
                              <input
                                type="radio"
                                name="mentee-difficulty"
                                checked={menteeMatching.difficulty_level === n}
                                onChange={() =>
                                  setMenteeMatching({
                                    ...menteeMatching,
                                    difficulty_level: n,
                                  })
                                }
                              />
                              {n}
                            </label>
                          ))}
                        </div>
                      </section>

                      <section className="matching-section-card">
                        <div className="settings-section-label">
                          Available time
                        </div>
                        <p className="field-helper">
                          Add one or more time ranges between 08:00 and 20:00.
                        </p>
                        <div className="time-range-row">
                          <div className="time-field">
                            <label>Start time</label>
                            <div className="time-input-wrapper">
                              <input
                                type="time"
                                className="time-input"
                                min={MIN_AVAILABLE_TIME}
                                max={MAX_AVAILABLE_TIME}
                                value={menteeAvailabilityDraft.start}
                                onChange={(e) => {
                                  setMenteeAvailabilityError("");
                                  setMenteeAvailabilityDraft({
                                    ...menteeAvailabilityDraft,
                                    start: e.target.value,
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <div className="time-field">
                            <label>End time</label>
                            <div className="time-input-wrapper">
                              <input
                                type="time"
                                className="time-input"
                                min={MIN_AVAILABLE_TIME}
                                max={MAX_AVAILABLE_TIME}
                                value={menteeAvailabilityDraft.end}
                                onChange={(e) => {
                                  setMenteeAvailabilityError("");
                                  setMenteeAvailabilityDraft({
                                    ...menteeAvailabilityDraft,
                                    end: e.target.value,
                                  });
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div
                          className="btn-row"
                          style={{ marginTop: "8px", marginBottom: "4px" }}
                        >
                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => {
                              const newSlots = toSingleAvailabilityRange(
                                menteeAvailabilityDraft.start,
                                menteeAvailabilityDraft.end,
                              );
                              if (
                                !Array.isArray(newSlots) ||
                                newSlots.length === 0
                              ) {
                                setMenteeAvailabilityError(
                                  "Choose a valid range where start time is earlier than end time.",
                                );
                                return;
                              }
                              setMenteeAvailabilityError("");
                              const current = Array.isArray(
                                menteeMatching.availability,
                              )
                                ? [...menteeMatching.availability]
                                : [];
                              newSlots.forEach((slot) => {
                                if (!current.includes(slot)) current.push(slot);
                              });
                              const updated = {
                                ...menteeMatching,
                                availability: current,
                              };
                              setMenteeMatching(updated);
                            }}
                          >
                            Add timeframe
                          </button>
                        </div>
                        {menteeAvailabilityError && (
                          <p
                            className="matching-inline-feedback matching-inline-feedback--error"
                            role="alert"
                          >
                            {menteeAvailabilityError}
                          </p>
                        )}
                        <p className="field-helper">
                          You can add multiple availability ranges between 08:00
                          and 20:00. We&apos;ll match you with people whose
                          times overlap these ranges.
                        </p>
                        {Array.isArray(menteeMatching.availability) &&
                          menteeMatching.availability.length > 0 && (
                            <div className="availability-tags">
                              {menteeMatching.availability.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  className="availability-tag"
                                  onClick={() => {
                                    const next =
                                      menteeMatching.availability.filter(
                                        (s) => s !== slot,
                                      );
                                    setMenteeMatching({
                                      ...menteeMatching,
                                      availability: next,
                                    });
                                  }}
                                >
                                  <span>{slot}</span>
                                  <span
                                    className="availability-tag-remove"
                                    aria-hidden="true"
                                  >
                                    ×
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                      </section>

                      <div
                        className="btn-row matching-questionnaire-actions"
                        style={{
                          marginTop: "16px",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="btn"
                          type="button"
                          onClick={async () => {
                            await handleMenteeMatchingSave();
                            setMenteeMatchingSavedAt(Date.now());
                          }}
                          disabled={
                            menteeMatchingSaving || menteeMatchingPristine
                          }
                        >
                          {menteeMatchingSaving
                            ? "Saving..."
                            : menteeMatchingPristine
                              ? "No changes yet"
                              : "Save mentee questionnaire"}
                        </button>
                      </div>
                      <p
                        className="matching-inline-feedback matching-inline-feedback--success"
                        role="status"
                        aria-live="polite"
                      >
                        {menteeMatchingSaving
                          ? "Saving mentee questionnaire..."
                          : menteeMatchingJustSaved
                            ? "Mentee questionnaire saved successfully."
                            : ""}
                      </p>
                    </>
                  ) : (
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>
                      Complete your general information above to unlock the
                      questionnaire.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.settings = SettingsPage;
})();
