import { Alert as MuiAlert } from "@mui/material";

(function () {
  "use strict";
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useContext, useEffect, useRef, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function getPortalAuthRole() {
    const fromUrl = new URLSearchParams(window.location.search || "").get("role");
    const fromStore =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("portalRole")
        : null;
    const role = fromUrl || fromStore;
    return role === "mentor" || role === "mentee" || role === "staff" ? role : null;
  }

  function getPortalRoleLabel() {
    const stored =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("portalRoleLabel")
        : null;
    if (stored) return stored;
    const role = getPortalAuthRole();
    if (role === "mentor") return "Mentor";
    if (role === "mentee") return "Mentee";
    if (role === "staff") return "Staff";
    return null;
  }

  function navigateAuthTab(setActiveTab, tab) {
    setActiveTab(tab);
    const params = new URLSearchParams();
    // Role belongs to signup only; sign-in stays role-neutral.
    if (tab === "signup") {
      const portalRole = getPortalAuthRole();
      if (portalRole) params.set("role", portalRole);
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `/app/${qs}#${tab}`);
  }

  const STUDENT_MENTOR_DOC_FIELDS = [
    { key: "letter_of_intent", label: "Letter of intent" },
    { key: "study_load", label: "Study load" },
    { key: "grade", label: "Grade" },
  ];
  const MAX_SIGNUP_FILES_PER_KIND = 10;

  function fileKey(file) {
    return [file.name, file.size, file.lastModified].join(":");
  }

  function mergeSelectedFiles(current, incoming) {
    const next = Array.isArray(current) ? current.slice() : [];
    const seen = new Set(next.map(fileKey));
    incoming.forEach((file) => {
      if (!file || seen.has(fileKey(file))) return;
      if (next.length >= MAX_SIGNUP_FILES_PER_KIND) return;
      next.push(file);
      seen.add(fileKey(file));
    });
    return next;
  }

  function MultiFileField({ id, label, files, onChange, required }) {
    const selected = Array.isArray(files) ? files : [];
    return (
      <div className="auth-field">
        <label htmlFor={id}>
          {label}
          {required ? " *" : ""}
        </label>
        <input
          id={id}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          onChange={(e) => {
            const added = Array.from(e.target.files || []);
            onChange(mergeSelectedFiles(selected, added));
            e.target.value = "";
          }}
        />
        <small className="auth-field-helper">
          You can select multiple files at once. PDF, JPG, or PNG. Max 5 MB each.
        </small>
        {selected.length > 0 && (
          <ul className="auth-file-list">
            {selected.map((file, index) => (
              <li key={fileKey(file)} className="auth-file-list-item">
                <span title={file.name}>{file.name}</span>
                <button
                  type="button"
                  className="auth-file-remove"
                  onClick={() =>
                    onChange(selected.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function getGoogleLoginUrl() {
    return "/accounts/google/start/login/";
  }

  function getGoogleSignupUrl() {
    const role = getPortalAuthRole();
    if (role !== "mentor" && role !== "mentee") return "/portal/";
    return (
      "/accounts/google/start/signup/?role=" + encodeURIComponent(role)
    );
  }

  function GoogleMark() {
    return (
      <svg className="auth-social-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    );
  }

  function isOauthMismatchAlert(authAlert) {
    const code = String((authAlert && authAlert.code) || "").toLowerCase();
    return code === "no_account" || code === "account_exists";
  }

  function getOauthModalCopy(authAlert) {
    const code = String((authAlert && authAlert.code) || "").toLowerCase();
    if (code === "account_exists") {
      return {
        title: (authAlert && authAlert.title) || "Account Already Exists",
        message:
          (authAlert && authAlert.message) ||
          "An account is already registered with this Google email. Would you like to log in instead?",
        primaryId: "login_google",
        primaryLabel: "Log In with Google",
      };
    }
    return {
      title: (authAlert && authAlert.title) || "No Account Found",
      message:
        (authAlert && authAlert.message) ||
        "No account is registered with this Google email. Would you like to create a new account instead?",
      primaryId: "signup_google",
      primaryLabel: "Sign Up with Google",
    };
  }

  function handleOauthAlertAction(actionId, setActiveTab, setAuthAlert) {
    if (actionId === "dismiss") {
      if (setAuthAlert) setAuthAlert(null);
      return;
    }
    if (actionId === "create_account") {
      const role = getPortalAuthRole();
      if (role === "mentor" || role === "mentee") {
        if (setAuthAlert) setAuthAlert(null);
        navigateAuthTab(setActiveTab, "signup");
        return;
      }
      window.location.href = "/portal/";
      return;
    }
    if (actionId === "signup_google") {
      window.location.href = getGoogleSignupUrl();
      return;
    }
    if (actionId === "go_login") {
      if (setAuthAlert) setAuthAlert(null);
      navigateAuthTab(setActiveTab, "signin");
      return;
    }
    if (actionId === "login_google") {
      window.location.href = getGoogleLoginUrl();
    }
  }

  function WarningBadgeIcon() {
    return (
      <svg
        className="auth-oauth-modal-badge-icon"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  function AuthOauthWarningModal({ authAlert, setAuthAlert, setActiveTab }) {
    const dialogRef = useRef(null);
    const leavingRef = useRef(false);
    const [leaving, setLeaving] = useState(false);
    const copy = getOauthModalCopy(authAlert);
    const titleId = "auth-oauth-modal-title";
    const descId = "auth-oauth-modal-desc";

    function dismiss() {
      if (leavingRef.current) return;
      leavingRef.current = true;
      setLeaving(true);
      window.setTimeout(() => {
        if (setAuthAlert) setAuthAlert(null);
      }, 200);
    }

    useEffect(() => {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      function onKeyDown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          dismiss();
        }
      }
      document.addEventListener("keydown", onKeyDown);
      if (dialogRef.current && typeof dialogRef.current.focus === "function") {
        dialogRef.current.focus();
      }
      return () => {
        document.body.style.overflow = previousOverflow;
        document.removeEventListener("keydown", onKeyDown);
      };
    }, []);

    const overlay = (
      <div
        className={
          "auth-oauth-modal-overlay is-open" + (leaving ? " is-leaving" : "")
        }
        data-testid="auth-oauth-modal-overlay"
        onClick={(event) => {
          if (event.target === event.currentTarget) dismiss();
        }}
      >
        <div
          ref={dialogRef}
          className="auth-oauth-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
        >
          <button
            type="button"
            className="auth-oauth-modal-close"
            onClick={dismiss}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="auth-oauth-modal-badge" aria-hidden="true">
            <WarningBadgeIcon />
          </div>
          <h3 id={titleId} className="auth-oauth-modal-title">
            {copy.title}
          </h3>
          <p id={descId} className="auth-oauth-modal-message">
            {copy.message}
          </p>
          <div className="auth-oauth-modal-actions">
            <button
              type="button"
              className="auth-oauth-modal-primary"
              onClick={() =>
                handleOauthAlertAction(
                  copy.primaryId,
                  setActiveTab,
                  setAuthAlert,
                )
              }
            >
              <GoogleMark />
              {copy.primaryLabel}
            </button>
            <button
              type="button"
              className="auth-oauth-modal-secondary"
              onClick={dismiss}
            >
              Cancel / Dismiss
            </button>
          </div>
        </div>
      </div>
    );

    if (ReactDOM && typeof ReactDOM.createPortal === "function" && document.body) {
      return ReactDOM.createPortal(overlay, document.body);
    }
    return overlay;
  }

  function AuthAlertBanner({ authAlert, setAuthAlert, defaultTitle }) {
    if (!authAlert || isOauthMismatchAlert(authAlert)) return null;
    const body = (
      <div className="auth-alert-content">
        <p className="auth-alert-title">
          {authAlert.title || defaultTitle}
        </p>
        <p className="auth-alert-message">{authAlert.message}</p>
        {authAlert.detail && (
          <p className="auth-alert-detail">{authAlert.detail}</p>
        )}
        {authAlert.attempts && (
          <p className="auth-alert-attempts">
            Failed attempts: {authAlert.attempts}
          </p>
        )}
      </div>
    );
    if (MuiAlert) {
      return (
        <MuiAlert
          className="auth-inline-alert"
          severity={authAlert.severity || "error"}
          variant="outlined"
          onClose={() => setAuthAlert(null)}
          sx={{ mb: 2, alignItems: "flex-start" }}
        >
          {body}
        </MuiAlert>
      );
    }
    return (
      <div
        className={
          "alert auth-inline-alert " +
          (authAlert.severity === "warning"
            ? "alert-warning"
            : authAlert.severity === "success"
              ? "alert-success"
              : "alert-error")
        }
        role="alert"
      >
        {body}
      </div>
    );
  }

  function SignInPage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const [showPassword, setShowPassword] = useState(false);
    const {
      signInForm,
      setSignInForm,
      handleSignIn,
      setActiveTab,
      signInLoading,
      authAlert,
      setAuthAlert,
      user,
    } = ctx;
    const queryParams = new URLSearchParams(window.location.search || "");
    const roleRequired = ["1", "true", "yes", "on"].includes(
      String(queryParams.get("role_required") || "").toLowerCase(),
    );
    const pendingApproval =
      user &&
      ((user.role === "mentor" && user.mentor_approved === false) ||
        (user.role === "mentee" && user.mentee_approved === false));
    const isAuthLoading = signInLoading;

    function goBackToLanding() {
      window.location.href = "/landing/";
    }

    return (
      <div className="auth-page">
        {isAuthLoading && (
          <div
            className="session-check-overlay"
            role="status"
            aria-live="assertive"
            aria-busy="true"
          >
            <LoadingSpinner inline />
          </div>
        )}
        <div className="auth-card">
          <div className="auth-card-left">
            <div className="auth-left-top">
              <img
                src="/static/assets/logo.png"
                alt="AMU Mentoring"
                className="auth-left-logo"
              />
              <h1 className="auth-info-title">Welcome to PeerLink</h1>
              <p className="auth-info-text">
                Access your personalized learning dashboard and continue your
                journey with expert mentors.
              </p>
              <ul className="auth-left-points">
                <li>Secure authentication</li>
                <li>Track your progress</li>
                <li>Connect with mentors</li>
              </ul>
            </div>
            {window.DashboardApp.AmuFooter ? (
              <window.DashboardApp.AmuFooter compact />
            ) : (
              <div className="auth-info-footer">
                <a
                  href="https://www.facebook.com/buksuAMU"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Bukidnon State University — AMU
                </a>
              </div>
            )}
          </div>
          <div className="auth-card-divider"></div>
          <div className="auth-card-right">
            <button
              type="button"
              className="auth-back-btn"
              onClick={goBackToLanding}
              aria-label="Back to landing page"
              title="Back to landing page"
            >
              <svg
                className="auth-back-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h2 className="auth-title">Login</h2>
            <p className="auth-subtitle">
              Welcome back! Please sign in to your account
            </p>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSignIn();
              }}
            >
              <AuthAlertBanner
                authAlert={authAlert}
                setAuthAlert={setAuthAlert}
                defaultTitle="Sign in issue"
              />
              <div className="auth-field">
                <label htmlFor="signin-identifier">Email or Username</label>
                <input
                  id="signin-identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="you@example.com or username"
                  value={signInForm.identifier}
                  onChange={(e) =>
                    setSignInForm({ ...signInForm, identifier: e.target.value })
                  }
                />
                <p className="auth-field-helper">Use your institutional email or username.</p>
              </div>
              <div className="auth-field auth-password-wrap">
                <label htmlFor="signin-password">Password</label>
                <div className="auth-password-input-wrap">
                  <input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={signInForm.password}
                    onChange={(e) =>
                      setSignInForm({ ...signInForm, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <svg
                        className="auth-password-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        className="auth-password-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="auth-row">
                <label className="checkbox-row">
                  <input type="checkbox" /> Remember me
                </label>
                <button
                  className="link-button"
                  type="button"
                  onClick={() => {
                    window.location.href = "/accounts/password_reset/";
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <button
                type="submit"
                className="auth-primary"
                disabled={signInLoading}
              >
                {signInLoading ? (
                  <LoadingSpinner inline />
                ) : (
                  "Sign In"
                )}
              </button>
              <div className="auth-divider">
                <span>Or continue with</span>
              </div>
              <div className="auth-social">
                {roleRequired ? (
                  <div className="auth-social" style={{ width: "100%" }}>
                    <p className="auth-subtitle" style={{ marginBottom: "0.75rem" }}>
                      Choose your role first to continue with Google.
                    </p>
                    <a className="auth-social-btn" href="/portal/">
                      Choose role to sign up
                    </a>
                  </div>
                ) : pendingApproval ? (
                  <div className="auth-social" style={{ width: "100%" }}>
                    <p className="auth-subtitle" style={{ marginBottom: "0.75rem" }}>
                      Your account is pending coordinator approval.
                    </p>
                    <button
                      type="button"
                      className="auth-primary"
                      onClick={() => setActiveTab("onboarding")}
                    >
                      Continue onboarding
                    </button>
                  </div>
                ) : (
                  <button
                    className="auth-social-btn"
                    type="button"
                    onClick={() => {
                      window.location.href = getGoogleLoginUrl();
                    }}
                  >
                    <GoogleMark />
                    Log in with Google
                  </button>
                )}
              </div>
              <div className="auth-footer">
                Don't have an account?{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    window.location.href = "/portal/";
                  }}
                >
                  Sign up
                </button>
              </div>
            </form>
          </div>
        </div>
        {isOauthMismatchAlert(authAlert) && (
          <AuthOauthWarningModal
            authAlert={authAlert}
            setAuthAlert={setAuthAlert}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    );
  }

  function SignUpPage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const [showPassword1, setShowPassword1] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [signupStep, setSignupStep] = useState(1);
    const {
      signUpForm,
      setSignUpForm,
      handleSignUp,
      setActiveTab,
      signUpLoading,
      authAlert,
      setAuthAlert,
    } = ctx;
    const portalRoleLabel = getPortalRoleLabel();
    const portalAuthRole = getPortalAuthRole();
    const isAuthLoading = signUpLoading;
    const isMentorSignup =
      portalAuthRole === "mentor" || signUpForm.role === "mentor";
    const MENTOR_TYPE_OPTIONS = [
      {
        value: "Senior IT Student",
        title: "Student mentor",
        description: "Senior IT student mentoring peers",
      },
      {
        value: "Instructor",
        title: "Instructor",
        description: "Faculty member mentoring students",
      },
    ];

    function goBackToLanding() {
      window.location.href = "/landing/";
    }

    function goToSignupStep(step) {
      setAuthAlert(null);
      setSignupStep(step);
    }

    function goToSignupStep2() {
      const firstName = String(signUpForm.first_name || "").trim();
      const lastName = String(signUpForm.last_name || "").trim();
      const email = String(signUpForm.email || "").trim();
      const password1 = String(signUpForm.password1 || "");
      const password2 = String(signUpForm.password2 || "");
      if (!firstName) {
        setAuthAlert({
          severity: "error",
          title: "First name required",
          message: "Enter your first name to continue.",
        });
        return;
      }
      if (!lastName) {
        setAuthAlert({
          severity: "error",
          title: "Last name required",
          message: "Enter your last name to continue.",
        });
        return;
      }
      if (!email) {
        setAuthAlert({
          severity: "error",
          title: "Email required",
          message: "Enter your email address to continue.",
        });
        return;
      }
      if (!password1) {
        setAuthAlert({
          severity: "error",
          title: "Password required",
          message: "Create a password to continue.",
        });
        return;
      }
      if (!password2) {
        setAuthAlert({
          severity: "error",
          title: "Confirm password required",
          message: "Confirm your password to continue.",
        });
        return;
      }
      if (password1 !== password2) {
        setAuthAlert({
          severity: "error",
          title: "Passwords do not match",
          message: "Make sure both password fields are the same.",
        });
        return;
      }
      goToSignupStep(2);
    }

    return (
      <div className="auth-page">
        {isAuthLoading && (
          <div
            className="session-check-overlay"
            role="status"
            aria-live="assertive"
            aria-busy="true"
          >
            <LoadingSpinner inline />
          </div>
        )}
        <div className="auth-card">
          <div className="auth-card-left">
            <div className="auth-left-top">
              <img
                src="/static/assets/logo.png"
                alt="AMU Mentoring"
                className="auth-left-logo"
              />
              <h1 className="auth-info-title">Welcome to PeerLink</h1>
              <p className="auth-info-text">
                Access your personalized learning dashboard and continue your
                journey with expert mentors.
              </p>
              <ul className="auth-left-points">
                <li>Secure authentication</li>
                <li>Track your progress</li>
                <li>Connect with mentors</li>
              </ul>
            </div>
            {window.DashboardApp.AmuFooter ? (
              <window.DashboardApp.AmuFooter compact />
            ) : (
              <div className="auth-info-footer">
                <a
                  href="https://www.facebook.com/buksuAMU"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Bukidnon State University — AMU
                </a>
              </div>
            )}
          </div>
          <div className="auth-card-divider"></div>
          <div className="auth-card-right">
            <button
              type="button"
              className="auth-back-btn"
              onClick={() => {
                if (signupStep === 2) {
                  goToSignupStep(1);
                  return;
                }
                goBackToLanding();
              }}
              aria-label={
                signupStep === 2
                  ? "Back to account details"
                  : "Back to landing page"
              }
              title={
                signupStep === 2
                  ? "Back to account details"
                  : "Back to landing page"
              }
            >
              <svg
                className="auth-back-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h2 className="auth-title">Sign Up</h2>
            <p className="auth-subtitle">
              {signupStep === 1
                ? portalRoleLabel
                  ? `Create your ${portalRoleLabel} account`
                  : "Create your account to get started"
                : "Finish your application for coordinator review"}
            </p>
            <div className="auth-step-meta" aria-hidden="true">
              <span
                className={
                  "auth-step-dot" + (signupStep === 1 ? " is-active" : "")
                }
              />
              <span
                className={
                  "auth-step-dot" + (signupStep === 2 ? " is-active" : "")
                }
              />
              <span className="auth-step-label">
                Step {signupStep} of 2
              </span>
            </div>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (signupStep === 1) {
                  goToSignupStep2();
                  return;
                }
                handleSignUp();
              }}
            >
              <AuthAlertBanner
                authAlert={authAlert}
                setAuthAlert={setAuthAlert}
                defaultTitle="Sign up issue"
              />
              {signupStep === 2 && (
                <>
              <div className="auth-field">
                <p className="auth-field-label">Role</p>
                <p
                  className="auth-role-locked"
                  style={{
                    margin: 0,
                    padding: "0.65rem 0.85rem",
                    borderRadius: "8px",
                    background: "rgba(99, 102, 241, 0.12)",
                    color: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    fontWeight: 600,
                  }}
                >
                  {portalRoleLabel ||
                    (signUpForm.role === "mentee" ? "Mentee" : "Mentor")}
                </p>
                <small className="auth-field-helper">
                  This role was selected when you started creating your account.
                </small>
              </div>
              {isMentorSignup && (
                <div className="auth-field">
                  <label id="signup-mentor-type-label">Mentor type *</label>
                  <p className="muted" style={{ margin: "0 0 8px" }}>
                    Student mentor or instructor.
                  </p>
                  <div
                    className="auth-mentor-type-picker"
                    role="radiogroup"
                    aria-labelledby="signup-mentor-type-label"
                  >
                    {MENTOR_TYPE_OPTIONS.map((option) => {
                      const active = signUpForm.mentor_role === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={
                            "auth-mentor-type-option" +
                            (active ? " is-active" : "")
                          }
                          onClick={() =>
                            setSignUpForm({
                              ...signUpForm,
                              mentor_role: option.value,
                              year_level:
                                option.value === "Senior IT Student"
                                  ? signUpForm.year_level
                                  : "",
                            })
                          }
                        >
                          <span className="auth-mentor-type-option-title">
                            {option.title}
                          </span>
                          <span className="auth-mentor-type-option-desc">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {isMentorSignup &&
                signUpForm.mentor_role === "Senior IT Student" && (
                <div className="auth-field">
                  <label id="signup-year-level-label">Year level *</label>
                  <p className="muted" style={{ margin: "0 0 8px" }}>
                    Locked after coordinator approval.
                  </p>
                  <div
                    className="auth-mentor-type-picker"
                    role="radiogroup"
                    aria-labelledby="signup-year-level-label"
                  >
                    {[
                      { value: 3, title: "3rd year" },
                      { value: 4, title: "4th year" },
                    ].map((option) => {
                      const active =
                        Number(signUpForm.year_level) === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={
                            "auth-mentor-type-option" +
                            (active ? " is-active" : "")
                          }
                          onClick={() =>
                            setSignUpForm({
                              ...signUpForm,
                              year_level: option.value,
                            })
                          }
                        >
                          <span className="auth-mentor-type-option-title">
                            {option.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {isMentorSignup && (
                <div className="auth-field">
                  <label htmlFor="signup-gender">Biological sex *</label>
                  <p className="muted" style={{ margin: "0 0 8px" }}>
                    Locked after coordinator approval.
                  </p>
                  <select
                    id="signup-gender"
                    value={signUpForm.gender || ""}
                    onChange={(e) =>
                      setSignUpForm({
                        ...signUpForm,
                        gender: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select biological sex</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              )}
                </>
              )}
              {signupStep === 1 && (
                <>
              <div className="auth-name-row">
              <div className="auth-field">
                <label htmlFor="signup-first-name">First name *</label>
                <input
                  id="signup-first-name"
                  autoComplete="given-name"
                  placeholder="First name"
                  value={signUpForm.first_name}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, first_name: e.target.value })
                  }
                  required
                  aria-required="true"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="signup-last-name">Last name *</label>
                <input
                  id="signup-last-name"
                  autoComplete="family-name"
                  placeholder="Last name"
                  value={signUpForm.last_name}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, last_name: e.target.value })
                  }
                  required
                  aria-required="true"
                />
              </div>
              </div>
              <div className="auth-field">
                <label htmlFor="signup-middle-name">Middle name</label>
                <input
                  id="signup-middle-name"
                  autoComplete="additional-name"
                  placeholder="Middle name (optional)"
                  value={signUpForm.middle_name}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, middle_name: e.target.value })
                  }
                />
              </div>
              <div className="auth-field">
                <label htmlFor="signup-email">Email *</label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={signUpForm.email}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, email: e.target.value })
                  }
                  required
                  aria-required="true"
                />
              </div>
                </>
              )}
              {signupStep === 2 && (
                isMentorSignup &&
                signUpForm.mentor_role === "Senior IT Student" ? (
                  <>
                    <p className="auth-field-label">Required documents *</p>
                    <small className="auth-field-helper">
                      Upload at least one file for each type. You can select
                      multiple files at once.
                    </small>
                    {STUDENT_MENTOR_DOC_FIELDS.map((field) => (
                      <MultiFileField
                        key={field.key}
                        id={`signup-${field.key}`}
                        label={field.label}
                        files={signUpForm[field.key]}
                        required
                        onChange={(nextFiles) =>
                          setSignUpForm({
                            ...signUpForm,
                            [field.key]: nextFiles,
                          })
                        }
                      />
                    ))}
                  </>
                ) : (
                  <MultiFileField
                    id="signup-verification-file"
                    label="Academic mentoring application form"
                    files={signUpForm.student_verification_documents}
                    required
                    onChange={(nextFiles) =>
                      setSignUpForm({
                        ...signUpForm,
                        student_verification_documents: nextFiles,
                      })
                    }
                  />
                )
              )}
              {signupStep === 1 && (
                <>
              <div className="auth-field auth-password-wrap">
                <label htmlFor="signup-password">Password *</label>
                <div className="auth-password-input-wrap">
                  <input
                    id="signup-password"
                    type={showPassword1 ? "text" : "password"}
                    autoComplete="new-password"
                    value={signUpForm.password1}
                    onChange={(e) =>
                      setSignUpForm({
                        ...signUpForm,
                        password1: e.target.value,
                      })
                    }
                    required
                    aria-required="true"
                    minLength={10}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword1((v) => !v)}
                    title={showPassword1 ? "Hide password" : "Show password"}
                    aria-label={
                      showPassword1 ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword1 ? (
                      <svg
                        className="auth-password-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        className="auth-password-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="auth-field auth-password-wrap">
                <label htmlFor="signup-confirm-password">Confirm password *</label>
                <div className="auth-password-input-wrap">
                  <input
                    id="signup-confirm-password"
                    type={showPassword2 ? "text" : "password"}
                    autoComplete="new-password"
                    value={signUpForm.password2}
                    onChange={(e) =>
                      setSignUpForm({
                        ...signUpForm,
                        password2: e.target.value,
                      })
                    }
                    required
                    aria-required="true"
                    minLength={10}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    onClick={() => setShowPassword2((v) => !v)}
                    title={showPassword2 ? "Hide password" : "Show password"}
                    aria-label={
                      showPassword2 ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword2 ? (
                      <svg
                        className="auth-password-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        className="auth-password-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
                </>
              )}
              <div className={signupStep === 2 ? "auth-step-actions is-split" : "auth-step-actions"}>
                {signupStep === 2 && (
                  <button
                    type="button"
                    className="auth-secondary"
                    onClick={() => goToSignupStep(1)}
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  className="auth-primary"
                  disabled={signUpLoading}
                >
                  {signUpLoading ? (
                    <LoadingSpinner inline />
                  ) : signupStep === 1 ? (
                    "Continue"
                  ) : (
                    "Create account"
                  )}
                </button>
              </div>
              {signupStep === 1 && (
                <>
                  <div className="auth-divider">
                    <span>Or continue with</span>
                  </div>
                  <div className="auth-social">
                    <button
                      className="auth-social-btn"
                      type="button"
                      onClick={() => {
                        window.location.href = getGoogleSignupUrl();
                      }}
                    >
                      <GoogleMark />
                      Sign up with Google
                    </button>
                  </div>
                </>
              )}
              <div className="auth-footer">
                Already have an account?{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigateAuthTab(setActiveTab, "signin")}
                >
                  Sign in
                </button>
              </div>
            </form>
          </div>
        </div>
        {isOauthMismatchAlert(authAlert) && (
          <AuthOauthWarningModal
            authAlert={authAlert}
            setAuthAlert={setAuthAlert}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.signin = SignInPage;
  window.DashboardApp.Pages.signup = SignUpPage;
  if (typeof module !== "undefined" && module.exports)
    module.exports = { SignInPage, SignUpPage };
})();
