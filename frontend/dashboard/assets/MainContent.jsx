(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;
  const RouteRenderer = window.DashboardApp.RouteRenderer;
  const ErrorBoundary =
    window.DashboardApp.ErrorBoundary ||
    function ErrorBoundaryPassthrough({ children }) {
      return children;
    };
  const LoadingSpinner =
    (window.DashboardApp &&
      window.DashboardApp.Utils &&
      window.DashboardApp.Utils.LoadingSpinner) ||
    function LoadingSpinner() {
      return (
        <div
          className="loading-spinner-spinkit"
          role="status"
          aria-label="Loading"
        >
          ...
        </div>
      );
    };

  function MainContent() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const {
      authCheckDone,
      isAuthenticated,
      isPendingApproval,
      showSignInPrompt,
      activeTab,
      user,
      showMenteeInfoModal,
      showMentorInfoModal,
      menteeProfile,
      setMenteeProfile,
      menteeProfileSaving,
      handleMenteeProfileSave,
      mentorProfile,
      setMentorProfile,
      mentorProfileSaving,
      handleMentorProfileSave,
      setActiveTab,
    } = ctx;

    useEffect(() => {
      if (authCheckDone) return undefined;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }, [authCheckDone]);

    const SUBJECT_OPTIONS =
      (window.DashboardApp && window.DashboardApp.MENTOR_SUBJECT_OPTIONS) || [];
    const TOPIC_OPTIONS =
      (window.DashboardApp && window.DashboardApp.MENTOR_TOPIC_OPTIONS) || [];
    const getAllowedTopicsForSubjects =
      window.DashboardApp.getAllowedTopicsForSubjects || (() => []);
    const filterTopicsForSubjects =
      window.DashboardApp.filterTopicsForSubjects ||
      ((subjects, topics) => (Array.isArray(topics) ? [...topics] : []));

    return (
      <>
        {!authCheckDone && (
          <div
            className="session-check-overlay"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="session-check-panel">
              <LoadingSpinner
                title="Checking your session..."
                subtitle="This will only take a moment."
              />
            </div>
          </div>
        )}
        {showSignInPrompt && (
          <div className="card auth-warning cta-card">
            <h2 className="page-title">Please sign in</h2>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              You need to log in to access the dashboard.
            </p>
            <div
              className="btn-row"
              style={{ marginTop: "16px", justifyContent: "center" }}
            >
              <button className="btn" onClick={() => setActiveTab("signin")}>
                Go to sign in
              </button>
            </div>
          </div>
        )}

        {isAuthenticated && isPendingApproval && activeTab === "pending-approval" && (
          <div className="card cta-card" style={{ maxWidth: 760, margin: "0 auto" }}>
            <h1 className="page-title">Account Pending Approval</h1>
            <p className="page-subtitle" style={{ marginBottom: 12 }}>
              Your account is signed in but still waiting for coordinator approval.
            </p>
            <div className="alert alert-warning" role="status" style={{ marginBottom: 16 }}>
              <strong>Status:</strong> Pending review.
            </div>
            <ul className="muted" style={{ marginTop: 0, marginBottom: 16, paddingLeft: 20 }}>
              <li>Complete all required profile details.</li>
              <li>Coordinator will review your account after submission.</li>
              <li>You will get full dashboard access once approved.</li>
            </ul>
            <div className="btn-row" style={{ justifyContent: "flex-start", gap: 10 }}>
              <button className="btn" onClick={() => setActiveTab("complete-profile")}>
                Complete Required Information
              </button>
              <button className="btn secondary" onClick={() => setActiveTab("settings")}>
                Open Account Settings
              </button>
            </div>
          </div>
        )}

        {isAuthenticated && user?.role === "mentee" && showMenteeInfoModal && (
          <div
            className="mentee-info-modal-backdrop required-info-backdrop"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.preventDefault();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentee-info-modal-title"
          >
            <div
              className="card mentee-info-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h1 id="mentee-info-modal-title" className="page-title">
                Complete your general information
              </h1>
              <p className="page-subtitle">
                Before using the dashboard, please confirm your student details
                below. This step is required and cannot be closed until
                completed.
              </p>
              <div className="form-grid">
                <div>
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
                <div>
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
                <div>
                  <label>Course / Program (read only)</label>
                  <input
                    value={menteeProfile.program}
                    readOnly
                    disabled
                    placeholder="e.g. BSIT"
                  />
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
                </div>
                <div>
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
                <div>
                  <label>Sex *</label>
                  <input
                    value={menteeProfile.sex}
                    onChange={(e) =>
                      setMenteeProfile({
                        ...menteeProfile,
                        sex: e.target.value,
                      })
                    }
                    placeholder="Sex"
                  />
                </div>
              </div>
              <div
                className="btn-row"
                style={{ marginTop: "16px", justifyContent: "flex-end" }}
              >
                <button
                  className="btn"
                  onClick={handleMenteeProfileSave}
                  disabled={menteeProfileSaving}
                >
                  {menteeProfileSaving ? "Saving..." : "Save information"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isAuthenticated && user?.role === "mentor" && showMentorInfoModal && (
          <div
            className="mentee-info-modal-backdrop required-info-backdrop"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") e.preventDefault();
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mentor-info-modal-title"
          >
            <div
              className="card mentee-info-modal mentor-info-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h1 id="mentor-info-modal-title" className="page-title">
                Complete your mentor profile
              </h1>
              <p className="page-subtitle">
                Before you can be approved, complete your subjects, topics, and
                expertise level. This step is required and cannot be closed
                until completed.
              </p>
              <div className="form-group">
                <label>Subjects (select at least one)</label>
                <div className="checkbox-group">
                  {SUBJECT_OPTIONS.map((s) => (
                    <label key={s} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={(mentorProfile.subjects || []).includes(s)}
                        onChange={() => {
                          const next = (mentorProfile.subjects || []).includes(
                            s,
                          )
                            ? (mentorProfile.subjects || []).filter(
                                (x) => x !== s,
                              )
                            : [...(mentorProfile.subjects || []), s];
                          setMentorProfile({
                            ...mentorProfile,
                            subjects: next,
                            topics: filterTopicsForSubjects(
                              next,
                              mentorProfile.topics || [],
                            ),
                          });
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
                  {(() => {
                    const allowedTopics = getAllowedTopicsForSubjects(
                      mentorProfile.subjects || [],
                    );
                    const isTopicAllowed = allowedTopics.length > 0;
                    return TOPIC_OPTIONS.map((t) => {
                      const disabled =
                        !isTopicAllowed || !allowedTopics.includes(t);
                      return (
                        <label
                          key={t}
                          className={
                            "checkbox-row" +
                            (disabled ? " checkbox-row--disabled" : "")
                          }
                        >
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={(mentorProfile.topics || []).includes(t)}
                            onChange={() => {
                              if (disabled) return;
                              const next = (
                                mentorProfile.topics || []
                              ).includes(t)
                                ? (mentorProfile.topics || []).filter(
                                    (x) => x !== t,
                                  )
                                : [...(mentorProfile.topics || []), t];
                              setMentorProfile({
                                ...mentorProfile,
                                topics: filterTopicsForSubjects(
                                  mentorProfile.subjects || [],
                                  next,
                                ),
                              });
                            }}
                          />
                          <span>{t}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
                <p className="field-helper">
                  Select one or more subjects first to unlock matching topics.
                </p>
              </div>
              <div className="form-group">
                <label>Expertise level (1-5)</label>
                <div className="expertise-radios">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="radio-inline">
                      <input
                        type="radio"
                        name="mentor_expertise"
                        checked={mentorProfile.expertise_level === n}
                        onChange={() =>
                          setMentorProfile((prev) => ({
                            ...prev,
                            expertise_level: n,
                          }))
                        }
                      />
                      <span>{n}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div
                className="btn-row"
                style={{ marginTop: "16px", justifyContent: "flex-end" }}
              >
                <button
                  className="btn"
                  onClick={handleMentorProfileSave}
                  disabled={mentorProfileSaving}
                >
                  {mentorProfileSaving ? "Saving..." : "Save information"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!(isAuthenticated && isPendingApproval && activeTab === "pending-approval") && (
          <ErrorBoundary>
            <RouteRenderer activeTab={activeTab} />
          </ErrorBoundary>
        )}
      </>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.MainContent = MainContent;
})();
