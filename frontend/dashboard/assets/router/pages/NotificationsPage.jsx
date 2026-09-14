import EventAvailable from "@mui/icons-material/EventAvailable";
import TaskAlt from "@mui/icons-material/TaskAlt";
import Campaign from "@mui/icons-material/Campaign";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";

(function () {
  "use strict";
  const React = window.React;
  const { useContext, useMemo, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatRelativeTime, LoadingSpinner } = Utils;
  const Mui = window.Mui || {};
  const Tabs = Mui.Tabs;
  const Tab = Mui.Tab;
  const Tooltip = Mui.Tooltip;
  const IconButton = Mui.IconButton;
  const Button = Mui.Button;

  const FILTER_TABS = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "sessions", label: "Sessions" },
    { id: "announcements", label: "Announcements" },
  ];

  function inferCategory(item) {
    if (item.category) return item.category;
    const lower = String(item.message || "").toLowerCase();
    const tab = String(item.action_tab || "").toLowerCase();
    if (
      lower.includes("session") &&
      (lower.includes("scheduled") ||
        lower.includes("upcoming") ||
        lower.includes("booked"))
    ) {
      return "session_scheduled";
    }
    if (
      lower.includes("session") &&
      (lower.includes("completed") ||
        lower.includes("finished") ||
        lower.includes("ended"))
    ) {
      return "session_completed";
    }
    if (tab === "announcements" || lower.includes("announcement")) {
      return "announcement";
    }
    if (
      tab === "matching" ||
      lower.includes("paired") ||
      lower.includes("mentor")
    ) {
      return "matching";
    }
    if (lower.includes("message") || tab === "newsfeed") {
      return "message";
    }
    return "general";
  }

  function resolveMessage(item) {
    return item.formatted_message || item.message || "";
  }

  function matchesFilter(item, filterId) {
    const category = inferCategory(item);
    if (filterId === "unread") return !item.is_read;
    if (filterId === "sessions") {
      return (
        category === "session_scheduled" || category === "session_completed"
      );
    }
    if (filterId === "announcements") {
      return category === "announcement" || category === "message";
    }
    return true;
  }

  function NotificationCategoryIcon({ category }) {
    if (category === "session_scheduled") {
      return <EventAvailable fontSize="inherit" />;
    }
    if (category === "session_completed") {
      return <TaskAlt fontSize="inherit" />;
    }
    if (category === "announcement" || category === "message") {
      return <Campaign fontSize="inherit" />;
    }
    return <NotificationsNoneOutlined fontSize="inherit" />;
  }

  function NotificationLeading({ item }) {
    const category = inferCategory(item);
    if (item.actor_avatar_url) {
      return (
        <img
          src={item.actor_avatar_url}
          alt={item.actor_display_name || "User"}
          className="notification-avatar"
        />
      );
    }
    return (
      <div
        className={
          "notification-icon-wrap notification-icon-wrap--" + category
        }
        aria-hidden="true"
      >
        <NotificationCategoryIcon category={category} />
      </div>
    );
  }

  function NotificationCardActions({ item, onMarkRead, setActiveTab }) {
    const category = inferCategory(item);
    const ctas = [];

    if (category === "session_scheduled") {
      ctas.push(
        <Button
          key="session-details"
          size="small"
          variant="outlined"
          className="notification-cta notification-cta--outlined"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab("home");
          }}
        >
          View Session Details
        </Button>,
      );
    }
    if (category === "session_completed") {
      ctas.push(
        <Button
          key="feedback"
          size="small"
          variant="text"
          className="notification-cta notification-cta--text"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab("home");
          }}
        >
          Leave Feedback
        </Button>,
      );
    }
    if (category === "announcement" && item.action_tab) {
      ctas.push(
        <Button
          key="announcement"
          size="small"
          variant="outlined"
          className="notification-cta notification-cta--outlined"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab(item.action_tab);
          }}
        >
          View Announcement
        </Button>,
      );
    }
    if (category === "matching" && item.action_tab) {
      ctas.push(
        <Button
          key="matching"
          size="small"
          variant="outlined"
          className="notification-cta notification-cta--outlined"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTab(item.action_tab);
          }}
        >
          Open Matching
        </Button>,
      );
    }

    if (!ctas.length) return null;
    return <div className="notification-actions-row">{ctas}</div>;
  }

  function NotificationCard({
    item,
    onOpen,
    onMarkRead,
    setActiveTab,
  }) {
    const isUnread = !item.is_read;

    return (
      <article
        role="button"
        tabIndex={0}
        className={
          "notification-card " + (isUnread ? "unread" : "read")
        }
        onClick={() => onOpen(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(item);
          }
        }}
      >
        <div className="notification-leading">
          <NotificationLeading item={item} />
        </div>
        <div className="notification-content">
          <p className="notification-message">{resolveMessage(item)}</p>
          <div className="notification-time">
            {formatRelativeTime(item.created_at)}
          </div>
          <NotificationCardActions
            item={item}
            onMarkRead={onMarkRead}
            setActiveTab={setActiveTab}
          />
        </div>
        {isUnread && Tooltip && IconButton ? (
          <div className="notification-card-actions">
            <Tooltip title="Mark as read">
              <IconButton
                size="small"
                className="notification-mark-read-btn"
                aria-label="Mark as read"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(item.id);
                }}
              >
                <CheckCircleOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ) : null}
      </article>
    );
  }

  function NotificationsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      notificationsLoading,
      notifications,
      handleMarkAllRead,
      handleMarkRead,
      setActiveTab,
      unreadCount,
    } = ctx;
    const Spinner = LoadingSpinner;
    const [activeFilter, setActiveFilter] = useState("all");

    const filteredNotifications = useMemo(() => {
      return (notifications || []).filter((item) =>
        matchesFilter(item, activeFilter),
      );
    }, [notifications, activeFilter]);

    function onNotificationOpen(item) {
      if (item.action_tab) setActiveTab(item.action_tab);
      if (!item.is_read) handleMarkRead(item.id);
    }

    return (
      <div className="notifications-page notifications-page--glass page-shell">
        <header className="kasandigan-header">
          <div className="kasandigan-header-content">
            <div className="kasandigan-badge">
              <span className="kasandigan-badge-dot" />
              <span>Academic Mentoring Unit • Notifications</span>
            </div>
            <h1 className="kasandigan-title">Notifications</h1>
            <p className="kasandigan-subtitle">
              Matching updates, schedule alerts, and discussion activity.
            </p>
          </div>
          <div className="kasandigan-header-actions">
            <button
              type="button"
              className="btn kasandigan-btn-secondary"
              onClick={handleMarkAllRead}
              disabled={!unreadCount}
            >
              Mark all as read
            </button>
          </div>
        </header>

        {!notificationsLoading && notifications.length > 0 && Tabs && Tab ? (
          <Tabs
            value={activeFilter}
            onChange={(_e, value) => setActiveFilter(value)}
            className="notifications-filter-tabs"
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            {FILTER_TABS.map((tab) => (
              <Tab key={tab.id} label={tab.label} value={tab.id} />
            ))}
          </Tabs>
        ) : null}

        {notificationsLoading && (
          <Spinner
            title="Loading notifications…"
            subtitle="Fetching your updates"
          />
        )}

        {!notificationsLoading && notifications.length === 0 && (
          <div className="fancy-empty notifications-empty">
            <span className="fancy-empty-icon" aria-hidden="true">
              <NotificationsNoneOutlined />
            </span>
            <p className="muted">No notifications yet.</p>
            <div className="btn-row notifications-empty-actions">
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setActiveTab("matching")}
              >
                Go to Matching
              </button>
            </div>
          </div>
        )}

        {!notificationsLoading &&
          notifications.length > 0 &&
          filteredNotifications.length === 0 && (
            <div className="notifications-empty">
              <p>No notifications in this filter.</p>
            </div>
          )}

        {!notificationsLoading && filteredNotifications.length > 0 && (
          <div className="notifications-list">
            {filteredNotifications.map((item) => (
              <NotificationCard
                key={item.id}
                item={item}
                onOpen={onNotificationOpen}
                onMarkRead={handleMarkRead}
                setActiveTab={setActiveTab}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.notifications = NotificationsPage;
})();
