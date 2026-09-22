import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import { MentorProfileCard } from "../assets/components/MentorProfileCard.jsx";

describe("MentorProfileCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const mentor = {
    user_id: 42,
    display_name: "Prof. Reyes",
    role: "Instructor",
    program: "BSIT",
    email: "reyes@buksu.edu.ph",
    bio: "I help students with HCI studios, usability reviews, and exam prep across the semester.",
    subjects: ["Intro to HCI"],
    topics: ["Usability testing", "Code reviews"],
    availability: ["Mon/Wed|10:00-12:00"],
    years_experience: 4,
    capacity: 5,
    expertise_level: 5,
    avatar_url: "",
  };

  it("renders hero identity, match chips, and request pairing", () => {
    render(
      React.createElement(MentorProfileCard, {
        person: mentor,
        displayName: "Prof. Reyes",
        email: mentor.email,
        score: 0.94,
        matchDetails: {
          common_subjects: ["Intro to HCI"],
          common_competencies: ["Data Structures & Algorithms"],
        },
        variant: "detail",
        kind: "mentor",
        menteeMatching: {
          subjects: ["Intro to HCI"],
          availability: ["Mon|10:00-12:00"],
        },
        slotsLeft: 3,
        onRequestPairing: () => {},
        onViewProfile: () => {},
      }),
    );

    expect(screen.getByText("Prof. Reyes")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Prof. Reyes" })).toHaveTextContent("PR");
    expect(screen.queryByRole("img", { name: "Prof. Reyes" }).tagName).toBe("SPAN");
    expect(screen.getByText("Instructor")).toBeInTheDocument();
    expect(screen.getByText(/GMT\+8/)).toBeInTheDocument();
    expect(screen.getByText("94% Match")).toBeInTheDocument();
    expect(screen.getByText("Why you matched")).toBeInTheDocument();
    expect(screen.getByText("1 Course")).toBeInTheDocument();
    expect(screen.getByText("1 Skill")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view match breakdown/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /view match breakdown/i }));
    expect(screen.getByText("Courses / Subjects")).toBeInTheDocument();
    expect(screen.getByText("Skills & Topics")).toBeInTheDocument();
    expect(screen.getByText("Intro to HCI")).toBeInTheDocument();
    expect(screen.getByText("Data Structures & Algorithms")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hide match details/i })).toBeInTheDocument();
    expect(screen.getByText("About & mentoring style")).toBeInTheDocument();
    expect(screen.getByText("What I can help with")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request pairing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /send message/i })).toHaveAttribute(
      "href",
      "https://mail.google.com/mail/?view=cm&fs=1&to=reyes%40buksu.edu.ph",
    );
  });

  it("shows official pairing actions and can save a profile", () => {
    render(
      React.createElement(MentorProfileCard, {
        person: mentor,
        displayName: "Prof. Reyes",
        email: mentor.email,
        score: 0.88,
        variant: "hero",
        kind: "mentor",
        isOfficial: true,
        savedId: 42,
      }),
    );

    expect(screen.getByText("Official mentor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /book session/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /request pairing/i })).toBeNull();
    const save = screen.getByRole("button", { name: /save profile/i });
    fireEvent.click(save);
    expect(window.localStorage.getItem("peerlink.savedMentorIds")).toContain("42");
  });

  it("renders two-letter initials when no profile photo is available", () => {
    render(
      React.createElement(MentorProfileCard, {
        person: { ...mentor, display_name: "Marian Rivera", avatar_url: "" },
        displayName: "Marian Rivera",
        variant: "grid",
        kind: "mentor",
      }),
    );
    const badge = screen.getByRole("img", { name: "Marian Rivera" });
    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveTextContent("MR");
    expect(badge).toHaveClass("pmc-avatar-fallback");
  });

  it("renders the photo when a profile URL is present", () => {
    render(
      React.createElement(MentorProfileCard, {
        person: {
          ...mentor,
          avatar_url: "https://cdn.example/marian.jpg",
        },
        displayName: "Marian Rivera",
        variant: "grid",
        kind: "mentor",
      }),
    );
    const photo = screen.getByRole("img", { name: "Marian Rivera" });
    expect(photo.tagName).toBe("IMG");
    expect(photo).toHaveAttribute("src", "https://cdn.example/marian.jpg");
  });

  it("renders exclusively 1 Time Match when candidate only overlaps in schedule", () => {
    const timeOnlyMentor = {
      ...mentor,
      display_name: "Ada Lovelace",
      subjects: ["Intro to Computing"],
      topics: ["Digital Logic & Data Representation"],
      availability: ["Wed|15:00-17:00"],
    };

    render(
      React.createElement(MentorProfileCard, {
        person: timeOnlyMentor,
        displayName: "Ada Lovelace",
        score: 0.17,
        matchDetails: {
          common_subjects: [],
          common_topics: [],
          common_competencies: [],
        },
        menteeMatching: {
          subjects: ["Computer Programming", "IT Fundamentals"],
          topics: ["Data Structures", "Modular Programming"],
          availability: ["Wed|15:00-17:00"],
        },
        variant: "detail",
        kind: "mentor",
      }),
    );

    // Should NOT show false course or skill counts
    expect(screen.queryByText(/Course/i)).toBeNull();
    expect(screen.queryByText(/Skill/i)).toBeNull();
    expect(screen.getByText("1 Time Match")).toBeInTheDocument();

    // Expand match details
    fireEvent.click(screen.getByRole("button", { name: /view match breakdown/i }));

    // Courses and skills groups should not be displayed when empty
    expect(screen.queryByText("Courses / Subjects")).toBeNull();
    expect(screen.queryByText("Skills & Topics")).toBeNull();
    expect(screen.getByText("Schedule Overlap")).toBeInTheDocument();
    expect(screen.getByText("Wed • 3:00 PM - 5:00 PM")).toBeInTheDocument();
  });

  it("disables request pairing button and shows limit reached (2/2) when isLimitReached is true", () => {
    const onPairing = vi.fn();
    render(
      React.createElement(MentorProfileCard, {
        person: mentor,
        displayName: "Prof. Reyes",
        email: mentor.email,
        score: 0.94,
        variant: "detail",
        kind: "mentor",
        isLimitReached: true,
        onRequestPairing: onPairing,
      }),
    );

    const btn = screen.getByRole("button", { name: /limit reached \(2\/2\)/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onPairing).not.toHaveBeenCalled();
  });

  it("disables request pairing button and shows Request Sent badge and label when isPending is true", () => {
    const onPairing = vi.fn();
    render(
      React.createElement(MentorProfileCard, {
        person: mentor,
        displayName: "Prof. Reyes",
        email: mentor.email,
        score: 0.94,
        variant: "detail",
        kind: "mentor",
        isPending: true,
        onRequestPairing: onPairing,
      }),
    );

    const btn = screen.getByRole("button", { name: /request sent/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onPairing).not.toHaveBeenCalled();

    expect(screen.getAllByText("Request Sent").length).toBeGreaterThanOrEqual(1);
  });
});

