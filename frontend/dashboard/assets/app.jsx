const React = window.React;
const ReactDOM = window.ReactDOM;

// Suppress unhandled promise rejections for logout when server is down
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason && typeof event.reason === "object" && event.reason.message && event.reason.message.includes("Failed to fetch")) {
    event.preventDefault();
  }
});

const AppRoot = window.DashboardApp.AppRoot;
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<AppRoot />);
