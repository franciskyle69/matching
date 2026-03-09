(function () {
  "use strict";
  const React = window.React;
  const AppProviders = window.DashboardApp.AppProviders;

  function AppRoot() {
    return <AppProviders />;
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.AppRoot = AppRoot;
})();
