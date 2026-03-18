(function () {
  "use strict";
  const React = window.React;
  window.DashboardApp = window.DashboardApp || {};

  function formatMatchScore(score) {
    const s = Number(score);
    const percentage = Math.round((Number.isNaN(s) ? 0 : Math.min(1, Math.max(0, s))) * 100);
    let label = "Low match";
    let tier = "low";
    if (percentage >= 85) {
      label = "Excellent match";
      tier = "excellent";
    } else if (percentage >= 70) {
      label = "Strong match";
      tier = "strong";
    } else if (percentage >= 55) {
      label = "Good match";
      tier = "good";
    } else if (percentage >= 40) {
      label = "Fair match";
      tier = "fair";
    } else if (percentage >= 25) {
      label = "Moderate match";
      tier = "moderate";
    }
    return { percentage, label, tier };
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(";").shift();
    }
    return "";
  }

  function LoadingSpinner({ inline = false }) {
    return (
      <div
        className={`sk-chase loading-spinner-spinkit ${inline ? "loading-spinner-inline" : ""}`}
        role="status"
        aria-label="Loading"
      >
        <div className="sk-chase-dot" />
        <div className="sk-chase-dot" />
        <div className="sk-chase-dot" />
        <div className="sk-chase-dot" />
        <div className="sk-chase-dot" />
        <div className="sk-chase-dot" />
      </div>
    );
  }

  function MatchingLoadingAnimation() {
    return (
      <div className="matching-loading-block" role="status" aria-label="Running matching">
        <div className="matching-loading-visual">
          <div className="matching-loading-ring" />
          <div className="matching-loading-dots">
            <span className="matching-loading-dot" />
            <span className="matching-loading-dot" />
            <span className="matching-loading-dot" />
          </div>
        </div>
        <p className="matching-loading-title">Running matching…</p>
        <p className="matching-loading-subtitle">Finding mentor–mentee pairs</p>
      </div>
    );
  }

  async function fetchJSON(url, options = {}) {
    try {
      const isRaw = options.raw;
      const fetchOpts = { credentials: "include", ...options };
      delete fetchOpts.raw;
      if (isRaw) {
        fetchOpts.headers = { ...(options.headers || {}) };
      } else {
        fetchOpts.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      }
      const response = await fetch(url, fetchOpts);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        return { ok: false, status: response.status, data: null };
      }
      try {
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
      } catch (jsonErr) {
        return { ok: false, status: response.status, data: null };
      }
    } catch (err) {
      return { ok: false, status: 0, data: { error: "Network error. Please check if the server is running." } };
    }
  }

  function formatDate(value) {
    try {
      return new Date(value).toLocaleString();
    } catch (err) {
      return value;
    }
  }

  window.DashboardApp.Utils = {
    formatMatchScore,
    getCookie,
    fetchJSON,
    formatDate,
    LoadingSpinner,
    MatchingLoadingAnimation,
  };
})();
