(function () {
  "use strict";
  const React = window.React;
  const { useContext } = React;
  const AppContext = window.DashboardApp.AppContext;

  function SettingsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      user,
      settingsForm,
      setSettingsForm,
      settingsSaving,
      handleSettingsSave,
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
      if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
      return h * 60 + m;
    }

    function firstAvailabilityRange(slots, fallbackStart = "08:00", fallbackEnd = "17:00") {
      const first = Array.isArray(slots) && slots.length > 0 ? String(slots[0]) : "";
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

    const mentorRange = firstAvailabilityRange(mentorProfile.availability, "08:00", "17:00");
    const menteeRange = firstAvailabilityRange(menteeMatching.availability, "08:00", "17:00");

    return (
      <>
        <div className="card settings-card">
          <h1 className="page-title">Account settings</h1>
          <p className="page-subtitle">Update your profile details.</p>
          <div className="form-grid">
            <div><label>Username</label><input value={settingsForm.username} onChange={(e) => setSettingsForm({ ...settingsForm, username: e.target.value })} placeholder="Your username" /></div>
            <div><label>Email</label><input type="email" value={settingsForm.email} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} placeholder="your@email.com" /></div>
            <div>
              <label>Profile picture</label>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="sidebar-avatar-wrapper">{settingsForm.avatar_url ? <img src={settingsForm.avatar_url} alt="Profile preview" className="sidebar-avatar" /> : <div className="sidebar-avatar fallback">{(settingsForm.username || user.username || "?").slice(0, 1).toUpperCase()}</div>}</div>
                <div><input type="file" accept="image/*" onChange={handleAvatarChange} disabled={avatarUploading} />{avatarUploading && <div className="muted" style={{ fontSize: "12px", marginTop: "4px" }}>Uploading...</div>}</div>
              </div>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: "16px" }}><button className="btn" onClick={handleSettingsSave} disabled={settingsSaving}>{settingsSaving ? "Saving..." : "Save changes"}</button></div>
        </div>
        {user.role === "mentee" && (
          <div className="card" style={{ marginTop: 16 }}>
            <h2 className="section-title">General information</h2>
            <p className="page-subtitle">
              Some fields are managed by the school and shown for reference only.
            </p>

            <div className="settings-section-label">Identity</div>
            <div className="form-grid">
              <div>
                <label>Campus *</label>
                <input
                  value={menteeProfile.campus}
                  onChange={(e) =>
                    setMenteeProfile({ ...menteeProfile, campus: e.target.value })
                  }
                  placeholder="Campus"
                />
              </div>
              <div>
                <label>Student ID No. *</label>
                <input
                  value={menteeProfile.student_id_no}
                  onChange={(e) =>
                    setMenteeProfile({
                      ...menteeProfile,
                      student_id_no: e.target.value.replace(/\D/g, "").slice(0, 10),
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
              <div>
                <label>Course / Program (read only)</label>
                <input
                  value={menteeProfile.program}
                  readOnly
                  disabled
                  placeholder="e.g. BSIT"
                />
                <p className="field-helper">
                  Set by your school. Contact an administrator if this is incorrect.
                </p>
              </div>
              <div>
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
                  Set by your school. Contact an administrator if this is incorrect.
                </p>
              </div>
            </div>

            <div className="settings-section-label">Contact</div>
            <div className="form-grid">
              <div>
                <label>Contact No. *</label>
                <input
                  value={menteeProfile.contact_no}
                  onChange={(e) =>
                    setMenteeProfile({
                      ...menteeProfile,
                      contact_no: e.target.value.replace(/\D/g, "").slice(0, 11),
                    })
                  }
                  placeholder="11 digits only"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={11}
                />
              </div>
              <div>
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
              <div>
                <label>Sex *</label>
                <input
                  value={menteeProfile.sex}
                  onChange={(e) =>
                    setMenteeProfile({ ...menteeProfile, sex: e.target.value })
                  }
                  placeholder="Sex"
                />
              </div>
            </div>

            <div className="btn-row" style={{ marginTop: "16px" }}>
              <button
                className="btn"
                onClick={handleMenteeProfileSave}
                disabled={menteeProfileSaving}
              >
                {menteeProfileSaving ? "Saving..." : "Save general information"}
              </button>
            </div>
          </div>
        )}
        {(user.role === "mentor" || user.role === "mentee") && (
          <div className="card matching-questionnaire-card">
            <h2 className="section-title" style={{ borderBottom: "none", paddingBottom: 0 }}>Matching questionnaire</h2>
            <p className="page-subtitle matching-questionnaire-subtitle">Keep your mentoring preferences up to date so we can recommend the best mentors and mentees for you.</p>

            {user.role === "mentor" && (
              <>
                <div className="settings-section-label">Mentor role</div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={mentorProfile.role || ""}
                    onChange={(e) =>
                      setMentorProfile({ ...mentorProfile, role: e.target.value })
                    }
                  >
                    <option value="">Select role</option>
                    <option value="Senior IT Student">Senior IT Student</option>
                    <option value="Instructor">Instructor</option>
                  </select>
                </div>

                <div className="settings-section-label">Subjects you can help with</div>
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
                            const current = Array.isArray(mentorProfile.subjects)
                              ? [...mentorProfile.subjects]
                              : [];
                            if (e.target.checked) {
                              if (!current.includes(label)) current.push(label);
                            } else {
                              const idx = current.indexOf(label);
                              if (idx >= 0) current.splice(idx, 1);
                            }
                            setMentorProfile({ ...mentorProfile, subjects: current });
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>

                <div className="settings-section-label">Topics you can mentor on</div>
                <div className="checkbox-group matching-questionnaire-pill-group">
                  {TOPIC_CHOICES.map((label) => {
                    const checked =
                      Array.isArray(mentorProfile.topics) &&
                      mentorProfile.topics.includes(label);
                    return (
                      <label key={label} className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={!!checked}
                          onChange={(e) => {
                            const current = Array.isArray(mentorProfile.topics)
                              ? [...mentorProfile.topics]
                              : [];
                            if (e.target.checked) {
                              if (!current.includes(label)) current.push(label);
                            } else {
                              const idx = current.indexOf(label);
                              if (idx >= 0) current.splice(idx, 1);
                            }
                            setMentorProfile({ ...mentorProfile, topics: current });
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>

                <div className="settings-section-label">Expertise level (1–5)</div>
                <div className="checkbox-group matching-questionnaire-levels">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="checkbox-row">
                      <input
                        type="radio"
                        name="mentor-expertise"
                        checked={mentorProfile.expertise_level === n}
                        onChange={() =>
                          setMentorProfile({ ...mentorProfile, expertise_level: n })
                        }
                      />
                      {n}
                    </label>
                  ))}
                </div>

                <div className="settings-section-label">Gender</div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={mentorProfile.gender || ""}
                    onChange={(e) => setMentorProfile({ ...mentorProfile, gender: e.target.value })}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                <div className="settings-section-label">Available Time</div>
                <div className="form-grid">
                  <div>
                    <label>Start time</label>
                    <input
                      type="time"
                      min={MIN_AVAILABLE_TIME}
                      max={MAX_AVAILABLE_TIME}
                      value={mentorRange.start}
                      onChange={(e) => setMentorProfile({ ...mentorProfile, availability: toSingleAvailabilityRange(e.target.value, mentorRange.end) })}
                    />
                  </div>
                  <div>
                    <label>End time</label>
                    <input
                      type="time"
                      min={MIN_AVAILABLE_TIME}
                      max={MAX_AVAILABLE_TIME}
                      value={mentorRange.end}
                      onChange={(e) => setMentorProfile({ ...mentorProfile, availability: toSingleAvailabilityRange(mentorRange.start, e.target.value) })}
                    />
                  </div>
                </div>
                <p className="field-helper">Choose one availability range between 08:00 and 20:00.</p>

                <div className="btn-row" style={{ marginTop: "16px" }}>
                  <button
                    className="btn"
                    onClick={handleMentorProfileSave}
                    type="button"
                    disabled={mentorProfileSaving}
                  >
                    {mentorProfileSaving ? "Saving..." : "Save mentor questionnaire"}
                  </button>
                </div>
              </>
            )}

            {user.role === "mentee" && (
              <>
                {user.mentee_general_info_completed ? (
                  <>
                    <div className="settings-section-label">Subjects you find challenging</div>
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
                                const current = Array.isArray(menteeMatching.subjects)
                                  ? [...menteeMatching.subjects]
                                  : [];
                                if (e.target.checked) {
                                  if (!current.includes(label)) current.push(label);
                                } else {
                                  const idx = current.indexOf(label);
                                  if (idx >= 0) current.splice(idx, 1);
                                }
                                setMenteeMatching({ ...menteeMatching, subjects: current });
                              }}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>

                    <div className="settings-section-label">Topics you have difficulty with</div>
                    <div className="checkbox-group matching-questionnaire-pill-group">
                      {TOPIC_CHOICES.map((label) => {
                        const checked =
                          Array.isArray(menteeMatching.topics) &&
                          menteeMatching.topics.includes(label);
                        return (
                          <label key={label} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={!!checked}
                              onChange={(e) => {
                                const current = Array.isArray(menteeMatching.topics)
                                  ? [...menteeMatching.topics]
                                  : [];
                                if (e.target.checked) {
                                  if (!current.includes(label)) current.push(label);
                                } else {
                                  const idx = current.indexOf(label);
                                  if (idx >= 0) current.splice(idx, 1);
                                }
                                setMenteeMatching({ ...menteeMatching, topics: current });
                              }}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>

                    <div className="settings-section-label">Difficulty level (1–5)</div>
                    <div className="checkbox-group matching-questionnaire-levels">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n} className="checkbox-row">
                          <input
                            type="radio"
                            name="mentee-difficulty"
                            checked={menteeMatching.difficulty_level === n}
                            onChange={() =>
                              setMenteeMatching({ ...menteeMatching, difficulty_level: n })
                            }
                          />
                          {n}
                        </label>
                      ))}
                    </div>

                    <div className="settings-section-label">Preferred Mentor Gender</div>
                    <div className="checkbox-group matching-questionnaire-levels">
                      {[
                        { id: "male", label: "Male" },
                        { id: "female", label: "Female" },
                        { id: "no_preference", label: "No Preference" },
                      ].map((choice) => (
                        <label key={choice.id} className="checkbox-row">
                          <input
                            type="radio"
                            name="preferred-mentor-gender"
                            checked={(menteeMatching.preferred_gender || "no_preference") === choice.id}
                            onChange={() => setMenteeMatching({ ...menteeMatching, preferred_gender: choice.id })}
                          />
                          {choice.label}
                        </label>
                      ))}
                    </div>

                    <div className="settings-section-label">Available Time</div>
                    <div className="form-grid">
                      <div>
                        <label>Start time</label>
                        <input
                          type="time"
                          min={MIN_AVAILABLE_TIME}
                          max={MAX_AVAILABLE_TIME}
                          value={menteeRange.start}
                          onChange={(e) => setMenteeMatching({ ...menteeMatching, availability: toSingleAvailabilityRange(e.target.value, menteeRange.end) })}
                        />
                      </div>
                      <div>
                        <label>End time</label>
                        <input
                          type="time"
                          min={MIN_AVAILABLE_TIME}
                          max={MAX_AVAILABLE_TIME}
                          value={menteeRange.end}
                          onChange={(e) => setMenteeMatching({ ...menteeMatching, availability: toSingleAvailabilityRange(menteeRange.start, e.target.value) })}
                        />
                      </div>
                    </div>
                    <p className="field-helper">Choose one availability range between 08:00 and 20:00.</p>

                    <div className="btn-row" style={{ marginTop: "16px" }}>
                      <button
                        className="btn"
                        type="button"
                        onClick={handleMenteeMatchingSave}
                        disabled={menteeMatchingSaving}
                      >
                        {menteeMatchingSaving ? "Saving..." : "Save mentee questionnaire"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="page-subtitle" style={{ marginBottom: 0 }}>
                    Complete your general information above to unlock the questionnaire.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.settings = SettingsPage;
})();
