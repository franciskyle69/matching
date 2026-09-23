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

  function purgeLegacyAuthTokens() {
    try {
      window.localStorage.removeItem("auth_access_token");
      window.localStorage.removeItem("auth_refresh_token");
    } catch {
      // Ignore storage failures in privacy-restricted browsers.
    }
  }

  purgeLegacyAuthTokens();

  let refreshInFlight = null;

  async function refreshSession() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const response = await fetch("/api/auth/refresh/", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
          },
          body: "{}",
        });
        return response.ok;
      } catch {
        return false;
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
    return (
      <div className="matching-skeleton-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, width: "100%", marginTop: 16 }}>
        {[1, 2, 3].map((n) => (
          <div key={n} className="matching-card profile-matching-card pmc-card pmc-skeleton-card" aria-hidden="true" style={{ minHeight: 240, padding: 20 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
              <div className="users-skeleton-avatar" style={{ width: 52, height: 52, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div className="users-skeleton-line" style={{ width: "60%", height: 16, marginBottom: 8 }} />
                <div className="users-skeleton-line" style={{ width: "40%", height: 12 }} />
              </div>
              <div className="users-skeleton-line" style={{ width: 68, height: 26, borderRadius: 14 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <div className="users-skeleton-line" style={{ width: 70, height: 22, borderRadius: 12 }} />
              <div className="users-skeleton-line" style={{ width: 90, height: 22, borderRadius: 12 }} />
              <div className="users-skeleton-line" style={{ width: 60, height: 22, borderRadius: 12 }} />
            </div>
            <div className="users-skeleton-line" style={{ width: "100%", height: 36, borderRadius: 8, marginBottom: 16 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="users-skeleton-line" style={{ width: 110, height: 34, borderRadius: 18 }} />
              <div className="users-skeleton-line" style={{ width: 34, height: 34, borderRadius: 18 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  let csrfTokenCache = "";
  let csrfTokenInFlight = null;

  async function ensureCsrfToken(force = false) {
    if (!force) {
      const fromCookie = getCookie("csrftoken");
      if (fromCookie) {
        csrfTokenCache = fromCookie;
        return fromCookie;
      }
      if (csrfTokenCache) return csrfTokenCache;
    }
    if (csrfTokenInFlight) return csrfTokenInFlight;
    csrfTokenInFlight = (async () => {
      try {
        const response = await fetch("/api/csrf/", { credentials: "include" });
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          csrfTokenCache = data.csrfToken || getCookie("csrftoken") || csrfTokenCache;
        } else {
          csrfTokenCache = getCookie("csrftoken") || csrfTokenCache;
        }
      } catch {
        csrfTokenCache = getCookie("csrftoken") || csrfTokenCache;
      } finally {
        csrfTokenInFlight = null;
      }
      return csrfTokenCache;
    })();
    return csrfTokenInFlight;
  }

  async function fetchJSON(url, options = {}) {
    try {
      const isRaw = options.raw;
      const isApiPath = typeof url === "string" && url.startsWith("/api/");
      const isPublicAuthPath =
        typeof url === "string" &&
        (/^\/api\/csrf\/?$/.test(url) ||
          /^\/api\/auth\/(login|register|check-lockout|refresh|logout)\/?$/.test(url));
      const fetchOpts = { credentials: "include", ...options };
      delete fetchOpts.raw;
      if (isRaw) {
        fetchOpts.headers = { ...(options.headers || {}) };
      } else {
        fetchOpts.headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      }
      const method = String(fetchOpts.method || "GET").toUpperCase();
      const isCsrfUrl = typeof url === "string" && /^\/api\/csrf\/?$/.test(url);
      if (!isCsrfUrl && method !== "GET" && method !== "HEAD") {
        const token = await ensureCsrfToken();
        if (token && !fetchOpts.headers["X-CSRFToken"]) {
          fetchOpts.headers["X-CSRFToken"] = token;
        }
      }
      let response = await fetch(url, fetchOpts);
      if (response.status === 403 && !isCsrfUrl && method !== "GET" && method !== "HEAD") {
        const retryToken = await ensureCsrfToken(true);
        if (retryToken) {
          fetchOpts.headers["X-CSRFToken"] = retryToken;
          response = await fetch(url, fetchOpts);
        }
      }
      const sessionRejected =
        isApiPath &&
        !isPublicAuthPath &&
        (response.status === 401 ||
          (response.redirected && /\/accounts\/login\//.test(response.url || "")));
      if (sessionRejected) {
        const refreshed = await refreshSession();
        if (refreshed) {
          response = await fetch(url, fetchOpts);
        }
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        if (response.status === 403) {
          return {
            ok: false,
            status: 403,
            data: { error: "Your session expired. Refresh the page and try again." },
          };
        }
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

  function formatRelativeTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) {
      return diffMin === 1 ? "1 minute ago" : diffMin + " minutes ago";
    }
    if (diffHr < 24) {
      return diffHr === 1 ? "1 hour ago" : diffHr + " hours ago";
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return (
        "Yesterday at " +
        date.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        })
      );
    }
    if (diffDay < 7) {
      return diffDay === 1 ? "1 day ago" : diffDay + " days ago";
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

  function getMentorRoleBadgeMeta(role) {
    const label = String(role || "").trim();
    if (!label) return null;
    const lower = label.toLowerCase();
    if (lower.includes("staff") || lower.includes("admin")) {
      return { kind: "staff", label: "Staff", fullLabel: label || "Operations Staff" };
    }
    if (lower.includes("instructor") || lower.includes("faculty")) {
      return { kind: "instructor", label: "Instructor", fullLabel: label || "Faculty Instructor" };
    }
    if (lower.includes("mentee")) {
      return { kind: "mentee", label: "Mentee", fullLabel: label || "Student Mentee" };
    }
    if (lower.includes("senior") || lower.includes("student") || lower.includes("mentor")) {
      return { kind: "student", label: "Student Mentor", fullLabel: label || "Senior IT Student Mentor" };
    }
    return { kind: "other", label, fullLabel: label };
  }

  function MentorRoleBadgeIcon({ kind }) {
    const common = {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
    };
    if (kind === "staff" || kind === "admin") {
      return (
        <svg {...common} className="mentor-role-badge__icon">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    }
    if (kind === "instructor") {
      return (
        <svg {...common} className="mentor-role-badge__icon">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
        </svg>
      );
    }
    if (kind === "mentee") {
      return (
        <svg {...common} className="mentor-role-badge__icon">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    }
    if (kind === "student") {
      return (
        <svg {...common} className="mentor-role-badge__icon">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8l2 2 4-4" strokeWidth="2.5" />
        </svg>
      );
    }
    return (
      <svg {...common} className="mentor-role-badge__icon">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    );
  }

  function MentorRoleBadge({ role, className = "", prominent = false }) {
    const meta = getMentorRoleBadgeMeta(role);
    if (!meta) return null;
    const tooltip = meta.fullLabel || meta.label;
    return (
      <span
        className={
          "mentor-role-badge mentor-role-badge--" +
          meta.kind +
          (prominent ? " mentor-role-badge--prominent" : "") +
          (className ? " " + className : "")
        }
        title={tooltip}
        aria-label={"Mentor type: " + tooltip}
      >
        <MentorRoleBadgeIcon kind={meta.kind} />
        <span className="mentor-role-badge__label">{meta.label}</span>
      </span>
    );
  }

  function MentorMatchTitle({ name, role, showRole = true }) {
    const displayName = name || "Unknown";
    return (
      <div className="match-card-title-block">
        <div
          className={
            "match-card-title-line" +
            (showRole && role ? "" : " match-card-title-line--name-only")
          }
        >
          <p className="match-card-title">Mentor: {displayName}</p>
          {showRole && role ? <MentorRoleBadge role={role} prominent /> : null}
        </div>
      </div>
    );
  }

  function categoryIconName(cat) {
    if (cat === "achievement") return "trophy";
    if (cat === "project") return "laptop";
    return "fileText";
  }

  function formatBiologicalSex(value) {
    const key = String(value || "").trim().toLowerCase();
    if (key === "male") return "Male";
    if (key === "female") return "Female";
    return String(value || "").trim() || "—";
  }

  function formatStudentYearLevel(year) {
    const n = Number(year);
    if (n === 3) return "3rd year";
    if (n === 4) return "4th year";
    return n ? `Year ${n}` : "";
  }

  function getAvatarInitials(name, fallback) {
    const source = String(name || fallback || "").trim();
    if (!source) return "?";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  window.DashboardApp.DashboardIcon = DashboardIcon;
  window.DashboardApp.categoryIconName = categoryIconName;

  window.DashboardApp.Utils = {
    formatMatchScore,
    getCookie,
    fetchJSON,
    ensureCsrfToken,
    formatDate,
    formatRelativeTime,
    formatBiologicalSex,
    formatStudentYearLevel,
    LoadingSpinner,
    OrbitingDotsLoader,
    MatchingLoadingAnimation,
    DashboardIcon,
    categoryIconName,
    getMentorRoleBadgeMeta,
    getAvatarInitials,
    MentorRoleBadge,
    MentorMatchTitle,
  };
})();
