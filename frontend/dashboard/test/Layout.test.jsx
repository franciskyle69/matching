import { describe, it, expect, afterAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import "../assets/Layout.jsx";

const AppContext = globalThis.window.DashboardApp.AppContext;
const Layout = globalThis.window.DashboardApp.Layout;
const theme = createTheme();

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
    React.createElement(
      ThemeProvider,
      { theme },
      React.createElement(
        AppContext.Provider,
        { value: ctx },
        React.createElement(Layout),
      ),
    ),
  );
}

describe("Dashboard topbar", () => {
  beforeEach(() => {
    window.innerWidth = 1280;
  });

  it("renders live profile, date, and notifications without search bar", () => {
    renderLayout();

    expect(
      screen.queryByPlaceholderText("Search mentors, students, or skills..."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^(⌘K|Ctrl\+K)$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/AY 2024–2025/i)).not.toBeInTheDocument();
    expect(document.querySelector(".app-topbar-date-badge")).not.toBeNull();
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
    expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();
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

describe("Dashboard mobile navigation", () => {
  const previousWidth = window.innerWidth;

  beforeEach(() => {
    window.innerWidth = 375;
  });

  afterEach(() => {
    window.innerWidth = previousWidth;
  });

  it("renders a sticky header and opens a slide-out drawer", async () => {
    renderLayout();

    expect(document.querySelector(".mobile-app-header")).not.toBeNull();
    expect(screen.queryByText("Alex Smith")).not.toBeInTheDocument();
    const menuButton = screen.getByRole("button", { name: "Open menu" });

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-label", "Close menu");
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    const drawer = await screen.findByTestId("mobile-nav-drawer-paper");
    fireEvent.click(within(drawer).getByRole("button", { name: /Matching/i }));

    await waitFor(() => {
      expect(menuButton).toHaveAttribute("aria-label", "Open menu");
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
    });
  });
});
