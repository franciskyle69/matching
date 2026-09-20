import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import VerifyEmail from "../src/components/VerifyEmail.jsx";

describe("VerifyEmail Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.location;
    window.location = new URL("http://localhost/verify-email/MQ/token123/");
  });

  it("shows loading indicator and triggers verification request on mount", async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {})); // Never resolves during mount test

    render(<VerifyEmail uidb64="MQ" token="token123" />);

    expect(screen.getByText(/Verifying your BukSU email address\.\.\./i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/verify-email/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uidb64: "MQ", token: "token123" }),
    });
  });

  it("displays success message and Proceed to Login button when token is valid", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        message: "Email successfully verified. You can now log in.",
      }),
    });

    const onNavigateToLogin = vi.fn();
    render(<VerifyEmail uidb64="MQ" token="valid-token" onNavigateToLogin={onNavigateToLogin} />);

    expect(await screen.findByText(/Email Verified Successfully!/i)).toBeInTheDocument();
    expect(screen.getByText(/Email successfully verified\. You can now log in\./i)).toBeInTheDocument();

    const proceedBtn = screen.getByRole("button", { name: /Proceed to Login/i });
    expect(proceedBtn).toBeInTheDocument();

    fireEvent.click(proceedBtn);
    expect(onNavigateToLogin).toHaveBeenCalled();
  });

  it("displays error message when token is invalid or expired", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "Activation link is invalid or expired.",
      }),
    });

    render(<VerifyEmail uidb64="MQ" token="expired-token" />);

    expect(await screen.findByText(/Verification Failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Activation link is invalid or expired\./i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Go to Sign In/i })).toBeInTheDocument();
  });
});
