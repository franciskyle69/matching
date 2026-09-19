import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { SignInPage, SignUpPage } from "../assets/router/pages/AuthPages.jsx";

const AppContext = globalThis.window.DashboardApp.AppContext;

function withContext(component, value) {
  return React.createElement(
    AppContext.Provider,
    { value },
    component
  );
}

describe("SignInPage", () => {
  const mockContext = {
    signInForm: { username: "", password: "" },
    setSignInForm: () => {},
    handleSignIn: () => {},
    setActiveTab: () => {},
    signInLoading: false,
  };

  it("renders login form and title", () => {
    render(withContext(React.createElement(SignInPage), mockContext));
    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example\.com or username/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in with google/i })).toBeInTheDocument();
  });

  it("shows Sign up link", () => {
    render(withContext(React.createElement(SignInPage), mockContext));
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("shows a Google mismatch warning as a centered modal prompting manual registration", async () => {
    const setAuthAlert = vi.fn();
    const ctx = {
      ...mockContext,
      authAlert: {
        severity: "error",
        code: "no_account",
        title: "No Account Found",
        message:
          "No account found with this email. Please complete the manual registration first.",
      },
      setAuthAlert,
    };
    render(withContext(React.createElement(SignInPage), ctx));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /no account found/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no account found with this email/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /complete manual registration/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel \/ dismiss/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/you@example\.com or username/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel \/ dismiss/i }));
    await waitFor(() => expect(setAuthAlert).toHaveBeenCalledWith(null));
  });

  it("closes the Google warning modal on Escape and backdrop click", async () => {
    const setAuthAlert = vi.fn();
    const ctx = {
      ...mockContext,
      authAlert: {
        severity: "error",
        code: "no_account",
      },
      setAuthAlert,
    };
    const { unmount } = render(withContext(React.createElement(SignInPage), ctx));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(setAuthAlert).toHaveBeenCalledWith(null));
    unmount();

    setAuthAlert.mockClear();
    render(withContext(React.createElement(SignInPage), ctx));
    fireEvent.click(screen.getByTestId("auth-oauth-modal-overlay"));
    await waitFor(() => expect(setAuthAlert).toHaveBeenCalledWith(null));
  });
});

describe("SignUpPage", () => {
  const mockContext = {
    signUpForm: { role: "mentor", username: "", email: "", password1: "", password2: "" },
    setSignUpForm: () => {},
    handleSignUp: () => {},
    setActiveTab: () => {},
  };

  it("renders sign up form and title without Google signup button", () => {
    render(withContext(React.createElement(SignUpPage), mockContext));
    expect(screen.getByRole("heading", { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign up with google/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Sign in link", () => {
    render(withContext(React.createElement(SignUpPage), mockContext));
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows an account-exists Google warning as a centered modal", () => {
    render(
      withContext(React.createElement(SignUpPage), {
        ...mockContext,
        authAlert: {
          severity: "warning",
          code: "account_exists",
        },
        setAuthAlert: () => {},
      }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /account already exists/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log in with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancel \/ dismiss/i }),
    ).toBeInTheDocument();
  });
});
