(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner, MentorRoleBadge, formatRelativeTime } = Utils;

  function formatLogTime(iso) {
    if (!iso) return { formatted: "—", relative: "" };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { formatted: String(iso), relative: "" };

    const formatted = d.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    let relative = "";
    if (typeof formatRelativeTime === "function") {
      relative = formatRelativeTime(iso);
    } else {
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) relative = "Just now";
      else if (diffMins < 60) relative = `${diffMins}m ago`;
      else if (diffMins < 1440) relative = `${Math.floor(diffMins / 60)}h ago`;
      else relative = `${Math.floor(diffMins / 1440)}d ago`;
    }

    return { formatted, relative };
  }

  function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function avatarHue(seed) {
    const text = String(seed || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) & 0xffffffff;
    }
    return Math.abs(hash) % 360;
  }

  const CATEGORY_OPTIONS = [
    { value: "all", label: "All Categories" },
    { value: "auth", label: "Authentication & Security" },
    { value: "matching", label: "Mentorship & Matching" },
    { value: "approvals", label: "Approvals & Verifications" },
    { value: "profiles", label: "Profiles & Onboarding" },
    { value: "system", label: "System & Backups" },
    { value: "community", label: "Community & Announcements" },
  ];

  const ROLE_OPTIONS = [
    { value: "all", label: "All Roles" },
    { value: "staff", label: "Operations Staff" },
    { value: "instructor", label: "Faculty Instructors" },
    { value: "student", label: "Student Mentors" },
    { value: "mentee", label: "Student Mentees" },
  ];

  function getActionBadgeMeta(actionType, action) {
    const act = (action || "").toLowerCase();
    switch (actionType) {
      case "approve":
        return { label: "Approved", className: "act-badge--approve" };
      case "create":
        return { label: "Created", className: "act-badge--create" };
      case "auth":
        if (act === "logout") return { label: "Signed Out", className: "act-badge--auth-out" };
        return { label: "Auth Event", className: "act-badge--auth" };
      case "update":
      case "run":
        return { label: act === "run" ? "Executed" : "Updated", className: "act-badge--update" };
      case "backup":
        return { label: "Backup Ops", className: "act-badge--backup" };
      case "reject":
      case "delete":
        return { label: act === "reject" ? "Rejected" : "Deleted", className: "act-badge--danger" };
      default:
        return { label: act || "Event", className: "act-badge--default" };
    }
  }

  function getCategoryPill(category) {
    switch (category) {
      case "auth":
        return { label: "Security", color: "cat-pill--auth" };
      case "matching":
        return { label: "Matching", color: "cat-pill--matching" };
      case "approvals":
        return { label: "Approvals", color: "cat-pill--approvals" };
      case "profiles":
        return { label: "Profile", color: "cat-pill--profiles" };
      case "system":
        return { label: "System", color: "cat-pill--system" };
      case "community":
        return { label: "Community", color: "cat-pill--community" };
      default:
        return { label: "General", color: "cat-pill--general" };
    }
  }

  function ActivityLogsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const isStaff = !!(ctx.user.is_staff || ctx.user.role === "staff");
    if (!isStaff) return null;

    const {
      activityLogs,
      activityLogsLoading,
      activityLogsPage,
      activityLogsPageSize,
      activityLogsTotal,
      activityLogsTotalPages,
      activityLogsStats,
      loadActivityLogs,
    } = ctx;

    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [role, setRole] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [expandedRowId, setExpandedRowId] = useState(null);

    const Spinner = LoadingSpinner;

    useEffect(() => {
      loadActivityLogs({
        page: 1,
        page_size: activityLogsPageSize,
        category: "all",
        role: "all",
      });
    }, []);

    const showingFrom = activityLogsTotal === 0 ? 0 : (activityLogsPage - 1) * activityLogsPageSize + 1;
    const showingTo = activityLogsTotal === 0 ? 0 : Math.min(activityLogsPage * activityLogsPageSize, activityLogsTotal);

    function triggerFilter(overridePage = 1, overridePageSize = activityLogsPageSize) {
      loadActivityLogs({
        page: overridePage,
        page_size: overridePageSize,
        search: search.trim() || undefined,
        category: category !== "all" ? category : undefined,
        role: role !== "all" ? role : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
    }

    function handleSearch() {
      triggerFilter(1);
    }

    function handleReset() {
      setSearch("");
      setCategory("all");
      setRole("all");
      setDateFrom("");
      setDateTo("");
      loadActivityLogs({ page: 1, page_size: activityLogsPageSize, category: "all", role: "all" });
    }

    function handlePageSizeChange(event) {
      const nextPageSize = Number.parseInt(event.target.value, 10) || 20;
      triggerFilter(1, nextPageSize);
    }

    function handleExportCsv() {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      if (category && category !== "all") q.set("category", category);
      if (role && role !== "all") q.set("role", role);
      if (dateFrom) q.set("date_from", dateFrom);
      if (dateTo) q.set("date_to", dateTo);
      window.location.href = `/api/activity-logs/export/?${q.toString()}`;
    }

    function toggleRowExpand(logId) {
      setExpandedRowId((prev) => (prev === logId ? null : logId));
    }

    const todayCount = activityLogsStats?.today_records || 0;

    return (
      <div className="activity-logs-space page-shell">
        {/* Open Native Header */}
        <header className="kasandigan-header">
          <div className="kasandigan-header-content">
            <div className="kasandigan-badge">
              <span className="kasandigan-badge-dot" />
              <span>Academic Mentoring Unit • Operations Audit Trail</span>
            </div>
            <h1 className="kasandigan-title">Activity Logs & Audit Trail</h1>
            <p className="kasandigan-subtitle">
              Real-time audit log of system events, security authorizations, mentor matching, and administrative actions.
            </p>
          </div>
          <div className="kasandigan-header-actions">
            <div className="activity-logs-stat-pill" title="Today's activity count">
              <span className="activity-logs-stat-dot" />
              <span className="activity-logs-stat-number">{todayCount}</span>
              <span className="activity-logs-stat-label">Today</span>
            </div>
            <div className="approvals-summary-pill" title="Total matched logs">
              <span className="approvals-summary-pill-count">{activityLogsTotal}</span>
              <span>{activityLogsTotal === 1 ? "Event" : "Total Events"}</span>
            </div>
            <button
              type="button"
              className="btn activity-logs-export-btn"
              onClick={handleExportCsv}
              title="Download filtered logs as CSV"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        <div className="activity-logs-card kasandigan-card">
          {/* Advanced Multi-Facet Filter Bar */}
          <div className="activity-logs-filters">
            {/* Search Box */}
            <div className="activity-logs-search-box">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="activity-logs-search-icon"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.65" y1="16.65" x2="21" y2="21" />
              </svg>
              <input
                type="text"
                className="activity-logs-search"
                placeholder="Search actor, email, action, ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              {search && (
                <button
                  type="button"
                  className="activity-logs-search-clear"
                  onClick={() => { setSearch(""); triggerFilter(1); }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="activity-logs-select-wrap">
              <select
                className="activity-logs-select"
                value={category}
                onChange={(e) => { setCategory(e.target.value); }}
                title="Filter by Category"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Role Dropdown */}
            <div className="activity-logs-select-wrap">
              <select
                className="activity-logs-select"
                value={role}
                onChange={(e) => { setRole(e.target.value); }}
                title="Filter by User Role"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="activity-logs-date-group">
              <input
                type="date"
                className="activity-logs-date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                title="From date"
              />
              <span className="activity-logs-date-sep">to</span>
              <input
                type="date"
                className="activity-logs-date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                title="To date"
              />
            </div>

            {/* Filter Action Buttons */}
            <button
              type="button"
              className="btn kasandigan-btn-primary activity-logs-filter-btn"
              onClick={handleSearch}
              disabled={activityLogsLoading}
            >
              {activityLogsLoading ? <Spinner inline /> : "Apply Filters"}
            </button>
            <button
              type="button"
              className="btn kasandigan-btn-secondary activity-logs-reset-btn"
              onClick={handleReset}
              disabled={activityLogsLoading}
            >
              Reset
            </button>
          </div>

          {/* Results Summary Toolbar */}
          <div className="activity-logs-toolbar">
            <div className="activity-logs-summary">
              {activityLogsTotal === 0
                ? "No matching activity logs found."
                : `Showing ${showingFrom}–${showingTo} of ${activityLogsTotal} audit records`}
            </div>
            <label className="activity-logs-page-size">
              <span>Rows per page</span>
              <select
                className="page-size-select"
                value={activityLogsPageSize}
                onChange={handlePageSizeChange}
                disabled={activityLogsLoading}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
          </div>

          {/* Interactive Logs Table */}
          <div className="table-wrapper activity-logs-table-wrapper">
            <table className="table activity-logs-table">
              <thead>
                <tr>
                  <th style={{ width: "170px" }}>Time</th>
                  <th style={{ minWidth: "220px" }}>Actor</th>
                  <th>Activity Description</th>
                  <th style={{ width: "130px" }}>Action</th>
                  <th style={{ width: "60px", textAlign: "center" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {activityLogsLoading && activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="activity-logs-loading">
                      <Spinner title="Loading activity records…" subtitle="Fetching audit trail" />
                    </td>
                  </tr>
                ) : activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted activity-logs-empty">
                      <div className="activity-logs-empty-state">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <p>No activity logs found matching your criteria.</p>
                        <button type="button" className="btn kasandigan-btn-secondary" onClick={handleReset}>
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activityLogs.map((log) => {
                    const timeInfo = formatLogTime(log.time);
                    const isExpanded = expandedRowId === log.id;
                    const badgeMeta = getActionBadgeMeta(log.action_type, log.action);
                    const catPill = getCategoryPill(log.category);
                    const hue = avatarHue(log.who || log.email || log.id);

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          className={`activity-logs-row ${isExpanded ? "activity-logs-row--expanded" : ""}`}
                          onClick={() => toggleRowExpand(log.id)}
                          style={{ cursor: "pointer" }}
                        >
                          {/* Time */}
                          <td>
                            <div className="activity-logs-time-cell">
                              <span className="activity-logs-time-primary">{timeInfo.formatted}</span>
                              {timeInfo.relative && (
                                <span className="activity-logs-time-relative">{timeInfo.relative}</span>
                              )}
                            </div>
                          </td>

                          {/* Actor */}
                          <td>
                            <div className="activity-logs-actor-cell">
                              <div
                                className="activity-logs-avatar"
                                style={{
                                  background: `hsl(${hue}, 65%, 45%)`,
                                }}
                              >
                                {getInitials(log.who)}
                              </div>
                              <div className="activity-logs-actor-meta">
                                <span className="activity-logs-actor-name">{log.who}</span>
                                {log.email && <span className="activity-logs-actor-email">{log.email}</span>}
                                {log.role && (
                                  <div className="activity-logs-role-wrap">
                                    {MentorRoleBadge ? (
                                      <MentorRoleBadge role={log.role} prominent={false} />
                                    ) : (
                                      <span className="activity-logs-role-fallback">{log.role}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Description & Category */}
                          <td>
                            <div className="activity-logs-desc-cell">
                              <span className={`activity-logs-cat-pill ${catPill.color}`}>
                                {catPill.label}
                              </span>
                              <span className="activity-logs-what">{log.what}</span>
                            </div>
                          </td>

                          {/* Action Badge */}
                          <td>
                            <span className={`activity-logs-action-badge ${badgeMeta.className}`}>
                              <span className="activity-logs-badge-dot" />
                              {badgeMeta.label}
                            </span>
                          </td>

                          {/* Details Toggle */}
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className={`activity-logs-chevron-btn ${isExpanded ? "activity-logs-chevron-btn--open" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpand(log.id);
                              }}
                              title={isExpanded ? "Hide details" : "Show technical details"}
                              aria-expanded={isExpanded}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Technical Details Drawer */}
                        {isExpanded && (
                          <tr className="activity-logs-drawer-row">
                            <td colSpan={5}>
                              <div className="activity-logs-drawer-content">
                                <div className="activity-logs-drawer-header">
                                  <div className="drawer-header-left">
                                    <span className="drawer-title">Technical Audit Metadata</span>
                                    <span className="drawer-id-tag">Event #{log.id}</span>
                                  </div>
                                  <span className="drawer-status-pill">Status: {log.status || "Success"}</span>
                                </div>
                                <div className="activity-logs-drawer-grid">
                                  <div className="drawer-field">
                                    <span className="drawer-field-label">Action Identifier:</span>
                                    <code className="drawer-field-code">{log.action || "—"}</code>
                                  </div>
                                  <div className="drawer-field">
                                    <span className="drawer-field-label">Target Entity Model:</span>
                                    <code className="drawer-field-code">{log.model_name || "—"}</code>
                                  </div>
                                  <div className="drawer-field">
                                    <span className="drawer-field-label">Target Object ID:</span>
                                    <code className="drawer-field-code">{log.object_id || "None"}</code>
                                  </div>
                                  <div className="drawer-field">
                                    <span className="drawer-field-label">Event Category:</span>
                                    <span className="drawer-field-value">{log.category}</span>
                                  </div>
                                  <div className="drawer-field">
                                    <span className="drawer-field-label">Full UTC Timestamp:</span>
                                    <span className="drawer-field-value">{log.time}</span>
                                  </div>
                                  <div className="drawer-field">
                                    <span className="drawer-field-label">Actor Username:</span>
                                    <span className="drawer-field-value">{log.username || "system"}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="pagination-section activity-logs-pagination">
            <div className="pagination-info activity-logs-pagination-info">
              Page {activityLogsPage} of {activityLogsTotalPages}
            </div>
            <div className="pagination-controls activity-logs-pagination-controls">
              <button
                type="button"
                className="btn secondary activity-logs-page-btn"
                disabled={activityLogsLoading || activityLogsPage <= 1}
                onClick={() => triggerFilter(activityLogsPage - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn secondary activity-logs-page-btn"
                disabled={activityLogsLoading || activityLogsPage >= activityLogsTotalPages}
                onClick={() => triggerFilter(activityLogsPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["activity-logs"] = ActivityLogsPage;
})();
