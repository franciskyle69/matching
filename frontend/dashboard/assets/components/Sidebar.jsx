import BackupOutlinedIcon from "@mui/icons-material/BackupOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DynamicFeedOutlinedIcon from "@mui/icons-material/DynamicFeedOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
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
        {tab.badge && (
          <span
            className={`sidebar-link-badge ${
              tab.badgeType === "danger"
                ? "sidebar-link-badge--danger"
                : "sidebar-link-badge--info"
            }`}
            style={{
              marginLeft: "auto",
              fontSize: "0.68rem",
              fontWeight: "700",
              padding: "2px 7px",
              borderRadius: "10px",
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
              backgroundColor:
                tab.badgeType === "danger"
                  ? "rgba(239, 68, 68, 0.16)"
                  : "rgba(59, 130, 246, 0.16)",
              color: tab.badgeType === "danger" ? "#ef4444" : "#3b82f6",
              border: `1px solid ${
                tab.badgeType === "danger"
                  ? "rgba(239, 68, 68, 0.35)"
                  : "rgba(59, 130, 246, 0.35)"
              }`,
            }}
          >
            {tab.badge}
          </span>
        )}
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
      </>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Sidebar = Sidebar;
})();
