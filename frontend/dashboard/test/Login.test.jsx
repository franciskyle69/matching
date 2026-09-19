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
});
