import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import ResetPasswordConfirm from "../src/components/ResetPasswordConfirm.jsx";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ uid: "test-uid", token: "test-token" }),
  };
});

describe("ResetPasswordConfirm Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders new password fields and submit button", () => {
    render(<ResetPasswordConfirm uid="test-uid" token="test-token" />);

    expect(
      screen.getByRole("heading", { name: /Set New Password/i })
    ).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/••••••••/i)).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Change Password/i })
    ).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    render(<ResetPasswordConfirm uid="test-uid" token="test-token" />);

    const inputs = screen.getAllByPlaceholderText(/••••••••/i);
    fireEvent.change(inputs[0], { target: { value: "StrongPass1!" } });
    fireEvent.change(inputs[1], { target: { value: "StrongPass2@" } });

    fireEvent.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(
      screen.getByText(/Passwords do not match\. Please verify and try again\./i)
    ).toBeInTheDocument();
  });

  it("shows error when password is too short", async () => {
    render(<ResetPasswordConfirm uid="test-uid" token="test-token" />);

    const inputs = screen.getAllByPlaceholderText(/••••••••/i);
    fireEvent.change(inputs[0], { target: { value: "Short1!" } });
    fireEvent.change(inputs[1], { target: { value: "Short1!" } });

    fireEvent.click(screen.getByRole("button", { name: /Change Password/i }));

    expect(
      screen.getByText(/Password must be at least 10 characters long\./i)
    ).toBeInTheDocument();
  });

  it("handles successful password reset without instant redirect, shows green banner, disables button, and navigates after 3s with state", async () => {
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        message: "Password reset successful.",
      }),
    });

    render(<ResetPasswordConfirm uid="test-uid" token="test-token" />);

    const inputs = screen.getAllByPlaceholderText(/••••••••/i);
    fireEvent.change(inputs[0], { target: { value: "ValidPassword123!" } });
    fireEvent.change(inputs[1], { target: { value: "ValidPassword123!" } });

    const submitBtn = screen.getByRole("button", { name: /Change Password/i });
    fireEvent.click(submitBtn);

    // Verify green success banner appears
    expect(
      await screen.findByText(
        /Password reset successful! Redirecting to login\.\.\./i
      )
    ).toBeInTheDocument();

    // Check button is disabled so user cannot click multiple times
    const disabledBtn = screen.getByRole("button", { name: /Password Reset!/i });
    expect(disabledBtn).toBeDisabled();

    // Verify setTimeout was called with 3000ms delay
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3000);

    // Verify NOT redirected instantly
    expect(mockNavigate).not.toHaveBeenCalled();

    // Execute the 3000ms callback
    const timerCall = setTimeoutSpy.mock.calls.find((call) => call[1] === 3000);
    expect(timerCall).toBeDefined();
    timerCall[0]();

    // Verify navigate called with /login and flash message state
    expect(mockNavigate).toHaveBeenCalledWith("/login", {
      state: {
        message:
          "Your password has been reset successfully. Please log in with your new password.",
      },
    });

    setTimeoutSpy.mockRestore();
  });
});
