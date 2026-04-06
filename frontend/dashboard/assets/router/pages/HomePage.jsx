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

  /** Stroke SVG icons (same style as sidebar) for mentee dashboard */
  function MenteeDashIcon({ name, size }) {
    const s = size != null ? size : 18;
    const p = {
      width: s,
      height: s,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
    };
    const icons = {
      users: (
        <svg {...p}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      calendar: (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
      clock: (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      pending: (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <line x1="10" y1="15" x2="10" y2="9" />
          <line x1="14" y1="15" x2="14" y2="9" />
        </svg>
      ),
      check: (
        <svg {...p}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      sparkles: (
        <svg {...p}>
          <path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      star: (
        <svg {...p}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" />
        </svg>
      ),
      megaphone: (
        <svg {...p}>
          <path d="m3 11 18-5v12L3 14v-3z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      ),
      plus: (
        <svg {...p}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      barChart: (
        <svg {...p}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      message: (
        <svg {...p}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="9" y1="10" x2="15" y2="10" />
          <line x1="9" y1="14" x2="13" y2="14" />
        </svg>
      ),
      user: (
        <svg {...p}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    };
    const node = icons[name];
    if (!node) return null;
    return <span className="mentee-dash-icon-wrap">{node}</span>;
  }

  function HomePage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const {
      user,
      stats,
      authCheckDone,
      setActiveTab,
      sessionsData,
      sessionsLoading,
      menteeRecommendations,
      myMentor,
      theme,
      mentorRequests,
    } = ctx;
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
        <div className="home-dashboard-space mentee-dashboard">
          <div className="mentee-dashboard-hero">
            <div className="dashboard-hero">
              <div className="dashboard-hero-main">
                <div className="dashboard-hero-icon" aria-hidden="true">
                  <img
                    className="dashboard-hero-logo"
                    src={theme === "dark" ? "/static/assets/logoreal.svg" : "/static/assets/logodark.svg"}
                    alt=""
                  />
                </div>
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
              <div className="top-stat-icon" aria-hidden="true"><MenteeDashIcon name="users" /></div>
              <div className="top-stat-content">
                <div className="top-stat-label">Mentor recommendations</div>
                <div className="top-stat-value">{matchCount}</div>
              </div>
            </div>
            <div className="top-stat-card">
              <div className="top-stat-icon" aria-hidden="true"><MenteeDashIcon name="calendar" /></div>
              <div className="top-stat-content">
                <div className="top-stat-label">Total sessions</div>
                <div className="top-stat-value">
                  {(userProgress?.sessions_completed ?? 0) + (userProgress?.sessions_upcoming ?? upcoming.length)}
                </div>
              </div>
            </div>
            <div className="top-stat-card">
              <div className="top-stat-icon" aria-hidden="true"><MenteeDashIcon name="clock" /></div>
              <div className="top-stat-content">
                <div className="top-stat-label">Mentoring hours progress</div>
                <div className="top-stat-value">
                  {Math.round((sessionsData?.progress?.progress_percent || 0))}%
                </div>
              </div>
            </div>
            <div className="top-stat-card">
              <div className="top-stat-icon" aria-hidden="true"><MenteeDashIcon name="pending" /></div>
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
                <span className="quick-action-pill-icon" aria-hidden="true"><MenteeDashIcon name="users" size={16} /></span>
                <span>Find mentors</span>
              </button>
              <button
                type="button"
                className="quick-action-pill"
                onClick={() => setActiveTab("sessions")}
              >
                <span className="quick-action-pill-icon" aria-hidden="true"><MenteeDashIcon name="plus" size={16} /></span>
                <span>Book session</span>
              </button>
              <button
                type="button"
                className="quick-action-pill"
                onClick={() => setActiveTab("matching")}
              >
                <span className="quick-action-pill-icon" aria-hidden="true"><MenteeDashIcon name="barChart" size={16} /></span>
                <span>View matches</span>
              </button>
              <button
                type="button"
                className="quick-action-pill"
                onClick={() => setActiveTab("sessions")}
              >
                <span className="quick-action-pill-icon" aria-hidden="true"><MenteeDashIcon name="message" size={16} /></span>
                <span>Message mentor</span>
              </button>
            </div>
          </div>

          {matchCount > 0 && (
            <div className="mentee-highlight-card">
              <div className="mentee-highlight-main">
                <div className="mentee-highlight-icon" aria-hidden="true"><MenteeDashIcon name="star" /></div>
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
                  <div className="activity-icon" aria-hidden="true"><MenteeDashIcon name="users" size={16} /></div>
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
                  <div className="activity-icon" aria-hidden="true"><MenteeDashIcon name="calendar" size={16} /></div>
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
                  <div className="activity-icon" aria-hidden="true"><MenteeDashIcon name="check" size={16} /></div>
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
                  <div className="activity-icon" aria-hidden="true"><MenteeDashIcon name="sparkles" size={16} /></div>
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
                <div className="lower-card-icon" aria-hidden="true"><MenteeDashIcon name="calendar" /></div>
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
                <div className="lower-card-icon" aria-hidden="true"><MenteeDashIcon name="users" /></div>
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
                <div className="lower-card-icon" aria-hidden="true"><MenteeDashIcon name="megaphone" /></div>
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
              display: false,
            },
          },
          cutout: "55%",
        },
      });
    }, [stats, theme]);

    const roleLine =
      user.role === "mentor"
        ? "You're signed in as a mentor."
        : user.role === "staff"
        ? "You're signed in as staff."
        : "You're signed in.";

    const totalMentors = stats?.total_mentors ?? 0;
    const totalMentees = stats?.total_mentees ?? 0;
    const totalSessions = stats?.total_sessions ?? 0;
    const completionRate = stats?.completion_rate ?? 0;
    const yourSessionsCompleted = userProgress?.sessions_completed ?? 0;

    const pendingMentorRequests =
      user.role === "mentor" ? (mentorRequests || []).filter((r) => !r.accepted).length : 0;
    const mentorMenteesCount = stats?.user_progress?.mentees_count ?? 0;
    const progressByMentee =
      user.role === "mentor" ? ((sessionsData && sessionsData.progress_by_mentee) || []) : [];
    const upcomingSessionsList =
      user.role === "mentor" ? ((sessionsData && sessionsData.upcoming) || []) : [];
    const targetHours = sessionsData?.progress_target_hours ?? 12;

    return (
      <div className="home-dashboard-space mentor-staff-dashboard">
        <div className="home-space-glow" aria-hidden="true" />

        <div className="home-top-stats">
          <div className="home-mini-stat">
            <div className="home-mini-stat-label">Total mentors</div>
            <div className="home-mini-stat-value">{totalMentors}</div>
          </div>
          <div className="home-mini-stat">
            <div className="home-mini-stat-label">Total mentees</div>
            <div className="home-mini-stat-value">{totalMentees}</div>
          </div>
          <div className="home-mini-stat">
            <div className="home-mini-stat-label">All-time sessions</div>
            <div className="home-mini-stat-value">{totalSessions}</div>
          </div>
          <div className="home-mini-stat">
            <div className="home-mini-stat-label">Your sessions completed</div>
            <div className="home-mini-stat-value">{yourSessionsCompleted}</div>
          </div>
          <div className="home-mini-stat">
            <div className="home-mini-stat-label">Completion rate</div>
            <div className="home-mini-stat-value">{completionRate}%</div>
          </div>
        </div>

        <div className="home-dashboard-grid">
          <section className="home-hero-space">
            <div className="home-hero-text">
              <h1 className="home-hero-title">
                Welcome back{user.username ? `, ${user.username}` : ""}
              </h1>
              <p className="home-hero-sub">{roleLine}</p>
            </div>

            <div className="home-hero-icon" aria-hidden="true">
              <img
                className="home-hero-logo"
                src={theme === "dark" ? "/static/assets/logoreal.svg" : "/static/assets/logodark.svg"}
                alt="PeerLink logo"
              />
            </div>
          </section>

          <aside className="home-analytics-card">
            <div className="home-analytics-header">
              <div className="home-analytics-title">Analytics</div>
              <div className="home-analytics-sub">
                {termStats ? `${termStats.sessions ?? 0} this term` : "System overview"}
              </div>
            </div>

            <div className="home-analytics-ring" aria-label="Mentors, mentees, and sessions distribution">
              <canvas id="staff-overview-chart" height="180" />
            </div>

            <div className="home-analytics-tabs" aria-hidden="true">
              <span className="home-analytics-tab is-active">Mentors</span>
              <span className="home-analytics-tab">Mentees</span>
              <span className="home-analytics-tab">Sessions</span>
            </div>

            <div className="home-analytics-foot">
              <span className="home-analytics-chip">
                This week: {weekStats?.sessions ?? 0} sessions
              </span>
              <span className="home-analytics-chip">
                Avg completion: {completionRate}%
              </span>
            </div>
          </aside>
        </div>

        {user.role === "mentor" && (
          <>
            <div className="quick-actions-section">
              <h2 className="section-title">Quick actions</h2>
              <div className="quick-actions-grid">
                <button
                  type="button"
                  className="quick-action-pill primary"
                  onClick={() => setActiveTab("matching")}
                >
                  <span className="quick-action-pill-icon" aria-hidden="true">
                    <MenteeDashIcon name="users" size={16} />
                  </span>
                  <span>View mentees</span>
                </button>
                <button
                  type="button"
                  className="quick-action-pill"
                  onClick={() => setActiveTab("sessions")}
                >
                  <span className="quick-action-pill-icon" aria-hidden="true">
                    <MenteeDashIcon name="plus" size={16} />
                  </span>
                  <span>Book session</span>
                </button>
                <button
                  type="button"
                  className="quick-action-pill"
                  onClick={() => setActiveTab("matching")}
                >
                  <span className="quick-action-pill-icon" aria-hidden="true">
                    <MenteeDashIcon name="barChart" size={16} />
                  </span>
                  <span>View matches</span>
                </button>
                <button
                  type="button"
                  className="quick-action-pill"
                  onClick={() => setActiveTab("sessions")}
                >
                  <span className="quick-action-pill-icon" aria-hidden="true">
                    <MenteeDashIcon name="message" size={16} />
                  </span>
                  <span>Message mentee</span>
                </button>
              </div>
            </div>

            <div className="mentor-home-bottom-grid">
              <section className="mentor-home-panel mentor-home-panel--summary" aria-labelledby="mentor-mentee-summary-heading">
                <div className="mentor-home-panel-head">
                  <h2 id="mentor-mentee-summary-heading" className="mentor-home-panel-title">
                    Mentee activity
                  </h2>
                  <p className="mentor-home-panel-sub">From your live account data</p>
                </div>
                <div className="mentor-summary-metrics">
                  <div className="mentor-summary-metric">
                    <div className="mentor-summary-metric-label">Active mentees</div>
                    <div className="mentor-summary-metric-value">{mentorMenteesCount}</div>
                    <span className="mentor-summary-metric-hint">Accepted pairings</span>
                  </div>
                  <div className="mentor-summary-metric">
                    <div className="mentor-summary-metric-label">Pending requests</div>
                    <div className="mentor-summary-metric-value">{pendingMentorRequests}</div>
                    <span className="mentor-summary-metric-hint">Auto-accepted when slots are available</span>
                  </div>
                  <div className="mentor-summary-metric">
                    <div className="mentor-summary-metric-label">Upcoming sessions</div>
                    <div className="mentor-summary-metric-value">{upcomingSessionsList.length}</div>
                    <span className="mentor-summary-metric-hint">Scheduled with mentees</span>
                  </div>
                  <div className="mentor-summary-metric">
                    <div className="mentor-summary-metric-label">Your streak</div>
                    <div className="mentor-summary-metric-value">
                      {stats?.user_progress?.current_streak_weeks ?? 0} wk
                    </div>
                    <span className="mentor-summary-metric-hint">Weeks with completed sessions</span>
                  </div>
                </div>
              </section>

              <section className="mentor-home-panel mentor-home-panel--progress" aria-labelledby="mentor-progress-heading">
                <div className="mentor-home-panel-head">
                  <h2 id="mentor-progress-heading" className="mentor-home-panel-title">
                    Mentee progress ({targetHours}h goal)
                  </h2>
                  <p className="mentor-home-panel-sub">Completion toward program hours per mentee</p>
                </div>
                {sessionsLoading ? (
                  <p className="mentor-home-muted">Loading session data…</p>
                ) : progressByMentee.length === 0 ? (
                  <p className="mentor-home-muted">
                    No mentee progress yet. Once mentees are auto-matched to you, progress will appear here.
                  </p>
                ) : (
                  <ul className="mentor-mentee-progress-list">
                    {progressByMentee.slice(0, 6).map((row) => (
                      <li key={row.mentee_id} className="mentor-mentee-progress-item">
                        <div className="mentor-mentee-progress-top">
                          <span className="mentor-mentee-name">{row.mentee_username}</span>
                          <span className="mentor-mentee-pct">{row.progress_percent}%</span>
                        </div>
                        <div className="mentor-mentee-progress-bar" role="presentation">
                          <div
                            className="mentor-mentee-progress-fill"
                            style={{ width: `${Math.min(100, Number(row.progress_percent) || 0)}%` }}
                          />
                        </div>
                        <div className="mentor-mentee-progress-meta">
                          {formatMinutesAsHours(row.total_completed_minutes || 0)} logged
                          {row.difficulty_level != null ? ` · Level ${row.difficulty_level}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="mentor-home-panel mentor-home-panel--full" aria-labelledby="mentor-upcoming-heading">
              <div className="mentor-home-panel-head">
                <h2 id="mentor-upcoming-heading" className="mentor-home-panel-title">
                  Upcoming sessions with mentees
                </h2>
                <p className="mentor-home-panel-sub">From your schedule</p>
              </div>
              {sessionsLoading ? (
                <p className="mentor-home-muted">Loading…</p>
              ) : upcomingSessionsList.length === 0 ? (
                <p className="mentor-home-muted">No upcoming sessions. Schedule one from the Sessions tab.</p>
              ) : (
                <ul className="mentor-upcoming-list">
                  {upcomingSessionsList.slice(0, 5).map((s) => (
                    <li key={s.id} className="mentor-upcoming-row">
                      <div>
                        <div className="mentor-upcoming-name">{s.mentee_username}</div>
                        <div className="mentor-upcoming-meta">
                          {s.subject || "Subject TBD"}
                          {s.topic ? ` · ${s.topic}` : ""}
                        </div>
                      </div>
                      <div className="mentor-upcoming-when">{formatDate(s.scheduled_at)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
