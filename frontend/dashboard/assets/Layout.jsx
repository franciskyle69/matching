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
  const LOGO_URL = window.DashboardApp.LOGO_URL || "/static/assets/logo_icon.png";
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
    if (!userData) return "pending-approval";
    if (userData.approval_status === "REJECTED") return "account-rejected";
    if (userData.is_onboarded === false) return "onboarding";
    return "pending-approval";
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
      myMentor,
      myMentors = [],
      menteePairingsCount,
    } = ctx;

    const sidebarCollapsed = false;
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isMobileView, setIsMobileView] = useState(() =>
      typeof window !== "undefined"
        ? window.innerWidth <= COMPACT_NAV_MAX_WIDTH
        : false,
    );

    useEffect(() => {
      try {
        window.localStorage.removeItem("dashboard-sidebar-collapsed");
      } catch (_) {}
    }, []);

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

    const isStaff = !!(
      user?.is_staff ||
      user?.role === "staff" ||
      user?.role === "coordinator"
    );

    const closeMobileMenu = () => setMobileMenuOpen(false);
    const handleHeaderCollapseClick = () => {
      if (isMobileView) {
        closeMobileMenu();
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
      if (isStaff) {
        if (
          tabId === "onboarding" ||
          tabId === "complete-profile" ||
          tabId === "profile" ||
          tabId === "mentees" ||
          tabId === "mentoring-preferences" ||
          tabId === "mentor-matching-profile"
        ) {
          finishNavigation("home");
          return;
        }
      }
      if (user && user.is_profile_complete === false && !isStaff) {
        if (tabId !== "complete-profile") {
          finishNavigation("complete-profile");
          return;
        }
      }
      if (isPendingApproval && !isStaff) {
        if (user && user.is_onboarded === false) {
          if (tabId !== "onboarding") {
            finishNavigation("onboarding");
            return;
          }
        } else {
          const allowedPendingTabs = new Set([
            "pending-approval",
            "account-pending",
            "account-rejected",
            "profile",
            "settings",
          ]);
          if (!allowedPendingTabs.has(tabId)) {
            finishNavigation(getPendingApprovalLandingTab(user));
            return;
          }
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

    const topbarDisplayName = getTopbarDisplayName(user);
    const topbarRoleLabel = getTopbarRoleLabel(user, isStaff, mentorProfile);

    const TAB_TITLES = {
      home: "Overview",
      matching: isStaff ? "Paired Users" : "Matching",
      announcements: "Announcements",
      approvals: "User Approvals",
      users: "User Directory",
      mentees: "My Mentees",
      settings: "Account Settings",
      notifications: "Notifications",
      "activity-logs": "Activity Logs",
      backup: "System Backup",
      "mentoring-preferences": "Matching Profile",
      "mentor-matching-profile": "Matching Profile",
      onboarding: "Onboarding",
      "complete-profile": "Profile Setup",
      "pending-approval": "Account Under Review",
      "account-pending": "Account Under Review",
      "account-rejected": "Account Application Rejected",
    };
    const currentPageTitle = TAB_TITLES[activeTab] || "Dashboard";

    const currentDateText = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const filteredTabs = MAIN_TABS.filter((tab) => {
      if (isStaff) {
        if (
          tab.id === "onboarding" ||
          tab.id === "complete-profile" ||
          tab.id === "mentees" ||
          tab.id === "mentoring-preferences" ||
          tab.id === "mentor-matching-profile" ||
          tab.id === "profile"
        ) {
          return false;
        }
      }
      if (user && user.is_profile_complete === false && !isStaff) {
        return tab.id === "complete-profile";
      }
      if (isPendingApproval && !isStaff) {
        if (user && user.is_onboarded === false) {
          return tab.id === "onboarding" || tab.id === "settings";
        }
        return tab.id === "settings";
      }
      if (tab.id === "onboarding") {
        if (isStaff) return false;
        if (!(user?.role === "mentor" || user?.role === "mentee")) return false;
        if (user?.is_onboarded) return false;
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
      if (tab.id === "matching") return true;
      if (tab.id === "approvals") return isStaff;
      if (tab.id === "complete-profile") {
        if (isStaff) return false;
        if (user?.is_onboarded) return false;
        const unapprovedMentor =
          user?.role === "mentor" && !user?.mentor_approved;
        const unapprovedMentee =
          user?.role === "mentee" && !user?.mentee_approved;
        return !!(unapprovedMentor || unapprovedMentee);
      }
      return true;
    });
    const isMenteeUser = (user?.role === "mentee" || user?.role === "both") && !isStaff;
    const menteeActiveCount = Math.max(
      (myMentors && myMentors.length) || (myMentor ? 1 : 0),
      menteePairingsCount || 0
    );
    const isMenteeLimitReached = isMenteeUser && menteeActiveCount >= 2;

    const tabsWithDynamicLabels = filteredTabs.map((tab) => {
      if (tab.id === "matching") {
        if (isStaff) {
          return { ...tab, label: "Paired Users" };
        }
        if (isMenteeUser) {
          return {
            ...tab,
            badge: isMenteeLimitReached ? "2/2 Limit" : menteeActiveCount === 1 ? "1/2 Slots" : undefined,
            badgeType: isMenteeLimitReached ? "danger" : "info",
          };
        }
      }
      return tab;
    });
    const dashboardTab = tabsWithDynamicLabels.find((tab) => tab.id === "home");
    const activityTabIds = new Set([
      "newsfeed",
      "matching",
      "mentees",
      "notifications",
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
    const activityTabs = tabsWithDynamicLabels.filter((tab) =>
      activityTabIds.has(tab.id),
    );
    const accountTabs = tabsWithDynamicLabels.filter((tab) => accountTabIds.has(tab.id));

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
            roles: ["mentor", "mentee"],
            type: "shortcut",
            actionTab: "matching",
          },
          {
            id: "matching-staff",
            label: "Go to Paired Users",
            hint: "Review matched mentor and mentee pairs and why they match",
            roles: ["staff"],
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
        collapsed={false}
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
            <aside className="sidebar sidebar--desktop">
              {sidebarNav}
            </aside>
          ))}

        <div className="app-main-shell">
          {!isAuthenticated && (
            <div className="auth-floating-topbar">
              <button
                type="button"
                className="sidebar-icon-btn app-topbar-theme-btn auth-floating-theme-btn"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? (
                  <LightModeOutlinedIcon fontSize="small" aria-hidden="true" />
                ) : (
                  <DarkModeOutlinedIcon fontSize="small" aria-hidden="true" />
                )}
              </button>
            </div>
          )}
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
                <img src={LOGO_URL} alt="Peerlink" className="mobile-app-header-logo" />
                <div className="mobile-app-header-text">
                  <span className="mobile-app-header-title">
                    <span className="brand-peer">Peer</span>
                    <span className="brand-link">link</span>
                  </span>
                  <span className="mobile-app-header-subtitle">Academic Mentoring Unit</span>
                </div>
              </div>
              <div className="mobile-app-header-actions">
                <button
                  type="button"
                  className="sidebar-icon-btn mobile-header-icon-btn mobile-header-bell-btn app-topbar-bell"
                  onClick={() => {
                    closeMobileMenu();
                    goTo("notifications");
                  }}
                  aria-label={
                    unreadCount > 0
                      ? "Notifications, " + unreadCount + " unread"
                      : "Notifications"
                  }
                  title={
                    unreadCount > 0
                      ? "Notifications (" + unreadCount + " unread)"
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
                    <span className="nav-badge mobile-nav-badge">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="sidebar-icon-btn mobile-header-icon-btn app-topbar-theme-btn"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? (
                    <LightModeOutlinedIcon fontSize="small" aria-hidden="true" />
                  ) : (
                    <DarkModeOutlinedIcon fontSize="small" aria-hidden="true" />
                  )}
                </button>
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
                      <span className="app-topbar-title-separator" aria-hidden="true">/</span>
                      <span className="app-topbar-current-page">{currentPageTitle}</span>
                    </div>
                  </div>
                </div>
              )}

              {!isMobileView && (
                <div className="app-topbar-center">
                  <div className="app-topbar-date-badge" title="Today's Date">
                    <svg
                      className="app-topbar-date-icon"
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="app-topbar-date-text">{currentDateText}</span>
                  </div>
                </div>
              )}

              {!isPendingApproval ? (
                <div className="app-topbar-right">
                  <div className="app-topbar-actions">
                    {isStaff ? (
                      <button
                        type="button"
                        className="app-topbar-quick-btn"
                        onClick={() => goTo("users")}
                        title="Search and manage all registered mentors and mentees"
                        aria-label="User Directory"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="app-topbar-quick-icon"
                          aria-hidden="true"
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>Users</span>
                      </button>
                    ) : user?.role === "mentee" ? (
                      <button
                        type="button"
                        className="app-topbar-quick-btn"
                        onClick={() => goTo("matching")}
                        title="Find mentors in directory"
                        aria-label="Find mentor"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="app-topbar-quick-icon"
                          aria-hidden="true"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <span>Find Mentor</span>
                      </button>
                    ) : user?.role === "mentor" ? (
                      <button
                        type="button"
                        className="app-topbar-quick-btn"
                        onClick={() => goTo("mentees")}
                        title="View assigned mentees"
                        aria-label="My mentees"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="app-topbar-quick-icon"
                          aria-hidden="true"
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span>My Mentees</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="sidebar-icon-btn app-topbar-theme-btn"
                      onClick={toggleTheme}
                      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    >
                      {theme === "dark" ? (
                        <LightModeOutlinedIcon fontSize="small" aria-hidden="true" />
                      ) : (
                        <DarkModeOutlinedIcon fontSize="small" aria-hidden="true" />
                      )}
                    </button>

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
                  <div className="btn-row" style={{ margin: 0, alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      className="sidebar-icon-btn app-topbar-theme-btn"
                      onClick={toggleTheme}
                      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    >
                      {theme === "dark" ? (
                        <LightModeOutlinedIcon fontSize="small" aria-hidden="true" />
                      ) : (
                        <DarkModeOutlinedIcon fontSize="small" aria-hidden="true" />
                      )}
                    </button>
                    {user && user.is_onboarded === false && (
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => goTo("onboarding")}
                      >
                        Continue Onboarding
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={handleLogout}
                    >
                      Log Out
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
