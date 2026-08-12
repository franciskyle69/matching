(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatDate, MentorRoleBadge } = Utils;

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
          <polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            fill="none"
          />
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

  function WelcomeHeroAvatar({ user }) {
    if (!user) return null;
    const displayName =
      user.full_name || user.display_name || user.username || "You";
    const initial = displayName.slice(0, 1).toUpperCase();
    const avatarUrl = user.avatar_url || "";
    return (
      <div className="dashboard-welcome-avatar" aria-hidden="true">
        <div className="sidebar-avatar-wrapper dashboard-welcome-avatar-wrap">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="sidebar-avatar" />
          ) : (
            <div className="sidebar-avatar fallback">{initial}</div>
          )}
        </div>
      </div>
    );
  }

  function HomePage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const {
      user,
      stats,
      authCheckDone,
      setActiveTab,
      menteeRecommendations,
      myMentor,
      theme,
      mentorRequests,
      mentorProfile,
    } = ctx;
    if (!authCheckDone) return null;
    if (!user) {
      return (
        <div className="card cta-card page-shell">
          <h1 className="page-title">Mentor–Mentee Matching</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Connect with mentors or mentees through smart matching in one place.
          </p>
          <div className="btn-row">
            <button
              className="btn"
              onClick={() => {
                window.location.href = "/portal/";
              }}
            >
              Get started
            </button>
            <button
              className="btn secondary"
              onClick={() => {
                window.location.href = "/portal/";
              }}
            >
              I already have an account
            </button>
            <button
              type="button"
              className="btn secondary auth-landing-back-btn"
              onClick={() => {
                window.location.href = "/landing/";
              }}
            >
              Back to landing
            </button>
          </div>
        </div>
      );
    }

    const staffOverviewChartRef = useRef(null);

    if (user.role === "mentee") {
      const hasQuestionnaire = !!(
        user.mentee_questionnaire_completed ?? user.questionnaire_completed
      );
      const matchCount = (menteeRecommendations || []).length;
      const userProgress = stats && stats.user_progress;

      return (
        <div className="home-dashboard-space mentee-dashboard mentee-dashboard-v2 page-shell">
          <section className="mentee-v2-panel mentee-v2-hero">
            <div className="mentee-v2-hero-leading">
              <WelcomeHeroAvatar user={user} />
              <div className="mentee-v2-hero-copy">
                <h1 className="mentee-v2-title">
                  Welcome back
                  {user.full_name || user.display_name
                    ? `, ${user.full_name || user.display_name}`
                    : user.username
                      ? `, ${user.username}`
                      : ""}
                </h1>
                <p className="mentee-v2-subtitle">
                  A focused view of your mentoring journey, matching, and next
                  best actions.
                </p>
              </div>
            </div>
            <div className="mentee-v2-hero-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setActiveTab("matching")}
              >
                Find mentors
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setActiveTab("announcements")}
              >
                Announcements
              </button>
            </div>
          </section>

          <section className="mentee-v2-quickbar" aria-label="Quick actions">
            <button
              type="button"
              className="mentee-v2-quickbar-btn is-primary"
              onClick={() => setActiveTab("matching")}
            >
              <MenteeDashIcon name="users" size={16} />
              <span>Find mentors</span>
            </button>
            <button
              type="button"
              className="mentee-v2-quickbar-btn"
              onClick={() => setActiveTab("matching")}
            >
              <MenteeDashIcon name="plus" size={16} />
              <span>View matches</span>
            </button>
            <button
              type="button"
              className="mentee-v2-quickbar-btn"
              onClick={() => setActiveTab("matching")}
            >
              <MenteeDashIcon name="barChart" size={16} />
              <span>View matches</span>
            </button>
            <button
              type="button"
              className="mentee-v2-quickbar-btn"
              onClick={() => setActiveTab("announcements")}
            >
              <MenteeDashIcon name="megaphone" size={16} />
              <span>Announcements</span>
            </button>
          </section>

          <section className="mentee-v2-panel mentee-v2-analytics">
            <div className="mentee-v2-section-head">
              <h2>Analytics snapshot</h2>
              <p>Key metrics at a glance</p>
            </div>
            <div className="mentee-v2-metric-grid">
              <article className="mentee-v2-metric-card">
                <span className="mentee-v2-metric-icon">
                  <MenteeDashIcon name="users" />
                </span>
                <p className="mentee-v2-metric-label">Mentor recommendations</p>
                <p className="mentee-v2-metric-value">{matchCount}</p>
              </article>
              <article className="mentee-v2-metric-card">
                <span className="mentee-v2-metric-icon">
                  <MenteeDashIcon name="calendar" />
                </span>
                <p className="mentee-v2-metric-label">Has mentor</p>
                <p className="mentee-v2-metric-value">
                  {userProgress?.has_mentor ? "Yes" : "No"}
                </p>
              </article>
              <article className="mentee-v2-metric-card">
                <span className="mentee-v2-metric-icon">
                  <MenteeDashIcon name="clock" />
                </span>
                <p className="mentee-v2-metric-label">Recommendations</p>
                <p className="mentee-v2-metric-value">{matchCount}</p>
              </article>
              <article className="mentee-v2-metric-card">
                <span className="mentee-v2-metric-icon">
                  <MenteeDashIcon name="pending" />
                </span>
                <p className="mentee-v2-metric-label">Pairings</p>
                <p className="mentee-v2-metric-value">
                  {stats?.accepted_pairings ?? 0}
                </p>
              </article>
            </div>
          </section>

          <div className="mentee-v2-main-grid">
            <section className="mentee-v2-panel mentee-v2-mentor">
              <div className="mentee-v2-section-head">
                <h2>Your mentor</h2>
                <p>Primary relationship and next action</p>
              </div>
              {myMentor ? (
                <div className="mentee-v2-mentor-card">
                  <div className="mentee-v2-mentor-main">
                    <div className="sidebar-avatar-wrapper">
                      {myMentor.avatar_url ? (
                        <img
                          src={myMentor.avatar_url}
                          alt={myMentor.display_name || myMentor.username}
                          className="sidebar-avatar"
                        />
                      ) : (
                        <div className="sidebar-avatar fallback">
                          {(myMentor.display_name || myMentor.username || "?")
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="mentee-v2-mentor-name">
                        {myMentor.display_name || myMentor.username}
                      </p>
                      {myMentor.accepted_at && (
                        <p className="mentee-v2-muted">
                          Mentor accepted {formatDate(myMentor.accepted_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => setActiveTab("matching")}
                  >
                    View matching
                  </button>
                </div>
              ) : (
                <div className="mentee-v2-empty-state">
                  <p>You do not have an official mentor yet.</p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setActiveTab("matching")}
                  >
                    Browse recommendations
                  </button>
                </div>
              )}

              {!hasQuestionnaire && (
                <div className="mentee-v2-inline-cta">
                  <span>
                    <MenteeDashIcon name="sparkles" size={16} />
                  </span>
                  <p>
                    Set your mentoring subjects and competencies to unlock
                    better mentor matches.
                  </p>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setActiveTab("onboarding")}
                  >
                    Continue onboarding
                  </button>
                </div>
              )}
            </section>
          </div>

          <div className="mentee-v2-main-grid">
            <section className="mentee-v2-panel mentee-v2-activity">
              <div className="mentee-v2-section-head">
                <h2>Recent activity</h2>
                <p>Latest events in your learning flow</p>
              </div>
              <ul className="mentee-v2-timeline">
                {matchCount > 0 && (
                  <li className="mentee-v2-timeline-item">
                    <span className="mentee-v2-timeline-icon">
                      <MenteeDashIcon name="users" size={14} />
                    </span>
                    <div>
                      <p className="mentee-v2-timeline-title">
                        New mentor recommendations
                      </p>
                      <p className="mentee-v2-muted">
                        You currently have {matchCount} recommendation
                        {matchCount !== 1 ? "s" : ""}.
                      </p>
                    </div>
                  </li>
                )}
                {!matchCount && (
                  <li className="mentee-v2-empty-state">
                    <p>No recent activity yet.</p>
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => setActiveTab("matching")}
                    >
                      Start exploring mentors
                    </button>
                  </li>
                )}
              </ul>
            </section>
          </div>
        </div>
      );
    }

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
      const acceptedPairings = stats.accepted_pairings ?? 0;
      const isDark = theme === "dark";
      const legendTextColor = isDark ? "#cbd5f5" : "#475569";
      const staffColors = isDark
        ? ["#605EA1", "#34d399", "#fb923c"]
        : ["#22177A", "#22c55e", "#f97316"];

      staffOverviewChartRef.current = new window.Chart(canvas, {
        type: "doughnut",
        data: {
          labels: ["Mentors", "Mentees", "Pairings"],
          datasets: [
            {
              data: [totalMentors, totalMentees, acceptedPairings],
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
    const acceptedPairings = stats?.accepted_pairings ?? 0;

    if (user.role === "mentor") {
      const acceptedRequests = Array.isArray(mentorRequests)
        ? mentorRequests.filter((request) => request.accepted)
        : [];
      const pendingRequests = Array.isArray(mentorRequests)
        ? mentorRequests.filter((request) => !request.accepted)
        : [];
      const mentorCapacity = Math.max(
        1,
        Number(mentorProfile?.capacity ?? userProgress?.mentor_capacity ?? 3) ||
          3,
      );
      const capacityUsed = Math.min(mentorCapacity, acceptedRequests.length);
      const capacityPct = Math.round((capacityUsed / mentorCapacity) * 100);
      const subjects = Array.isArray(mentorProfile?.subjects)
        ? mentorProfile.subjects
        : [];
      const topics = Array.isArray(mentorProfile?.topics)
        ? mentorProfile.topics
        : [];
      const availability = Array.isArray(mentorProfile?.availability)
        ? mentorProfile.availability
        : [];
      const mentorType = mentorProfile?.role || user.mentor_role || "";
      const profileReady = !!(
        user.mentor_questionnaire_completed ||
        subjects.length ||
        topics.length ||
        mentorProfile?.expertise_level
      );

      return (
        <div className="home-dashboard-space mentor-dashboard-v2 page-shell">
          <div className="home-space-glow" aria-hidden="true" />

          <section className="mentor-v2-hero">
            <div className="mentor-v2-hero-leading">
              <WelcomeHeroAvatar user={user} />
              <div className="mentor-v2-hero-copy">
                <div className="mentor-v2-eyebrow">Mentor Dashboard</div>
                <h1 className="mentor-v2-title">
                  Welcome back
                  {user.full_name || user.display_name
                    ? `, ${user.full_name || user.display_name}`
                    : user.username
                      ? `, ${user.username}`
                      : ""}
                </h1>
                <p className="mentor-v2-subtitle">
                  Track your mentees, keep your mentoring profile ready, and
                  jump into the next action.
                </p>
                <div className="mentor-v2-status-row">
                  {mentorType && MentorRoleBadge ? (
                    <MentorRoleBadge role={mentorType} prominent />
                  ) : null}
                  <span
                    className={
                      "mentor-v2-status-pill " +
                      (user.mentor_approved ? "is-approved" : "is-pending")
                    }
                  >
                    {user.mentor_approved
                      ? "Coordinator approved"
                      : "Pending coordinator approval"}
                  </span>
                </div>
              </div>
            </div>
            <div className="mentor-v2-hero-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setActiveTab("mentees")}
              >
                View mentees
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setActiveTab("settings")}
              >
                Update profile
              </button>
            </div>
          </section>

          <section
            className="mentor-v2-metric-grid"
            aria-label="Mentor summary"
          >
            <article className="mentor-v2-metric-card is-primary">
              <span className="mentor-v2-metric-icon">
                <MenteeDashIcon name="users" />
              </span>
              <p className="mentor-v2-metric-label">Your mentees</p>
              <p className="mentor-v2-metric-value">
                {acceptedRequests.length}
              </p>
              <p className="mentor-v2-metric-help">
                Official mentees assigned to you
              </p>
            </article>
            <article className="mentor-v2-metric-card">
              <span className="mentor-v2-metric-icon">
                <MenteeDashIcon name="barChart" />
              </span>
              <p className="mentor-v2-metric-label">Capacity used</p>
              <p className="mentor-v2-metric-value">
                {capacityUsed}/{mentorCapacity}
              </p>
              <div className="mentor-v2-progress" aria-hidden="true">
                <span style={{ width: `${capacityPct}%` }} />
              </div>
            </article>
            <article className="mentor-v2-metric-card">
              <span className="mentor-v2-metric-icon">
                <MenteeDashIcon name="pending" />
              </span>
              <p className="mentor-v2-metric-label">Capacity notices</p>
              <p className="mentor-v2-metric-value">{pendingRequests.length}</p>
              <p className="mentor-v2-metric-help">
                Mentees waiting because capacity is full
              </p>
            </article>
            <article className="mentor-v2-metric-card">
              <span className="mentor-v2-metric-icon">
                <MenteeDashIcon name="check" />
              </span>
              <p className="mentor-v2-metric-label">Profile readiness</p>
              <p className="mentor-v2-metric-value">
                {profileReady ? "Ready" : "Needs setup"}
              </p>
              <p className="mentor-v2-metric-help">
                {subjects.length} subject{subjects.length === 1 ? "" : "s"}{" "}
                selected
              </p>
            </article>
          </section>

          <div className="mentor-v2-main-grid">
            <section className="mentor-v2-panel mentor-v2-panel--wide">
              <div className="mentor-v2-panel-head">
                <div>
                  <h2>Your mentees</h2>
                  <p>Official mentees currently connected to you.</p>
                </div>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setActiveTab("mentees")}
                >
                  View all mentees
                </button>
              </div>
              {acceptedRequests.length > 0 ? (
                <div className="mentor-v2-mentee-list">
                  {acceptedRequests.slice(0, 4).map((request) => (
                    <article
                      key={request.mentee_id}
                      className="mentor-v2-mentee-card"
                    >
                      <div className="mentor-v2-avatar">
                        {(
                          request.mentee_display_name ||
                          request.mentee_username ||
                          "?"
                        )
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                      <div className="mentor-v2-mentee-body">
                        <div className="mentor-v2-mentee-top">
                          <h3>
                            {request.mentee_display_name ||
                              request.mentee_username}
                          </h3>
                          <span>
                            Accepted {formatDate(request.accepted_at)}
                          </span>
                        </div>
                        <p>
                          {(request.mentee_subjects || [])
                            .slice(0, 2)
                            .join(", ") || "No subjects selected yet"}
                          {request.mentee_difficulty_level != null
                            ? ` • Difficulty ${request.mentee_difficulty_level}/5`
                            : ""}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mentor-v2-empty">
                  <MenteeDashIcon name="users" size={22} />
                  <p>
                    No official mentees yet. Once matching assigns mentees to
                    you, they will appear here.
                  </p>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => setActiveTab("mentees")}
                  >
                    View all mentees
                  </button>
                </div>
              )}
            </section>

            <aside className="mentor-v2-panel">
              <div className="mentor-v2-panel-head">
                <div>
                  <h2>Mentoring profile</h2>
                  <p>What mentees are matched against.</p>
                </div>
              </div>
              <div className="mentor-v2-profile-list">
                <div>
                  <span>Subjects</span>
                  <strong>
                    {subjects.length ? subjects.join(", ") : "Not set"}
                  </strong>
                </div>
                <div>
                  <span>Topics</span>
                  <strong>
                    {topics.length ? topics.join(", ") : "Not set"}
                  </strong>
                </div>
                <div>
                  <span>Availability</span>
                  <strong>
                    {availability.length ? availability.join(", ") : "Not set"}
                  </strong>
                </div>
                <div>
                  <span>Expertise</span>
                  <strong>
                    {mentorProfile?.expertise_level
                      ? `${mentorProfile.expertise_level}/5`
                      : "Not set"}
                  </strong>
                </div>
              </div>
              {!profileReady && (
                <div className="mentor-v2-warning">
                  Complete your mentor profile so matching can recommend you
                  accurately.
                </div>
              )}
              <button
                type="button"
                className="btn mentor-v2-full-btn"
                onClick={() =>
                  setActiveTab(
                    profileReady ? "mentor-matching-profile" : "onboarding",
                  )
                }
              >
                {profileReady
                  ? "Update mentoring profile"
                  : "Continue onboarding"}
              </button>
            </aside>
          </div>

          <section
            className="mentor-v2-quick-actions"
            aria-label="Quick actions"
          >
            <button type="button" onClick={() => setActiveTab("mentees")}>
              <MenteeDashIcon name="users" size={16} />
              <span>Manage mentees</span>
            </button>
            <button type="button" onClick={() => setActiveTab("announcements")}>
              <MenteeDashIcon name="megaphone" size={16} />
              <span>Post announcement</span>
            </button>
            <button type="button" onClick={() => setActiveTab("settings")}>
              <MenteeDashIcon name="user" size={16} />
              <span>Account settings</span>
            </button>
          </section>
        </div>
      );
    }

    return (
      <div className="home-dashboard-space mentor-staff-dashboard page-shell">
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
            <div className="home-mini-stat-label">Accepted pairings</div>
            <div className="home-mini-stat-value">{acceptedPairings}</div>
          </div>
          <div className="home-mini-stat">
            <div className="home-mini-stat-label">Your mentees</div>
            <div className="home-mini-stat-value">
              {userProgress?.mentees_count ?? 0}
            </div>
          </div>
          <div className="home-mini-stat">
            <div className="home-mini-stat-label">Mentor pairings (system)</div>
            <div className="home-mini-stat-value">{acceptedPairings}</div>
          </div>
        </div>

        <div className="home-dashboard-grid">
          <section className="home-hero-space">
            <div className="home-hero-leading">
              <WelcomeHeroAvatar user={user} />
              <div className="home-hero-text">
                <h1 className="home-hero-title">
                  Welcome back
                  {user.full_name || user.display_name
                    ? `, ${user.full_name || user.display_name}`
                    : user.username
                      ? `, ${user.username}`
                      : ""}
                </h1>
                <p className="home-hero-sub">{roleLine}</p>
              </div>
            </div>

            <div className="home-hero-icon" aria-hidden="true">
              <img
                className="home-hero-logo"
                src="/static/assets/logo.png"
                alt="AMU Mentoring"
              />
            </div>
          </section>

          <aside className="home-analytics-card">
            <div className="home-analytics-header">
              <div className="home-analytics-title">Analytics</div>
              <div className="home-analytics-sub">System overview</div>
            </div>

            <div
              className="home-analytics-ring"
              aria-label="Mentors, mentees, and pairings distribution"
            >
              <canvas id="staff-overview-chart" height="180" />
            </div>

            <div className="home-analytics-tabs" aria-hidden="true">
              <span className="home-analytics-tab is-active">Mentors</span>
              <span className="home-analytics-tab">Mentees</span>
              <span className="home-analytics-tab">Pairings</span>
            </div>

            <div className="home-analytics-foot">
              <span className="home-analytics-chip">
                Accepted pairings: {acceptedPairings}
              </span>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.home = HomePage;
  if (typeof module !== "undefined" && module.exports)
    module.exports = { HomePage };
})();
