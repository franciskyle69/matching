(function () {
  "use strict";
  window.DashboardApp = window.DashboardApp || {};

  // Central route / tab configuration
  const ROUTES = [
    { id: "home", label: "Dashboard", role: "any" },
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
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
})();
