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
      <div className="home-dashboard-space mentees-page page-shell">
        <div className="mentees-page-header page-shell-head">
          <div>
            <h1 className="page-title">Mentees</h1>
            <p className="page-subtitle">
              All mentees linked to you through matching—official pairings and requests that could not be confirmed when your capacity was full.
            </p>
          </div>
          <div className="mentees-page-header-actions">
            <button
              type="button"
              className="btn secondary"
              onClick={() => loadMentorRequests && loadMentorRequests()}
              disabled={mentorRequestsLoading}
            >
              {mentorRequestsLoading ? "Refreshing…" : "Refresh"}
            </button>
            <button type="button" className="btn" onClick={() => setActiveTab("announcements")}>
              Post announcement
            </button>
          </div>
        </div>

        <div className="mentees-page-stats" aria-label="Mentee summary">
          <article className="mentees-page-stat">
            <span className="mentees-page-stat-label">Total</span>
            <strong>{(mentorRequests || []).length}</strong>
          </article>
          <article className="mentees-page-stat is-official">
            <span className="mentees-page-stat-label">Official</span>
            <strong>{accepted.length}</strong>
          </article>
          <article className="mentees-page-stat is-pending">
            <span className="mentees-page-stat-label">Not available</span>
            <strong>{pending.length}</strong>
          </article>
        </div>

        <div className="mentees-page-toolbar">
          <div className="mentees-page-filters" role="tablist" aria-label="Filter mentees">
            <button
              type="button"
              className={"mentees-page-filter-btn " + (filter === "all" ? "is-active" : "")}
              onClick={() => setFilter("all")}
            >
              All ({(mentorRequests || []).length})
            </button>
            <button
              type="button"
              className={"mentees-page-filter-btn " + (filter === "official" ? "is-active" : "")}
              onClick={() => setFilter("official")}
            >
              Official ({accepted.length})
            </button>
            <button
              type="button"
              className={"mentees-page-filter-btn " + (filter === "unavailable" ? "is-active" : "")}
              onClick={() => setFilter("unavailable")}
            >
              Not available ({pending.length})
            </button>
          </div>
          <input
            type="search"
            className="mentees-page-search"
            placeholder="Search by name, username, subject, or topic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search mentees"
          />
        </div>

        {mentorRequestsLoading && (mentorRequests || []).length === 0 ? (
          <div className="mentees-page-loading">
            <p>Loading mentees…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mentees-page-empty card">
            <h2 className="section-title">
              {filter === "official"
                ? "No official mentees yet"
                : filter === "unavailable"
                ? "No unavailable requests"
                : "No mentees yet"}
            </h2>
            <p className="muted">
              {filter === "all"
                ? "When mentees choose you as their mentor, they will appear here."
                : "Try another filter or clear your search."}
            </p>
            {filter === "all" && !search.trim() && (
              <button type="button" className="btn secondary" onClick={() => setActiveTab("matching")}>
                Open matching
              </button>
            )}
          </div>
        ) : (
          <div className="mentees-page-grid">
            {filtered.map((request) => (
              <article
                key={request.request_id || request.mentee_id}
                className={
                  "mentees-page-card " + (request.accepted ? "is-official" : "is-unavailable")
                }
              >
                <div className="mentees-page-card-top">
                  <MenteeAvatar request={request} />
                  <div className="mentees-page-card-head">
                    <h3>{request.mentee_display_name || request.mentee_username}</h3>
                    <p className="mentees-page-card-username">@{request.mentee_username}</p>
                  </div>
                  <span
                    className={
                      "match-request-badge " +
                      (request.accepted
                        ? "match-request-badge-accepted"
                        : "")
                    }
                  >
                    {request.accepted ? "Official mentee" : "Not available"}
                  </span>
                </div>

                <div className="mentees-page-card-body">
                  {request.accepted && request.accepted_at && (
                    <p>
                      <strong>Accepted:</strong> {formatDate(request.accepted_at)}
                    </p>
                  )}
                  {!request.accepted && request.created_at && (
                    <p>
                      <strong>Requested:</strong> {formatDate(request.created_at)}
                    </p>
                  )}
                  {request.mentee_subjects?.length > 0 && (
                    <p>
                      <strong>Subjects:</strong> {request.mentee_subjects.join(", ")}
                    </p>
                  )}
                  {request.mentee_topics?.length > 0 && (
                    <p>
                      <strong>Topics:</strong> {request.mentee_topics.join(", ")}
                    </p>
                  )}
                  {request.mentee_difficulty_level != null && (
                    <p>
                      <strong>Difficulty:</strong> {request.mentee_difficulty_level}/5
                    </p>
                  )}
                  {!request.mentee_subjects?.length &&
                    !request.mentee_topics?.length &&
                    request.mentee_difficulty_level == null && (
                      <p className="muted">No mentoring preferences listed yet.</p>
                    )}
                </div>

                <div className="mentees-page-card-actions">
                  {request.mentee_user_id && typeof loadUserProfile === "function" && (
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => loadUserProfile(request.mentee_user_id)}
                    >
                      View profile
                    </button>
                  )}
                  {request.accepted && (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => setActiveTab("announcements")}
                    >
                      Announcement
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.mentees = MenteesPage;
})();
