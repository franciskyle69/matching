(function () {
  "use strict";
  window.DashboardApp = window.DashboardApp || {};

  // Central route / tab configuration
  const ROUTES = [
    { id: "home", label: "Dashboard", role: "any" },
    { id: "profile", label: "Profile", role: "any" },
    { id: "complete-profile", label: "Complete profile", role: "any" },
    { id: "matching", label: "Matching", role: "non-staff" },
    { id: "sessions", label: "Sessions", role: "any" },
    { id: "announcements", label: "Announcements", role: "any" },
    { id: "approvals", label: "Approvals", role: "staff" },
    { id: "subjects", label: "Subjects", role: "staff" },
    { id: "activity-logs", label: "Activity Logs", role: "staff" },
    { id: "backup", label: "Backup & Restore", role: "staff" },
    { id: "settings", label: "Settings", role: "any" },
  ];

  window.DashboardApp.ROUTES = ROUTES;
  window.DashboardApp.MAIN_TABS = ROUTES.map(({ id, label }) => ({ id, label }));
  window.DashboardApp.MENTOR_SUBJECT_OPTIONS = [
    "Computer Programming",
    "Introduction to Computing",
    "Intro to Human Computer Interaction",
    "IT Fundamentals",
  ];
  window.DashboardApp.MENTOR_TOPIC_OPTIONS = [
    "Arrays",
    "Loops",
    "Input and Output Handling",
    "Error Handling",
    "HTML",
    "CSS",
    "Javascript",
    "UI/UX",
  ];
  window.DashboardApp.ROLE_OPTIONS = [
    { value: "mentor", label: "Mentor" },
    { value: "mentee", label: "Mentee" },
  ];
  window.DashboardApp.PLACEHOLDER_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M5 20c0-3.2 3-5 7-5s7 1.8 7 5'/%3E%3Ccircle cx='12' cy='12' r='10' stroke-width='1.6'/%3E%3C/svg%3E";
})();
