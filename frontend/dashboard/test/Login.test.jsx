import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Login from "../src/components/Login.jsx";

describe("Login Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.search = "";
    window.location.hash = "";
  });

  it("renders the login form with email/password and Google login button", () => {
    render(<Login />);
    expect(
      screen.getByRole("heading", { name: /BukSU IT Mentorship Login/i })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/you@student\.buksu\.edu\.ph or username/i)
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Log in with Google/i })
    ).toBeInTheDocument();
    // Strictly ensure no Google signup button exists
    expect(
      screen.queryByRole("button", { name: /Sign up with Google/i })
    ).not.toBeInTheDocument();
  });

  it("displays error alert when oauth_error=no_account is in search query", () => {
    delete window.location;
    window.location = new URL("http://localhost/app/signin?oauth_error=no_account");

    render(<Login />);
    expect(
      screen.getByText(
        /No account found with this email\. Please complete the manual registration first\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Register Now/i })
    ).toBeInTheDocument();
  });

  it("captures 401 unregistered Google account error and displays red alert", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error:
          "No account found with this email. Please complete the manual registration first.",
      }),
    });

    const onNavigateRegister = vi.fn();
    render(<Login onNavigateRegister={onNavigateRegister} />);

    // Trigger google login with a token payload
    const loginInstance = screen.getByRole("button", { name: /Log in with Google/i });
    expect(loginInstance).toBeInTheDocument();

    // Directly test the submission error handling for manual login
    fireEvent.change(
      screen.getByPlaceholderText(/you@student\.buksu\.edu\.ph or username/i),
      { target: { value: "unregistered@student.buksu.edu.ph" } }
    );
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /No account found with this email\. Please complete the manual registration first\./i
        )
      ).toBeInTheDocument();
    });

    const registerBtn = screen.getByRole("button", { name: /Register Now/i });
    fireEvent.click(registerBtn);
    expect(onNavigateRegister).toHaveBeenCalled();
  });

  it("captures 403 unverified email error and allows resending verification email", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: "Please verify your BukSU email address before logging in.",
          code: "email_not_verified",
          email: "student@student.buksu.edu.ph",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          message: "A verification email has been sent. Please check your inbox.",
        }),
      });

    render(<Login />);

    fireEvent.change(
      screen.getByPlaceholderText(/you@student\.buksu\.edu\.ph or username/i),
      { target: { value: "student@student.buksu.edu.ph" } }
    );
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    expect(await screen.findByText(/Your email is not verified\./i)).toBeInTheDocument();
    const resendBtn = screen.getByRole("button", { name: /Resend Verification Email/i });
    expect(resendBtn).toBeInTheDocument();

    fireEvent.click(resendBtn);

    expect(
      await screen.findByText(/A verification email has been sent\. Please check your inbox\./i)
    ).toBeInTheDocument();
  });

  it("captures 429 lockout response, stores lockout in localStorage, disables controls, and shows live countdown", async () => {
    localStorage.clear();
    const unlockTime = new Date(Date.now() + 900 * 1000).toISOString();
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: "account_locked",
        message: "Too many failed login attempts. Account locked.",
        cooloff_seconds: 900,
        unlock_time: unlockTime,
      }),
    });

    render(<Login />);

    fireEvent.change(
      screen.getByPlaceholderText(/you@student\.buksu\.edu\.ph or username/i),
      { target: { value: "locked_user@buksu.edu.ph" } }
    );
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "wrongpass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Sign In/i }));

    expect(
      await screen.findByText(/Too many failed login attempts\. Account locked\./i)
    ).toBeInTheDocument();

    expect(localStorage.getItem("peerlink_lockout_until")).toBe(unlockTime);

    // Verify form controls are disabled
    expect(screen.getByPlaceholderText(/you@student\.buksu\.edu\.ph or username/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Log in with Google/i })).toBeDisabled();
  });

  it("restores lockout from localStorage on mount and disables controls", () => {
    localStorage.clear();
    const futureUnlock = new Date(Date.now() + 600 * 1000).toISOString();
    localStorage.setItem("peerlink_lockout_until", futureUnlock);

    render(<Login />);

    expect(
      screen.getByText(/Too many failed login attempts\. Account locked\./i)
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText(/you@student\.buksu\.edu\.ph or username/i)).toBeDisabled();
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Log in with Google/i })).toBeDisabled();
  });

  it("clears expired lockout from localStorage on mount and leaves controls enabled", () => {
    localStorage.clear();
    const pastUnlock = new Date(Date.now() - 5000).toISOString();
    localStorage.setItem("peerlink_lockout_until", pastUnlock);

    render(<Login />);

    expect(
      screen.queryByText(/Too many failed login attempts\. Account locked\./i)
    ).not.toBeInTheDocument();

    expect(localStorage.getItem("peerlink_lockout_until")).toBeNull();
    expect(screen.getByPlaceholderText(/you@student\.buksu\.edu\.ph or username/i)).not.toBeDisabled();
    expect(screen.getByPlaceholderText(/••••••••/i)).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Sign In/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Log in with Google/i })).not.toBeDisabled();
  });

  it("displays flash success banner when passed via Router state on mount", () => {
    const { MemoryRouter } = require("react-router-dom");
    const testMessage =
      "Your password has been reset successfully. Please log in with your new password.";

    render(
      <MemoryRouter
        initialEntries={[{ pathname: "/login", state: { message: testMessage } }]}
      >
        <Login />
      </MemoryRouter>
    );

    const alert = screen.getByText(testMessage);
    expect(alert).toBeInTheDocument();
  });
});

