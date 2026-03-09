(function () {
  "use strict";
  const React = window.React;
  const { useContext } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatDate } = Utils;

  function formatMinutesAsHours(min) {
    const m = Number(min) || 0;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return mins > 0 ? `${h}h ${mins}min` : `${h}h`;
  }

  function HomePage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const { user, stats, authCheckDone, setActiveTab, sessionsData, menteeRecommendations } = ctx;
    if (!authCheckDone) return null;
    if (!user) {
      return (
        <div className="card cta-card">
          <h1 className="page-title">Mentor–Mentee Matching</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Connect with mentors or mentees and schedule sessions in one place.</p>
          <div className="btn-row">
            <button className="btn" onClick={() => setActiveTab("signup")}>Get started</button>
            <button className="btn secondary" onClick={() => setActiveTab("signin")}>I already have an account</button>
          </div>
        </div>
      );
    }

    if (user.role === "mentee") {
      const upcoming = sessionsData?.upcoming || [];
      const nextSession = upcoming[0];
      const hasQuestionnaire = !!(user.mentee_questionnaire_completed ?? user.questionnaire_completed);
      const matchCount = (menteeRecommendations || []).length;
      const userProgress = stats && stats.user_progress;
      const weekStats = stats && stats.week;
      const termStats = stats && stats.term;

      return (
        <div className="card mentee-dashboard">
          <div className="mentee-dashboard-hero">
            <h1 className="page-title mentee-welcome">
              Welcome back{user.username ? `, ${user.username}` : ""}
            </h1>
            <p className="mentee-tagline">Your learning journey starts here. Find mentors and grow with every session.</p>
          </div>

          <div className="mentee-quick-actions">
            <button type="button" className="quick-action-card primary" onClick={() => setActiveTab("matching")}>
              <span className="quick-action-icon" aria-hidden="true">👤</span>
              <span className="quick-action-label">Find your mentors</span>
              <span className="quick-action-desc">Browse personalized mentor recommendations</span>
            </button>
            <button type="button" className="quick-action-card" onClick={() => setActiveTab("sessions")}>
              <span className="quick-action-icon" aria-hidden="true">📅</span>
              <span className="quick-action-label">Your sessions</span>
              <span className="quick-action-desc">{upcoming.length > 0 ? `${upcoming.length} upcoming` : "View and manage sessions"}</span>
            </button>
          </div>

          {matchCount > 0 && (
            <div className="mentee-highlight-card">
              <p className="mentee-highlight-text">You have <strong>{matchCount}</strong> mentor recommendation{matchCount !== 1 ? "s" : ""} waiting for you.</p>
              <button type="button" className="btn" onClick={() => setActiveTab("matching")}>View matches</button>
            </div>
          )}

          {!hasQuestionnaire && (
            <div className="mentee-cta-card">
              <p className="mentee-cta-text">Complete your questionnaire to get personalized mentor recommendations based on your subjects and goals.</p>
              <button type="button" className="btn secondary" onClick={() => setActiveTab("settings")}>Complete questionnaire</button>
            </div>
          )}

          {nextSession && (
            <div className="mentee-next-session">
              <h2 className="section-title">Next session</h2>
              <div className="mentee-next-session-card">
                <p className="mentee-next-session-title">{nextSession.subject || "Mentoring session"} {nextSession.topic ? " · " + nextSession.topic : ""}</p>
                <p className="mentee-next-session-meta">with {nextSession.mentor_username} · {formatDate(nextSession.scheduled_at)}</p>
                <button type="button" className="btn small" onClick={() => setActiveTab("sessions")}>View all sessions</button>
              </div>
            </div>
          )}

          {(userProgress || (user.role === "mentee" && sessionsData?.progress != null)) && (
            <div className="mentee-progress-card">
              <h2 className="section-title">Your mentoring progress</h2>
              {user.role === "mentee" && sessionsData?.progress != null && (
                <div className="mentee-12h-progress" style={{ marginBottom: "16px" }}>
                  <p className="stat-label" style={{ marginBottom: "4px" }}>Mentoring hours (goal: {(sessionsData.progress_target_hours ?? 12)}h)</p>
                  <p className="stat-value" style={{ marginBottom: "6px" }}>
                    {formatMinutesAsHours(sessionsData.progress.total_completed_minutes)} of {(sessionsData.progress_target_hours ?? 12)}h
                    <span className="progress-percent" style={{ marginLeft: "6px", fontWeight: "normal", fontSize: "0.9em" }}>
                      ({Math.round(sessionsData.progress.progress_percent || 0)}%)
                    </span>
                  </p>
                  <div className="progress-bar-wrap" role="progressbar" aria-valuenow={Math.round(sessionsData.progress.progress_percent || 0)} aria-valuemin={0} aria-valuemax={100} style={{ maxWidth: "320px" }}>
                    <div className="progress-bar-fill" style={{ width: Math.min(100, sessionsData.progress.progress_percent || 0) + "%" }} />
                  </div>
                </div>
              )}
              {userProgress && (
              <div className="stat-grid stat-grid-mentee">
                <div className="stat-card">
                  <p className="stat-label">Sessions completed</p>
                  <p className="stat-value">{userProgress.sessions_completed ?? 0}</p>
                </div>
                <div className="stat-card">
                  <p className="stat-label">Upcoming sessions</p>
                  <p className="stat-value">{userProgress.sessions_upcoming ?? upcoming.length}</p>
                </div>
                <div className="stat-card">
                  <p className="stat-label">Weeks with sessions</p>
                  <p className="stat-value">{userProgress.current_streak_weeks ?? 0}</p>
                </div>
                {typeof userProgress.days_to_first_session === "number" && (
                  <div className="stat-card">
                    <p className="stat-label">Time to first session</p>
                    <p className="stat-value">
                      {userProgress.days_to_first_session === 0
                        ? "Same day"
                        : `${userProgress.days_to_first_session} day${userProgress.days_to_first_session === 1 ? "" : "s"}`}
                    </p>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          <div className="stat-grid stat-grid-mentee">
            {termStats && (
              <div className="stat-card">
                <p className="stat-label">This term – sessions</p>
                <p className="stat-value">{termStats.sessions ?? "—"}</p>
              </div>
            )}
            {weekStats && (
              <div className="stat-card">
                <p className="stat-label">This week – sessions</p>
                <p className="stat-value">{weekStats.sessions ?? "—"}</p>
              </div>
            )}
            <div className="stat-card"><p className="stat-label">Mentor matches</p><p className="stat-value">{matchCount}</p></div>
            <div className="stat-card"><p className="stat-label">Total mentors</p><p className="stat-value">{stats?.total_mentors ?? "—"}</p></div>
          </div>
        </div>
      );
    }

    const weekStats = stats && stats.week;
    const termStats = stats && stats.term;
    const userProgress = stats && stats.user_progress;

    return (
      <div className="card">
        <h1 className="page-title">
          Welcome{user.username ? `, ${user.username}` : ""}
          {user.role && (
            <span className={"role-badge " + (user.role === "mentor" && user.mentor_approved === false ? "pending" : "")}>
              {user.role === "mentor"
                ? `Mentor${user.mentor_approved === false ? " (pending)" : ""}`
                : user.role === "mentee"
                ? "Mentee"
                : "Staff"}
            </span>
          )}
        </h1>
        <p className="page-subtitle">
          {user.role === "mentor"
            ? "You're signed in as a mentor. Here's your overview."
            : user.role === "mentee"
            ? "You're signed in as a mentee. Here's your overview."
            : user.role === "staff"
            ? "You're signed in as staff. Here's your overview."
            : "Here's your overview."}
        </p>

        {termStats && (
          <div className="impact-hero">
            <p className="impact-hero-label">This term</p>
            <p className="impact-hero-value">
              {termStats.sessions ?? 0} mentoring session{(termStats.sessions || 0) === 1 ? "" : "s"}
            </p>
            {weekStats && (
              <p className="impact-hero-sub">
                {weekStats.sessions ?? 0} this week · {stats?.completion_rate ?? 0}% completed overall
              </p>
            )}
          </div>
        )}

        <div className="stat-grid">
          <div className="stat-card"><p className="stat-label">Total mentors</p><p className="stat-value">{stats?.total_mentors ?? "—"}</p></div>
          <div className="stat-card"><p className="stat-label">Total mentees</p><p className="stat-value">{stats?.total_mentees ?? "—"}</p></div>
          <div className="stat-card"><p className="stat-label">All-time sessions</p><p className="stat-value">{stats?.total_sessions ?? "—"}</p></div>
          <div className="stat-card"><p className="stat-label">Completion rate</p><p className="stat-value">{stats?.completion_rate ?? 0}%</p></div>
          {userProgress && userProgress.role === "mentor" && (
            <div className="stat-card">
              <p className="stat-label">Your sessions completed</p>
              <p className="stat-value">{userProgress.sessions_completed ?? 0}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.home = HomePage;
  if (typeof module !== "undefined" && module.exports) module.exports = { HomePage };
})();
