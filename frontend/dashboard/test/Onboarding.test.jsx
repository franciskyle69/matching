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

  it("Mentee Test: enforces max 5 competencies global cap by disabling remaining checkboxes and blocks submission with 0 competencies", () => {
    render(<Onboarding user={{ role: "mentee", email: "student@student.buksu.edu.ph" }} />);
    fireEvent.click(screen.getByRole("button", { name: /I Understand & Accept — Continue/i }));

    // Verify visual counter chip
    expect(screen.getByText(/Competencies: \d+ \/ 5 \(Max 5\)/i)).toBeInTheDocument();

    // Open "History & Hardware Evolution" topic in IT 111
    const historyTopic = screen.getByRole("checkbox", { name: /History & Hardware Evolution/i });
    fireEvent.click(historyTopic);

    // Select Computing Generations (total 4)
    const compGenBox = screen.getByRole("checkbox", { name: /Computing Generations/i });
    fireEvent.click(compGenBox);

    // Select Processor Architecture (total 5 - Global Cap reached!)
    const procBox = screen.getByRole("checkbox", { name: /Processor Architecture/i });
    fireEvent.click(procBox);

    // Global cap of 5 reached!
    expect(screen.getByText(/Competencies: 5 \/ 5 \(Max 5\)/i)).toBeInTheDocument();

    // Unchecked competencies should now have disabled={true}
    const html5Box = screen.getByRole("checkbox", { name: /HTML5 Semantic Structure/i });
    expect(html5Box).toBeDisabled();
    expect(html5Box).not.toBeChecked();

    // Checked ones should NOT be disabled so user can uncheck them
    expect(compGenBox).not.toBeDisabled();
    expect(compGenBox).toBeChecked();
  });


  it("Mentor Test: student mentor has max 10 competencies cap, up to 3 subjects, and requires at least 2 availability slots", () => {
    render(<Onboarding user={{ role: "student_mentor", email: "mentor@student.buksu.edu.ph" }} />);
    fireEvent.click(screen.getByRole("button", { name: /I Understand & Accept — Continue/i }));

    // Verify limits reflected in visual trackers
    expect(screen.getByText(/Subjects: \d+ \/ 3 \(Min 1, Max 3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Competencies: \d+ \/ 10 \(Max 10\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Availability Slots: 2 \/ 6 \(Min 2, Max 6\)/i)).toBeInTheDocument();

    // Try to remove an availability slot down to 1 (min is 2 for mentors)
    const deleteButtons = screen.getAllByTestId("DeleteOutlineIcon");
    expect(deleteButtons.length).toBeGreaterThan(0);
    // Delete buttons should be disabled because slots count (2) is at min (2)
    const firstDeleteBtn = deleteButtons[0].closest("button");
    expect(firstDeleteBtn).toBeDisabled();

    // Mentor can select up to 3 subjects
    const it113Box = screen.getByRole("checkbox", { name: "IT 113" });
    expect(it113Box).toBeInTheDocument();
    expect(it113Box).not.toBeDisabled();
    expect(screen.getByText("IT 113")).toBeInTheDocument();
  });

  it("Validation before submit: shows alert and blocks submit if requirements not met", () => {
    render(<Onboarding user={{ role: "mentee", email: "student@student.buksu.edu.ph" }} />);
    fireEvent.click(screen.getByRole("button", { name: /I Understand & Accept — Continue/i }));

    // Uncheck currently selected competencies
    const loopBox = screen.getByRole("checkbox", { name: /Loop Control/i });
    const figmaBox = screen.getByRole("checkbox", { name: /Figma UI Design/i });
    const flexBox = screen.getByRole("checkbox", { name: /Flexbox & Grid/i });

    fireEvent.click(loopBox);
    fireEvent.click(figmaBox);
    fireEvent.click(flexBox);

    // Try to complete onboarding
    const submitButton = screen.getByRole("button", { name: /Complete Onboarding/i });
    fireEvent.click(submitButton);

    // Alert should be displayed
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/must select at least 1 competency/i)).toBeInTheDocument();
  });
});

