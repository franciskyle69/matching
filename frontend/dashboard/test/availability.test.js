import { describe, it, expect } from "vitest";

const { weeklyMinutes, intersectSlots, nextOccurrences } =
  globalThis.window.DashboardApp.Availability;

describe("weeklyMinutes", () => {
  it("counts each selected day separately", () => {
    expect(weeklyMinutes(["Mon/Wed|08:00-12:00"])).toBe(480);
  });

  it("treats a slot without a day prefix as every day", () => {
    expect(weeklyMinutes(["08:00-09:00"])).toBe(420);
  });

  it("ignores unparseable slots", () => {
    expect(weeklyMinutes(["nonsense", "Mon|08:00-09:00"])).toBe(60);
  });
});

describe("intersectSlots", () => {
  it("returns only the shared days and overlapping times", () => {
    expect(
      intersectSlots(["Mon/Wed|08:00-12:00"], ["Mon/Fri|09:00-11:00"]),
    ).toEqual(["Mon|09:00-11:00"]);
  });

  it("returns nothing when the days do not overlap", () => {
    expect(intersectSlots(["Mon|08:00-12:00"], ["Tue|08:00-12:00"])).toEqual([]);
  });

  it("returns nothing when the times do not overlap", () => {
    expect(intersectSlots(["Mon|08:00-09:00"], ["Mon|10:00-11:00"])).toEqual([]);
  });

  it("matches a legacy day-less slot against any day", () => {
    expect(intersectSlots(["08:00-12:00"], ["Thu|09:00-10:00"])).toEqual([
      "Thu|09:00-10:00",
    ]);
  });
});

describe("nextOccurrences", () => {
  it("skips a window that has already started today", () => {
    const from = new Date(2026, 8, 1, 10, 0, 0); // Tuesday 10:00 AM
    const next = nextOccurrences(["Tue|09:00-11:00", "Wed|08:00-10:00"], 1, from);
    expect(next.map((item) => item.label)).toEqual([
      "Wed • 8:00 AM - 10:00 AM",
    ]);
  });

  it("returns the next weekday occurrence of a shared Monday window", () => {
    const from = new Date(2026, 8, 1, 8, 0, 0); // Tuesday
    const next = nextOccurrences(["Mon|09:00-11:00"], 1, from);
    expect(next).toHaveLength(1);
    expect(next[0].day).toBe("Mon");
    expect(next[0].start.getDate()).toBe(7);
    expect(next[0].timeLabel).toMatch(/9:00 AM - 11:00 AM/);
  });
});
