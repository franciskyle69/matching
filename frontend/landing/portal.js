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

  const stepRoles = document.getElementById("portal-step-roles");
  const stepAuth = document.getElementById("portal-step-auth");
  const selectedLabel = document.getElementById("portal-selected-role");
  const signInBtn = document.getElementById("portal-signin-btn");
  const signUpBtn = document.getElementById("portal-signup-btn");
  const backBtn = document.getElementById("portal-back-btn");

  if (!stepRoles || !stepAuth) return;

  document.querySelectorAll("[data-portal-role]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const key = btn.getAttribute("data-portal-role");
      const role = ROLES[key];
      if (!role) return;

      savePortalRole(role);

      if (role.signinOnly) {
        window.location.href = authHref("signin", role.authRole);
        return;
      }

      selectedLabel.textContent = role.label;
      signInBtn.href = authHref("signin", role.authRole);
      if (signUpBtn) {
        signUpBtn.href = authHref("signup", role.authRole);
        signUpBtn.hidden = false;
      }
      signInBtn.hidden = false;

      stepRoles.classList.remove("portal-step--visible");
      stepRoles.hidden = true;
      stepAuth.hidden = false;
      stepAuth.classList.add("portal-step--visible");
    });
  });

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      stepAuth.hidden = true;
      stepAuth.classList.remove("portal-step--visible");
      stepRoles.hidden = false;
      stepRoles.classList.add("portal-step--visible");
    });
  }
})();
