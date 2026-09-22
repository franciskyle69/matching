import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import "../assets/router/pages/MatchingPage.jsx";

const AppContext = globalThis.window.DashboardApp.AppContext;
const MatchingPage = globalThis.window.DashboardApp.Pages.matching;
const AdminPairedUsersView = globalThis.window.DashboardApp.AdminPairedUsersView;

describe("Admin Paired Users View", () => {
  const mockPairing = {
    id: 10,
    accepted: true,
    accepted_at: "2026-09-21T15:38:39.162274+00:00",
    created_at: "2026-09-21T15:38:38.764664+00:00",
    score: 0.8392,
    score_breakdown: {
      overall_score: 0.8392,
      overall_percentage: 84,
      tier: "high",
      tier_label: "Strong Fit",
      algorithm: "XGBoost Machine Learning",
      factors: {
        academic: {
          label: "Academic & Subject Fit",
          score: 100,
          weight_pct: 40,
          shared_subjects: ["Computer Programming"],
          shared_topics: ["Data Structures"],
          summary: "1 shared subject(s), 1 topic(s)",
        },
        competency: {
          label: "Competency Alignment",
          score: 0,
          weight_pct: 25,
          shared_count: 0,
          summary: "No shared competencies",
        },
        difficulty: {
          label: "Experience & Difficulty Balance",
          score: 75,
          weight_pct: 15,
          summary: "Difficulty difference: 1 level",
        },
        schedule: {
          label: "Schedule Compatibility",
          score: 75,
          weight_pct: 20,
          summary: "Availability not set",
        },
      },
    },
    mentor_id: 5,
    mentor_user_id: 213,
    mentor_username: "mentor21",
    mentor_display_name: "Daniel Padilla",
    mentor: {
      id: 5,
      user_id: 213,
      role: "Student Mentor",
      email: "mentor21@student.buksu.edu.ph",
      expertise_level: 4,
      capacity: 5,
      subjects: ["Computer Programming"],
      topics: ["Data Structures"],
    },
    mentee_id: 1,
    mentee_user_id: 12,
    mentee_username: "mentee1",
    mentee_display_name: "John Doe",
    mentee: {
      id: 1,
      user_id: 12,
      year_level: 2,
      difficulty_level: 3,
      email: "mentee1@student.buksu.edu.ph",
      subjects: ["Computer Programming"],
      topics: ["Data Structures"],
    },
    match_details: {
      common_subjects: ["Computer Programming"],
      common_topics: ["Data Structures"],
      common_competencies: [],
    },
  };

  it("renders Paired Users console with XAI breakdown for staff user on Matching page", () => {
    const ctx = {
      user: {
        id: 1,
        username: "coordinator1",
        is_staff: true,
        role: "staff",
      },
      adminPairings: [mockPairing],
      adminPairingsLoading: false,
      loadAdminPairings: () => {},
    };

    render(
      React.createElement(
        AppContext.Provider,
        { value: ctx },
        React.createElement(MatchingPage)
      )
    );

    // Header & summary
    expect(screen.getByText("Paired Users")).toBeInTheDocument();
    expect(screen.getByText(/Review active mentor–mentee partnerships/i)).toBeInTheDocument();
    expect(screen.getByText("Pairing")).toBeInTheDocument();
    expect(document.querySelector(".approvals-summary-pill-count")).toHaveTextContent("1");

    // Profiles rendered
    expect(screen.getByText("Daniel Padilla")).toBeInTheDocument();
    expect(screen.getByText("@mentor21")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("@mentee1")).toBeInTheDocument();

    // Match score and tier
    expect(screen.getAllByText(/84%/)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/84% · Strong Fit/i)[0]).toBeInTheDocument();

    // Why they match / XAI Breakdown
    expect(screen.getByText(/Why They Match • Explainable AI Diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText("Academic & Subject Fit")).toBeInTheDocument();
    expect(screen.getByText("Competency Alignment")).toBeInTheDocument();
    expect(screen.getByText("Experience & Difficulty Balance")).toBeInTheDocument();
    expect(screen.getByText("Schedule Compatibility")).toBeInTheDocument();
    expect(screen.getByText("1 shared subject(s), 1 topic(s)")).toBeInTheDocument();
  });

  it("exports AdminPairedUsersView on window.DashboardApp", () => {
    expect(typeof AdminPairedUsersView).toBe("function");
  });
});
