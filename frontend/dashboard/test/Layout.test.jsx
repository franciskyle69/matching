import { describe, it, expect, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import "../assets/Layout.jsx";

const AppContext = globalThis.window.DashboardApp.AppContext;
const Layout = globalThis.window.DashboardApp.Layout;

afterAll(() => {
  globalThis.window.DashboardApp.Layout = function LayoutStub() {
    const ctx = React.useContext(AppContext);
    const keys = ctx ? Object.keys(ctx).sort().join(",") : "";
    return React.createElement("div", { "data-testid": "context-keys" }, keys);
  };
});

function renderLayout(overrides = {}) {
  const ctx = {
    user: {
      display_name: "Alex Smith",
      username: "alex",
      role: "mentee",
      avatar_url: "",
    },
    activeTab: "matching",
    setActiveTab: () => {},
    requestTabChange: () => {},
    unreadCount: 3,
    theme: "dark",
    toggleTheme: () => {},
    handleLogout: () => {},
    logoutLoading: false,
    globalSearchResults: [],
    loadGlobalSearch: () => {},
    isAuthenticated: true,
    loadUserProfile: () => {},
    isPendingApproval: false,
    pendingApprovalLandingTab: "onboarding",
    stats: {
      accepted_pairings: 24,
      user_progress: { role: "mentee", has_mentor: false },
    },
    pendingMentors: [],
    pendingMentees: [],
    mentorRequests: [],
    myMentor: null,
    mentorProfile: {},
    ...overrides,
  };
  return render(
    React.createElement(AppContext.Provider, { value: ctx }, React.createElement(Layout)),
  );
}

describe("Dashboard topbar", () => {
  it("renders search placeholder, shortcut pill, and live profile", () => {
    renderLayout();

    expect(
      screen.getByPlaceholderText("Search mentors, students, or skills..."),
    ).toBeInTheDocument();
    expect(screen.getByText(/^(⌘K|Ctrl\+K)$/)).toBeInTheDocument();
    expect(screen.getByText("Alex Smith")).toBeInTheDocument();
    expect(screen.getByText("Mentee")).toBeInTheDocument();
    expect(screen.queryByText(/Active Matches/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Create Pairing Request/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Notifications, 3 unread/i }),
    ).toBeInTheDocument();
    expect(document.querySelector(".app-topbar-bell-dot.is-active")).not.toBeNull();
  });

  it("shows coordinator role for staff without match chip or approvals CTA", () => {
    renderLayout({
      user: {
        display_name: "Dr. Alex Smith",
        username: "coordinator1",
        role: "staff",
        is_staff: true,
      },
      pendingMentors: [{ id: 1 }, { id: 2 }],
      pendingMentees: [{ id: 3 }],
      stats: { accepted_pairings: 24 },
    });

    expect(screen.getByText("Dr. Alex Smith")).toBeInTheDocument();
    expect(screen.getByText("Coordinator")).toBeInTheDocument();
    expect(screen.queryByText(/Active Matches/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Pending Approvals/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the profile menu from the caret control", () => {
    renderLayout();
    fireEvent.click(
      screen.getByRole("button", { name: "Account menu for Alex Smith" }),
    );
    expect(screen.getByRole("menuitem", { name: "View profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
  });
});
