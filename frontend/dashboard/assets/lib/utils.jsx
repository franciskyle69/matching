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

  function getAuthToken() {
    try {
      return window.localStorage.getItem("auth_access_token") || "";
    } catch {
      return "";
    }
  }

  function getRefreshToken() {
    try {
      return window.localStorage.getItem("auth_refresh_token") || "";
    } catch {
      return "";
    }
  }

  function setAuthToken(token) {
    try {
      if (!token) {
        window.localStorage.removeItem("auth_access_token");
        return;
      }
      window.localStorage.setItem("auth_access_token", token);
    } catch {
      // Ignore storage failures in privacy-restricted browsers.
    }
  }

  function setRefreshToken(token) {
    try {
      if (!token) {
        window.localStorage.removeItem("auth_refresh_token");
        return;
      }
      window.localStorage.setItem("auth_refresh_token", token);
    } catch {
      // Ignore storage failures in privacy-restricted browsers.
    }
  }

  function clearAuthToken() {
    setAuthToken("");
  }

  function clearAuthTokens() {
    clearAuthToken();
    setRefreshToken("");
  }

  let refreshInFlight = null;

  async function refreshAccessToken() {
    if (refreshInFlight) return refreshInFlight;
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    refreshInFlight = (async () => {
      try {
        const response = await fetch("/api/auth/refresh/", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!response.ok) return null;
        const data = await response.json().catch(() => null);
        if (!data || !data.access_token) return null;
        setAuthToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        return data.access_token;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  }

  function LoadingSpinner({ inline = false, title = null, subtitle = null }) {
    // Unified spinner using the matching page's design system
    // For inline use: compact spinner without text
    // For block use: full spinner with optional title and subtitle
    return (
      <div
        className={`unified-loading-spinner ${inline ? "unified-loading-spinner-inline" : "unified-loading-spinner-block"}`}
        role="status"
        aria-label={title ? `${title}` : "Loading"}
      >
        <div className="unified-loading-visual">
          <div className="unified-loading-ring" />
          <div className="unified-loading-dots">
            <span className="unified-loading-dot" />
            <span className="unified-loading-dot" />
            <span className="unified-loading-dot" />
          </div>
        </div>
        {!inline && title && (
          <>
            <p className="unified-loading-title">{title}</p>
            {subtitle && <p className="unified-loading-subtitle">{subtitle}</p>}
          </>
        )}
      </div>
    );
  }

  function OrbitingDotsLoader({ size = 50, speed = 1 }) {
    const dots = [0, 1, 2, 3, 4];
    const sizePx = typeof size === "number" ? `${size}px` : size;
    const duration = 1.2 / Math.max(0.25, Math.min(2, speed));
    return (
      <div
        className="orbiting-dots-loader"
        style={{
          "--orbiting-size": sizePx,
          "--orbiting-duration": `${duration}s`,
        }}
        role="status"
        aria-label="Loading"
      >
        <div className="orbiting-dots-loader__track">
          {dots.map((i) => (
            <span
              key={i}
              className="orbiting-dots-loader__dot"
              style={{ "--orbiting-angle": `${i * 72}deg`, "--orbiting-delay": `${-i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  function MatchingLoadingAnimation() {
    return <LoadingSpinner title="Running matching…" subtitle="Finding mentor–mentee pairs" />;
  }

  async function fetchJSON(url, options = {}) {
    try {
      const isRaw = options.raw;
      const token = getAuthToken();
      const isApiPath = typeof url === "string" && url.startsWith("/api/");
      const isCookieAuthPath =
        typeof url === "string" &&
        (/^\/api\/csrf\/?$/.test(url) ||
          /^\/api\/auth\/(login|register|check-lockout|refresh|logout)\/?$/.test(url));
      const useToken = !!(token && isApiPath && !isCookieAuthPath);
      const defaultCredentials = isCookieAuthPath ? "include" : useToken ? "omit" : "include";
      const fetchOpts = { credentials: defaultCredentials, ...options };
      delete fetchOpts.raw;
      if (isRaw) {
        fetchOpts.headers = { ...(options.headers || {}) };
      } else {
        fetchOpts.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      }
      if (useToken && !fetchOpts.headers.Authorization) {
        fetchOpts.headers.Authorization = `Bearer ${token}`;
      }
      let response = await fetch(url, fetchOpts);
      if (useToken && response.status === 401) {
        const newAccessToken = await refreshAccessToken();
        if (newAccessToken) {
          const retryOpts = {
            ...fetchOpts,
            credentials: "omit",
            headers: {
              ...(fetchOpts.headers || {}),
              Authorization: `Bearer ${newAccessToken}`,
            },
          };
          response = await fetch(url, retryOpts);
        } else {
          clearAuthTokens();
          const retryOpts = {
            ...fetchOpts,
            credentials: "include",
            headers: { ...(fetchOpts.headers || {}) },
          };
          delete retryOpts.headers.Authorization;
          response = await fetch(url, retryOpts);
        }
      }
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

  /** Stroke icons (sidebar-style) for profile, settings, post categories */
  function DashboardIcon({ name, size = 18, className = "" }) {
    const s = size;
    const common = {
      width: s,
      height: s,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: "dashboard-stroke-icon " + (className || ""),
      "aria-hidden": true,
    };
    switch (name) {
      case "graduationCap":
        return (
          <svg {...common}>
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        );
      case "calendar":
        return (
          <svg {...common}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        );
      case "building":
        return (
          <svg {...common}>
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
            <path d="M10 6h4" />
            <path d="M10 10h4" />
            <path d="M10 14h4" />
            <path d="M10 18h4" />
          </svg>
        );
      case "users":
        return (
          <svg {...common}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case "barChart":
        return (
          <svg {...common}>
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
        );
      case "userCircle":
        return (
          <svg {...common}>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20.7c.7-2 2.6-3.3 5-3.3s4.3 1.3 5 3.3" />
          </svg>
        );
      case "briefcase":
        return (
          <svg {...common}>
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            <line x1="12" y1="12" x2="12" y2="12.01" />
          </svg>
        );
      case "clock":
        return (
          <svg {...common}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case "trophy":
        return (
          <svg {...common}>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        );
      case "laptop":
        return (
          <svg {...common}>
            <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
            <line x1="2" y1="20" x2="22" y2="20" />
          </svg>
        );
      case "fileText":
        return (
          <svg {...common}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        );
      case "pencil":
        return (
          <svg {...common}>
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        );
      case "user":
        return (
          <svg {...common}>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case "lock":
        return (
          <svg {...common}>
            <rect x="4" y="11" width="16" height="9" rx="2" ry="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            <path d="M12 14v3" />
          </svg>
        );
      case "clipboardList":
        return (
          <svg {...common}>
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M12 11h4" />
            <path d="M12 16h4" />
            <path d="M8 11h.01" />
            <path d="M8 16h.01" />
          </svg>
        );
      case "sparkles":
        return (
          <svg {...common}>
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
          </svg>
        );
      case "camera":
        return (
          <svg {...common}>
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        );
      default:
        return (
          <svg {...common}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  }

  function categoryIconName(cat) {
    if (cat === "achievement") return "trophy";
    if (cat === "project") return "laptop";
    return "fileText";
  }

  window.DashboardApp.DashboardIcon = DashboardIcon;
  window.DashboardApp.categoryIconName = categoryIconName;

  window.DashboardApp.Utils = {
    formatMatchScore,
    getCookie,
    getAuthToken,
    getRefreshToken,
    setAuthToken,
    setRefreshToken,
    clearAuthToken,
    clearAuthTokens,
    refreshAccessToken,
    fetchJSON,
    formatDate,
    LoadingSpinner,
    OrbitingDotsLoader,
    MatchingLoadingAnimation,
    DashboardIcon,
    categoryIconName,
  };
})();
