import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import HandshakeOutlined from "@mui/icons-material/HandshakeOutlined";
import FlagOutlined from "@mui/icons-material/FlagOutlined";
import ChatBubbleOutline from "@mui/icons-material/ChatBubbleOutline";
import PersonOutline from "@mui/icons-material/PersonOutline";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import TuneOutlined from "@mui/icons-material/TuneOutlined";
import ExploreOutlined from "@mui/icons-material/ExploreOutlined";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";

(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatDate, MentorRoleBadge, formatMatchScore } = Utils;
  const Availability = window.DashboardApp.Availability;
  const formatSlotList =
    (Availability && Availability.formatSlotList) ||
    ((slots) => (Array.isArray(slots) ? slots.join(", ") : ""));

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
      mail: (
        <svg {...p}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </svg>
      ),
      target: (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      ),
      compass: (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
    };
    const node = icons[name];
    if (!node) return null;
    return <span className="mentee-dash-icon-wrap">{node}</span>;
  }

  function MenteeAvatar({ name, url, className }) {
    const initial = String(name || "?")
      .slice(0, 1)
      .toUpperCase();
    return (
      <div className={"sidebar-avatar-wrapper " + (className || "")}>
        {url ? (
          <img src={url} alt="" className="sidebar-avatar" />
        ) : (
          <div className="sidebar-avatar fallback">{initial}</div>
        )}
      </div>
    );
  }

  function StatCard({ icon, label, value, hint }) {
    return (
      <article className="dashboard-card mentee-stat-card">
        <span className="mentee-stat-icon">{icon}</span>
        <p className="mentee-stat-value">{value}</p>
        <p className="mentee-stat-label">{label}</p>
        {hint ? <p className="mentee-stat-hint">{hint}</p> : null}
      </article>
    );
  }

  function formatHoursValue(minutes) {
    const mins = Number(minutes) || 0;
    if (mins <= 0) return "—";
    const hours = Math.round((mins / 60) * 10) / 10;
    return `${hours} hrs`;
  }

  function formatCountdown(start) {
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return "";
    const ms = start.getTime() - Date.now();
    if (ms <= 0) return "";
    const hours = Math.round(ms / 3600000);
    if (hours < 1) return "Next window in under an hour";
    if (hours === 1) return "Next window in 1 hour";
    if (hours < 48) return `Next window in ${hours} hours`;
    return `Next window ${start.toLocaleDateString(undefined, {
      weekday: "short",
    })}`;
  }

  function gmailComposeUrl(email) {
    const to = String(email || "").trim();
    if (!to) return "";
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`;
  }

  function MatchBadge({ score }) {
    if (score == null || !formatMatchScore) return null;
    const { percentage, label, tier } = formatMatchScore(score);
    return (
      <span
        className={"mentee-match-badge match-score-tier-" + tier}
        title={label}
      >
        {percentage}% Match
      </span>
    );
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
      menteeMatching,
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
                window.location.href = "/app/#signin";
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
      const recommendations = Array.isArray(menteeRecommendations)
        ? menteeRecommendations
        : [];
      const matchCount = recommendations.length;
      const firstName = String(
        user.full_name || user.display_name || user.username || "",
      )
        .trim()
        .split(/\s+/)[0];

      const menteeSlots = Array.isArray(menteeMatching?.availability)
        ? menteeMatching.availability
        : [];
      const sharedSlots =
        Availability && myMentor
          ? Availability.intersectSlots(menteeSlots, myMentor.availability)
          : [];
      const scheduleSlots = myMentor && sharedSlots.length
        ? sharedSlots
        : menteeSlots;
      const upcoming = Availability
        ? Availability.nextOccurrences(scheduleSlots, 4)
        : [];
      const nextWindow = upcoming[0] || null;
      const weeklyMinutes = Availability
        ? Availability.weeklyMinutes(
            myMentor && sharedSlots.length ? sharedSlots : menteeSlots,
          )
        : 0;

      const planSubjects = Array.isArray(menteeMatching?.subjects)
        ? menteeMatching.subjects.filter((item) => String(item || "").trim())
        : [];
      const planTopics = Array.isArray(menteeMatching?.topics)
        ? menteeMatching.topics.filter((item) => String(item || "").trim())
        : [];

      /* Best score we can honestly show: the paired mentor's, else the
         strongest recommendation. */
      const topRecommendation = recommendations.reduce(
        (best, item) =>
          best == null || Number(item.score) > Number(best.score) ? item : best,
        null,
      );
      const headlineScore =
        myMentor && myMentor.score != null
          ? myMentor.score
          : topRecommendation
            ? topRecommendation.score
            : null;
      const headlineMatch =
        headlineScore != null && formatMatchScore
          ? formatMatchScore(headlineScore)
          : null;

      const mentorName = myMentor
        ? myMentor.display_name || myMentor.username
        : "";
      const mentorSubjects = (() => {
        if (!myMentor) return [];
        const details = myMentor.match_details || {};
        if ((details.common_subjects || []).length) {
          return details.common_subjects;
        }
        if (
          Array.isArray(myMentor.subjects) &&
          Array.isArray(menteeMatching?.subjects)
        ) {
          const wanted = new Set(
            menteeMatching.subjects.map((s) => String(s).trim().toLowerCase()),
          );
          return myMentor.subjects.filter((s) =>
            wanted.has(String(s).trim().toLowerCase()),
          );
        }
        return [];
      })();

      const goalTotal = planSubjects.length || planTopics.length;
      const goalDone = myMentor
        ? mentorSubjects.length || Math.min(goalTotal, planTopics.length)
        : 0;

      const heroPill = (() => {
        if (nextWindow && myMentor) {
          return formatCountdown(nextWindow.start);
        }
        if (myMentor && headlineMatch) {
          return `${headlineMatch.percentage}% match with ${mentorName}`;
        }
        if (!hasQuestionnaire) {
          return "Finish your profile to unlock matches";
        }
        if (matchCount > 0) {
          return `${matchCount} mentor match${matchCount === 1 ? "" : "es"} ready`;
        }
        return "We're lining up mentors for you";
      })();

      function openMentorProfile(userId) {
        if (userId == null || typeof window === "undefined") return;
        window.location.hash = `profile/mentor/${userId}`;
      }

      return (
        <div className="home-dashboard-space mentee-home page-shell">
          <div className="mentee-home-grid">
            <div className="mentee-home-main">
              <section className="dashboard-card mentee-hero">
                <span className="mentee-hero-mesh" aria-hidden="true" />
                <div className="mentee-hero-body">
                  <div className="mentee-hero-leading">
                    <WelcomeHeroAvatar user={user} />
                    <div className="mentee-hero-copy">
                      <h1 className="mentee-hero-title">
                        Welcome back{firstName ? `, ${firstName}` : ""}
                      </h1>
                      <p className="mentee-hero-subtitle">
                        Your mentoring journey, matches, and next best actions
                        in one place.
                      </p>
                    </div>
                  </div>
                  <span className="mentee-hero-pill">{heroPill}</span>
                  <div className="mentee-hero-actions">
                    <button
                      type="button"
                      className="btn mentee-cta-primary"
                      onClick={() => setActiveTab("matching")}
                    >
                      Find a Mentor
                    </button>
                    <button
                      type="button"
                      className="btn mentee-cta-glass"
                      onClick={() => setActiveTab("mentoring-preferences")}
                    >
                      Browse Subjects
                    </button>
                  </div>
                </div>
              </section>

              <section
                className="mentee-stat-grid"
                aria-label="Your matching snapshot"
              >
                <StatCard
                  icon={<EventAvailableOutlined fontSize="inherit" />}
                  label="Upcoming sessions"
                  value={
                    upcoming.length
                      ? `${upcoming.length} ${upcoming.length === 1 ? "window" : "windows"}`
                      : "0"
                  }
                  hint={
                    myMentor && sharedSlots.length
                      ? "Shared times this month"
                      : upcoming.length
                        ? "From your availability"
                        : "No windows set"
                  }
                />
                <StatCard
                  icon={<ScheduleOutlined fontSize="inherit" />}
                  label="Mentoring hours"
                  value={formatHoursValue(weeklyMinutes)}
                  hint={
                    myMentor && sharedSlots.length
                      ? "Weekly overlap with your mentor"
                      : menteeSlots.length
                        ? "Weekly hours you are free"
                        : "Add availability to start"
                  }
                />
                <StatCard
                  icon={<HandshakeOutlined fontSize="inherit" />}
                  label="Completed pairings"
                  value={myMentor ? 1 : 0}
                  hint={
                    myMentor
                      ? `Paired with ${mentorName}`
                      : "No official mentor yet"
                  }
                />
                <StatCard
                  icon={<FlagOutlined fontSize="inherit" />}
                  label="Active learning goals"
                  value={
                    goalTotal
                      ? `${goalDone} / ${goalTotal}`
                      : "—"
                  }
                  hint={
                    goalTotal
                      ? goalDone
                        ? "Subjects covered with your mentor"
                        : "Subjects in your plan"
                      : "Choose subjects to track"
                  }
                />
              </section>

              <section className="dashboard-card mentee-spotlight">
                <div className="mentee-card-head">
                  <h2>Your mentor</h2>
                  {myMentor ? <MatchBadge score={myMentor.score} /> : null}
                </div>

                {myMentor ? (
                  <>
                    <div className="mentee-spotlight-identity">
                      <div className="mentee-spotlight-avatar">
                        <MenteeAvatar
                          name={mentorName}
                          url={myMentor.avatar_url}
                        />
                        <span
                          className="mentee-spotlight-status"
                          title="Active pairing"
                          aria-label="Active pairing"
                        />
                      </div>
                      <div className="mentee-spotlight-meta">
                        <div className="mentee-spotlight-name-row">
                          <p className="mentee-spotlight-name">{mentorName}</p>
                          {myMentor.role && MentorRoleBadge ? (
                            <MentorRoleBadge role={myMentor.role} prominent />
                          ) : null}
                        </div>
                        {myMentor.accepted_at && (
                          <p className="mentee-muted">
                            Paired since {formatDate(myMentor.accepted_at)}
                          </p>
                        )}
                        {mentorSubjects.length > 0 && (
                          <div className="mentee-chip-row">
                            {mentorSubjects.slice(0, 4).map((subject) => (
                              <span key={subject} className="mentee-chip">
                                {subject}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <dl className="mentee-spotlight-facts">
                      <div>
                        <dt>Next window</dt>
                        <dd>
                          {nextWindow
                            ? `${nextWindow.dateLabel} • ${nextWindow.timeLabel}`
                            : "No overlapping time yet"}
                        </dd>
                      </div>
                      <div>
                        <dt>Weekly hours</dt>
                        <dd>{formatHoursValue(weeklyMinutes)}</dd>
                      </div>
                    </dl>

                    <div className="mentee-spotlight-actions">
                      {myMentor.email ? (
                        <a
                          className="btn mentee-cta-primary"
                          href={gmailComposeUrl(myMentor.email)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ChatBubbleOutline fontSize="inherit" />
                          <span>Send Message</span>
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="btn mentee-cta-glass"
                        onClick={() => openMentorProfile(myMentor.user_id)}
                      >
                        <PersonOutline fontSize="inherit" />
                        <span>View Profile</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mentee-empty">
                    <p>You do not have an official mentor yet.</p>
                    <button
                      type="button"
                      className="btn mentee-cta-primary"
                      onClick={() => setActiveTab("matching")}
                    >
                      Browse recommendations
                    </button>
                  </div>
                )}

                {!hasQuestionnaire && (
                  <div className="mentee-inline-cta">
                    <AutoAwesomeOutlined fontSize="inherit" />
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

              <section className="dashboard-card mentee-activity">
                <div className="mentee-card-head">
                  <h2>Next steps</h2>
                </div>
                <ul className="mentee-timeline">
                  {!hasQuestionnaire && (
                    <li className="mentee-timeline-item">
                      <span className="mentee-timeline-icon">
                        <AutoAwesomeOutlined fontSize="inherit" />
                      </span>
                      <div>
                        <p className="mentee-timeline-title">
                          Finish your mentoring preferences
                        </p>
                        <p className="mentee-muted">
                          Subjects and competencies drive every match we show
                          you.
                        </p>
                      </div>
                    </li>
                  )}
                  {menteeSlots.length === 0 && (
                    <li className="mentee-timeline-item">
                      <span className="mentee-timeline-icon">
                        <ScheduleOutlined fontSize="inherit" />
                      </span>
                      <div>
                        <p className="mentee-timeline-title">
                          Add your availability
                        </p>
                        <p className="mentee-muted">
                          Mentors are only matched when your days and times
                          overlap.
                        </p>
                      </div>
                    </li>
                  )}
                  {matchCount > 0 && (
                    <li className="mentee-timeline-item">
                      <span className="mentee-timeline-icon">
                        <GroupsOutlined fontSize="inherit" />
                      </span>
                      <div>
                        <p className="mentee-timeline-title">
                          {matchCount} mentor recommendation
                          {matchCount === 1 ? "" : "s"} waiting
                        </p>
                        <p className="mentee-muted">
                          Review them and choose the mentor that fits you best.
                        </p>
                      </div>
                    </li>
                  )}
                  {myMentor && (
                    <li className="mentee-timeline-item">
                      <span className="mentee-timeline-icon">
                        <CheckCircleOutline fontSize="inherit" />
                      </span>
                      <div>
                        <p className="mentee-timeline-title">
                          You are paired with {mentorName}
                        </p>
                        <p className="mentee-muted">
                          Reach out to agree on a regular meeting time.
                        </p>
                      </div>
                    </li>
                  )}
                  {hasQuestionnaire &&
                    menteeSlots.length > 0 &&
                    !matchCount &&
                    !myMentor && (
                      <li className="mentee-empty">
                        <p>
                          No mentor recommendations yet. Try widening your
                          availability or adding subjects.
                        </p>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => setActiveTab("mentoring-preferences")}
                        >
                          Adjust preferences
                        </button>
                      </li>
                    )}
                </ul>
              </section>
            </div>

            <aside className="mentee-home-rail" aria-label="Dashboard sidebar">
              <section className="dashboard-card mentee-rail-card">
                <div className="mentee-card-head">
                  <h2>Upcoming sessions</h2>
                </div>
                {upcoming.length > 0 ? (
                  <>
                    <p className="mentee-muted">
                      {myMentor && sharedSlots.length
                        ? `Next overlapping windows with ${mentorName}.`
                        : "The next times you marked as free."}
                    </p>
                    <ul className="mentee-slot-list">
                      {upcoming.map((occ) => (
                        <li key={`${occ.slot}-${occ.start.getTime()}`} className="mentee-slot mentee-slot--schedule">
                          <span className="mentee-slot-icon">
                            <EventAvailableOutlined fontSize="inherit" />
                          </span>
                          <div className="mentee-slot-copy">
                            <span className="mentee-slot-when">{occ.dateLabel}</span>
                            <span className="mentee-slot-time">{occ.timeLabel}</span>
                          </div>
                          <button
                            type="button"
                            className="mentee-slot-action"
                            onClick={() =>
                              setActiveTab("mentoring-preferences")
                            }
                          >
                            Reschedule
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mentee-muted">
                    {myMentor
                      ? `You and ${mentorName} have no overlapping times yet.`
                      : "You have not set any availability yet."}
                  </p>
                )}
                <button
                  type="button"
                  className="btn mentee-cta-glass mentee-rail-action"
                  onClick={() => setActiveTab("mentoring-preferences")}
                >
                  {upcoming.length ? "Reschedule" : "Edit availability"}
                </button>
              </section>

              <section className="dashboard-card mentee-rail-card">
                <div className="mentee-card-head">
                  <h2>Recommended mentors</h2>
                </div>
                {matchCount > 0 ? (
                  <ul className="mentee-rec-list">
                    {recommendations.slice(0, 3).map((match) => {
                      const mentor = match.mentor || {};
                      const name =
                        match.mentor_display_name ||
                        mentor.display_name ||
                        match.mentor_username ||
                        "Mentor";
                      return (
                        <li key={match.mentor_id} className="mentee-rec-item">
                          <MenteeAvatar name={name} url={mentor.avatar_url} />
                          <div className="mentee-rec-meta">
                            <p className="mentee-rec-name">{name}</p>
                            <MatchBadge score={match.score} />
                          </div>
                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => setActiveTab("matching")}
                          >
                            Connect
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mentee-muted">
                    No recommendations yet. Complete your preferences to see
                    matched mentors here.
                  </p>
                )}
                <button
                  type="button"
                  className="btn mentee-cta-glass mentee-rail-action"
                  onClick={() => setActiveTab("matching")}
                >
                  See all matches
                </button>
              </section>

              <section className="dashboard-card mentee-rail-card">
                <div className="mentee-card-head">
                  <h2>Quick actions</h2>
                </div>
                <div className="mentee-quick-actions">
                  <button
                    type="button"
                    className="mentee-quick-action"
                    onClick={() => setActiveTab("matching")}
                  >
                    <ExploreOutlined fontSize="inherit" />
                    <span>Find mentors</span>
                  </button>
                  <button
                    type="button"
                    className="mentee-quick-action"
                    onClick={() => setActiveTab("mentoring-preferences")}
                  >
                    <TuneOutlined fontSize="inherit" />
                    <span>Mentoring preferences</span>
                  </button>
                  <button
                    type="button"
                    className="mentee-quick-action"
                    onClick={() => setActiveTab("announcements")}
                  >
                    <CampaignOutlined fontSize="inherit" />
                    <span>Announcements</span>
                  </button>
                  <button
                    type="button"
                    className="mentee-quick-action"
                    onClick={() => setActiveTab("notifications")}
                  >
                    <NotificationsNoneOutlined fontSize="inherit" />
                    <span>Notifications</span>
                  </button>
                </div>
              </section>
            </aside>
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
        Number(mentorProfile?.capacity ?? userProgress?.mentor_capacity ?? 5) ||
          5,
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
                    {availability.length
                      ? formatSlotList(availability)
                      : "Not set"}
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
