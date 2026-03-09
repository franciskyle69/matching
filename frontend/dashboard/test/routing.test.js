import { describe, it, expect } from "vitest";
import { getTabFromHash } from "./utils/routing.js";

describe("routing (hash → tab)", () => {
  const tabIds = ["home", "sessions", "matching", "signin", "signup", "settings"];

  it("returns hash without # when it is a valid tab id", () => {
    expect(getTabFromHash("sessions", tabIds)).toBe("sessions");
    expect(getTabFromHash("matching", tabIds)).toBe("matching");
    expect(getTabFromHash("signin", tabIds)).toBe("signin");
    expect(getTabFromHash("home", tabIds)).toBe("home");
  });

  it("strips leading # from hash", () => {
    expect(getTabFromHash("#sessions", tabIds)).toBe("sessions");
    expect(getTabFromHash("#home", tabIds)).toBe("home");
  });

  it("returns default 'home' when hash is empty or not a valid tab", () => {
    expect(getTabFromHash("", tabIds)).toBe("home");
    expect(getTabFromHash("#", tabIds)).toBe("home");
    expect(getTabFromHash("unknown", tabIds)).toBe("home");
    expect(getTabFromHash("#unknown", tabIds)).toBe("home");
  });

  it("handles null/undefined hash", () => {
    expect(getTabFromHash(null, tabIds)).toBe("home");
    expect(getTabFromHash(undefined, tabIds)).toBe("home");
  });
});
