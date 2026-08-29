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
})();
