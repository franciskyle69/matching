(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;
  const MainContent = window.DashboardApp.MainContent;
  const MAIN_TABS = (window.DashboardApp && window.DashboardApp.MAIN_TABS) || [];

  const TAB_ICONS = {
    home: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    "complete-profile": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
      </svg>
    ),
    matching: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    sessions: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
    announcements: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    approvals: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    subjects: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="16" y2="10" />
      </svg>
    ),
    "activity-logs": (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    backup: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    settings: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  };

  function Layout() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const {
      user,
      activeTab,
      setActiveTab,
      setSessionsPairMenteeId,
      unreadCount,
      theme,
      toggleTheme,
      handleLogout,
      isAuthenticated,
    } = ctx;

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
      if (typeof window === "undefined") return false;
      try {
        return window.localStorage.getItem("dashboard-sidebar-collapsed") === "true";
      } catch (_) {
        return false;
      }
    });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMobileView, setIsMobileView] = useState(() =>
      typeof window !== "undefined" ? window.innerWidth <= 768 : false
    );

    useEffect(() => {
      try {
        window.localStorage.setItem("dashboard-sidebar-collapsed", String(sidebarCollapsed));
      } catch (_) {}
    }, [sidebarCollapsed]);

    useEffect(() => {
      const onResize = () => {
        const mobile = window.innerWidth <= 768;
        setIsMobileView(mobile);
        if (!mobile && mobileMenuOpen) setMobileMenuOpen(false);
      };
      onResize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [mobileMenuOpen]);

    useEffect(() => {
      const body = document.body;
      if (mobileMenuOpen) {
        const prev = body.style.overflow;
        body.dataset.sidebarPrevOverflow = prev;
        body.style.overflow = "hidden";
        return () => {
          body.style.overflow = body.dataset.sidebarPrevOverflow || "";
          delete body.dataset.sidebarPrevOverflow;
        };
      }
    }, [mobileMenuOpen]);

    const toggleSidebar = () => setSidebarCollapsed((c) => !c);
    const closeMobileMenu = () => setMobileMenuOpen(false);
    const handleHeaderCollapseClick = () => {
      if (typeof window !== "undefined" && window.innerWidth <= 768) {
        closeMobileMenu();
      } else {
        toggleSidebar();
      }
    };
    const goTo = (tabId) => {
      if (tabId === "sessions" && setSessionsPairMenteeId) setSessionsPairMenteeId(null);
      setActiveTab(tabId);
      window.scrollTo(0, 0);
      closeMobileMenu();
    };

    const filteredTabs = MAIN_TABS.filter((tab) => {
      const isStaff = !!(user?.is_staff || user?.role === "staff");
      if (tab.id === "subjects") return isStaff;
      if (tab.id === "activity-logs") return isStaff;
      if (tab.id === "backup") return isStaff;
      if (tab.id === "matching") return !isStaff;
      if (tab.id === "approvals") return isStaff;
      if (tab.id === "complete-profile") {
        const unapprovedMentor = user?.role === "mentor" && !user?.mentor_approved;
        const unapprovedMentee = user?.role === "mentee" && !user?.mentee_approved;
        return !!(unapprovedMentor || unapprovedMentee);
      }
      return true;
    });

    return (
      <div className="app-shell">
        {isAuthenticated && (
          <>
            <button
              type="button"
              className="sidebar-mobile-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div
              className={"sidebar-backdrop " + (mobileMenuOpen ? "visible" : "")}
              onClick={closeMobileMenu}
              onKeyDown={(e) => e.key === "Escape" && closeMobileMenu()}
              role="button"
              tabIndex={-1}
              aria-hidden="true"
            />
            <aside
              className={
                "sidebar " +
                (sidebarCollapsed ? "collapsed" : "") +
                (mobileMenuOpen ? " mobile-open" : "")
              }
            >
              <div className="sidebar-header">
                <button
                  type="button"
                  className="sidebar-collapse-btn"
                  onClick={handleHeaderCollapseClick}
                  aria-label={isMobileView ? "Close menu" : sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={isMobileView ? "Close menu" : sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {sidebarCollapsed ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  )}
                </button>
                <span className="sidebar-header-title">Dashboard</span>
              </div>
              <div className="sidebar-profile">
                <button
                  type="button"
                  className="sidebar-avatar-btn"
                  onClick={() => goTo("notifications")}
                  aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
                  title="Notifications"
                >
                  <div className="sidebar-avatar-wrapper">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username || "Profile"} className="sidebar-avatar" />
                    ) : (
                      <div className="sidebar-avatar fallback">
                        {(user.username || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <span className="sidebar-avatar-notification-badge" aria-hidden="true">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                <div className="sidebar-profile-text">
                  <div className="sidebar-name">{user.username}</div>
                  <div className="sidebar-role-line">
                    {user.role && (
                      <span className={"sidebar-role-badge role-" + user.role}>
                        {user.role === "mentor" ? "Mentor" : user.role === "mentee" ? "Mentee" : "Staff"}
                      </span>
                    )}
                    {!user.role && user.is_staff && <span className="sidebar-role-badge staff">Staff</span>}
                  </div>
                </div>
                <div className="sidebar-profile-actions">
                  <button
                    type="button"
                    className="sidebar-icon-btn"
                    onClick={() => goTo("notifications")}
                    aria-label="Notifications"
                  >
                    <svg className="sidebar-icon-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {unreadCount > 0 && <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                  </button>
                </div>
              </div>
              <div className="sidebar-section">
                <div className="sidebar-title">Navigation</div>
                <div className="sidebar-links">
                  {filteredTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={"sidebar-link " + (activeTab === tab.id ? "active" : "")}
                      onClick={() => goTo(tab.id)}
                      title={tab.label}
                    >
                      <span className="sidebar-link-icon">{TAB_ICONS[tab.id] || TAB_ICONS.home}</span>
                      <span className="sidebar-link-text">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="sidebar-section sidebar-footer">
                <button
                  type="button"
                  className="theme-toggle"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  title={theme === "dark" ? "Light mode" : "Dark mode"}
                >
                  {theme === "dark" ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                      <span className="theme-toggle-label">Light mode</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                      <span className="theme-toggle-label">Dark mode</span>
                    </>
                  )}
                </button>
                <button type="button" className="btn secondary sidebar-logout-btn" onClick={handleLogout}>
                  <svg className="sidebar-logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="sidebar-logout-text">Log out</span>
                </button>
              </div>
            </aside>
          </>
        )}

        <main className={"app-content " + (isAuthenticated ? "with-sidebar" : "") + (sidebarCollapsed && isAuthenticated ? " sidebar-collapsed" : "")}>
          <MainContent />
        </main>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Layout = Layout;
})();
