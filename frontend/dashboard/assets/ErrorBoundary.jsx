(function () {
  "use strict";
  const React = window.React;

  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      if (typeof console !== "undefined" && console.error) {
        console.error("ErrorBoundary caught:", error, errorInfo);
      }
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="card error-boundary-fallback">
            <h2 className="page-title">Something went wrong</h2>
            <p className="page-subtitle">
              This page encountered an error. Try refreshing or going back to the dashboard.
            </p>
            <div className="btn-row" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="btn"
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try again
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => window.location.assign(window.location.pathname + "#home")}
              >
                Go to dashboard
              </button>
            </div>
          </div>
        );
      }
      return this.props.children;
    }
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.ErrorBoundary = ErrorBoundary;
})();
