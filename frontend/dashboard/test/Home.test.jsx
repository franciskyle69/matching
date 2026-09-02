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
      stats: { total_mentors: 5, total_mentees: 10, accepted_pairings: 3 },
      setActiveTab: () => {},
      menteeRecommendations: [],
      mentorRequests: [],
    };
    render(withContext(React.createElement(HomePage), ctx));
    expect(screen.getByText(/welcome.*staff1/i)).toBeInTheDocument();
    expect(screen.getByText(/signed in as staff/i)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders the mentee spotlight and sidebar from real context data", () => {
    const ctx = {
      user: {
        username: "mila",
        full_name: "Mila Cruz",
        role: "mentee",
        mentee_questionnaire_completed: true,
      },
      authCheckDone: true,
      stats: { user_progress: { role: "mentee", has_mentor: true } },
      setActiveTab: () => {},
      menteeMatching: {
        subjects: ["Data Structures", "Networking"],
        availability: ["Mon/Wed|08:00-12:00"],
      },
      myMentor: {
        user_id: 42,
        display_name: "Prof. Reyes",
        email: "reyes@example.edu",
        score: 0.92,
        availability: ["Mon|09:00-11:00"],
        match_details: { common_subjects: ["Data Structures"] },
      },
      menteeRecommendations: [
        {
          mentor_id: 7,
          mentor_display_name: "Ana Lim",
          mentor: { user_id: 7 },
          score: 0.81,
        },
      ],
    };
    render(withContext(React.createElement(HomePage), ctx));

    expect(screen.getByRole("heading", { name: /welcome back, mila/i })).toBeInTheDocument();
    expect(screen.getByText("Prof. Reyes")).toBeInTheDocument();
    // Send Message falls back to the mentor's email since there is no chat feature.
    expect(screen.getByRole("link", { name: /send message/i })).toHaveAttribute(
      "href",
      "https://mail.google.com/mail/?view=cm&fs=1&to=reyes%40example.edu",
    );
    expect(screen.queryByRole("link", { name: /schedule session/i })).toBeNull();
    // Overlap of Mon/Wed 08:00-12:00 with Mon 09:00-11:00, shown as the next Monday.
    expect(screen.getAllByText(/9:00 AM - 11:00 AM/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Ana Lim")).toBeInTheDocument();
    expect(screen.getByText("81% Match")).toBeInTheDocument();
    expect(screen.getByText("Completed pairings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument();
  });

  it("does not render a message link when the mentee has no mentor", () => {
    const ctx = {
      user: { username: "mila", role: "mentee" },
      authCheckDone: true,
      stats: { user_progress: { role: "mentee", has_mentor: false } },
      setActiveTab: () => {},
      menteeMatching: { subjects: [], availability: [] },
      myMentor: null,
      menteeRecommendations: [],
    };
    render(withContext(React.createElement(HomePage), ctx));

    expect(screen.getByText(/do not have an official mentor yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /send message/i })).toBeNull();
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
