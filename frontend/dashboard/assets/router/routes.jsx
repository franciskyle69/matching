(function () {
  "use strict";
  const React = window.React;
  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};

  const STAFF_TABS = ["users", "approvals", "backup", "activity-logs"];

  function RouteRenderer({ activeTab }) {
    const ctx = React.useContext(window.DashboardApp.AppContext);
    const user = ctx?.user;
    const isStaff = !!(user?.is_staff || user?.role === "staff");

    // Guard: Staff-only routes
    if (STAFF_TABS.includes(activeTab) && !isStaff) {
      return (
        <div className="card cta-card page-shell" style={{ textAlign: "center", padding: "48px 24px", maxWidth: "560px", margin: "40px auto" }}>
          <div style={{ fontSize: "42px", marginBottom: "14px" }} role="img" aria-label="Restricted">🔒</div>
          <h2 className="page-title" style={{ fontSize: "1.5rem" }}>Access Restricted</h2>
          <p className="page-subtitle" style={{ maxWidth: "420px", margin: "0 auto 20px" }}>
            This section is restricted to Coordinator and Administrator accounts. Please navigate using the available menu options.
          </p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (typeof ctx?.setActiveTab === "function") {
                  ctx.setActiveTab("home");
                } else {
                  window.location.hash = "home";
                }
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    const Page = window.DashboardApp.Pages[activeTab];
    if (!Page) {
      return (
        <div className="card cta-card page-shell" style={{ textAlign: "center", padding: "48px 24px", maxWidth: "560px", margin: "40px auto" }}>
          <div style={{ fontSize: "42px", marginBottom: "14px" }} role="img" aria-label="Not Found">🔍</div>
          <h2 className="page-title" style={{ fontSize: "1.5rem" }}>Section Not Found</h2>
          <p className="page-subtitle" style={{ maxWidth: "420px", margin: "0 auto 20px" }}>
            The requested page does not exist or has been moved.
          </p>
          <div className="btn-row" style={{ justifyContent: "center" }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (typeof ctx?.setActiveTab === "function") {
                  ctx.setActiveTab("home");
                } else {
                  window.location.hash = "home";
                }
              }}
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return <Page />;
  }

  window.DashboardApp.RouteRenderer = RouteRenderer;
  window.DashboardApp.MAIN_TABS = window.DashboardApp.MAIN_TABS || [];
})();
