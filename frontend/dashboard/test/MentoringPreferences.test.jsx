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
  it("uses a recurring weekday dropdown instead of a calendar date", () => {
    render(React.createElement(Harness));

    expect(
      screen.getByText(
        "Set your recurring weekly availability for mentoring sessions.",
      ),
    ).toBeInTheDocument();
    expect(document.querySelector('input[type="date"]')).toBeNull();

    const dayField = screen.getByLabelText("Select day");
    fireEvent.mouseDown(dayField);

    expect(screen.getByRole("option", { name: "Monday" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Saturday" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Sunday" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Friday" }));
    fireEvent.click(screen.getByRole("button", { name: /add slot/i }));

    expect(screen.getByText("Friday (weekly)")).toBeInTheDocument();
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
