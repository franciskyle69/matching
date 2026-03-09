import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { HomePage } from "../assets/router/pages/HomePage.jsx";

const AppContext = globalThis.window.DashboardApp.AppContext;

function withContext(component, value) {
  return React.createElement(
    AppContext.Provider,
    { value },
    component
  );
}

describe("HomePage", () => {
  it("renders CTA when not authenticated", () => {
    const ctx = {
      user: null,
      authCheckDone: true,
      setActiveTab: () => {},
    };
    render(withContext(React.createElement(HomePage), ctx));
    expect(screen.getByRole("heading", { name: /mentor–mentee matching/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i already have an account/i })).toBeInTheDocument();
  });

  it("renders welcome and stat grid when authenticated as staff", () => {
    const ctx = {
      user: { username: "staff1", role: "staff" },
      authCheckDone: true,
      stats: { total_mentors: 5, total_mentees: 10, total_sessions: 3, completion_rate: 80 },
      setActiveTab: () => {},
      sessionsData: null,
      menteeRecommendations: [],
    };
    render(withContext(React.createElement(HomePage), ctx));
    expect(screen.getByText(/welcome.*staff1/i)).toBeInTheDocument();
    expect(screen.getByText(/^Staff$/)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("returns null when auth check not done", () => {
    const ctx = {
      user: null,
      authCheckDone: false,
      setActiveTab: () => {},
    };
    const { container } = render(withContext(React.createElement(HomePage), ctx));
    expect(container.firstChild).toBeNull();
  });
});
