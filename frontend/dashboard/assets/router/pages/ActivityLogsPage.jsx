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
      <div className="card activity-logs-page">
        <h1 className="page-title">Activity Logs</h1>
        <p className="page-subtitle">View audit trail of actions by users and admins.</p>

        <div className="activity-logs-filters">
          <input
            type="text"
            className="activity-logs-search"
            placeholder="Search email, action, mm/dd/yyyy"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <input
            type="date"
            className="activity-logs-date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />
          <input
            type="date"
            className="activity-logs-date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
          />
          <button type="button" className="btn" onClick={handleSearch} disabled={activityLogsLoading}>
            {activityLogsLoading ? <Spinner inline /> : "Search"}
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

        <div className="table-wrapper">
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
                  <td colSpan={4} className="muted">No activity logs found.</td>
                </tr>
              ) : (
                activityLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatLogTime(log.time)}</td>
                    <td>
                      {log.who}
                      {log.role && <span className="activity-logs-role">({log.role})</span>}
                    </td>
                    <td>{log.what}</td>
                    <td>
                      <span className="activity-logs-status activity-logs-status-success">{log.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination-section activity-logs-pagination">
          <div className="pagination-info">Page {activityLogsPage} of {activityLogsTotalPages}</div>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={activityLogsLoading || activityLogsPage <= 1}
              onClick={() => loadPage(activityLogsPage - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={activityLogsLoading || activityLogsPage >= activityLogsTotalPages}
              onClick={() => loadPage(activityLogsPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["activity-logs"] = ActivityLogsPage;
})();
