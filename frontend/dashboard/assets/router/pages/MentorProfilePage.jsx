(function () {
  "use strict";
  const React = window.React;
  const { useContext } = React;
  const AppContext = window.DashboardApp.AppContext;
  const PLACEHOLDER_AVATAR = window.DashboardApp.PLACEHOLDER_AVATAR || "";

  function InfoRow({ icon, label, value }) {
    if (!value && value !== 0) return null;
    return (
      <div className="prof-info-row">
        <span className="prof-info-icon" aria-hidden="true">{icon}</span>
        <span className="prof-info-label">{label}</span>
        <span className="prof-info-value">{value}</span>
      </div>
    );
  }

  function ChipList({ items, accent }) {
    if (!items || items.length === 0) return null;
    return (
      <div className="prof-chip-list">
        {items.map((item) => (
          <span key={item} className={"prof-chip" + (accent ? " prof-chip--accent" : "")}>
            {item}
          </span>
        ))}
      </div>
    );
  }

  function LevelDots({ level, max }) {
    const n = Number(level) || 0;
    const m = max || 5;
    return (
      <span className="prof-level-dots" aria-label={`${n} out of ${m}`}>
        {Array.from({ length: m }, (_, i) => (
          <span key={i} className={"prof-dot" + (i < n ? " filled" : "")} />
        ))}
      </span>
    );
  }

  function MentorProfilePage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const { user, viewedMentorProfile, setViewedMentorProfile, setActiveTab, chooseMentor, chosenMentorId } = ctx;

    if (!viewedMentorProfile) {
      return (
        <div className="card">
          <h1 className="page-title">Mentor profile</h1>
          <p className="page-subtitle">
            No mentor selected. Go back to Matching to choose a mentor and view their profile.
          </p>
          <div className="btn-row" style={{ marginTop: "12px" }}>
            <button type="button" className="btn secondary" onClick={() => setActiveTab("matching")}>
              Back to Matching
            </button>
          </div>
        </div>
      );
    }

    const match = viewedMentorProfile;
    const mentor = match.mentor || {};
    const d = match.match_details || {};
    const mentorSubjects = mentor.subjects && mentor.subjects.length ? mentor.subjects : d.mentor_subjects || [];
    const mentorTopics = mentor.topics && mentor.topics.length ? mentor.topics : d.mentor_topics || [];
    const availability = Array.isArray(mentor.availability) ? mentor.availability : [];

    return (
      <div className="prof-page">
        <div className="prof-hero">
          <div className="prof-hero-bg" />
          <div className="prof-hero-content">
            <div className="prof-avatar-ring">
              <img
                src={mentor.avatar_url || PLACEHOLDER_AVATAR}
                alt={match.mentor_username}
                className="prof-avatar-img"
              />
            </div>
            <div className="prof-hero-text">
              <h1 className="prof-name">{match.mentor_username}</h1>
              <p className="prof-role-line">
                <span className="prof-role-badge prof-role-badge--mentor">Mentor</span>
                {mentor.role && <span className="prof-role-tag">{mentor.role}</span>}
              </p>
            </div>
            <div className="prof-hero-actions">
              {user.role === "mentee" && typeof chooseMentor === "function" && match.mentor_id && (
                <button
                  type="button"
                  className="btn small"
                  onClick={() => chooseMentor(match.mentor_id)}
                  disabled={chosenMentorId === match.mentor_id}
                >
                  {chosenMentorId === match.mentor_id ? "Requested" : "Request this mentor"}
                </button>
              )}
              <button
                type="button"
                className="btn secondary small"
                onClick={() => { setViewedMentorProfile(null); setActiveTab("matching"); }}
              >
                Back to Matching
              </button>
            </div>
          </div>
        </div>

        <div className="prof-body">
          <div className="prof-card-grid">
            <div className="prof-card">
              <h3 className="prof-card-title">
                <span className="prof-card-icon" aria-hidden="true">👤</span>
                About
              </h3>
              <div className="prof-card-body">
                <InfoRow icon="⚥" label="Biological sex" value={mentor.gender || "—"} />
                {mentor.expertise_level != null && (
                  <div className="prof-info-row">
                    <span className="prof-info-icon" aria-hidden="true">📊</span>
                    <span className="prof-info-label">Expertise level</span>
                    <LevelDots level={mentor.expertise_level} max={5} />
                  </div>
                )}
                {mentor.capacity != null && (
                  <InfoRow icon="👥" label="Capacity" value={`${mentor.capacity} mentees`} />
                )}
              </div>
            </div>

            <div className="prof-card">
              <h3 className="prof-card-title">
                <span className="prof-card-icon" aria-hidden="true">📚</span>
                Expertise
              </h3>
              <div className="prof-card-body">
                {mentorSubjects.length > 0 && (
                  <div className="prof-field-group">
                    <span className="prof-field-label">Subjects</span>
                    <ChipList items={mentorSubjects} accent />
                  </div>
                )}
                {mentorTopics.length > 0 && (
                  <div className="prof-field-group">
                    <span className="prof-field-label">Topics</span>
                    <ChipList items={mentorTopics} />
                  </div>
                )}
                {mentorSubjects.length === 0 && mentorTopics.length === 0 && (
                  <p className="muted">No expertise details available.</p>
                )}
              </div>
            </div>
          </div>

          {availability.length > 0 && (
            <div className="prof-card prof-card--wide">
              <h3 className="prof-card-title">
                <span className="prof-card-icon" aria-hidden="true">📅</span>
                Availability
              </h3>
              <div className="prof-card-body">
                <div className="prof-availability">
                  {availability.map((slot) => (
                    <span key={slot} className="prof-avail-slot">
                      <span className="prof-avail-clock" aria-hidden="true">🕒</span>
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentor-profile"] = MentorProfilePage;
})();
