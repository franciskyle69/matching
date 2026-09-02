import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { CompleteProfilePage } from "../assets/router/pages/CompleteProfilePage.jsx";

const AppContext = globalThis.window.DashboardApp.AppContext;

function renderPage(value) {
  return render(
    React.createElement(
      AppContext.Provider,
      { value },
      React.createElement(CompleteProfilePage),
    ),
  );
}

describe("Complete profile onboarding", () => {
  it("shows the Google account setup form when the profile is incomplete", () => {
    renderPage({
      user: {
        role: "mentee",
        is_profile_complete: false,
        auth_provider: "google",
        email: "ada@student.buksu.edu.ph",
        full_name: "Ada Lovelace",
        first_name: "Ada",
        last_name: "Lovelace",
        avatar_url: "",
        tags: [],
      },
      menteeProfile: {
        program: "BSIT",
        year_level: 1,
        campus: "",
        student_id_no: "",
        contact_no: "",
        admission_type: "",
        sex: "",
      },
      mentorProfile: {},
      handleCompleteProfileSave: vi.fn(),
      completeProfileSaving: false,
    });

    expect(
      screen.getByRole("heading", { name: /finish setting up your account/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@student.buksu.edu.ph")).toBeInTheDocument();
    expect(screen.getByText(/signed in with google/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/institutional \/ student id/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save and continue/i })).toBeInTheDocument();
  });

  it("shows inline errors when required fields are empty", () => {
    renderPage({
      user: {
        role: "mentor",
        is_profile_complete: false,
        auth_provider: "google",
        email: "mentor@student.buksu.edu.ph",
        full_name: "Mentor User",
        tags: [],
      },
      menteeProfile: {},
      mentorProfile: { program: "BSIT", year_level: 0, role: "", student_id_no: "" },
      handleCompleteProfileSave: vi.fn(),
      completeProfileSaving: false,
    });

    fireEvent.click(screen.getByRole("button", { name: /save and continue/i }));
    expect(
      screen.getByText(/choose student or faculty/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/enter your institutional or student id/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/select at least one mentoring interest/i).length,
    ).toBeGreaterThan(0);
  });
});
