import { Alert as MuiAlert } from "@mui/material";

(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState } = React;
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
    const portalRole = getPortalAuthRole();
    if (portalRole) params.set("role", portalRole);
    const qs = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `/app/${qs}#${tab}`);
  }

  function getGoogleLoginUrl() {
    const portalRole = getPortalAuthRole();
    if (portalRole === "mentor" || portalRole === "mentee") {
      return `/accounts/google/role/${portalRole}/`;
    }
    return "/accounts/google/login/?process=login&next=/app/signin%3Foauth%3Dgoogle";
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
    const portalRoleLabel = getPortalRoleLabel();
    const portalAuthRole = getPortalAuthRole();
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
              {portalRoleLabel
                ? `Sign in as ${portalRoleLabel}`
                : "Welcome back! Please sign in to your account"}
            </p>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSignIn();
              }}
            >
              {authAlert &&
                (MuiAlert ? (
                  <MuiAlert
                    severity={authAlert.severity || "error"}
                    variant="filled"
                    onClose={() => setAuthAlert(null)}
                    sx={{ mb: 2, alignItems: "flex-start" }}
                  >
                    <div className="auth-alert-content">
                      <p className="auth-alert-title">
                        {authAlert.title || "Sign in issue"}
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
                  </MuiAlert>
                ) : (
                  <div
                    className={
                      "alert auth-inline-alert " +
                      (authAlert.severity === "warning"
                        ? "alert-warning"
                        : "alert-error")
                    }
                    role="alert"
                  >
                    <p className="auth-alert-title">
                      {authAlert.title || "Sign in issue"}
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
                ))}
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
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <a
                        className="auth-social-btn"
                        href="/accounts/google/role/mentor/"
                      >
                        Continue as Mentor
                      </a>
                      <a
                        className="auth-social-btn"
                        href="/accounts/google/role/mentee/"
                      >
                        Continue as Mentee
                      </a>
                    </div>
                  </div>
                ) : portalAuthRole === "staff" ? (
                  <p className="auth-subtitle" style={{ margin: 0 }}>
                    Staff accounts use administrator credentials.
                  </p>
                ) : pendingApproval ? (
                  <div className="auth-social" style={{ width: "100%" }}>
                    <p className="auth-subtitle" style={{ marginBottom: "0.75rem" }}>
                      Your account is pending coordinator approval.
                    </p>
                    <button
                      type="button"
                      className="auth-primary"
                      onClick={() => setActiveTab("complete-profile")}
                    >
                      Complete Required Information
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
                    <svg className="auth-social-icon" viewBox="0 0 24 24">
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
                    Google
                  </button>
                )}
              </div>
              {portalAuthRole !== "staff" && (
                <div className="auth-footer">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => navigateAuthTab(setActiveTab, "signup")}
                  >
                    Sign up
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    );
  }

  function SignUpPage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const [showPassword1, setShowPassword1] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const {
      signUpForm,
      setSignUpForm,
      handleSignUp,
      setActiveTab,
      signUpLoading,
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
            <h2 className="auth-title">Sign Up</h2>
            <p className="auth-subtitle">
              {portalRoleLabel
                ? `Create your ${portalRoleLabel} account`
                : "Create your account to get started"}
            </p>
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSignUp();
              }}
            >
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
                  This role is selected from the role portal.
                </small>
              </div>
              {isMentorSignup && (
                <div className="auth-field">
                  <label id="signup-mentor-type-label">Mentor type *</label>
                  <p className="muted" style={{ margin: "0 0 10px" }}>
                    Coordinators use this to verify whether you are a student
                    mentor or an instructor.
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
              <div className="auth-field">
                <label htmlFor="signup-first-name">First name</label>
                <input
                  id="signup-first-name"
                  autoComplete="given-name"
                  placeholder="First name"
                  value={signUpForm.first_name}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, first_name: e.target.value })
                  }
                />
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
                <label htmlFor="signup-last-name">Last name</label>
                <input
                  id="signup-last-name"
                  autoComplete="family-name"
                  placeholder="Last name"
                  value={signUpForm.last_name}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, last_name: e.target.value })
                  }
                />
              </div>
              <div className="auth-field">
                <label htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={signUpForm.email}
                  onChange={(e) =>
                    setSignUpForm({ ...signUpForm, email: e.target.value })
                  }
                />
              </div>
              <div className="auth-field">
                <label htmlFor="signup-verification-file">Academic mentoring application form</label>
                <input
                  id="signup-verification-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  required
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                    setSignUpForm({
                      ...signUpForm,
                      student_verification_document: file,
                    });
                  }}
                />
                <small className="auth-field-helper">
                  Upload your completed academic mentoring application form for account review (PDF/JPG/PNG, max 5 MB).
                </small>
                {signUpForm.student_verification_document && (
                  <small className="auth-field-helper">
                    Selected: {signUpForm.student_verification_document.name}
                  </small>
                )}
              </div>
              <div className="auth-field auth-password-wrap">
                <label htmlFor="signup-password">Password</label>
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
                <label htmlFor="signup-confirm-password">Confirm password</label>
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
              <button type="submit" className="auth-primary" disabled={signUpLoading}>
                {signUpLoading ? <LoadingSpinner inline /> : "Sign Up"}
              </button>
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
