import BackupOutlinedIcon from "@mui/icons-material/BackupOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DynamicFeedOutlinedIcon from "@mui/icons-material/DynamicFeedOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";

(function () {
  "use strict";
  const React = window.React;

  function SidebarNavIcon({ IconComponent }) {
    return (
      <IconComponent
        className="sidebar-mui-icon"
        fontSize="inherit"
        aria-hidden="true"
      />
    );
  }

  const TAB_ICONS = {
    home: <SidebarNavIcon IconComponent={DashboardOutlinedIcon} />,
    newsfeed: <SidebarNavIcon IconComponent={DynamicFeedOutlinedIcon} />,
    profile: <SidebarNavIcon IconComponent={PersonOutlineIcon} />,
    "complete-profile": <SidebarNavIcon IconComponent={VerifiedOutlinedIcon} />,
    onboarding: <SidebarNavIcon IconComponent={SchoolOutlinedIcon} />,
    "mentoring-preferences": <SidebarNavIcon IconComponent={TuneOutlinedIcon} />,
    "mentor-matching-profile": <SidebarNavIcon IconComponent={TuneOutlinedIcon} />,
    matching: <SidebarNavIcon IconComponent={HandshakeOutlinedIcon} />,
    mentees: <SidebarNavIcon IconComponent={GroupsOutlinedIcon} />,
    announcements: <SidebarNavIcon IconComponent={CampaignOutlinedIcon} />,
    notifications: <SidebarNavIcon IconComponent={NotificationsOutlinedIcon} />,
    approvals: <SidebarNavIcon IconComponent={CheckCircleOutlineIcon} />,
    users: <SidebarNavIcon IconComponent={PeopleOutlineIcon} />,
    "activity-logs": <SidebarNavIcon IconComponent={DescriptionOutlinedIcon} />,
    backup: <SidebarNavIcon IconComponent={BackupOutlinedIcon} />,
    settings: <SidebarNavIcon IconComponent={SettingsOutlinedIcon} />,
  };

  function SidebarLink({ tab, activeTab, onNavigate }) {
    return (
      <button
        key={tab.id}
        type="button"
        className={
          "sidebar-link nav-item " + (activeTab === tab.id ? "active" : "")
        }
        onClick={() => onNavigate(tab.id)}
        title={tab.label}
      >
        <span className="sidebar-link-icon">
          {TAB_ICONS[tab.id] || TAB_ICONS.home}
        </span>
        <span className="sidebar-link-text nav-item-label">{tab.label}</span>
      </button>
    );
  }

  function Sidebar({
    collapsed = false,
    isDrawer = false,
    dashboardTab,
    activityTabs = [],
    accountTabs = [],
    activeTab,
    onNavigate,
    onHeaderButtonClick,
    theme,
    toggleTheme,
    handleLogout,
    logoutLoading,
    logoUrl,
    logoAlt,
  }) {
    const headerLabel = isDrawer
      ? "Close menu"
      : collapsed
        ? "Expand sidebar"
        : "Collapse sidebar";

    return (
      <>
        <div className="sidebar-header">
          {collapsed ? (
            <div className="sidebar-header-collapsed">
              <button
                type="button"
                className="sidebar-collapsed-logo-pod"
                onClick={onHeaderButtonClick}
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <img
                  src="/static/assets/logo_icon.png"
                  alt={logoAlt}
                  className="sidebar-logo-icon"
                />
              </button>
              <button
                type="button"
                className="sidebar-collapse-btn sidebar-collapse-btn--collapsed"
                onClick={onHeaderButtonClick}
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="sidebar-header-expanded">
              <div className="sidebar-header-title">
                <div className="sidebar-logo-wrapper">
                  <img
                    src="/static/assets/logo_icon.png"
                    alt={logoAlt}
                    className="sidebar-logo-icon"
                  />
                </div>
                <div className="sidebar-brand-text">
                  <div className="sidebar-brand-title">
                    <span className="brand-peer">Peer</span>
                    <span className="brand-link">link</span>
                  </div>
                  <div className="sidebar-brand-subtitle">
                    Academic Mentoring Unit
                  </div>
                </div>
              </div>
              {!isDrawer && (
                <button
                  type="button"
                  className="sidebar-collapse-btn sidebar-collapse-btn--expanded"
                  onClick={onHeaderButtonClick}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              {isDrawer && (
                <button
                  type="button"
                  className="sidebar-collapse-btn sidebar-drawer-close"
                  onClick={onHeaderButtonClick}
                  aria-label="Close menu"
                  title="Close menu"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="sidebar-section">
          {dashboardTab && (
            <>
              <div className="sidebar-title nav-section-label">Main</div>
              <div className="sidebar-links">
                <SidebarLink
                  tab={dashboardTab}
                  activeTab={activeTab}
                  onNavigate={onNavigate}
                />
              </div>
            </>
          )}

          {activityTabs.length > 0 && (
            <>
              <div className="sidebar-title nav-section-label">My Activities</div>
              <div className="sidebar-links">
                {activityTabs.map((tab) => (
                  <SidebarLink
                    key={tab.id}
                    tab={tab}
                    activeTab={activeTab}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </>
          )}

          {accountTabs.length > 0 && (
            <>
              <div className="sidebar-title nav-section-label">Account Pages</div>
              <div className="sidebar-links">
                {accountTabs.map((tab) => (
                  <SidebarLink
                    key={tab.id}
                    tab={tab}
                    activeTab={activeTab}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="sidebar-section sidebar-footer">
          {collapsed ? (
            <div className="sidebar-footer-collapsed">
              <button
                type="button"
                className="theme-toggle theme-toggle--collapsed"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                title="Toggle appearance"
              >
                <LightModeOutlinedIcon
                  className="sidebar-mui-icon sidebar-mui-icon--toggle"
                  fontSize="inherit"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="btn secondary sidebar-logout-btn sidebar-logout-btn--collapsed"
                onClick={handleLogout}
                disabled={logoutLoading}
                aria-busy={logoutLoading ? "true" : "false"}
                title="Log out"
              >
                {logoutLoading ? (
                  <span className="sidebar-logout-spinner" aria-hidden="true" />
                ) : (
                  <LogoutOutlinedIcon
                    className="sidebar-mui-icon sidebar-logout-icon"
                    fontSize="inherit"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          ) : (
            <div className="sidebar-footer-expanded">
              <button
                type="button"
                className="theme-toggle theme-toggle--switch is-light"
                onClick={toggleTheme}
                aria-label="Light mode active"
                aria-pressed="true"
                title="Light mode (Neumorphic Soft UI)"
              >
                <span className="theme-toggle-copy">
                  <span className="theme-toggle-label">Light mode</span>
                  <span className="theme-toggle-hint">Appearance</span>
                </span>
                <span className="theme-toggle-track" aria-hidden="true">
                  <span className="theme-toggle-thumb">
                    <LightModeOutlinedIcon
                      className="sidebar-mui-icon sidebar-mui-icon--toggle"
                      fontSize="inherit"
                      aria-hidden="true"
                    />
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="btn secondary sidebar-logout-btn"
                onClick={handleLogout}
                disabled={logoutLoading}
                aria-busy={logoutLoading ? "true" : "false"}
                title="Log out"
              >
                {logoutLoading ? (
                  <span className="sidebar-logout-spinner" aria-hidden="true" />
                ) : (
                  <LogoutOutlinedIcon
                    className="sidebar-mui-icon sidebar-logout-icon"
                    fontSize="inherit"
                    aria-hidden="true"
                  />
                )}
                <span className="sidebar-logout-text">
                  {logoutLoading ? "Logging out..." : "Log out"}
                </span>
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Sidebar = Sidebar;
})();
