import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByPlaceholderText(/your@email\.com or username/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows Sign up link", () => {
    render(withContext(React.createElement(SignInPage), mockContext));
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });
});

describe("SignUpPage", () => {
  const mockContext = {
    signUpForm: { role: "mentor", username: "", email: "", password1: "", password2: "" },
    setSignUpForm: () => {},
    handleSignUp: () => {},
    setActiveTab: () => {},
  };

  it("renders sign up form and title", () => {
    render(withContext(React.createElement(SignUpPage), mockContext));
    expect(screen.getByRole("heading", { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mentor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign up$/i })).toBeInTheDocument();
  });

  it("shows Sign in link", () => {
    render(withContext(React.createElement(SignUpPage), mockContext));
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
