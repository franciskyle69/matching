(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const MainContent = window.DashboardApp.MainContent;
  const MAIN_TABS = (window.DashboardApp && window.DashboardApp.MAIN_TABS) || [];
  const PLACEHOLDER_AVATAR = window.DashboardApp.PLACEHOLDER_AVATAR || "";

  const TAB_ICONS = {
    home: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    profile: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="7" r="4" />
        <path d="M5 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" />
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

  function HighlightText({ text, query }) {
    if (!query || !text) return text || "";
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const idx = lower.indexOf(qLower);
    if (idx === -1) return text;
    return React.createElement(React.Fragment, null,
      text.slice(0, idx),
      React.createElement("mark", { className: "search-highlight" }, text.slice(idx, idx + query.length)),
      text.slice(idx + query.length)
    );
  }

  function getPendingApprovalLandingTab(userData) {
    if (!userData) return "settings";
    if (userData.role === "mentee") {
      return userData.mentee_general_info_completed ? "settings" : "complete-profile";
    }
    if (userData.role === "mentor") {
      return userData.mentor_questionnaire_completed ? "settings" : "complete-profile";
    }
    return "settings";
  }

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
      logoutLoading,
      globalSearchResults,
      loadGlobalSearch,
      isAuthenticated,
      loadUserProfile,
      isPendingApproval,
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
      if (isPendingApproval) {
        const allowedPendingTabs = new Set([
          "complete-profile",
          "settings",
        ]);
        if (!allowedPendingTabs.has(tabId)) {
          setActiveTab(getPendingApprovalLandingTab(user));
          window.scrollTo(0, 0);
          closeMobileMenu();
          return;
        }
      }
      if (tabId === "sessions" && setSessionsPairMenteeId) setSessionsPairMenteeId(null);
      setActiveTab(tabId);
      window.scrollTo(0, 0);
      closeMobileMenu();
    };

    const [searchQuery, setSearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchHighlight, setSearchHighlight] = useState(0);

    const isStaff = !!(user?.is_staff || user?.role === "staff");

    const filteredTabs = MAIN_TABS.filter((tab) => {
      if (isPendingApproval) {
        return tab.id === "complete-profile" || tab.id === "settings";
      }
      if (tab.id === "subjects") return isStaff;
      if (tab.id === "users") return isStaff;
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
    const dashboardTab = filteredTabs.find((tab) => tab.id === "home");
    const activityTabIds = new Set(["matching", "sessions", "announcements", "approvals", "subjects", "users", "activity-logs", "backup"]);
    const accountTabIds = new Set(["profile", "settings", "complete-profile"]);
    const activityTabs = filteredTabs.filter((tab) => activityTabIds.has(tab.id));
    const accountTabs = filteredTabs.filter((tab) => accountTabIds.has(tab.id));

    const role = user?.role;
    const baseShortcuts = isPendingApproval
      ? []
      : [
          {
            id: "matching",
            label: "Go to Matching",
            hint: "See mentor/mentee matches",
            roles: ["mentor", "mentee", "staff"],
            type: "shortcut",
            actionTab: "matching",
          },
          {
            id: "sessions",
            label: "Go to Sessions",
            hint: "View and schedule sessions",
            roles: ["mentor", "mentee", "staff"],
            type: "shortcut",
            actionTab: "sessions",
          },
          {
            id: "announcements",
            label: "Go to Announcements",
            hint: "Post or read announcements",
            roles: ["mentor", "mentee", "staff"],
            type: "shortcut",
            actionTab: "announcements",
          },
          {
            id: "settings",
            label: "Go to Settings",
            hint: "Update your profile and matching info",
            roles: ["mentor", "mentee"],
            type: "shortcut",
            actionTab: "settings",
          },
          {
            id: "general-info",
            label: "Open general information",
            hint: "Settings → your general info",
            roles: ["mentee"],
            type: "shortcut",
            actionTab: "settings",
          },
          {
            id: "mentee-questionnaire",
            label: "Open mentee questionnaire",
            hint: "Settings → mentee matching form",
            roles: ["mentee"],
            type: "shortcut",
            actionTab: "settings",
          },
          {
            id: "mentor-questionnaire",
            label: "Open mentor questionnaire",
            hint: "Settings → mentor profile form",
            roles: ["mentor"],
            type: "shortcut",
            actionTab: "settings",
          },
          {
            id: "approvals",
            label: "Review approvals",
            hint: "Approve mentors and mentees",
            roles: ["staff"],
            action: () => goTo("approvals"),
          },
          {
            id: "subjects",
            label: "Manage subjects",
            hint: "Edit available subjects and topics",
            roles: ["staff"],
            action: () => goTo("subjects"),
          },
        ].filter((item) => {
          if (!role && !isStaff) return true;
          if (isStaff) return item.roles.includes("staff");
          return !item.roles.length || item.roles.includes(role);
        });

    const trimmedQuery = searchQuery.trim().toLowerCase();
    const activeTabMeta = MAIN_TABS.find((tab) => tab.id === activeTab);
    const topbarTitle = activeTabMeta?.label || "Dashboard";

    let shortcutMatches = [];
    if (trimmedQuery) {
      shortcutMatches = baseShortcuts.filter((item) => {
        const haystack = (item.label + " " + (item.hint || "")).toLowerCase();
        return haystack.includes(trimmedQuery);
      });
    }

    const entitySuggestions = (globalSearchResults || []).slice(0, 8);
    // Put entity (user/session) matches first so pressing Enter on a username
    // prefers profiles over generic shortcuts like \"Go to Matching\".
    const suggestions = [...entitySuggestions, ...shortcutMatches].slice(0, 8);
    const showSuggestions =
      isAuthenticated && !isPendingApproval && searchFocused && trimmedQuery.length > 0;

    useEffect(() => {
      if (isPendingApproval) {
        loadGlobalSearch("");
        return;
      }
      const q = searchQuery.trim();
      if (!q) {
        loadGlobalSearch("");
        return;
      }
      const handle = setTimeout(() => {
        loadGlobalSearch(q);
      }, 300);
      return () => clearTimeout(handle);
      // We intentionally depend only on searchQuery here. loadGlobalSearch
      // comes from context and is stable for the lifetime of the app, so
      // including it can cause unnecessary re-runs.
    }, [searchQuery, isPendingApproval]);

    function handleSuggestionSelect(item) {
      if (!item) return;
      if (isPendingApproval) return;
      if (item.type === "shortcut" || item.actionTab) {
        const tab = item.actionTab || "home";
        setActiveTab(tab);
      } else if (item.type === "user") {
        if (item.id === user?.id) {
          setActiveTab("profile");
        } else if (typeof loadUserProfile === "function") {
          loadUserProfile(item.id);
        }
      } else if (item.type === "session") {
        setActiveTab("sessions");
      }
      setSearchQuery("");
      setSearchHighlight(0);
      setSearchFocused(false);
    }

    const handleSearchKeyDown = (e) => {
      if (!suggestions.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSearchHighlight((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSearchHighlight((prev) =>
          prev - 1 < 0 ? suggestions.length - 1 : prev - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = suggestions[searchHighlight] || suggestions[0];
        if (chosen) {
          handleSuggestionSelect(chosen);
        }
      } else if (e.key === "Escape") {
        setSearchQuery("");
        setSearchHighlight(0);
        setSearchFocused(false);
        e.preventDefault();
      }
    };

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
                <span className="sidebar-header-title">
                  <img
                    src="/static/assets/logoreal.svg"
                    alt="Mentoring Dashboard"
                    className="sidebar-logo"
                  />
                </span>
              </div>
              <div className="sidebar-section">
                {dashboardTab && (
                  <div className="sidebar-links">
                    <button
                      key={dashboardTab.id}
                      type="button"
                      className={"sidebar-link " + (activeTab === dashboardTab.id ? "active" : "")}
                      onClick={() => goTo(dashboardTab.id)}
                      title={dashboardTab.label}
                    >
                      <span className="sidebar-link-icon">{TAB_ICONS[dashboardTab.id] || TAB_ICONS.home}</span>
                      <span className="sidebar-link-text">{dashboardTab.label}</span>
                    </button>
                  </div>
                )}

                {activityTabs.length > 0 && (
                  <>
                    <div className="sidebar-title">My Activities</div>
                    <div className="sidebar-links">
                      {activityTabs.map((tab) => (
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
                  </>
                )}

                {accountTabs.length > 0 && (
                  <>
                    <div className="sidebar-title">Account Pages</div>
                    <div className="sidebar-links">
                      {accountTabs.map((tab) => (
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
                  </>
                )}
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
                <button
                  type="button"
                  className="btn secondary sidebar-logout-btn"
                  onClick={handleLogout}
                  disabled={logoutLoading}
                  aria-busy={logoutLoading ? "true" : "false"}
                >
                  {logoutLoading ? (
                    <span className="sidebar-logout-spinner" aria-hidden="true" />
                  ) : (
                    <svg className="sidebar-logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  )}
                  <span className="sidebar-logout-text">{logoutLoading ? "Logging out..." : "Log out"}</span>
                </button>
                <a href="#" className="sidebar-help-card" onClick={(e) => e.preventDefault()}>
                  <div className="sidebar-help-icon">?</div>
                  <div className="sidebar-help-content">
                    <div className="sidebar-help-title">Need help?</div>
                    <div className="sidebar-help-sub">Please check our docs</div>
                    <span className="sidebar-help-cta">Documentation</span>
                  </div>
                </a>
              </div>
            </aside>
          </>
        )}

        <div className="app-main-shell">
          {isAuthenticated && (
            <header className="app-topbar">
              <div className="app-topbar-meta">
                <div className="app-topbar-meta-label">Pages / {topbarTitle}</div>
                <div className="app-topbar-meta-title">{topbarTitle}</div>
              </div>

              {!isPendingApproval ? (
              <>
              <div className="app-topbar-search-wrapper">
                <div className="app-topbar-search">
                  <input
                    type="search"
                    className="app-topbar-search-input"
                    placeholder={searchFocused ? "Search users, sessions, actions…" : ""}
                    aria-label="Global search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSearchHighlight(0);
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => {
                      // Delay so click on suggestion still registers
                      setTimeout(() => setSearchFocused(false), 120);
                    }}
                    onKeyDown={handleSearchKeyDown}
                  />
                  <button
                    type="button"
                    className="app-topbar-search-btn"
                    aria-label="Search"
                    onClick={() => {
                      if (suggestions.length) {
                        handleSuggestionSelect(suggestions[0]);
                      }
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <line x1="16.65" y1="16.65" x2="21" y2="21" />
                    </svg>
                  </button>
                </div>
                {showSuggestions && (
                  <div className="search-dropdown" role="listbox">
                    {suggestions.some((s) => s.type === "user") && (
                      <div className="search-dropdown-section">
                        <div className="search-dropdown-heading">Users</div>
                        {suggestions.filter((s) => s.type === "user").map((item, idx) => {
                          const globalIdx = suggestions.indexOf(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={"search-dropdown-item" + (globalIdx === searchHighlight ? " active" : "")}
                              onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(item); }}
                              role="option"
                              aria-selected={globalIdx === searchHighlight}
                            >
                              <div className="search-dropdown-avatar">
                                {item.avatar_url ? (
                                  <img src={item.avatar_url} alt="" />
                                ) : (
                                  <span className="search-dropdown-avatar-fallback">{(item.label || "?")[0].toUpperCase()}</span>
                                )}
                              </div>
                              <div className="search-dropdown-info">
                                <span className="search-dropdown-name">
                                  <HighlightText text={item.label} query={trimmedQuery} />
                                </span>
                                <span className={"search-dropdown-role search-role-" + (item.role || "user")}>
                                  {item.role === "mentor" ? "Mentor" : item.role === "mentee" ? "Mentee" : "User"}
                                </span>
                              </div>
                              <svg className="search-dropdown-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {suggestions.some((s) => s.type === "shortcut") && (
                      <div className="search-dropdown-section">
                        <div className="search-dropdown-heading">Quick actions</div>
                        {suggestions.filter((s) => s.type === "shortcut").map((item) => {
                          const globalIdx = suggestions.indexOf(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={"search-dropdown-item search-dropdown-item--shortcut" + (globalIdx === searchHighlight ? " active" : "")}
                              onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(item); }}
                            >
                              <div className="search-dropdown-info">
                                <span className="search-dropdown-name">
                                  <HighlightText text={item.label} query={trimmedQuery} />
                                </span>
                                {item.hint && <span className="search-dropdown-hint">{item.hint}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {suggestions.some((s) => s.type === "session") && (
                      <div className="search-dropdown-section">
                        <div className="search-dropdown-heading">Sessions</div>
                        {suggestions.filter((s) => s.type === "session").map((item) => {
                          const globalIdx = suggestions.indexOf(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={"search-dropdown-item search-dropdown-item--session" + (globalIdx === searchHighlight ? " active" : "")}
                              onMouseDown={(e) => { e.preventDefault(); handleSuggestionSelect(item); }}
                            >
                              <div className="search-dropdown-info">
                                <span className="search-dropdown-name">
                                  <HighlightText text={item.label} query={trimmedQuery} />
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {trimmedQuery && suggestions.length === 0 && (
                      <div className="search-dropdown-empty">No results found</div>
                    )}
                  </div>
                )}
              </div>
              <>
                <button
                  type="button"
                  className="sidebar-icon-btn app-topbar-bell"
                  onClick={() => goTo("notifications")}
                  aria-label="Notifications"
                >
                  <svg className="sidebar-icon-bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </button>
                <button
                  type="button"
                  className="app-topbar-avatar-btn"
                  onClick={() => goTo("profile")}
                  aria-label="Open profile"
                  title="Profile"
                >
                  <div className="sidebar-avatar-wrapper">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.display_name || user.full_name || user.username || "Profile"} className="sidebar-avatar" />
                    ) : (
                      <div className="sidebar-avatar fallback">
                        {(user.display_name || user.full_name || user.username || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                </button>
              </>
              </>
              ) : (
                <div className="btn-row" style={{ margin: 0 }}>
                  <button type="button" className="btn" onClick={() => goTo("complete-profile")}>Complete profile</button>
                  <button type="button" className="btn secondary" onClick={() => goTo("settings")}>Account settings</button>
                </div>
              )}
            </header>
          )}

          <main className={"app-content " + (isAuthenticated ? "with-sidebar" : "") + (sidebarCollapsed && isAuthenticated ? " sidebar-collapsed" : "")}>
            <MainContent />
          </main>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Layout = Layout;
})();
