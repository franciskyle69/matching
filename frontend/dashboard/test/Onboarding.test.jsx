import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Onboarding from "../src/components/Onboarding.jsx";

describe("Onboarding Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Step 1 orientation instructions and guidelines without any file upload", () => {
    render(<Onboarding user={{ role: "mentee", email: "student@student.buksu.edu.ph" }} />);
    
    expect(screen.getByRole("heading", { name: /BukSU Mentorship Orientation & Guidelines/i })).toBeInTheDocument();
    expect(screen.getByText(/How the Smart Matching System Works/i)).toBeInTheDocument();
    expect(screen.getByText(/Code of Conduct & Academic Integrity/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /I Understand & Accept — Continue/i })).toBeInTheDocument();

    // Verify profile image / document upload elements are completely absent
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/Profile photo or institutional ID/i)).not.toBeInTheDocument();
  });

  it("advances to Step 2: Subject, Competency & Availability Preferences", () => {
    render(<Onboarding user={{ role: "mentee", email: "student@student.buksu.edu.ph" }} />);
    
    const continueButton = screen.getByRole("button", { name: /I Understand & Accept — Continue/i });
    fireEvent.click(continueButton);

    // Subject preferences
    expect(screen.getByRole("heading", { name: /Subject & Skill Preferences/i })).toBeInTheDocument();
    expect(screen.getByText(/Core BSIT Subjects/i)).toBeInTheDocument();

    // Competencies
    expect(screen.getByText(/Competency & Skill Tags/i)).toBeInTheDocument();
    expect(screen.getByText("Loop Control")).toBeInTheDocument();
    expect(screen.getByText("Figma UI Design")).toBeInTheDocument();
    expect(screen.getByText("Flexbox & Grid")).toBeInTheDocument();

    // Support Need Slider
    expect(screen.getByText(/Support Need Rating Scale \(1 to 5\)/i)).toBeInTheDocument();

    // Recurring Availability Schedule
    expect(screen.getByText(/Recurring Availability Schedule/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Day of Week/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/Start Time/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/End Time/i).length).toBeGreaterThan(0);

    // Complete Onboarding button
    expect(screen.getByRole("button", { name: /Complete Onboarding/i })).toBeInTheDocument();
  });
});
