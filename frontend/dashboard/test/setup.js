/**
 * Test setup: provide window.React and window.DashboardApp so IIFE-based
 * components (AppProviders, AuthPages, HomePage) can run in jsdom.
 */
import React from "react";
import ReactDOM from "react-dom";

if (typeof globalThis.window !== "undefined") {
  globalThis.window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  });
  globalThis.window.React = React;
  globalThis.window.ReactDOM = ReactDOM;
  const AppContext = React.createContext(null);
  globalThis.window.DashboardApp = {
    AppContext,
    Utils: {
      getCookie: () => "",
      fetchJSON: () => Promise.resolve({ ok: false }),
      LoadingSpinner: () => null,
      formatDate: (d) => (d != null ? String(d) : ""),
      formatMatchScore: (score) => {
        const percentage = Math.round(
          Math.min(1, Math.max(0, Number(score) || 0)) * 100,
        );
        return { percentage, label: "Match", tier: "strong" };
      },
      getAvatarInitials: (name, fallback) => {
        const source = String(name || fallback || "").trim();
        if (!source) return "?";
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      },
    },
    MAIN_TABS: [
      { id: "home", label: "Home" },
      { id: "matching", label: "Matching" },
      { id: "settings", label: "Settings" },
    ],
    ROLE_OPTIONS: [
      { value: "mentor", label: "Mentor" },
      { value: "mentee", label: "Mentee" },
    ],
    Pages: {},
    MainContent: function MainContent() {
      return React.createElement("div", { "data-testid": "main-content" });
    },
    Layout: function Layout() {
      const ctx = React.useContext(AppContext);
      const keys = ctx ? Object.keys(ctx).sort().join(",") : "";
      return React.createElement("div", { "data-testid": "context-keys" }, keys);
    },
  };

  /* Imported for their side effects: TimePickerField registers
     formatTimeLabel, which availability.jsx reads when formatting slots, and
     availability.jsx registers the namespace HomePage reads on evaluation. */
  await import("../assets/components/TimePickerField.jsx");
  await import("../assets/lib/availability.jsx");
}
