import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AppProviders } from "../assets/AppProviders.jsx";

describe("AppProviders context", () => {
  it("provides expected context keys to Layout", async () => {
    render(<AppProviders />);
    const keysEl = await screen.findByTestId("context-keys");
    const keys = keysEl.textContent || "";
    expect(keys).toContain("activeTab");
    expect(keys).toContain("setActiveTab");
    expect(keys).toContain("user");
    expect(keys).toContain("signInForm");
    expect(keys).toContain("handleSignIn");
    expect(keys).toContain("handleLogout");
    expect(keys).toContain("sessionsData");
    expect(keys).toContain("loadSessions");
    expect(keys).toContain("theme");
    expect(keys).toContain("toggleTheme");
    expect(keys).toContain("isAuthenticated");
    expect(keys).toContain("showSignInPrompt");
  });
});
