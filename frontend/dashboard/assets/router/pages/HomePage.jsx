(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatDate } = Utils;
  const { Box, Grid, Card, CardContent, Typography } = (window.Mui || {});

  function formatMinutesAsHours(min) {
    const m = Number(min) || 0;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return mins > 0 ? `${h}h ${mins}min` : `${h}h`;
  }

  function HomePage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const { user, stats, authCheckDone, setActiveTab, sessionsData, menteeRecommendations, myMentor, theme } = ctx;
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

    const menteeHoursChartRef = useRef(null);
    const staffOverviewChartRef = useRef(null);

    if (user.role === "mentee") {
      const upcoming = sessionsData?.upcoming || [];
      const nextSession = upcoming[0];
      const hasQuestionnaire = !!(user.mentee_questionnaire_completed ?? user.questionnaire_completed);
      const matchCount = (menteeRecommendations || []).length;
      const userProgress = stats && stats.user_progress;
      const weekStats = stats && stats.week;
      const termStats = stats && stats.term;

      useEffect(() => {
        if (!sessionsData?.progress || !window.Chart) return;
        const canvas = document.getElementById("mentee-hours-chart");
        if (!canvas) return;
        if (menteeHoursChartRef.current) {
          menteeHoursChartRef.current.destroy();
        }
        const targetHours = sessionsData.progress_target_hours ?? 12;
        const completedMinutes = sessionsData.progress.total_completed_minutes || 0;
        const completedHours = Math.round((completedMinutes / 60) * 10) / 10;
        const remainingHours = Math.max(0, targetHours - completedHours);
        const isDark = theme === "dark";
        const completedColor = isDark ? "#605EA1" : "#22177A";
        const remainingColor = isDark ? "#334155" : "#e5e7eb";
        const legendTextColor = isDark ? "#cbd5f5" : "#475569";
        const centerTextColor = isDark ? "#e2e8f0" : "#111827";

        menteeHoursChartRef.current = new window.Chart(canvas, {
          type: "doughnut",
          data: {
            labels: ["Completed hours", "Remaining"],
            datasets: [
              {
                data: [completedHours, remainingHours],
                backgroundColor: [completedColor, remainingColor],
              },
            ],
          },
          options: {
            plugins: {
              legend: {
                position: "bottom",
                labels: { color: legendTextColor },
              },
            },
            cutout: "65%",
          },
          plugins: [
            {
              id: "menteeCenterText",
              afterDraw(chart) {
                const { ctx, chartArea: { width, height } } = chart;
                ctx.save();
                ctx.font = "bold 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
                ctx.fillStyle = centerTextColor;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const centerX = chart.getDatasetMeta(0).data[0].x;
                const centerY = chart.getDatasetMeta(0).data[0].y;
                const text = `${completedHours}h / ${targetHours}h`;
                ctx.fillText(text, centerX, centerY);
                ctx.restore();
              },
            },
          ],
        });
      }, [sessionsData, theme]);

      return (
        <div className="card mentee-dashboard">
          <div className="mentee-dashboard-hero">
            <div className="dashboard-hero">
              <div className="dashboard-hero-main">
                <div className="dashboard-hero-icon" aria-hidden="true">🎓</div>
                <div className="dashboard-hero-text">
                  <h1 className="dashboard-hero-title">
                    Welcome back{user.username ? `, ${user.username}` : ""}
                  </h1>
                  <p className="dashboard-hero-subtitle">
                    Track your mentoring progress, find mentors, and keep sessions organized in one place.
                  </p>
                </div>
              </div>
              <div className="dashboard-hero-cta">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setActiveTab("matching")}
                >
                  Find mentors
                </button>
              </div>
            </div>
          </div>

          <div className="top-stat-grid">
            <div className="top-stat-card">
              <div className="top-stat-icon" aria-hidden="true">👥</div>
              <div className="top-stat-content">
                <div className="top-stat-label">Mentor recommendations</div>
                <div className="top-stat-value">{matchCount}</div>
              </div>
            </div>
            <div className="top-stat-card">
              <div className="top-stat-icon" aria-hidden="true">📅</div>
              <div className="top-stat-content">
                <div className="top-stat-label">Total sessions</div>
                <div className="top-stat-value">
                  {(userProgress?.sessions_completed ?? 0) + (userProgress?.sessions_upcoming ?? upcoming.length)}
                </div>
              </div>
            </div>
            <div className="top-stat-card">
              <div className="top-stat-icon" aria-hidden="true">⏱</div>
              <div className="top-stat-content">
                <div className="top-stat-label">Mentoring hours progress</div>
                <div className="top-stat-value">
                  {Math.round((sessionsData?.progress?.progress_percent || 0))}%
                </div>
              </div>
            </div>
            <div className="top-stat-card">
              <div className="top-stat-icon" aria-hidden="true">⏳</div>
              <div className="top-stat-content">
                <div className="top-stat-label">Pending sessions</div>
                <div className="top-stat-value">
                  {userProgress?.sessions_upcoming ?? upcoming.length}
                </div>
              </div>
            </div>
          </div>

          <div className="quick-actions-section">
            <h2 className="section-title">Quick actions</h2>
            <div className="quick-actions-grid">
              <button
                type="button"
                className="quick-action-pill primary"
                onClick={() => setActiveTab("matching")}
              >
                <span className="quick-action-pill-icon" aria-hidden="true">👤</span>
                <span>Find mentors</span>
              </button>
              <button
                type="button"
                className="quick-action-pill"
                onClick={() => setActiveTab("sessions")}
              >
                <span className="quick-action-pill-icon" aria-hidden="true">➕</span>
                <span>Book session</span>
              </button>
              <button
                type="button"
                className="quick-action-pill"
                onClick={() => setActiveTab("matching")}
              >
                <span className="quick-action-pill-icon" aria-hidden="true">📊</span>
                <span>View matches</span>
              </button>
              <button
                type="button"
                className="quick-action-pill"
                onClick={() => setActiveTab("sessions")}
              >
                <span className="quick-action-pill-icon" aria-hidden="true">💬</span>
                <span>Message mentor</span>
              </button>
            </div>
          </div>

          {matchCount > 0 && (
            <div className="mentee-highlight-card">
              <div className="mentee-highlight-main">
                <div className="mentee-highlight-icon" aria-hidden="true">⭐</div>
                <p className="mentee-highlight-text">
                  You have <strong>{matchCount}</strong> mentor recommendation{matchCount !== 1 ? "s" : ""} waiting for you.
                </p>
              </div>
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
              {user.role === "mentee" && myMentor && (
                <div className="mentee-official-mentor-card">
                  <div className="mentee-official-mentor-main">
                    <div className="mentee-official-mentor-avatar">
                      <div className="sidebar-avatar-wrapper">
                        {myMentor.avatar_url ? (
                          <img src={myMentor.avatar_url} alt={myMentor.username} className="sidebar-avatar" />
                        ) : (
                          <div className="sidebar-avatar fallback">
                            {(myMentor.username || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mentee-official-mentor-text">
                      <p className="stat-label" style={{ marginBottom: 2 }}>Your official mentor</p>
                      <p className="stat-value" style={{ marginBottom: 2 }}>{myMentor.username}</p>
                      {myMentor.accepted_at && (
                        <p className="muted" style={{ fontSize: "12px" }}>
                          Accepted {formatDate(myMentor.accepted_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => setActiveTab("sessions")}
                  >
                    Go to sessions
                  </button>
                </div>
              )}
              {user.role === "mentee" && sessionsData?.progress != null && (
                <div className="mentee-12h-progress mentee-12h-progress-card" style={{ marginBottom: "16px" }}>
                  <div className="mentee-12h-progress-label-row">
                    <p className="stat-label">Mentoring hours (goal: {(sessionsData.progress_target_hours ?? 12)}h)</p>
                    <span className="progress-percent">
                      {Math.round(sessionsData.progress.progress_percent || 0)}% complete
                    </span>
                  </div>
                  <p className="stat-value" style={{ marginBottom: "8px" }}>
                    {formatMinutesAsHours(sessionsData.progress.total_completed_minutes)} of {(sessionsData.progress_target_hours ?? 12)}h
                  </p>
                  <div className="progress-bar-wrap" role="progressbar" aria-valuenow={Math.round(sessionsData.progress.progress_percent || 0)} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-bar-fill" style={{ width: Math.min(100, sessionsData.progress.progress_percent || 0) + "%" }} />
                  </div>
                  <div className="progress-milestones">
                    <span>3h</span>
                    <span>6h</span>
                    <span>9h</span>
                    <span>12h</span>
                  </div>
                  <div className="mentee-chart-wrapper">
                    <canvas id="mentee-hours-chart" height="150" />
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

          <div className="activity-section">
            <h2 className="section-title">Recent activity</h2>
            <ul className="activity-list">
              {matchCount > 0 && (
                <li className="activity-item">
                  <div className="activity-icon" aria-hidden="true">👥</div>
                  <div className="activity-content">
                    <p className="activity-title">New mentor recommendation</p>
                    <p className="activity-meta">
                      You currently have {matchCount} mentor recommendation{matchCount !== 1 ? "s" : ""} based on your questionnaire.
                    </p>
                  </div>
                </li>
              )}
              {nextSession && (
                <li className="activity-item">
                  <div className="activity-icon" aria-hidden="true">📅</div>
                  <div className="activity-content">
                    <p className="activity-title">Upcoming session booked</p>
                    <p className="activity-meta">
                      {formatDate(nextSession.scheduled_at)} · {nextSession.subject || "Mentoring session"} with {nextSession.mentor_username}
                    </p>
                  </div>
                </li>
              )}
              {userProgress && (userProgress.sessions_completed ?? 0) > 0 && (
                <li className="activity-item">
                  <div className="activity-icon" aria-hidden="true">✅</div>
                  <div className="activity-content">
                    <p className="activity-title">Sessions completed</p>
                    <p className="activity-meta">
                      You’ve completed {userProgress.sessions_completed} session{userProgress.sessions_completed === 1 ? "" : "s"} so far.
                    </p>
                  </div>
                </li>
              )}
              {(!matchCount && !nextSession && !(userProgress && (userProgress.sessions_completed ?? 0) > 0)) && (
                <li className="activity-item">
                  <div className="activity-icon" aria-hidden="true">✨</div>
                  <div className="activity-content">
                    <p className="activity-title">No recent activity yet</p>
                    <p className="activity-meta">
                      Start by completing your questionnaire, finding mentors, or booking your first session.
                    </p>
                  </div>
                </li>
              )}
            </ul>
          </div>

          <div className="lower-dashboard-grid">
            <div className="lower-card">
              <div className="lower-card-header">
                <p className="lower-card-title">Upcoming sessions</p>
                <div className="lower-card-icon" aria-hidden="true">📅</div>
              </div>
              <ul className="lower-card-list">
                {upcoming.slice(0, 3).map((s) => (
                  <li key={s.id}>
                    <div className="lower-card-item-main">
                      {s.subject || "Mentoring session"}{s.topic ? " · " + s.topic : ""}
                    </div>
                    <div className="lower-card-item-meta">
                      {formatDate(s.scheduled_at)}
                    </div>
                  </li>
                ))}
                {upcoming.length === 0 && (
                  <li className="lower-card-item-meta">
                    No upcoming sessions yet. Use Sessions to book your first one.
                  </li>
                )}
              </ul>
            </div>

            <div className="lower-card">
              <div className="lower-card-header">
                <p className="lower-card-title">Mentor suggestions</p>
                <div className="lower-card-icon" aria-hidden="true">👥</div>
              </div>
              <ul className="lower-card-list">
                {(menteeRecommendations || []).slice(0, 3).map((m) => (
                  <li key={m.mentor_id}>
                    <div className="lower-card-item-main">
                      Mentor: {m.mentor_username}
                    </div>
                    <div className="lower-card-item-meta">
                      Match score: {Math.round((m.score || 0) * 100)}%
                    </div>
                  </li>
                ))}
                {(!menteeRecommendations || menteeRecommendations.length === 0) && (
                  <li className="lower-card-item-meta">
                    No mentor suggestions yet. Complete your questionnaire or refresh matches.
                  </li>
                )}
              </ul>
            </div>

            <div className="lower-card">
              <div className="lower-card-header">
                <p className="lower-card-title">Announcements</p>
                <div className="lower-card-icon" aria-hidden="true">📣</div>
              </div>
              <p className="lower-card-item-meta" style={{ marginBottom: "8px" }}>
                Stay up to date with messages from your mentors and coordinators.
              </p>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setActiveTab("announcements")}
              >
                View announcements
              </button>
            </div>
          </div>

          {Box && Grid && Card && CardContent && Typography ? (
            <Box sx={{ mt: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={6} md={6}>
                  <Card elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Mentor matches
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.5 }}>
                        {matchCount}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={6} md={6}>
                  <Card elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">
                        Total mentors
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 0.5 }}>
                        {stats?.total_mentors ?? "—"}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <div className="stat-grid stat-grid-mentee">
              <div className="stat-card"><p className="stat-label">Mentor matches</p><p className="stat-value">{matchCount}</p></div>
              <div className="stat-card"><p className="stat-label">Total mentors</p><p className="stat-value">{stats?.total_mentors ?? "—"}</p></div>
            </div>
          )}
        </div>
      );
    }

    const weekStats = stats && stats.week;
    const termStats = stats && stats.term;
    const userProgress = stats && stats.user_progress;

    useEffect(() => {
      if (!stats || !window.Chart) return;
      const canvas = document.getElementById("staff-overview-chart");
      if (!canvas) return;
      if (staffOverviewChartRef.current) {
        staffOverviewChartRef.current.destroy();
      }
      const totalMentors = stats.total_mentors ?? 0;
      const totalMentees = stats.total_mentees ?? 0;
      const totalSessions = stats.total_sessions ?? 0;
      const isDark = theme === "dark";
      const legendTextColor = isDark ? "#cbd5f5" : "#475569";
      const staffColors = isDark
        ? ["#605EA1", "#34d399", "#fb923c"]
        : ["#22177A", "#22c55e", "#f97316"];

      staffOverviewChartRef.current = new window.Chart(canvas, {
        type: "doughnut",
        data: {
          labels: ["Mentors", "Mentees", "Sessions"],
          datasets: [
            {
              data: [totalMentors, totalMentees, totalSessions],
              backgroundColor: staffColors,
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: legendTextColor },
            },
          },
          cutout: "55%",
        },
      });
    }, [stats, theme]);

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

        {Box && Grid && Card && CardContent && Typography ? (
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={2} alignItems="stretch">
              <Grid item xs={12} md={7}>
                <Card elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", height: "100%" }}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                      Platform overview
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Total mentors
                        </Typography>
                        <Typography variant="h5">
                          {stats?.total_mentors ?? "—"}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Total mentees
                        </Typography>
                        <Typography variant="h5">
                          {stats?.total_mentees ?? "—"}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          All-time sessions
                        </Typography>
                        <Typography variant="h5">
                          {stats?.total_sessions ?? "—"}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sm={6}>
                        <Typography variant="caption" color="text.secondary">
                          Completion rate
                        </Typography>
                        <Typography variant="h5">
                          {stats?.completion_rate ?? 0}%
                        </Typography>
                      </Grid>
                      {userProgress && userProgress.role === "mentor" && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">
                            Your sessions completed
                          </Typography>
                          <Typography variant="h6">
                            {userProgress.sessions_completed ?? 0}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={5}>
                <Card elevation={0} sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Mentors / mentees / sessions
                  </Typography>
                  <div className="staff-chart-wrapper">
                    <canvas id="staff-overview-chart" height="140" />
                  </div>
                </Card>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <>
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
            <div className="staff-chart-wrapper" style={{ marginTop: "16px", maxWidth: "420px" }}>
              <canvas id="staff-overview-chart" height="140" />
            </div>
          </>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.home = HomePage;
  if (typeof module !== "undefined" && module.exports) module.exports = { HomePage };
})();
