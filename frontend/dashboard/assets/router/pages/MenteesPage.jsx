import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import HourglassEmptyOutlined from "@mui/icons-material/HourglassEmptyOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import PersonOutline from "@mui/icons-material/PersonOutline";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import CalendarTodayOutlined from "@mui/icons-material/CalendarTodayOutlined";
import RefreshOutlined from "@mui/icons-material/RefreshOutlined";

(function () {
  "use strict";
  const React = window.React;
  const { useContext, useMemo, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatDate } = Utils;

  function MenteeAvatar({ request }) {
    const name = request.mentee_display_name || request.mentee_username || "?";
    const initial = name.slice(0, 1).toUpperCase();
    const avatarUrl = request.mentee_avatar_url || "";
    return (
      <div className="sidebar-avatar-wrapper mentees-page-avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="sidebar-avatar" />
        ) : (
          <div className="sidebar-avatar fallback">{initial}</div>
        )}
        <span
          className={
            "mentee-avatar-status-dot " +
            (request.accepted ? "is-active" : "is-pending")
          }
          title={request.accepted ? "Official Mentee" : "Pending Pairing"}
        />
      </div>
    );
  }

  function MenteesPage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const {
      user,
      mentorRequests,
      mentorRequestsLoading,
      loadMentorRequests,
      setActiveTab,
      loadUserProfile,
    } = ctx;

    if (!user || user.role !== "mentor") {
      return (
        <div className="card page-shell">
          <h1 className="page-title">Mentees</h1>
          <p className="page-subtitle">This page is only available for mentor accounts.</p>
        </div>
      );
    }

    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");

    const accepted = useMemo(
      () => (mentorRequests || []).filter((r) => r.accepted),
      [mentorRequests]
    );
    const pending = useMemo(
      () => (mentorRequests || []).filter((r) => !r.accepted),
      [mentorRequests]
    );

    const filtered = useMemo(() => {
      let list = mentorRequests || [];
      if (filter === "official") list = accepted;
      else if (filter === "unavailable") list = pending;
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter((r) => {
        const name = (r.mentee_display_name || r.mentee_username || "").toLowerCase();
        const userName = (r.mentee_username || "").toLowerCase();
        const subjects = (r.mentee_subjects || []).join(" ").toLowerCase();
        const topics = (r.mentee_topics || []).join(" ").toLowerCase();
        return (
          name.includes(q) ||
          userName.includes(q) ||
          subjects.includes(q) ||
          topics.includes(q)
        );
      });
    }, [mentorRequests, filter, search, accepted, pending]);

    return (
      <div className="mentees-page page-shell">
        <header className="kasandigan-header">
          <div className="kasandigan-header-content">
            <div className="kasandigan-badge">
              <span className="kasandigan-badge-dot" />
              <span>Academic Mentoring Unit • Mentee Roster</span>
            </div>
            <h1 className="kasandigan-title">Mentees</h1>
            <p className="kasandigan-subtitle">
              All mentees linked to you through matching—official pairings and active requests.
            </p>
          </div>
          <div className="kasandigan-header-actions">
            <button
              type="button"
              className="btn kasandigan-btn-secondary"
              onClick={() => loadMentorRequests && loadMentorRequests()}
              disabled={mentorRequestsLoading}
            >
              <RefreshOutlined fontSize="small" className="kasandigan-btn-icon" />
              <span>{mentorRequestsLoading ? "Refreshing…" : "Refresh"}</span>
            </button>
            <button
              type="button"
              className="btn kasandigan-btn-primary"
              onClick={() => setActiveTab("announcements")}
            >
              <CampaignOutlined fontSize="small" className="kasandigan-btn-icon" />
              <span>Post announcement</span>
            </button>
          </div>
        </header>

        <div className="mentees-page-stats" aria-label="Mentee summary">
          <div
            className={"mentees-page-stat " + (filter === "all" ? "is-selected" : "")}
            onClick={() => setFilter("all")}
            role="button"
            tabIndex={0}
            title="Filter all mentees"
          >
            <div className="mentees-page-stat-top">
              <span className="mentees-page-stat-label">Total roster</span>
              <span className="mentees-page-stat-icon neu-icon-pod">
                <GroupsOutlined fontSize="inherit" />
              </span>
            </div>
            <div className="mentees-page-stat-val">{(mentorRequests || []).length}</div>
            <div className="mentees-page-stat-sub">All matched & requested</div>
          </div>

          <div
            className={"mentees-page-stat is-official " + (filter === "official" ? "is-selected" : "")}
            onClick={() => setFilter("official")}
            role="button"
            tabIndex={0}
            title="Filter official mentees"
          >
            <div className="mentees-page-stat-top">
              <span className="mentees-page-stat-label">Official pairings</span>
              <span className="mentees-page-stat-icon neu-icon-pod is-official">
                <CheckCircleOutline fontSize="inherit" />
              </span>
            </div>
            <div className="mentees-page-stat-val is-official">{accepted.length}</div>
            <div className="mentees-page-stat-sub">Active confirmed mentees</div>
          </div>

          <div
            className={"mentees-page-stat is-pending " + (filter === "unavailable" ? "is-selected" : "")}
            onClick={() => setFilter("unavailable")}
            role="button"
            tabIndex={0}
            title="Filter unavailable or pending requests"
          >
            <div className="mentees-page-stat-top">
              <span className="mentees-page-stat-label">Not available</span>
              <span className="mentees-page-stat-icon neu-icon-pod is-pending">
                <HourglassEmptyOutlined fontSize="inherit" />
              </span>
            </div>
            <div className="mentees-page-stat-val is-pending">{pending.length}</div>
            <div className="mentees-page-stat-sub">Pending or unavailable</div>
          </div>
        </div>

        <div className="mentees-page-toolbar">
          <div className="mentees-page-filters" role="tablist" aria-label="Filter mentees">
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              className={"mentees-page-filter-btn " + (filter === "all" ? "is-active" : "")}
              onClick={() => setFilter("all")}
            >
              All ({(mentorRequests || []).length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "official"}
              className={"mentees-page-filter-btn " + (filter === "official" ? "is-active" : "")}
              onClick={() => setFilter("official")}
            >
              Official ({accepted.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "unavailable"}
              className={"mentees-page-filter-btn " + (filter === "unavailable" ? "is-active" : "")}
              onClick={() => setFilter("unavailable")}
            >
              Not available ({pending.length})
            </button>
          </div>

          <div className="mentees-page-search-wrapper">
            <SearchOutlined className="mentees-page-search-icon" fontSize="small" />
            <input
              type="search"
              className="mentees-page-search"
              placeholder="Search by name, username, subject, or topic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search mentees"
            />
            {search.trim() ? (
              <button
                type="button"
                className="mentees-page-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        {mentorRequestsLoading && (mentorRequests || []).length === 0 ? (
          <div className="mentees-page-loading neu-card">
            <p>Loading mentees…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mentees-page-empty neu-card">
            <div className="neu-empty-icon-pod">
              <GroupsOutlined fontSize="large" />
            </div>
            <h2 className="section-title">
              {filter === "official"
                ? "No official mentees yet"
                : filter === "unavailable"
                ? "No unavailable requests"
                : "No mentees found"}
            </h2>
            <p className="muted">
              {filter === "all"
                ? "When mentees choose you as their mentor, they will appear here."
                : "Try another filter or clear your search."}
            </p>
            {filter === "all" && !search.trim() && (
              <button
                type="button"
                className="btn kasandigan-btn-primary"
                onClick={() => setActiveTab("matching")}
                style={{ marginTop: "12px" }}
              >
                Open matching
              </button>
            )}
          </div>
        ) : (
          <div className="mentees-page-grid">
            {filtered.map((request) => {
              const menteeName =
                request.mentee_display_name || request.mentee_username || "Mentee";
              const subs = request.mentee_subjects || [];
              const topics = request.mentee_topics || [];
              return (
                <article
                  key={request.request_id || request.mentee_id}
                  className={
                    "mentees-page-card " +
                    (request.accepted ? "is-official" : "is-unavailable")
                  }
                >
                  <div className="mentees-page-card-top">
                    <MenteeAvatar request={request} />
                    <div className="mentees-page-card-head">
                      <h3 className="mentees-page-card-name">{menteeName}</h3>
                      <p className="mentees-page-card-username">@{request.mentee_username}</p>
                    </div>
                    <span
                      className={
                        "match-request-badge " +
                        (request.accepted
                          ? "match-request-badge-accepted"
                          : "match-request-badge-pending")
                      }
                    >
                      <span className="match-request-badge-dot" />
                      <span>{request.accepted ? "Official mentee" : "Not available"}</span>
                    </span>
                  </div>

                  <div className="mentees-page-card-body">
                    <div className="mentees-card-meta-row">
                      <CalendarTodayOutlined fontSize="inherit" className="mentees-card-meta-icon" />
                      <span>
                        {request.accepted && request.accepted_at
                          ? `Accepted ${formatDate(request.accepted_at)}`
                          : request.created_at
                          ? `Requested ${formatDate(request.created_at)}`
                          : "Paired recently"}
                      </span>
                    </div>

                    {(subs.length > 0 || request.mentee_difficulty_level != null) && (
                      <div className="mentee-chip-row mentees-card-chips">
                        {subs.map((sub) => (
                          <span key={sub} className="mentee-chip">
                            {sub}
                          </span>
                        ))}
                        {request.mentee_difficulty_level != null && (
                          <span className="mentee-chip mentee-chip--accent">
                            Difficulty {request.mentee_difficulty_level}/5
                          </span>
                        )}
                      </div>
                    )}

                    {topics.length > 0 && (
                      <div className="mentees-card-topics">
                        <span className="mentees-card-topics-label">Focus:</span>{" "}
                        {topics.join(", ")}
                      </div>
                    )}

                    {!subs.length && !topics.length && request.mentee_difficulty_level == null && (
                      <p className="muted" style={{ margin: 0 }}>
                        No mentoring preferences listed yet.
                      </p>
                    )}
                  </div>

                  <div className="mentees-page-card-actions">
                    {request.mentee_user_id && typeof loadUserProfile === "function" && (
                      <button
                        type="button"
                        className="btn kasandigan-btn-secondary small"
                        onClick={() => loadUserProfile(request.mentee_user_id)}
                      >
                        <PersonOutline fontSize="inherit" />
                        <span>View profile</span>
                      </button>
                    )}
                    {request.accepted && (
                      <button
                        type="button"
                        className="btn kasandigan-btn-primary small"
                        onClick={() => setActiveTab("announcements")}
                      >
                        <CampaignOutlined fontSize="inherit" />
                        <span>Announcement</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.mentees = MenteesPage;
})();
