import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import "./components/Sidebar.jsx";

(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const MainContent = window.DashboardApp.MainContent;
  const Sidebar = window.DashboardApp.Sidebar;
  const MAIN_TABS =
    (window.DashboardApp && window.DashboardApp.MAIN_TABS) || [];
  const LOGO_URL = window.DashboardApp.LOGO_URL || "/static/assets/logo.png";
  const LOGO_ALT = window.DashboardApp.LOGO_ALT || "AMU Mentoring";
  const COMPACT_NAV_MAX_WIDTH = 899;

  function getTopbarDisplayName(user) {
    return (
      (user && (user.display_name || user.full_name || user.username)) ||
      "Account"
    );
  }

  function getTopbarRoleLabel(user, isStaff, mentorProfile) {
    if (isStaff) return "Coordinator";
    const role = user && user.role;
    if (role === "mentor") {
      const mentorRole =
        (mentorProfile && mentorProfile.role) ||
        (user && user.mentor_info && user.mentor_info.role) ||
        "";
      const getMeta =
        window.DashboardApp && window.DashboardApp.getMentorRoleBadgeMeta;
      const meta = typeof getMeta === "function" ? getMeta(mentorRole) : null;
      if (meta && meta.kind === "instructor") return "Instructor";
      if (meta && meta.kind === "student") return "Student Mentor";
      if (mentorRole) return mentorRole;
      return "Mentor";
    }
    if (role === "mentee") return "Mentee";
    return "Member";
  }

  function getSearchShortcutLabel() {
    if (typeof navigator === "undefined") return "Ctrl+K";
    const platform = navigator.platform || "";
    if (/Mac|iPhone|iPad|iPod/i.test(platform)) return "⌘K";
    return "Ctrl+K";
  }

  function HighlightText({ text, query }) {
    if (!query || !text) return text || "";
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const idx = lower.indexOf(qLower);
    if (idx === -1) return text;
    return React.createElement(
      React.Fragment,
      null,
      text.slice(0, idx),
      React.createElement(
        "mark",
        { className: "search-highlight" },
        text.slice(idx, idx + query.length),
      ),
      text.slice(idx + query.length),
    );
  }

  function getPendingApprovalLandingTab(userData) {
    if (!userData) return "settings";
    if (userData.role === "mentee" || userData.role === "mentor") {
      return "onboarding";
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
      requestTabChange,
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
      pendingApprovalLandingTab,
      mentorProfile,
    } = ctx;

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
      if (typeof window === "undefined") return false;
      try {
        return (
          window.localStorage.getItem("dashboard-sidebar-collapsed") === "true"
        );
      } catch (_) {
        return false;
      }
    });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMobileView, setIsMobileView] = useState(() =>
      typeof window !== "undefined"
        ? window.innerWidth <= COMPACT_NAV_MAX_WIDTH
        : false,
    );

    useEffect(() => {
      try {
        window.localStorage.setItem(
          "dashboard-sidebar-collapsed",
          String(sidebarCollapsed),
        );
      } catch (_) {}
    }, [sidebarCollapsed]);

    useEffect(() => {
      const onResize = () => {
        const mobile = window.innerWidth <= COMPACT_NAV_MAX_WIDTH;
        setIsMobileView(mobile);
        if (!mobile && mobileMenuOpen) setMobileMenuOpen(false);
      };
      onResize();
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, [mobileMenuOpen]);

    useEffect(() => {
      if (!mobileMenuOpen) return undefined;
      const { body } = document;
      const previousOverflow = body.style.overflow;
      body.style.overflow = "hidden";
      return () => {
        body.style.overflow = previousOverflow;
      };
    }, [mobileMenuOpen]);

    const toggleSidebar = () => setSidebarCollapsed((c) => !c);
    const closeMobileMenu = () => setMobileMenuOpen(false);
    const handleHeaderCollapseClick = () => {
      if (isMobileView) {
        closeMobileMenu();
      } else {
        toggleSidebar();
      }
    };
    const goTo = (tabId) => {
      const changeTab = ctx.requestTabChange || setActiveTab;
      const finishNavigation = (nextTab) => {
        changeTab(nextTab);
        closeMobileMenu();
        try {
          window.scrollTo(0, 0);
        } catch (_) {
          /* jsdom does not implement scrollTo */
        }
      };
      if (user && user.is_profile_complete === false && !isStaff) {
        if (tabId !== "complete-profile") {
          finishNavigation("complete-profile");
          return;
        }
      }
      if (isPendingApproval) {
        const allowedPendingTabs = new Set([
          "onboarding",
          "complete-profile",
          "mentoring-preferences",
          "mentor-matching-profile",
          "settings",
        ]);
        if (!allowedPendingTabs.has(tabId)) {
          finishNavigation(getPendingApprovalLandingTab(user));
          return;
        }
      }
      finishNavigation(tabId);
    };

    const [searchQuery, setSearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchHighlight, setSearchHighlight] = useState(0);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const searchInputRef = useRef(null);
    const profileMenuRef = useRef(null);
    const shortcutLabel = getSearchShortcutLabel();

    const isStaff = !!(user?.is_staff || user?.role === "staff");
    const topbarDisplayName = getTopbarDisplayName(user);
    const topbarRoleLabel = getTopbarRoleLabel(user, isStaff, mentorProfile);

    const filteredTabs = MAIN_TABS.filter((tab) => {
      if (user && user.is_profile_complete === false && !isStaff) {
        return tab.id === "complete-profile";
      }
      if (isPendingApproval) {
        return (
          tab.id === "onboarding" ||
          tab.id === "settings"
        );
      }
      if (tab.id === "onboarding") {
        if (!(user?.role === "mentor" || user?.role === "mentee")) return false;
        if (user.role === "mentee") {
          const prefsDone = !!(
            user.mentee_questionnaire_completed ??
            user.questionnaire_completed
          );
          const approved = !!user.mentee_approved;
          return !(user.mentee_general_info_completed && prefsDone && approved);
        }
        if (user.role === "mentor") {
          return !(
            user.mentor_questionnaire_completed && user.mentor_approved
          );
        }
        return true;
      }
      if (tab.id === "mentoring-preferences") return user?.role === "mentee";
      if (tab.id === "mentor-matching-profile") return user?.role === "mentor";
      if (tab.id === "mentees") return user?.role === "mentor";
      if (tab.id === "profile") return !isStaff;
      if (tab.id === "newsfeed") {
        return !!(window.DashboardApp.FEATURE_NEWSFEED && !isStaff);
      }
      if (tab.id === "users") return isStaff;
      if (tab.id === "activity-logs") return isStaff;
      if (tab.id === "backup") return isStaff;
      if (tab.id === "matching") return !isStaff;
      if (tab.id === "approvals") return isStaff;
      if (tab.id === "complete-profile") {
        const unapprovedMentor =
          user?.role === "mentor" && !user?.mentor_approved;
        const unapprovedMentee =
          user?.role === "mentee" && !user?.mentee_approved;
        return !!(unapprovedMentor || unapprovedMentee);
      }
      return true;
    });
    const dashboardTab = filteredTabs.find((tab) => tab.id === "home");
    const activityTabIds = new Set([
      "newsfeed",
      "matching",
      "mentees",
      "announcements",
      "approvals",
      "users",
      "activity-logs",
      "backup",
    ]);
    const accountTabIds = new Set([
      "profile",
      "settings",
      "onboarding",
      "complete-profile",
      "mentoring-preferences",
      "mentor-matching-profile",
    ]);
    const activityTabs = filteredTabs.filter((tab) =>
      activityTabIds.has(tab.id),
    );
    const accountTabs = filteredTabs.filter((tab) => accountTabIds.has(tab.id));

    const role = user?.role;
    const baseShortcuts = isPendingApproval
      ? []
      : [
          ...(window.DashboardApp.FEATURE_NEWSFEED
            ? [
                {
                  id: "newsfeed",
                  label: "Go to Newsfeed",
                  hint: "See posts from mentors and mentees",
                  roles: ["mentor", "mentee"],
                  type: "shortcut",
                  actionTab: "newsfeed",
                },
              ]
            : []),
          {
            id: "matching",
            label: "Go to Matching",
            hint: "See mentor/mentee matches",
            roles: ["mentor", "mentee", "staff"],
            type: "shortcut",
            actionTab: "matching",
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
            id: "notifications",
            label: "Go to Notifications",
            hint: "See unread updates",
            roles: ["mentor", "mentee", "staff"],
            type: "shortcut",
            actionTab: "notifications",
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
            id: "mentoring-preferences",
            label: "Open mentoring preferences",
            hint: "Choose subjects you want mentoring in",
            roles: ["mentee"],
            type: "shortcut",
            actionTab: "mentoring-preferences",
          },
          {
            id: "mentor-matching-profile",
            label: "Open matching profile",
            hint: "Subjects, competencies, and availability for matching",
            roles: ["mentor"],
            type: "shortcut",
            actionTab: "mentor-matching-profile",
          },
          {
            id: "mentees",
            label: "View all mentees",
            hint: "Official mentees and pairing requests",
            roles: ["mentor"],
            type: "shortcut",
            actionTab: "mentees",
          },
          {
            id: "approvals",
            label: "Review approvals",
            hint: "Approve mentors and mentees",
            roles: ["staff"],
            action: () => goTo("approvals"),
          },
        ].filter((item) => {
          if (!role && !isStaff) return true;
          if (isStaff) return item.roles.includes("staff");
          return !item.roles.length || item.roles.includes(role);
        });

    const trimmedQuery = searchQuery.trim().toLowerCase();
    const pendingPrimaryTab = pendingApprovalLandingTab || "onboarding";
    const pendingPrimaryLabel =
      pendingPrimaryTab === "onboarding"
        ? "Continue onboarding"
        : pendingPrimaryTab === "mentoring-preferences"
          ? "Continue mentoring preferences"
          : pendingPrimaryTab === "mentor-matching-profile"
            ? "Continue matching profile"
            : "Complete profile";

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
      isAuthenticated &&
      !isPendingApproval &&
      searchFocused &&
      trimmedQuery.length > 0;

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

    useEffect(() => {
      const onKeyDown = (e) => {
        if (!isAuthenticated || isPendingApproval) return;
        const key = e.key || "";
        if (key !== "k" && key !== "K") return;
        if (!(e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        setSearchFocused(true);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [isAuthenticated, isPendingApproval]);

    useEffect(() => {
      if (!profileMenuOpen) return;
      const onPointerDown = (e) => {
        const root = profileMenuRef.current;
        if (root && !root.contains(e.target)) {
          setProfileMenuOpen(false);
        }
      };
      const onKeyDown = (e) => {
        if (e.key === "Escape") setProfileMenuOpen(false);
      };
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [profileMenuOpen]);

    function handleSuggestionSelect(item) {
      if (!item) return;
      if (isPendingApproval) return;
      if (item.type === "shortcut" || item.actionTab) {
        const tab = item.actionTab || "home";
        goTo(tab);
      } else if (item.type === "user") {
        if (item.id === user?.id) {
          goTo(isStaff ? "settings" : "profile");
        } else if (typeof loadUserProfile === "function") {
          loadUserProfile(item.id);
        }
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
          prev - 1 < 0 ? suggestions.length - 1 : prev - 1,
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

    const sidebarNav = Sidebar ? (
      <Sidebar
        collapsed={isMobileView ? false : sidebarCollapsed}
        isDrawer={isMobileView}
        dashboardTab={dashboardTab}
        activityTabs={activityTabs}
        accountTabs={accountTabs}
        activeTab={activeTab}
        onNavigate={goTo}
        onHeaderButtonClick={handleHeaderCollapseClick}
        theme={theme}
        toggleTheme={toggleTheme}
        handleLogout={handleLogout}
        logoutLoading={logoutLoading}
        logoUrl={LOGO_URL}
        logoAlt={LOGO_ALT}
      />
    ) : null;

    const profileMenu = profileMenuOpen ? (
      <div
        className="app-topbar-profile-menu logout-popover-card"
        role="menu"
      >
        {!isStaff && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setProfileMenuOpen(false);
              goTo("profile");
            }}
          >
            View profile
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setProfileMenuOpen(false);
            goTo("settings");
          }}
        >
          Settings
        </button>
      </div>
    ) : null;

    return (
      <div className={"app-shell" + (isMobileView ? " is-compact-nav" : "")}>
        {isAuthenticated &&
          (isMobileView ? (
            <Drawer
              anchor="left"
              id="mobile-nav-drawer"
              className="mobile-nav-drawer"
              open={mobileMenuOpen}
              onClose={closeMobileMenu}
              variant="temporary"
              transitionDuration={{ enter: 240, exit: 180 }}
              ModalProps={{ keepMounted: true, disableScrollLock: true }}
              slotProps={{
                paper: {
                  className: "sidebar mobile-drawer-paper",
                  "data-testid": "mobile-nav-drawer-paper",
                },
              }}
            >
              {sidebarNav}
            </Drawer>
          ) : (
            <aside
              className={
                "sidebar sidebar--desktop" +
                (sidebarCollapsed ? " collapsed" : "")
              }
            >
              {sidebarNav}
            </aside>
          ))}

        <div className="app-main-shell">
          {isAuthenticated && isMobileView && (
            <header className="mobile-app-header">
              <IconButton
                className="mobile-header-icon-btn"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen ? "true" : "false"}
                aria-controls="mobile-nav-drawer"
              >
                <MenuOutlinedIcon />
              </IconButton>
              <div className="mobile-app-header-brand">
                <img src={LOGO_URL} alt="" className="mobile-app-header-logo" />
                <span className="mobile-app-header-title">PeerLink</span>
              </div>
              <div className="mobile-app-header-actions">
                <IconButton
                  className="mobile-header-icon-btn"
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark"
                      ? "Switch to light mode"
                      : "Switch to dark mode"
                  }
                  aria-pressed={theme === "light"}
                >
                  {theme === "dark" ? (
                    <DarkModeOutlinedIcon />
                  ) : (
                    <LightModeOutlinedIcon />
                  )}
                </IconButton>
                <div className="app-topbar-profile" ref={profileMenuRef}>
                  <IconButton
                    className={
                      "mobile-header-icon-btn mobile-header-avatar-btn" +
                      (profileMenuOpen ? " is-open" : "")
                    }
                    onClick={() => setProfileMenuOpen((open) => !open)}
                    aria-label={"Account menu for " + topbarDisplayName}
                    aria-haspopup="menu"
                    aria-expanded={profileMenuOpen ? "true" : "false"}
                    title={topbarDisplayName}
                  >
                    <span className="sidebar-avatar-wrapper">
                      {user && user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="sidebar-avatar"
                        />
                      ) : (
                        <span className="sidebar-avatar fallback">
                          {topbarDisplayName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </IconButton>
                  {profileMenu}
                </div>
              </div>
            </header>
          )}
          {isAuthenticated && (
            <header className="app-topbar">
              {!isMobileView && (
                <div className="app-topbar-left">
                  <div className="app-topbar-meta">
                    <div className="app-topbar-meta-label">{LOGO_ALT}</div>
                    <div className="app-topbar-title-row">
                      <h1 className="app-topbar-meta-title">PeerLink</h1>
                    </div>
                  </div>
                </div>
              )}

              {!isPendingApproval ? (
                <div className="app-topbar-right">
                  <div className="app-topbar-search-wrapper">
                    <div className="app-topbar-search">
                      <span className="app-topbar-search-icon" aria-hidden="true">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="7" />
                          <line x1="16.65" y1="16.65" x2="21" y2="21" />
                        </svg>
                      </span>
                      <input
                        ref={searchInputRef}
                        type="search"
                        className="app-topbar-search-input"
                        placeholder="Search mentors, students, or skills..."
                        aria-label="Search mentors, students, or skills"
                        aria-keyshortcuts="Control+K Meta+K"
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
                        className="app-topbar-shortcut"
                        aria-label={"Focus search, " + shortcutLabel}
                        title={"Focus search (" + shortcutLabel + ")"}
                        onClick={() => {
                          if (searchInputRef.current) {
                            searchInputRef.current.focus();
                          }
                        }}
                      >
                        <kbd>{shortcutLabel}</kbd>
                      </button>
                    </div>
                    {showSuggestions && (
                      <div className="search-dropdown" role="listbox">
                        {suggestions.some((s) => s.type === "user") && (
                          <div className="search-dropdown-section">
                            <div className="search-dropdown-heading">Users</div>
                            {suggestions
                              .filter((s) => s.type === "user")
                              .map((item, idx) => {
                                const globalIdx = suggestions.indexOf(item);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className={
                                      "search-dropdown-item" +
                                      (globalIdx === searchHighlight
                                        ? " active"
                                        : "")
                                    }
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSuggestionSelect(item);
                                    }}
                                    role="option"
                                    aria-selected={
                                      globalIdx === searchHighlight
                                    }
                                  >
                                    <div className="search-dropdown-avatar">
                                      {item.avatar_url ? (
                                        <img src={item.avatar_url} alt="" />
                                      ) : (
                                        <span className="search-dropdown-avatar-fallback">
                                          {(item.label || "?")[0].toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                    <div className="search-dropdown-info">
                                      <span className="search-dropdown-name">
                                        <HighlightText
                                          text={item.label}
                                          query={trimmedQuery}
                                        />
                                      </span>
                                      <span
                                        className={
                                          "search-dropdown-role search-role-" +
                                          (item.role || "user")
                                        }
                                      >
                                        {item.role === "mentor"
                                          ? "Mentor"
                                          : item.role === "mentee"
                                            ? "Mentee"
                                            : "User"}
                                      </span>
                                    </div>
                                    <svg
                                      className="search-dropdown-arrow"
                                      width="14"
                                      height="14"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                  </button>
                                );
                              })}
                          </div>
                        )}
                        {suggestions.some((s) => s.type === "shortcut") && (
                          <div className="search-dropdown-section">
                            <div className="search-dropdown-heading">
                              Quick actions
                            </div>
                            {suggestions
                              .filter((s) => s.type === "shortcut")
                              .map((item) => {
                                const globalIdx = suggestions.indexOf(item);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className={
                                      "search-dropdown-item search-dropdown-item--shortcut" +
                                      (globalIdx === searchHighlight
                                        ? " active"
                                        : "")
                                    }
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      handleSuggestionSelect(item);
                                    }}
                                  >
                                    <div className="search-dropdown-info">
                                      <span className="search-dropdown-name">
                                        <HighlightText
                                          text={item.label}
                                          query={trimmedQuery}
                                        />
                                      </span>
                                      {item.hint && (
                                        <span className="search-dropdown-hint">
                                          {item.hint}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        )}
                        {trimmedQuery && suggestions.length === 0 && (
                          <div className="search-dropdown-empty">
                            No results found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="app-topbar-actions">
                    <button
                      type="button"
                      className="sidebar-icon-btn app-topbar-bell"
                      onClick={() => goTo("notifications")}
                      aria-label={
                        unreadCount > 0
                          ? "Notifications, " + unreadCount + " unread"
                          : "Notifications"
                      }
                    >
                      <svg
                        className="sidebar-icon-bell"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                      <span
                        className={
                          "app-topbar-bell-dot" +
                          (unreadCount > 0 ? " is-active" : "")
                        }
                        aria-hidden="true"
                      />
                      {unreadCount > 0 && (
                        <span className="nav-badge">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>
                    {!isMobileView && (
                    <div className="app-topbar-profile" ref={profileMenuRef}>
                      <button
                        type="button"
                        className={
                          "app-topbar-profile-btn" +
                          (profileMenuOpen ? " is-open" : "")
                        }
                        onClick={() => setProfileMenuOpen((open) => !open)}
                        aria-label={
                          "Account menu for " + topbarDisplayName
                        }
                        aria-haspopup="menu"
                        aria-expanded={profileMenuOpen ? "true" : "false"}
                        title={topbarDisplayName}
                      >
                        <div className="sidebar-avatar-wrapper">
                          {user && user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=""
                              className="sidebar-avatar"
                            />
                          ) : (
                            <div className="sidebar-avatar fallback">
                              {topbarDisplayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="app-topbar-user-text">
                          <span className="app-topbar-user-name">
                            {topbarDisplayName}
                          </span>
                          <span className="app-topbar-user-role">
                            {topbarRoleLabel}
                          </span>
                        </span>
                        <KeyboardArrowDownOutlinedIcon
                          className="app-topbar-caret"
                          fontSize="inherit"
                          aria-hidden="true"
                        />
                      </button>
                      {profileMenu}
                    </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="app-topbar-right">
                  <div className="btn-row" style={{ margin: 0 }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => goTo(pendingPrimaryTab)}
                    >
                      {pendingPrimaryLabel}
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => goTo("settings")}
                    >
                      Account settings
                    </button>
                  </div>
                </div>
              )}
            </header>
          )}

          <main
            className={
              "app-content dashboard-main-content " +
              (isAuthenticated ? "with-sidebar" : "") +
              (sidebarCollapsed && isAuthenticated && !isMobileView
                ? " sidebar-collapsed"
                : "")
            }
          >
            <MainContent />
          </main>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Layout = Layout;
})();
