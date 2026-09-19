import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import OnboardingPreferences from "../../../src/components/Onboarding.jsx";

(function () {
  "use strict";
  const React = window.React;
  const Mui = window.Mui || {};
  const { useContext, useMemo, useState, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;

  function menteePrefsDone(user) {
    return !!(
      user.mentee_questionnaire_completed ?? user.questionnaire_completed
    );
  }

  function getRoleSteps(user) {
    if (user.role === "mentee") {
      const profileDone = !!user.mentee_general_info_completed;
      const prefsDone = menteePrefsDone(user);
      return [
        { id: "welcome", label: "Welcome", done: true },
        { id: "profile", label: "Your details", done: profileDone },
        { id: "preferences", label: "Learning needs", done: prefsDone },
        { id: "done", label: "Finish", done: prefsDone },
      ];
    }
    if (user.role === "mentor") {
      const profileDone = !!user.mentor_questionnaire_completed;
      return [
        { id: "welcome", label: "Welcome", done: true },
        { id: "profile", label: "Mentoring profile", done: profileDone },
        { id: "done", label: "Finish", done: profileDone },
      ];
    }
    return [{ id: "done", label: "Finish", done: true }];
  }

  function deriveStep(user) {
    if (!user) return "welcome";
    if (user.role === "mentee") {
      if (!user.mentee_general_info_completed) return "profile";
      if (!menteePrefsDone(user)) return "preferences";
      return "done";
    }
    if (user.role === "mentor") {
      if (!user.mentor_questionnaire_completed) return "profile";
      return "done";
    }
    return "done";
  }

  function isApproved(user) {
    if (!user) return false;
    if (user.role === "mentor") return !!user.mentor_approved;
    if (user.role === "mentee") return !!user.mentee_approved;
    return true;
  }

  function storageKeyFor(user) {
    if (!user) return "onboarding-started";
    return `onboarding-started:${user.id || user.email || user.role}`;
  }

  function OnboardingStepper({ steps, currentId }) {
    const currentIndex = Math.max(
      0,
      steps.findIndex((step) => step.id === currentId),
    );
    return (
      <ol className="onboarding-stepper" aria-label="Onboarding progress">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentId;
          const isComplete =
            step.done && (index < currentIndex || step.id === "done");
          const stateClass = isCurrent
            ? " is-current"
            : isComplete
              ? " is-complete"
              : "";
          return (
            <li
              key={step.id}
              className={"onboarding-stepper-item" + stateClass}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className="onboarding-stepper-index" aria-hidden="true">
                {isComplete && !isCurrent ? "✓" : index + 1}
              </span>
              <span className="onboarding-stepper-label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  function WelcomePanel({ user, onContinue }) {
    const isMentor = user.role === "mentor";
    return (
      <section className="onboarding-panel onboarding-welcome">
        <p className="onboarding-eyebrow">
          {isMentor ? "Mentor onboarding" : "Mentee onboarding"}
        </p>
        <h2 className="onboarding-welcome-title">
          {isMentor ? "Set up how you mentor" : "Set up how you want to learn"}
        </h2>
        <p className="onboarding-welcome-copy">
          {isMentor
            ? "Tell us which subjects and competencies you can teach. Coordinators review this before you appear in matching."
            : "Share your details and learning needs so we can recommend mentors that fit your subjects and goals."}
        </p>
        <ul className="onboarding-welcome-list">
          {isMentor ? (
            <>
              <li>Choose subjects, topics, and competencies</li>
              <li>Set expertise, experience, and availability</li>
              <li>Submit for coordinator approval</li>
            </>
          ) : (
            <>
              <li>Confirm your student details</li>
              <li>
                Pick subjects, topics, and competencies you need help with
              </li>
              <li>Submit for coordinator approval</li>
            </>
          )}
        </ul>
        <div className="onboarding-actions">
          <button type="button" className="btn" onClick={onContinue}>
            Start setup
          </button>
        </div>
      </section>
    );
  }

  function DonePanel({ user, setActiveTab }) {
    const approved = isApproved(user);
    const isMentor = user.role === "mentor";
    return (
      <section className="onboarding-panel onboarding-done">
        <p className="onboarding-eyebrow">
          {approved ? "You are ready" : "Submitted"}
        </p>
        <h2 className="onboarding-welcome-title">
          {approved ? "Onboarding complete" : "Profile submitted for review"}
        </h2>
        <p className="onboarding-welcome-copy">
          {approved
            ? isMentor
              ? "Your mentoring profile is complete. You can update it anytime from Matching profile."
              : "Your learning preferences are saved. Head to Matching when you are ready to find a mentor."
            : "A coordinator will review your account. You can still update your information while you wait."}
        </p>
        <div className="onboarding-actions">
          {approved ? (
            <button
              type="button"
              className="btn"
              onClick={() => setActiveTab("home")}
            >
              Go to dashboard
            </button>
          ) : (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setActiveTab("settings")}
            >
              Open settings
            </button>
          )}
          {isMentor ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setActiveTab("mentor-matching-profile")}
            >
              Edit mentoring profile
            </button>
          ) : (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setActiveTab("mentoring-preferences")}
            >
              Edit preferences
            </button>
          )}
        </div>
      </section>
    );
  }

  function MissingStep({ label }) {
    return (
      <section className="onboarding-panel">
        <p className="onboarding-welcome-copy">
          {label} could not load. Refresh the page and try again.
        </p>
      </section>
    );
  }

  function OnboardingPage() {
    const ctx = useContext(AppContext);
    const user = ctx && ctx.user;
    const setActiveTab = ctx && ctx.setActiveTab;

    const isMentor = !!(user && user.role === "mentor");
    const isMentee = !!(user && user.role === "mentee");
    const storageKey = storageKeyFor(user);

    const steps = useMemo(() => (user ? getRoleSteps(user) : []), [user]);
    const derivedStep = user ? deriveStep(user) : "welcome";

    const [currentStep, setCurrentStep] = useState(() => {
      try {
        if (sessionStorage.getItem(storageKey) === "1") {
          return deriveStep(user) || "profile";
        }
      } catch (_) {}
      return "welcome";
    });

    useEffect(() => {
      if (!user) return;
      if (derivedStep === "done") {
        setCurrentStep("done");
        return;
      }
      // If the user already finished an earlier step, skip past welcome/stale steps.
      if (currentStep === "welcome") return;
      if (currentStep === "profile" && derivedStep === "preferences") {
        setCurrentStep("preferences");
      } else if (
        (currentStep === "profile" || currentStep === "preferences") &&
        derivedStep === "done"
      ) {
        setCurrentStep("done");
      }
    }, [user, derivedStep, currentStep]);

    if (!ctx || !user) return null;

    if (!isMentor && !isMentee) {
      return (
        <div className="card onboarding-page page-shell">
          <h1 className="page-title">Onboarding</h1>
          <p className="page-subtitle">
            Onboarding is available for mentor and mentee accounts.
          </p>
        </div>
      );
    }

    function markStarted() {
      const next = deriveStep(user) || "profile";
      setCurrentStep(next);
      try {
        sessionStorage.setItem(storageKey, "1");
      } catch (_) {}
    }

    const CompleteProfilePage = window.DashboardApp.Pages["complete-profile"];
    const MentoringPreferencesPage =
      window.DashboardApp.Pages["mentoring-preferences"];
    const MentorMatchingProfilePage =
      window.DashboardApp.Pages["mentor-matching-profile"];

    let subtitle = "A short setup so matching works for you.";
    if (currentStep === "done") {
      subtitle = isApproved(user)
        ? "You finished setup."
        : "Waiting for coordinator approval.";
    } else if (currentStep !== "welcome") {
      subtitle = isMentor
        ? "Step through your mentoring subjects and availability."
        : "Complete each step to unlock mentor matching.";
    }

    return (
      <div className="card onboarding-page page-shell">
        <header className="complete-profile-header onboarding-header">
          <h1 className="page-title">Onboarding</h1>
          <p className="page-subtitle">{subtitle}</p>
        </header>

        <OnboardingStepper steps={steps} currentId={currentStep} />

        {currentStep === "welcome" && (
          <WelcomePanel user={user} onContinue={markStarted} />
        )}

        {currentStep === "profile" && isMentee && (
          <div className="onboarding-embed">
            {CompleteProfilePage ? (
              <CompleteProfilePage embedded />
            ) : (
              <MissingStep label="Your details form" />
            )}
          </div>
        )}

        {currentStep === "preferences" && isMentee && (
          <div className="onboarding-embed">
            {MentoringPreferencesPage ? (
              <MentoringPreferencesPage embedded />
            ) : (
              <MissingStep label="Learning needs form" />
            )}
          </div>
        )}

        {currentStep === "profile" && isMentor && (
          <div className="onboarding-embed">
            {MentorMatchingProfilePage ? (
              <MentorMatchingProfilePage embedded />
            ) : (
              <MissingStep label="Mentoring profile form" />
            )}
          </div>
        )}

        {currentStep === "done" && (
          <DonePanel user={user} setActiveTab={setActiveTab} />
        )}
      </div>
    );
  }

  function UnifiedOnboardingPage() {
    const ctx = useContext(AppContext);
    const user = ctx && ctx.user;
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [form, setForm] = useState({
      year_level: user?.role === "mentee" ? 1 : 3,
      campus: "Main",
      contact_no: "",
      subjects: [],
      topics: [],
      availability: [],
    });
    if (!ctx || !user) return null;
    const faculty =
      /@buksu\.edu\.ph$/i.test(user.email || "") &&
      !/@student\.buksu\.edu\.ph$/i.test(user.email || "");
    const MuiBox = Mui.Box || "div";
    const MuiPaper = Mui.Paper || "div";
    const MuiStack = Mui.Stack || "div";
    const MuiButton = Mui.Button || "button";
    const MuiTextField = Mui.TextField || "input";
    const MuiTypography = Mui.Typography || "div";
    function chooseFile(candidate) {
      if (!candidate) return;
      const validType =
        ["image/png", "image/jpeg", "image/jpg"].includes(candidate.type) ||
        /\.(png|jpe?g)$/i.test(candidate.name || "");
      if (!validType || candidate.size > 5 * 1024 * 1024) {
        ctx.setError("Choose a PNG, JPG, or JPEG image up to 5 MB.");
        return;
      }
      setFile(candidate);
      setPreview(URL.createObjectURL(candidate));
      ctx.setError("");
    }
    function proceedToStep2() {
      if (!file) {
        ctx.setError("Please upload your profile photo or institutional ID to proceed.");
        return;
      }
      ctx.setError("");
      setStep(2);
    }
    function submit() {
      if (!file) {
        ctx.setError("Please upload your profile photo or institutional ID in Step 1 first.");
        setStep(1);
        return;
      }
      const campus = (faculty ? "Main" : form.campus || "").trim();
      if (!campus) {
        ctx.setError("Please enter your campus location (e.g. Main).");
        return;
      }
      const contact = (form.contact_no || "").trim();
      if (!contact) {
        ctx.setError("Please enter your mobile contact number (e.g. 09XXXXXXXXX).");
        return;
      }
      const cleanPhone = contact.replace(/[\s-]/g, "");
      if (!/^09\d{9}$/.test(cleanPhone) && !/^\+639\d{9}$/.test(cleanPhone)) {
        ctx.setError(
          "Please enter a valid 11-digit Philippine mobile number starting with 09 (e.g. 09123456789).",
        );
        return;
      }
      ctx.setError("");
      const body = new FormData();
      body.append("profile_photo", file);
      body.append(
        "metadata",
        JSON.stringify({
          ...form,
          campus,
          contact_no: cleanPhone,
          year_level: faculty ? 4 : Number(form.year_level),
        }),
      );
      ctx.handleOnboardingComplete(body);
    }
    const setValue = (key) => (event) => {
      if (ctx.error) ctx.setError("");
      setForm((previous) => ({ ...previous, [key]: event.target.value }));
    };
    return (
      <div className="cp-onboard">
        <div className="cp-onboard-card">
          <div className="cp-onboard-progress" aria-label="Setup progress">
            <div className="cp-onboard-progress-meta">
              <span>Step {step} of 2</span>
              <span>
                {step === 1 ? "Identity verification" : "Academic details"}
              </span>
            </div>
            <div className="cp-onboard-progress-track">
              <span className="cp-onboard-progress-fill is-current" />
              <span
                className={`cp-onboard-progress-fill ${step === 2 ? "is-current" : ""}`}
              />
            </div>
          </div>

          <header className="cp-onboard-header">
            <p className="cp-onboard-eyebrow">PeerLink onboarding</p>
            <h1 className="cp-onboard-title">
              Complete Your BukSU Mentorship Profile
            </h1>
            <p className="cp-onboard-copy">
              {step === 1
                ? "Upload your profile photo or institutional ID to verify your BukSU affiliation."
                : "Confirm your academic standing and subjects of interest for optimal peer matching."}
            </p>
          </header>

          {ctx.error && (
            <div className="cp-onboard-error-banner" style={{ marginBottom: 20 }}>
              <p className="cp-onboard-error">{ctx.error}</p>
            </div>
          )}

          {step === 1 ? (
            <div className="cp-onboard-form">
              <div className="cp-onboard-field">
                <label>
                  Profile photo or institutional ID <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <label
                  htmlFor="onboarding-photo"
                  className="cp-onboard-dropzone"
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt="Selected profile preview"
                      className="cp-onboard-preview-img"
                    />
                  ) : (
                    <div className="cp-onboard-dropzone-empty">
                      <CloudUploadOutlinedIcon
                        style={{ fontSize: 44, color: "var(--cp-accent)" }}
                      />
                      <p style={{ margin: "8px 0 0", fontWeight: 600 }}>
                        Drop an image here or click to choose a file
                      </p>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--cp-text-muted)",
                        }}
                      >
                        PNG, JPG, or JPEG up to 5 MB
                      </span>
                    </div>
                  )}
                  <input
                    id="onboarding-photo"
                    hidden
                    type="file"
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    onChange={(event) => chooseFile(event.target.files?.[0])}
                  />
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className="cp-onboard-submit"
                  style={{ minWidth: 160 }}
                  onClick={proceedToStep2}
                >
                  Continue →
                </button>
              </div>
            </div>
          ) : (
            <form
              className="cp-onboard-form"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="cp-onboard-grid">
                <div className="cp-onboard-field">
                  <label>Course program</label>
                  <p className="cp-onboard-locked">BSIT — Information Technology</p>
                </div>

                <div className="cp-onboard-field">
                  <label htmlFor="cp-year-level">Year level</label>
                  <select
                    id="cp-year-level"
                    value={faculty ? 4 : form.year_level}
                    onChange={setValue("year_level")}
                    disabled={faculty}
                  >
                    {faculty ? (
                      <option value={4}>Faculty / Staff</option>
                    ) : (
                      <>
                        <option value={1}>1st Year</option>
                        <option value={2}>2nd Year</option>
                        <option value={3}>3rd Year</option>
                        <option value={4}>4th Year</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="cp-onboard-grid">
                <div className="cp-onboard-field">
                  <label htmlFor="cp-campus">
                    Campus location <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="cp-campus"
                    type="text"
                    value={faculty ? "Main" : form.campus}
                    onChange={setValue("campus")}
                    placeholder="e.g. Main"
                  />
                </div>

                <div className="cp-onboard-field">
                  <label htmlFor="cp-contact">
                    Mobile contact number <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    id="cp-contact"
                    type="tel"
                    inputMode="tel"
                    value={form.contact_no}
                    onChange={setValue("contact_no")}
                    placeholder="09XXXXXXXXX"
                  />
                </div>
              </div>

              <div className="cp-onboard-field">
                <label htmlFor="cp-subjects">
                  Subjects of interest (comma separated)
                </label>
                <input
                  id="cp-subjects"
                  type="text"
                  value={form.subjects.join(", ")}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      subjects: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="e.g. IT 111, IT 112, Web Systems"
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className="cp-onboard-btn-secondary"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  className="cp-onboard-submit"
                  style={{ minWidth: 200 }}
                  disabled={ctx.onboardingSaving}
                >
                  {ctx.onboardingSaving ? "Saving..." : "Complete onboarding"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  function OnboardingRouterPage() {
    const ctx = useContext(AppContext);
    const user = ctx && ctx.user;
    const setActiveTab = ctx && ctx.setActiveTab;

    if (!ctx || !user) return null;

    return (
      <div className="onboarding-container-wrap">
        <OnboardingPreferences
          user={user}
          onComplete={(data) => {
            if (ctx.setUser) {
              ctx.setUser((prev) => ({
                ...(prev || {}),
                ...(data?.user || {}),
                is_onboarded: true,
                is_profile_complete: true,
                mentee_approved: true,
                mentor_approved: true,
              }));
            }
            if (ctx.addToast) {
              ctx.addToast(
                "Matching preferences saved! Welcome to PeerLink.",
                "success",
              );
            }
            if (ctx.loadMe) {
              ctx.loadMe({ force: true });
            }
            if (setActiveTab) {
              setActiveTab("matching");
              if (window.DashboardApp && window.DashboardApp.replaceAppUrl) {
                window.DashboardApp.replaceAppUrl("matching");
              }
            }
          }}
        />
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.onboarding = OnboardingRouterPage;
})();
