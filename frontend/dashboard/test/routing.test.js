import { describe, it, expect } from "vitest";
import { getTabFromHash } from "../assets/utils/routing.js";

describe("getTabFromHash", () => {
  const tabIds = ["home", "matching", "signin", "signup", "settings"];

  it("parses hash without #", () => {
    expect(getTabFromHash("sessions", tabIds)).toBe("home");
    expect(getTabFromHash("matching", tabIds)).toBe("matching");
    expect(getTabFromHash("signin", tabIds)).toBe("signin");
    expect(getTabFromHash("home", tabIds)).toBe("home");
  });

  it("parses hash with #", () => {
    expect(getTabFromHash("#sessions", tabIds)).toBe("home");
    expect(getTabFromHash("#home", tabIds)).toBe("home");
  });

  it("defaults to home for empty or unknown", () => {
    expect(getTabFromHash("", tabIds)).toBe("home");
    expect(getTabFromHash("#", tabIds)).toBe("home");
    expect(getTabFromHash("unknown", tabIds)).toBe("home");
  });

  it("handles nullish input", () => {
    expect(getTabFromHash(null, tabIds)).toBe("home");
    expect(getTabFromHash(undefined, tabIds)).toBe("home");
  });
});
