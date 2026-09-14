(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;
  const RouteRenderer = window.DashboardApp.RouteRenderer;
  const ErrorBoundary =
    window.DashboardApp.ErrorBoundary ||
    function ErrorBoundaryPassthrough({ children }) {
      return children;
    };
  const LoadingSpinner =
    (window.DashboardApp &&
      window.DashboardApp.Utils &&
      window.DashboardApp.Utils.LoadingSpinner) ||
    function LoadingSpinner() {
      return (
        <div
          className="loading-spinner-spinkit"
          role="status"
          aria-label="Loading"
        >
          ...
        </div>
      );
    };

  function MainContent() {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    const {
      authCheckDone,
      showSignInPrompt,
      activeTab,
      setActiveTab,
    } = ctx;

    useEffect(() => {
      if (authCheckDone) return undefined;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }, [authCheckDone]);

    const isDark =
      (ctx && ctx.theme === "dark") ||
      (typeof document !== "undefined" &&
        document.documentElement.getAttribute("data-theme") === "dark");

    const overlayBg = isDark
      ? "radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.22) 0%, #0c1a30 65%, #081224 100%)"
      : "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f8fafc 100%)";

    return (
      <>
        {!authCheckDone && (
          <div
            className="session-check-overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              background: overlayBg,
            }}
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <style>{`
              .session-check-overlay {
                background: ${overlayBg} !important;
              }
              .session-check-overlay .unified-loading-visual {
                width: 72px !important;
                height: 72px !important;
              }
              .session-check-overlay .unified-loading-ring {
                border: 3px solid ${isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(14, 165, 233, 0.2)"} !important;
                border-top-color: ${isDark ? "#38bdf8" : "#0ea5e9"} !important;
                box-shadow: ${isDark ? "0 0 0 1px rgba(14, 165, 233, 0.25) inset, 0 0 20px rgba(14, 165, 233, 0.45)" : "0 0 0 1px rgba(14, 165, 233, 0.12) inset, 0 0 16px rgba(14, 165, 233, 0.25)"} !important;
              }
              .session-check-overlay .unified-loading-dot {
                width: 8px !important;
                height: 8px !important;
                background: ${isDark ? "#38bdf8" : "#0ea5e9"} !important;
                box-shadow: ${isDark ? "0 0 10px rgba(56, 189, 248, 0.7)" : "0 0 8px rgba(14, 165, 233, 0.5)"} !important;
              }
            `}</style>
            <LoadingSpinner inline />
          </div>
        )}
        {authCheckDone && (
          <>
            {showSignInPrompt && (
              <div className="card auth-warning cta-card">
                <h2 className="page-title">Please sign in</h2>
                <p className="page-subtitle" style={{ marginBottom: 0 }}>
                  You need to log in to access the dashboard.
                </p>
                <div
                  className="btn-row"
                  style={{ marginTop: "16px", justifyContent: "center" }}
                >
                  <button className="btn" onClick={() => setActiveTab("signin")}>
                    Go to sign in
                  </button>
                </div>
              </div>
            )}

            <ErrorBoundary>
              <RouteRenderer activeTab={activeTab} />
            </ErrorBoundary>
          </>
        )}
      </>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.MainContent = MainContent;
})();
