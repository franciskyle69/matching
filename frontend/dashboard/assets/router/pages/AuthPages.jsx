(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const ROLE_OPTIONS = (window.DashboardApp.ROLE_OPTIONS || []);
  const { LoadingSpinner } = Utils;

  function SignInPage() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const [showPassword, setShowPassword] = useState(false);
    const { signInForm, setSignInForm, handleSignIn, setActiveTab, signInLoading } = ctx;
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-left">
            <div>
              <div className="auth-brand">BukSU</div>
              <h1 className="auth-info-title">Academic mentoring system</h1>
              <p className="auth-info-text">Connect mentors and mentees seamlessly.</p>
            </div>
            <div className="auth-info-footer">www.capstoneproject.com</div>
          </div>
          <div className="auth-card-divider"></div>
          <div className="auth-card-right">
            <h2 className="auth-title">Login</h2>
            <p className="auth-subtitle">Welcome back! Please sign in to your account</p>
            <div className="auth-form">
              <div className="auth-field">
                <label>Email or username</label>
                <input placeholder="your@email.com or username" value={signInForm.username} onChange={(e) => setSignInForm({ ...signInForm, username: e.target.value })} />
              </div>
              <div className="auth-field auth-password-wrap">
                <label>Password</label>
                <div className="auth-password-input-wrap">
                  <input type={showPassword ? "text" : "password"} value={signInForm.password} onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })} />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((v) => !v)} title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? (
                      <svg className="auth-password-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg className="auth-password-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="auth-row">
                <label className="checkbox-row"><input type="checkbox" /> Remember me</label>
                <button className="link-button" type="button" onClick={() => { window.location.href = "/accounts/password_reset/"; }}>Forgot password?</button>
              </div>
              <button className="auth-primary" onClick={handleSignIn} disabled={signInLoading}>
                {signInLoading ? <span className="loading-inline"><LoadingSpinner inline /> Signing in…</span> : "Sign In"}
              </button>
              <div className="auth-divider"><span>Or continue with</span></div>
              <div className="auth-social">
                <button className="auth-social-btn" type="button" onClick={() => { window.location.href = "/accounts/google/login/?process=login&next=/app/"; }}>
                  <svg className="auth-social-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  Google
                </button>
              </div>
              <div className="auth-footer">Don't have an account? <button className="link-button" onClick={() => setActiveTab("signup")}>Sign up</button></div>
            </div>
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
    const { signUpForm, setSignUpForm, handleSignUp, setActiveTab } = ctx;
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-left">
            <div>
              <div className="auth-brand">Academic mentoring system</div>
              <h1 className="auth-info-title">Join Us Today</h1>
              <p className="auth-info-text">Start your mentoring journey with our platform.</p>
            </div>
            <div className="auth-info-footer">www.academicmentoring.com</div>
          </div>
          <div className="auth-card-divider"></div>
          <div className="auth-card-right">
            <h2 className="auth-title">Sign Up</h2>
            <p className="auth-subtitle">Create your account to get started</p>
            <div className="auth-form">
              <div className="auth-field">
                <label>Role</label>
                <select value={signUpForm.role} onChange={(e) => setSignUpForm({ ...signUpForm, role: e.target.value })}>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="auth-field"><label>Username</label><input value={signUpForm.username} onChange={(e) => setSignUpForm({ ...signUpForm, username: e.target.value })} /></div>
              <div className="auth-field"><label>Email</label><input type="email" placeholder="your@email.com" value={signUpForm.email} onChange={(e) => setSignUpForm({ ...signUpForm, email: e.target.value })} /></div>
              <div className="auth-field auth-password-wrap">
                <label>Password</label>
                <div className="auth-password-input-wrap">
                  <input type={showPassword1 ? "text" : "password"} value={signUpForm.password1} onChange={(e) => setSignUpForm({ ...signUpForm, password1: e.target.value })} />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword1((v) => !v)} title={showPassword1 ? "Hide password" : "Show password"} aria-label={showPassword1 ? "Hide password" : "Show password"}>
                    {showPassword1 ? (
                      <svg className="auth-password-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg className="auth-password-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="auth-field auth-password-wrap">
                <label>Confirm password</label>
                <div className="auth-password-input-wrap">
                  <input type={showPassword2 ? "text" : "password"} value={signUpForm.password2} onChange={(e) => setSignUpForm({ ...signUpForm, password2: e.target.value })} />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword2((v) => !v)} title={showPassword2 ? "Hide password" : "Show password"} aria-label={showPassword2 ? "Hide password" : "Show password"}>
                    {showPassword2 ? (
                      <svg className="auth-password-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg className="auth-password-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
              <button className="auth-primary" onClick={handleSignUp}>Sign Up</button>
              <div className="auth-footer">Already have an account? <button className="link-button" onClick={() => setActiveTab("signin")}>Sign in</button></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.signin = SignInPage;
  window.DashboardApp.Pages.signup = SignUpPage;
  if (typeof module !== "undefined" && module.exports) module.exports = { SignInPage, SignUpPage };
})();
