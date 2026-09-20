import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import RegisterSuccess from "../src/components/RegisterSuccess.jsx";

describe("RegisterSuccess Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders Neumorphic confirmation card with header icon, title, dynamic email chip, and guidance steps", () => {
    const testEmail = "testuser@student.buksu.edu.ph";
    render(<RegisterSuccess email={testEmail} />);

    // Title
    expect(
      screen.getByRole("heading", { name: /Account Created Successfully!/i })
    ).toBeInTheDocument();

    // Dynamic email chip
    expect(screen.getByText(`Sent to: ${testEmail}`)).toBeInTheDocument();

    // Guidance Checklist Steps
    expect(screen.getByText(/Next Steps to Complete Activation:/i)).toBeInTheDocument();
    expect(screen.getByText(/BukSU Institutional Email/i)).toBeInTheDocument();
    expect(screen.getByText(/Email Verification Link/i)).toBeInTheDocument();
    expect(screen.getByText(/log in to complete your profile onboarding/i)).toBeInTheDocument();

    // Action Buttons
    expect(screen.getByRole("button", { name: /Go to Login/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend Verification Email/i })).toBeInTheDocument();
  });

  it("invokes onNavigateToLogin callback when Go to Login button is clicked", () => {
    const onNavigateToLogin = vi.fn();
    render(<RegisterSuccess email="test@student.buksu.edu.ph" onNavigateToLogin={onNavigateToLogin} />);

    const loginButton = screen.getByRole("button", { name: /Go to Login/i });
    fireEvent.click(loginButton);

    expect(onNavigateToLogin).toHaveBeenCalledTimes(1);
  });

  it("routes to #/login when onNavigateToLogin is not provided", () => {
    window.location.hash = "";
    render(<RegisterSuccess email="test@student.buksu.edu.ph" />);

    const loginButton = screen.getByRole("button", { name: /Go to Login/i });
    fireEvent.click(loginButton);

    expect(window.location.hash).toBe("#/login");
  });

  it("triggers resend endpoint, shows success feedback alert, and initiates 60-second cooldown timer", async () => {
    vi.useFakeTimers();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: "A new verification link has been sent to your inbox.",
      }),
    });

    const testEmail = "student123@student.buksu.edu.ph";
    render(<RegisterSuccess email={testEmail} />);

    const resendBtn = screen.getByRole("button", { name: /Resend Verification Email/i });
    expect(resendBtn).not.toBeDisabled();

    // Click Resend
    await act(async () => {
      fireEvent.click(resendBtn);
    });

    // Check fetch was called with email
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/resend-verification/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail, identifier: testEmail }),
      })
    );

    // Confirmation toast / alert
    expect(
      screen.getByText(/A new verification link has been sent to your inbox\./i)
    ).toBeInTheDocument();

    // Button should be disabled and show cooldown timer
    expect(resendBtn).toBeDisabled();
    expect(resendBtn).toHaveTextContent(/Resend Email \(60s\)/i);

    // Fast-forward 15 seconds
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(resendBtn).toHaveTextContent(/Resend Email \(45s\)/i);
    expect(resendBtn).toBeDisabled();

    // Fast-forward remaining 45 seconds
    act(() => {
      vi.advanceTimersByTime(45000);
    });

    // Cooldown expired, button re-enabled
    expect(resendBtn).not.toBeDisabled();
    expect(resendBtn).toHaveTextContent(/Resend Verification Email/i);
  });

  it("adapts correctly in dark mode theme without contrast issues", () => {
    const darkTheme = createTheme({
      palette: {
        mode: "dark",
        background: { default: "#0F172A", paper: "#151D2A" },
        text: { primary: "#F8FAFC", secondary: "#94A3B8" },
      },
    });

    const { container } = render(
      <ThemeProvider theme={darkTheme}>
        <RegisterSuccess email="darkmode@student.buksu.edu.ph" />
      </ThemeProvider>
    );

    expect(container.querySelector(".MuiPaper-root")).toBeInTheDocument();
    expect(screen.getByText("Account Created Successfully!")).toBeInTheDocument();
  });
});
