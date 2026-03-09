(function () {
  "use strict";
  const React = window.React;
  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};

  function RouteRenderer({ activeTab }) {
    const Page = window.DashboardApp.Pages[activeTab];
    return Page ? <Page /> : null;
  }

  window.DashboardApp.RouteRenderer = RouteRenderer;
  window.DashboardApp.MAIN_TABS = window.DashboardApp.MAIN_TABS || [];
})();
