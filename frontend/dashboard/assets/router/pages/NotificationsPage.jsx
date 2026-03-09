(function () {
  "use strict";
  const React = window.React;
  const { useContext } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatDate, LoadingSpinner } = Utils;

  function NotificationsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const { notificationsLoading, notifications, handleMarkAllRead, handleMarkRead, setActiveTab } = ctx;
    const Spinner = LoadingSpinner;

    function onNotificationClick(item) {
      if (item.action_tab) setActiveTab(item.action_tab);
      if (!item.is_read) handleMarkRead(item.id);
    }

    return (
      <div className="card">
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">Session updates and activity.</p>
        <div className="notifications-header"><button className="btn secondary" onClick={handleMarkAllRead}>Mark all as read</button></div>
        {notificationsLoading && <div className="loading-block"><Spinner /><p className="muted">Loading notifications...</p></div>}
        {!notificationsLoading && notifications.length === 0 && (
          <div className="fancy-empty notifications-empty">
            <span className="fancy-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            </span>
            <p className="muted">No notifications yet.</p>
          </div>
        )}
        {!notificationsLoading && notifications.length > 0 && notifications.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onNotificationClick(item)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNotificationClick(item); } }}
            className={"notification-item " + (!item.is_read ? "unread" : "") + (item.action_tab ? " notification-item-clickable" : "")}
            aria-label={item.action_tab ? "Open " + item.action_tab : undefined}
          >
            <div className="btn-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><p className="notification-message">{item.message}</p><div className="notification-time">{formatDate(item.created_at)}</div></div>
              {!item.is_read && <button className="btn small" onClick={(e) => { e.stopPropagation(); handleMarkRead(item.id); }}>Mark read</button>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.notifications = NotificationsPage;
})();
