import React from "react";
import * as ReactDOM from "react-dom/client";
import * as Mui from "@mui/material";

window.React = React;
window.ReactDOM = ReactDOM;
window.Mui = Mui;
window.MaterialUI = Mui;
window.DashboardApp = window.DashboardApp || {};

async function loadDashboardModules() {
	await import("./lib/constants.jsx");
	await import("./lib/utils.jsx");
	await import("./context.jsx");
	await import("./router/pages/AllPages.jsx");
	await import("./router/pages/AuthPages.jsx");
	await import("./router/pages/HomePage.jsx");
	await import("./router/pages/MatchingPage.jsx");
	await import("./router/pages/AnnouncementsPage.jsx");
	await import("./router/pages/SessionsPage.jsx");
	await import("./router/pages/NotificationsPage.jsx");
	await import("./router/pages/ApprovalsPage.jsx");
	await import("./router/pages/SubjectsPage.jsx");
	await import("./router/pages/ActivityLogsPage.jsx");
	await import("./router/pages/BackupPage.jsx");
	await import("./router/pages/UsersPage.jsx");
	await import("./router/pages/SettingsPage.jsx");
	await import("./router/pages/ProfilePage.jsx");
	await import("./router/pages/MentorProfilePage.jsx");
	await import("./router/pages/CompleteProfilePage.jsx");
	await import("./router/routes.jsx");
	await import("./ErrorBoundary.jsx");
	await import("./MainContent.jsx");
	await import("./Layout.jsx");
	await import("./AppProviders.jsx");
	await import("./AppRoot.jsx");
	await import("./app.jsx");
}

loadDashboardModules();
