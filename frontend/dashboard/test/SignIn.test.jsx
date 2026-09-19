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
    setAuthAlert: () => {},
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

  it("does not render Mentor type when portal role is mentee", () => {
    sessionStorage.setItem("portalRole", "mentee");
    sessionStorage.setItem("portalRoleLabel", "Mentee");

    const menteeForm = {
      role: "mentee",
      first_name: "John",
      last_name: "Doe",
      email: "johndoe@student.buksu.edu.ph",
      password1: "Password123!",
      password2: "Password123!",
      student_verification_documents: [],
    };

    render(
      withContext(React.createElement(SignUpPage), {
        ...mockContext,
        signUpForm: menteeForm,
      }),
    );

    // Advance to Step 2
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Verify Mentee role is shown
    expect(screen.getByText("Mentee")).toBeInTheDocument();
    // Mentor type should NOT be present
    expect(screen.queryByText(/mentor type/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/student mentor or instructor/i)).not.toBeInTheDocument();
    // Academic mentoring application form should be present
    expect(screen.getByText(/academic mentoring application form/i)).toBeInTheDocument();

    sessionStorage.removeItem("portalRole");
    sessionStorage.removeItem("portalRoleLabel");
  });

  it("renders Mentor type when portal role is mentor", () => {
    sessionStorage.setItem("portalRole", "mentor");
    sessionStorage.setItem("portalRoleLabel", "Mentor");

    const mentorForm = {
      role: "mentor",
      first_name: "Jane",
      last_name: "Smith",
      email: "janesmith@buksu.edu.ph",
      password1: "Password123!",
      password2: "Password123!",
      mentor_role: "",
      letter_of_intent: [],
      study_load: [],
      grade: [],
      student_verification_documents: [],
    };

    render(
      withContext(React.createElement(SignUpPage), {
        ...mockContext,
        signUpForm: mentorForm,
      }),
    );

    // Advance to Step 2
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Mentor type SHOULD be present
    expect(screen.getByText(/mentor type \*/i)).toBeInTheDocument();
    expect(screen.getByText(/student mentor or instructor/i)).toBeInTheDocument();

    sessionStorage.removeItem("portalRole");
    sessionStorage.removeItem("portalRoleLabel");
  });
});

