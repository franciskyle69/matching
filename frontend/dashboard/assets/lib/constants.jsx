(function () {
  "use strict";
  window.DashboardApp = window.DashboardApp || {};

  window.DashboardApp.LOGO_URL = "/static/assets/logo.png";
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
  const ROUTES = [
    { id: "home", label: "Dashboard", role: "any" },
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
    { id: "notifications", label: "Notifications", role: "any" },
    { id: "approvals", label: "User approvals", role: "staff" },
    { id: "subjects", label: "Subjects", role: "staff" },
    { id: "users", label: "Users", role: "staff" },
    { id: "activity-logs", label: "Activity Logs", role: "staff" },
    { id: "backup", label: "Backup & Restore", role: "staff" },
    { id: "settings", label: "Settings", role: "any" },
  ];

  window.DashboardApp.ROUTES = ROUTES;
  window.DashboardApp.MAIN_TABS = ROUTES.map(({ id, label }) => ({
    id,
    label,
  }));
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
    "Arrays",
    "Loops",
    "Input and Output Handling",
    "Error Handling",
    "HTML",
    "CSS",
    "Javascript",
    "UI/UX",
  ];
  window.DashboardApp.QUESTIONNAIRE_TOPIC_MAP = {
    "Computer Programming": [
      "Arrays",
      "Loops",
      "Input and Output Handling",
      "Error Handling",
      "Javascript",
    ],
    "Introduction to Computing": [
      "Arrays",
      "Loops",
      "Input and Output Handling",
      "Error Handling",
    ],
    "Intro to Human Computer Interaction": ["UI/UX"],
    "IT Fundamentals": ["HTML", "CSS", "Javascript"],
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
