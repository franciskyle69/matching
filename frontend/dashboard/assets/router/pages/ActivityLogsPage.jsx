(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function formatLogTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
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
      loadActivityLogs,
    } = ctx;
    const [search, setSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const Spinner = LoadingSpinner;

    useEffect(() => {
      loadActivityLogs({ page: 1, page_size: activityLogsPageSize });
    }, []);

    const showingFrom = activityLogsTotal === 0 ? 0 : (activityLogsPage - 1) * activityLogsPageSize + 1;
    const showingTo = activityLogsTotal === 0 ? 0 : Math.min(activityLogsPage * activityLogsPageSize, activityLogsTotal);

    function loadPage(nextPage) {
      loadActivityLogs({
        page: nextPage,
        page_size: activityLogsPageSize,
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
    }

    function handleSearch() {
      loadActivityLogs({
        page: 1,
        page_size: activityLogsPageSize,
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
    }

    function handlePageSizeChange(event) {
      const nextPageSize = Number.parseInt(event.target.value, 10) || 20;
      loadActivityLogs({
        page: 1,
        page_size: nextPageSize,
        search: search.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
    }

    return (
      <div className="activity-logs-space page-shell">
        {/* Kasandigan Open Native Header — Zero box container */}
        <header className="kasandigan-header">
          <div className="kasandigan-header-content">
            <div className="kasandigan-badge">
              <span className="kasandigan-badge-dot" />
              <span>Academic Mentoring Unit • Operations Console</span>
            </div>
            <h1 className="kasandigan-title">Activity Logs</h1>
            <p className="kasandigan-subtitle">
              View audit trail of system events and actions by users and administrators.
            </p>
          </div>
          <div className="kasandigan-header-actions">
            <div className="approvals-summary-pill">
              <span className="approvals-summary-pill-count">{activityLogsTotal}</span>
              <span>{activityLogsTotal === 1 ? "Event Log" : "Event Logs"}</span>
            </div>
          </div>
        </header>

        <div className="activity-logs-card kasandigan-card">
          <div className="activity-logs-filters">
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
                placeholder="Search email, action, mm/dd/yyyy…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
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
            <button
              type="button"
              className="btn kasandigan-btn-primary activity-logs-filter-btn"
              onClick={handleSearch}
              disabled={activityLogsLoading}
            >
              {activityLogsLoading ? <Spinner inline /> : "Filter Logs"}
            </button>
            <button
              type="button"
              className="btn kasandigan-btn-secondary activity-logs-reset-btn"
              onClick={() => {
                setSearch("");
                setDateFrom("");
                setDateTo("");
                loadActivityLogs({ page: 1, page_size: activityLogsPageSize });
              }}
              disabled={activityLogsLoading}
            >
              Reset
            </button>
          </div>

        <div className="activity-logs-toolbar">
          <div className="activity-logs-summary">
            {activityLogsTotal === 0
              ? "No activity logs found."
              : `Showing ${showingFrom}-${showingTo} of ${activityLogsTotal} logs`}
          </div>
          <label className="activity-logs-page-size">
            <span>Rows per page</span>
            <select className="page-size-select" value={activityLogsPageSize} onChange={handlePageSizeChange} disabled={activityLogsLoading}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>

        <div className="table-wrapper activity-logs-table-wrapper">
          <table className="table activity-logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Who</th>
                <th>What</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activityLogsLoading && activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="activity-logs-loading">
                    <Spinner />
                  </td>
                </tr>
              ) : activityLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted activity-logs-empty">No activity logs found.</td>
                </tr>
              ) : (
                activityLogs.map((log) => (
                  <tr key={log.id} className="activity-logs-row">
                    <td>
                      <span className="activity-logs-time">{formatLogTime(log.time)}</span>
                    </td>
                    <td>
                      <div className="activity-logs-who">
                        <span className="activity-logs-who-name">{log.who}</span>
                        {log.role && <span className="activity-logs-role activity-logs-role-pill">({log.role})</span>}
                      </div>
                    </td>
                    <td>
                      <span className="activity-logs-what">{log.what}</span>
                    </td>
                    <td>
                      <span className={`activity-logs-status ${log.status === "Success" ? "activity-logs-status-success" : ""}`}>
                        <span className="activity-logs-status-dot" />
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-section activity-logs-pagination">
          <div className="pagination-info activity-logs-pagination-info">Page {activityLogsPage} of {activityLogsTotalPages}</div>
          <div className="pagination-controls activity-logs-pagination-controls">
            <button
              type="button"
              className="btn secondary activity-logs-page-btn"
              disabled={activityLogsLoading || activityLogsPage <= 1}
              onClick={() => loadPage(activityLogsPage - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn secondary activity-logs-page-btn"
              disabled={activityLogsLoading || activityLogsPage >= activityLogsTotalPages}
              onClick={() => loadPage(activityLogsPage + 1)}
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
