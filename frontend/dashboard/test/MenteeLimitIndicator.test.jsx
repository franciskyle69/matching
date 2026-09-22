import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { HomePage } from "../assets/router/pages/HomePage.jsx";
import "../assets/Layout.jsx";

const AppContext = globalThis.window.DashboardApp.AppContext;

function withContext(component, value) {
  return React.createElement(
    AppContext.Provider,
    { value },
    component
  );
}

describe("Mentee Limit Indicators on HomePage", () => {
  const baseMenteeUser = {
    username: "testmentee",
    full_name: "Test Mentee",
    role: "mentee",
    mentee_questionnaire_completed: true,
  };

  it("renders 0/2 slots available when mentee has no mentors", () => {
    const ctx = {
      user: baseMenteeUser,
      authCheckDone: true,
      stats: { user_progress: { role: "mentee", has_mentor: false } },
      setActiveTab: () => {},
      menteeMatching: { subjects: ["IT 111"], availability: ["Mon|08:00-10:00"] },
      myMentor: null,
      myMentors: [],
      menteePairingsCount: 0,
      menteeRecommendations: [],
    };

    render(withContext(React.createElement(HomePage), ctx));

    // Header badge
    expect(screen.getByText("Mentors: 0/2 Slots")).toBeInTheDocument();

    // Metric cell
    expect(screen.getByText("0/2")).toBeInTheDocument();
    expect(screen.getByText(/2 slots available \(0\/2\) →/i)).toBeInTheDocument();

    // Spotlight empty state
    expect(screen.getByText(/do not have an official mentor yet/i)).toBeInTheDocument();

    // No limit alert banner
    expect(screen.queryByText(/Mentor Limit Reached \(2\/2 Mentors\)/i)).toBeNull();
  });

  it("renders 1/2 slots used when mentee has 1 mentor", () => {
    const ctx = {
      user: baseMenteeUser,
      authCheckDone: true,
      stats: { user_progress: { role: "mentee", has_mentor: true } },
      setActiveTab: () => {},
      menteeMatching: { subjects: ["Data Structures"], availability: ["Mon|08:00-12:00"] },
      myMentor: {
        id: 101,
        user_id: 101,
        display_name: "Dr. Jane Smith",
        email: "jane@buksu.edu.ph",
        role: "student",
        score: 0.95,
        availability: ["Mon|09:00-11:00"],
        match_details: { common_subjects: ["Data Structures"] },
      },
      myMentors: [
        {
          id: 101,
          user_id: 101,
          display_name: "Dr. Jane Smith",
          email: "jane@buksu.edu.ph",
          role: "student",
          score: 0.95,
          availability: ["Mon|09:00-11:00"],
          match_details: { common_subjects: ["Data Structures"] },
        },
      ],
      menteePairingsCount: 1,
      menteeRecommendations: [],
    };

    render(withContext(React.createElement(HomePage), ctx));

    // Header badge
    expect(screen.getByText("Mentors: 1/2 Slots")).toBeInTheDocument();

    // Metric cell
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText(/1 slot available \(1\/2\) →/i)).toBeInTheDocument();

    // Spotlight heading
    expect(screen.getByText("Your Mentor (1/2 Slots Used)")).toBeInTheDocument();
    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();

    // No limit alert banner
    expect(screen.queryByText(/Mentor Limit Reached \(2\/2 Mentors\)/i)).toBeNull();
  });

  it("renders 2/2 Limit Reached indicators and alert banner when mentee has 2 mentors", () => {
    const ctx = {
      user: baseMenteeUser,
      authCheckDone: true,
      stats: { user_progress: { role: "mentee", has_mentor: true } },
      setActiveTab: () => {},
      menteeMatching: { subjects: ["Data Structures", "Web Dev"], availability: ["Mon|08:00-12:00"] },
      myMentor: {
        id: 101,
        user_id: 101,
        display_name: "Dr. Jane Smith",
        email: "jane@buksu.edu.ph",
        role: "student",
        score: 0.95,
        availability: ["Mon|09:00-11:00"],
        match_details: { common_subjects: ["Data Structures"] },
      },
      myMentors: [
        {
          id: 101,
          user_id: 101,
          display_name: "Dr. Jane Smith",
          email: "jane@buksu.edu.ph",
          role: "student",
          score: 0.95,
          availability: ["Mon|09:00-11:00"],
          match_details: { common_subjects: ["Data Structures"] },
        },
        {
          id: 102,
          user_id: 102,
          display_name: "Prof. Alan Turing",
          email: "alan@buksu.edu.ph",
          role: "student",
          score: 0.89,
          availability: ["Wed|13:00-15:00"],
          match_details: { common_subjects: ["Web Dev"] },
        },
      ],
      menteePairingsCount: 2,
      menteeRecommendations: [],
    };

    render(withContext(React.createElement(HomePage), ctx));

    // Header badge
    expect(screen.getByText("Mentor Limit Reached (2/2)")).toBeInTheDocument();

    // Metric cell
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getByText(/Limit reached \(2\/2\) →/i)).toBeInTheDocument();

    // Alert banner
    expect(screen.getByText("Mentor Limit Reached (2/2 Mentors)")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Under AMU guidelines, each mentee is limited to a maximum of 2 concurrent mentors/i
      )
    ).toBeInTheDocument();

    // Spotlight heading
    expect(screen.getByText("Your Mentors (2/2 Limit Reached)")).toBeInTheDocument();

    // Both mentors visible
    expect(screen.getByText("Dr. Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("Prof. Alan Turing")).toBeInTheDocument();
  });
});

describe("Sidebar Matching Badge in Layout", () => {
  const Layout = globalThis.window.DashboardApp.Layout;

  it("shows no badge when mentee has 0 mentors", () => {
    const ctx = {
      user: { role: "mentee", is_staff: false },
      activeTab: "home",
      setActiveTab: () => {},
      requestTabChange: () => {},
      myMentor: null,
      myMentors: [],
      menteePairingsCount: 0,
      unreadCount: 0,
      theme: "dark",
      toggleTheme: () => {},
      handleLogout: () => {},
      logoutLoading: false,
      globalSearchResults: [],
      loadGlobalSearch: () => {},
      isAuthenticated: true,
      loadUserProfile: () => {},
      isPendingApproval: false,
      stats: {},
    };

    render(withContext(React.createElement(Layout), ctx));
    expect(screen.queryByText("1/2 Slots")).toBeNull();
    expect(screen.queryByText("2/2 Limit")).toBeNull();
  });

  it("shows '1/2 Slots' badge when mentee has 1 mentor", () => {
    const ctx = {
      user: { role: "mentee", is_staff: false },
      activeTab: "home",
      setActiveTab: () => {},
      requestTabChange: () => {},
      myMentor: { id: 1, display_name: "Mentor 1" },
      myMentors: [{ id: 1 }],
      menteePairingsCount: 1,
      unreadCount: 0,
      theme: "dark",
      toggleTheme: () => {},
      handleLogout: () => {},
      logoutLoading: false,
      globalSearchResults: [],
      loadGlobalSearch: () => {},
      isAuthenticated: true,
      loadUserProfile: () => {},
      isPendingApproval: false,
      stats: {},
    };

    render(withContext(React.createElement(Layout), ctx));
    expect(screen.getByText("1/2 Slots")).toBeInTheDocument();
  });

  it("shows '2/2 Limit' badge when mentee has reached 2 mentors", () => {
    const ctx = {
      user: { role: "mentee", is_staff: false },
      activeTab: "home",
      setActiveTab: () => {},
      requestTabChange: () => {},
      myMentor: { id: 1, display_name: "Mentor 1" },
      myMentors: [{ id: 1 }, { id: 2 }],
      menteePairingsCount: 2,
      unreadCount: 0,
      theme: "dark",
      toggleTheme: () => {},
      handleLogout: () => {},
      logoutLoading: false,
      globalSearchResults: [],
      loadGlobalSearch: () => {},
      isAuthenticated: true,
      loadUserProfile: () => {},
      isPendingApproval: false,
      stats: {},
    };

    render(withContext(React.createElement(Layout), ctx));
    expect(screen.getByText("2/2 Limit")).toBeInTheDocument();
  });
});

