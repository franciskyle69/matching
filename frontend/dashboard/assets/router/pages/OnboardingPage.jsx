(function () {
  "use strict";
  const React = window.React;
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
          {isMentor
            ? "Set up how you mentor"
            : "Set up how you want to learn"}
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
              <li>Pick subjects, topics, and competencies you need help with</li>
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

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.onboarding = OnboardingPage;
})();
