import React from "react";
import MenteePreferencesPage from "./MenteePreferencesPage.jsx";

export default function MentorPreferencesPage(props) {
  return <MenteePreferencesPage defaultRole="STUDENT_MENTOR" {...props} />;
}

if (typeof window !== "undefined") {
  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentor-preferences"] = MentorPreferencesPage;
}
