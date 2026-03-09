(function () {
  "use strict";
  const React = window.React;
  const { useContext } = React;
  const AppContext = window.DashboardApp.AppContext;

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
    const SUBJECT_OPTIONS = (window.DashboardApp && window.DashboardApp.MENTOR_SUBJECT_OPTIONS) || [];
    const TOPIC_OPTIONS = (window.DashboardApp && window.DashboardApp.MENTOR_TOPIC_OPTIONS) || [];

    return (
      <div className="card">
        <h1 className="page-title">Complete your profile</h1>
        <p className="page-subtitle">
          {isMentee
            ? "Coordinator approval requires your general information. Fill in all required fields and save."
            : "Coordinator approval requires your mentor questionnaire. Fill in subjects, topics, and expertise level and save."}
        </p>

        {isMentee && (
          <>
            <div className="form-grid">
              <div>
                <label>Campus *</label>
                <input
                  value={menteeProfile.campus}
                  onChange={(e) => setMenteeProfile({ ...menteeProfile, campus: e.target.value })}
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
              <div>
                <label>Course / Program (read only)</label>
                <input value={menteeProfile.program} readOnly disabled placeholder="e.g. BSIT" />
              </div>
              <div>
                <label>Year level (read only)</label>
                <input type="number" min="1" max="10" value={menteeProfile.year_level} readOnly disabled placeholder="1" />
              </div>
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
                  onChange={(e) => setMenteeProfile({ ...menteeProfile, admission_type: e.target.value })}
                  placeholder="e.g. Regular, Transferee"
                />
              </div>
              <div>
                <label>Sex *</label>
                <input
                  value={menteeProfile.sex}
                  onChange={(e) => setMenteeProfile({ ...menteeProfile, sex: e.target.value })}
                  placeholder="Sex"
                />
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: "16px" }}>
              <button className="btn" onClick={handleMenteeProfileSave} disabled={menteeProfileSaving}>
                {menteeProfileSaving ? "Saving..." : "Save information"}
              </button>
            </div>
          </>
        )}

        {isMentor && (
          <>
            <div className="form-group">
              <label>Subjects (select at least one)</label>
              <div className="checkbox-group">
                {SUBJECT_OPTIONS.map((s) => (
                  <label key={s} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={(mentorProfile.subjects || []).includes(s)}
                      onChange={() => {
                        const next = (mentorProfile.subjects || []).includes(s)
                          ? (mentorProfile.subjects || []).filter((x) => x !== s)
                          : [...(mentorProfile.subjects || []), s];
                        setMentorProfile({ ...mentorProfile, subjects: next });
                      }}
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Topics (select at least one)</label>
              <div className="checkbox-group">
                {TOPIC_OPTIONS.map((t) => (
                  <label key={t} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={(mentorProfile.topics || []).includes(t)}
                      onChange={() => {
                        const next = (mentorProfile.topics || []).includes(t)
                          ? (mentorProfile.topics || []).filter((x) => x !== t)
                          : [...(mentorProfile.topics || []), t];
                        setMentorProfile({ ...mentorProfile, topics: next });
                      }}
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Expertise level (1-5)</label>
              <div className="expertise-radios">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="radio-inline">
                    <input
                      type="radio"
                      name="complete_profile_expertise"
                      checked={mentorProfile.expertise_level === n}
                      onChange={() => setMentorProfile({ ...mentorProfile, expertise_level: n })}
                    />
                    <span>{n}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="btn-row" style={{ marginTop: "16px" }}>
              <button className="btn" onClick={handleMentorProfileSave} disabled={mentorProfileSaving}>
                {mentorProfileSaving ? "Saving..." : "Save information"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["complete-profile"] = CompleteProfilePage;
})();
