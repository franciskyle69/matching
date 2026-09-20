import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";

beforeAll(async () => {
  window.DashboardApp.SelectionCatalog = {
    prefetch: vi.fn(),
    peek: vi.fn(() => null),
    load: vi.fn(() => Promise.resolve({ topics: [], competencies: [] })),
  };
  await import("../assets/router/pages/MentoringPreferencesPage.jsx");
}, 20000);

const AppContext = globalThis.window.DashboardApp.AppContext;

function Harness() {
  const Page = window.DashboardApp.Pages["mentoring-preferences"];
  const [menteeMatching, setMenteeMatching] = React.useState({
    subjects: [],
    topics: [],
    competency_ids: [],
    competency_needs: {},
    difficulty_level: 3,
    preferred_learning_style: "",
    availability: [],
  });

  return React.createElement(
    AppContext.Provider,
    {
      value: {
        user: { role: "mentee", display_name: "Ada" },
        menteeMatching,
        setMenteeMatching,
        menteeMatchingSaving: false,
        handleMenteeMatchingSave: vi.fn(),
        setUnsavedChangesDirty: vi.fn(),
      },
    },
    React.createElement(Page),
  );
}

describe("Mentoring preferences availability", () => {
  it("allows selecting days and a time range to add availability timeframes", () => {
    render(React.createElement(Harness));

    expect(screen.getByText("Available time")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Pick the days you can meet, then a time range between 7:00 AM and 10:00 PM.",
      ),
    ).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();

    // Select Friday
    const friChip = screen.getByRole("checkbox", { name: "Friday" });
    fireEvent.click(friChip);

    // Set start and end times
    const startInput = screen.getByLabelText("Start time");
    const endInput = screen.getByLabelText("End time");
    fireEvent.change(startInput, { target: { value: "09:00" } });
    fireEvent.change(endInput, { target: { value: "11:00" } });

    // Click Add timeframe
    const addBtn = screen.getByRole("button", { name: /add timeframe/i });
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);

    // Verify timeframe item is rendered
    expect(screen.getAllByText("Fri • 9:00 AM - 11:00 AM").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("allows selecting a support need by clicking on a selection card", () => {
    render(React.createElement(Harness));

    const card4 = screen.getByRole("button", {
      name: /4 Intensive Support You need consistent, structured support to keep progressing\./i,
    });
    expect(card4).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(card4);

    expect(card4).toHaveAttribute("aria-pressed", "true");
    expect(card4).toHaveClass("is-active");
  });
});
