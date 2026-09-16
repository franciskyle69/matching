(function () {
  "use strict";

  const STORAGE_KEY = "portalRole";
  const STORAGE_LABEL_KEY = "portalRoleLabel";

  /** Matches PeerLink roles: staff, mentor, mentee (see ROLE_OPTIONS / api account). */
  const ROLES = {
    staff: {
      label: "Staff",
      authRole: "staff",
      signinOnly: true,
    },
    mentor: {
      label: "Mentor",
      authRole: "mentor",
    },
    mentee: {
      label: "Mentee",
      authRole: "mentee",
    },
  };

  function authHref(mode, authRole) {
    const params = new URLSearchParams();
    if (authRole) params.set("role", authRole);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return `/app/${qs}#${mode}`;
  }

  function savePortalRole(roleConfig) {
    if (!roleConfig || !roleConfig.authRole) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, roleConfig.authRole);
      sessionStorage.setItem(STORAGE_LABEL_KEY, roleConfig.label || "");
    } catch {
      /* ignore */
    }
  }

  function clearPortalRole() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_LABEL_KEY);
    } catch {
      /* ignore */
    }
  }

  document.querySelectorAll("[data-portal-role]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const key = btn.getAttribute("data-portal-role");
      const role = ROLES[key];
      if (!role) return;

      // Staff accounts are not created here — go straight to sign-in.
      if (role.signinOnly) {
        clearPortalRole();
        window.location.href = authHref("signin");
        return;
      }

      // Mentor / mentee: role choice is for account creation only.
      savePortalRole(role);
      window.location.href = authHref("signup", role.authRole);
    });
  });

  (function initPortalTheme() {
    const toggle = document.getElementById("portal-theme-toggle");
    const label = document.getElementById("portal-theme-label");

    function updateLabel() {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      if (label) label.textContent = isDark ? "Light" : "Dark";
    }
    updateLabel();

    function applyTheme(next) {
      try {
        localStorage.setItem("theme", next);
      } catch (_) {}
      try {
        document.cookie = "theme=" + next + "; path=/; max-age=31536000; SameSite=Lax";
      } catch (_) {}
      document.documentElement.setAttribute("data-theme", next);
      if (document.body) document.body.setAttribute("data-theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
        if (document.body) document.body.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        if (document.body) document.body.classList.remove("dark");
      }
      updateLabel();
    }

    if (toggle) {
      toggle.addEventListener("click", () => {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        const next = isDark ? "light" : "dark";
        applyTheme(next);
      });
    }

    window.addEventListener("storage", (e) => {
      if (e.key === "theme" && (e.newValue === "dark" || e.newValue === "light")) {
        applyTheme(e.newValue);
      }
    });
  })();
})();
