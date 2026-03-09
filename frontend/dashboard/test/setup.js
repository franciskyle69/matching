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
    },
    MAIN_TABS: [
      { id: "home", label: "Home" },
      { id: "sessions", label: "Sessions" },
      { id: "matching", label: "Matching" },
      { id: "settings", label: "Settings" },
    ],
    ROLE_OPTIONS: [
      { value: "mentor", label: "Mentor" },
      { value: "mentee", label: "Mentee" },
    ],
    Pages: {},
    Layout: function Layout() {
      const ctx = React.useContext(AppContext);
      const keys = ctx ? Object.keys(ctx).sort().join(",") : "";
      return React.createElement("div", { "data-testid": "context-keys" }, keys);
    },
  };
}
