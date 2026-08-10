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

    return (
      <>
        {!authCheckDone && (
          <div
            className="session-check-overlay"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <LoadingSpinner inline />
          </div>
        )}
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
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.MainContent = MainContent;
})();
