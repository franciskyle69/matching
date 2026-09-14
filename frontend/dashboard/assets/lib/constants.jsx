(function () {
  "use strict";
  window.DashboardApp = window.DashboardApp || {};

  window.DashboardApp.LOGO_URL = "/static/assets/logo_icon.png";
  window.DashboardApp.LOGO_ALT = "AMU Mentoring";

  window.DashboardApp.FOOTER = {
    unitName: "Bukidnon State University — Academic Mentoring Unit",
    shortName: "Bukidnon State University — AMU",
    tagline:
      "Helping students succeed through mentoring, peer support, and faculty consultations.",
    address:
      "Main Campus, Fortich Street, Malaybalay City, Bukidnon, Philippines",
    email: "amu@buksu.edu.ph",
    phone: "(088) 813-5661 to 5663",
    fax: "(088) 813-2717",
    websiteUrl: "https://www.buksu.edu.ph",
    websiteLabel: "www.buksu.edu.ph",
    facebookUrl: "https://www.facebook.com/buksuAMU",
    facebookLabel: "Facebook — @buksuAMU",
  };

  window.DashboardApp.CAMPUS_OPTIONS = [
    "QUEZON",
    "LIBONA",
    "ALUBIJID",
    "IMPASUG-ONG",
    "BAUNGON",
    "KADINGILAN",
    "KITAOTAO",
    "DAMULOG",
    "CABANGLASAN",
    "TALISAYAN",
    "SAN FERNANDO",
    "MALITBOG",
    "MAIN CAMPUS",
    "MEDINA",
    "TALAKAG",
    "KALILANGAN",
    "LANTAPAN",
  ];

  // Central route / tab configuration
  // Newsfeed is temporarily hidden (set true to restore nav + deep links).
  const FEATURE_NEWSFEED = false;
  const ROUTES = [
    { id: "home", label: "Dashboard", role: "any" },
    ...(FEATURE_NEWSFEED
      ? [{ id: "newsfeed", label: "Newsfeed", role: "non-staff" }]
      : []),
    { id: "profile", label: "Profile", role: "any" },
    { id: "onboarding", label: "Onboarding", role: "non-staff" },
    { id: "complete-profile", label: "Complete profile", role: "any" },
    {
      id: "mentoring-preferences",
      label: "Mentoring preferences",
      role: "mentee",
    },
    {
      id: "mentor-matching-profile",
      label: "Mentor matching profile",
      role: "mentor",
    },
    { id: "mentees", label: "Mentees", role: "mentor" },
    { id: "matching", label: "Matching", role: "non-staff" },
    { id: "announcements", label: "Announcements", role: "any" },
    { id: "approvals", label: "User approvals", role: "staff" },
    { id: "users", label: "Users", role: "staff" },
    { id: "activity-logs", label: "Activity Logs", role: "staff" },
    { id: "backup", label: "Backup & Restore", role: "staff" },
    { id: "settings", label: "Settings", role: "any" },
  ];

  window.DashboardApp.FEATURE_NEWSFEED = FEATURE_NEWSFEED;
  window.DashboardApp.ROUTES = ROUTES;
  // Topbar-only tabs: routable but hidden from sidebar navigation.
  window.DashboardApp.HIDDEN_TABS = [
    { id: "notifications", label: "Notifications" },
  ];
  window.DashboardApp.MAIN_TABS = ROUTES.map(({ id, label }) => ({
    id,
    label,
  }));
  window.DashboardApp.getTabMeta = function getTabMeta(tabId) {
    const visible = ROUTES.find((tab) => tab.id === tabId);
    if (visible) return { id: visible.id, label: visible.label };
    const hidden = window.DashboardApp.HIDDEN_TABS.find(
      (tab) => tab.id === tabId,
    );
    return hidden ? { id: hidden.id, label: hidden.label } : null;
  };
  window.DashboardApp.SUBJECT_CATEGORY_LABELS = {
    major: "Major subjects",
    ge: "General Education (GE)",
    nstp: "NSTP",
    pe: "Physical Education (PE)",
  };
  window.DashboardApp.SUBJECT_CATEGORY_ORDER = ["major", "ge", "nstp", "pe"];
  window.DashboardApp.SUBJECT_CATALOG = [
    { name: "Computer Programming", code: "IT 112", category: "major" },
    { name: "Introduction to Computing", code: "IT 111", category: "major" },
    { name: "IT Fundamentals", code: "IT 113", category: "major" },
    {
      name: "Intro to Human Computer Interaction",
      code: "IT 115",
      category: "major",
    },
    {
      name: "GE 108: Understanding the Self",
      code: "GE 108",
      category: "ge",
    },
    {
      name: "GE 104: Readings in Philippine History",
      code: "GE 104",
      category: "ge",
    },
    {
      name: "GE EL 108: Philippine Indigenous Communities",
      code: "GE EL 108",
      category: "ge",
    },
    {
      name: "GE 105: Mathematics in the Modern World",
      code: "GE 105",
      category: "ge",
    },
    {
      name: "NSTP 1: Civic Welfare Training Service",
      code: "NSTP 1",
      category: "nstp",
    },
    {
      name: "NSTP 2: Civic Welfare Training Service",
      code: "NSTP 2",
      category: "nstp",
    },
    {
      name: "PE 1: PATH FIT 1 - Movement Enhancement",
      code: "PE 1",
      category: "pe",
    },
    {
      name: "PE 2: PATH FIT 2 - Fitness Exercises",
      code: "PE 2",
      category: "pe",
    },
  ];
  window.DashboardApp.MENTOR_SUBJECT_OPTIONS =
    window.DashboardApp.SUBJECT_CATALOG.map((item) => item.name);
  window.DashboardApp.isMinorSubject = function isMinorSubject(subjectName) {
    const item = (window.DashboardApp.SUBJECT_CATALOG || []).find(
      (entry) => entry.name === subjectName,
    );
    return !!(item && item.category !== "major");
  };
  window.DashboardApp.getMajorSubjectsFromSelection = function getMajorSubjectsFromSelection(
    subjects,
  ) {
    const selected = Array.isArray(subjects) ? subjects : [];
    return selected.filter(
      (name) => !window.DashboardApp.isMinorSubject(name),
    );
  };
  window.DashboardApp.selectionRequiresTopics = function selectionRequiresTopics(
    subjects,
  ) {
    return window.DashboardApp.getMajorSubjectsFromSelection(subjects).length > 0;
  };
  window.DashboardApp.MENTOR_TOPIC_OPTIONS = [
    "History & Hardware Evolution",
    "Digital Logic & Data Representation",
    "Operating Systems & Architecture",
    "Computer Networks Basics",
    "Control Structures",
    "Data Structures",
    "Modular Programming",
    "Debugging & Execution",
    "Web Markup",
    "Web Styling",
    "Client-Side Scripting",
    "Command Line & Web Infra",
    "HCI Principles & Guidelines",
    "Interaction Design & Cognitive Models",
    "User Research & Behavioral Mapping",
    "Prototyping & UI Tooling",
    "High-Fidelity Design & Documentation",
  ];
  window.DashboardApp.QUESTIONNAIRE_TOPIC_MAP = {
    "Introduction to Computing": [
      "History & Hardware Evolution",
      "Digital Logic & Data Representation",
      "Operating Systems & Architecture",
      "Computer Networks Basics",
    ],
    "Computer Programming": [
      "Control Structures",
      "Data Structures",
      "Modular Programming",
      "Debugging & Execution",
    ],
    "IT Fundamentals": [
      "Web Markup",
      "Web Styling",
      "Client-Side Scripting",
      "Command Line & Web Infra",
    ],
    "Intro to Human Computer Interaction": [
      "HCI Principles & Guidelines",
      "Interaction Design & Cognitive Models",
      "User Research & Behavioral Mapping",
      "Prototyping & UI Tooling",
      "High-Fidelity Design & Documentation",
    ],
  };
  window.DashboardApp.getAllowedTopicsForSubjects =
    function getAllowedTopicsForSubjects(subjects) {
      const selected = window.DashboardApp.getMajorSubjectsFromSelection(subjects);
      const allowed = [];
      const seen = new Set();
      selected.forEach((subject) => {
        (window.DashboardApp.QUESTIONNAIRE_TOPIC_MAP[subject] || []).forEach(
          (topic) => {
            if (!seen.has(topic)) {
              seen.add(topic);
              allowed.push(topic);
            }
          },
        );
      });
      return allowed;
    };
  window.DashboardApp.filterTopicsForSubjects =
    function filterTopicsForSubjects(subjects, topics) {
      const allowed = new Set(
        window.DashboardApp.getAllowedTopicsForSubjects(subjects),
      );
      const selectedTopics = Array.isArray(topics) ? topics : [];
      return selectedTopics.filter((topic) => allowed.has(topic));
    };
  window.DashboardApp.ROLE_OPTIONS = [
    { value: "mentor", label: "Mentor" },
    { value: "mentee", label: "Mentee" },
  ];
  window.DashboardApp.PLACEHOLDER_AVATAR =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M5 20c0-3.2 3-5 7-5s7 1.8 7 5'/%3E%3Ccircle cx='12' cy='12' r='10' stroke-width='1.6'/%3E%3C/svg%3E";
})();
