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

    const { activityLogs, activityLogsLoading, loadActivityLogs } = ctx;
    const [search, setSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const Spinner = LoadingSpinner;

    useEffect(() => {
      loadActivityLogs({});
    }, []);

    function handleSearch() {
      loadActivityLogs({
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
            {activityLogsLoading ? <span className="loading-inline"><Spinner inline /> Searching…</span> : "Search"}
          </button>
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
                    <Spinner /> Loading…
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
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["activity-logs"] = ActivityLogsPage;
})();
