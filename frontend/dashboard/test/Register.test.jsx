import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Register from "../src/components/Register.jsx";

describe("Register Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the main registration title and role selection", () => {
    render(<Register />);
    expect(screen.getByRole("heading", { name: /BukSU IT Mentorship Registration/i })).toBeInTheDocument();
    expect(screen.getByText(/Mentee/i)).toBeInTheDocument();
    expect(screen.getByText(/Student Mentor/i)).toBeInTheDocument();
    expect(screen.getByText(/Instructor Mentor/i)).toBeInTheDocument();
  });

  it("hides file uploads for Mentee by default", () => {
    render(<Register />);
    expect(screen.queryByText(/Student Mentor Application Documents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Faculty Verification Document/i)).not.toBeInTheDocument();
  });

  it("displays 3 document upload slots when Student Mentor role is selected", () => {
    render(<Register />);
    const studentMentorRadio = screen.getByLabelText(/Student Mentor/i);
    fireEvent.click(studentMentorRadio);

    expect(screen.getByText(/Student Mentor Application Documents/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Letter of Intent/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Current Study Load/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Summary of Grades/i)).toBeInTheDocument();
  });

  it("displays 1 document upload slot when Instructor Mentor role is selected", () => {
    render(<Register />);
    const instructorMentorRadio = screen.getByLabelText(/Instructor Mentor/i);
    fireEvent.click(instructorMentorRadio);

    expect(screen.getByText(/Faculty Verification Document/i)).toBeInTheDocument();
    expect(screen.getByText(/Faculty ID or Verification Letter/i)).toBeInTheDocument();
    expect(screen.queryByText(/Letter of Intent/i)).not.toBeInTheDocument();
  });

  it("validates domain for student vs instructor", async () => {
    render(<Register />);
    const submitButton = screen.getByRole("button", { name: /Complete Registration/i });

    // Fill personal info with invalid student email
    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Juan" } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Dela Cruz" } });
    fireEvent.change(screen.getByLabelText(/BukSU Email Address/i), { target: { value: "juan@gmail.com" } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: "Password123!" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "Password123!" } });

    fireEvent.click(submitButton);

    expect(screen.getByText(/Student accounts require an @student\.buksu\.edu\.ph email address\./i)).toBeInTheDocument();
  });
});
