(function () {
  "use strict";
  const React = window.React;

  const FOOTER =
    (window.DashboardApp && window.DashboardApp.FOOTER) || {
      unitName: "Bukidnon State University — Academic Mentoring Unit",
      shortName: "Bukidnon State University — AMU",
      tagline:
        "Helping students succeed through mentoring, peer support, and faculty consultations.",
      address: "Main Campus, Fortich Street, Malaybalay City, Bukidnon",
      email: "amu@buksu.edu.ph",
      phone: "(088) 813-5661 to 5663",
      fax: "(088) 813-2717",
      websiteUrl: "https://www.buksu.edu.ph",
      websiteLabel: "www.buksu.edu.ph",
      facebookUrl: "https://www.facebook.com/buksuAMU",
      facebookLabel: "Facebook",
    };

  const LOGO_URL =
    (window.DashboardApp && window.DashboardApp.LOGO_URL) ||
    "/static/assets/logo.png";
  const LOGO_ALT =
    (window.DashboardApp && window.DashboardApp.LOGO_ALT) || "AMU Mentoring";

  function AmuFooter({ compact = false, className = "" }) {
    const year = new Date().getFullYear();

    if (compact) {
      return (
        <footer
          className={"amu-site-footer amu-site-footer--compact " + className}
          role="contentinfo"
        >
          <p className="amu-site-footer-unit">{FOOTER.shortName || FOOTER.unitName}</p>
          <p className="amu-site-footer-links">
            <a href={FOOTER.facebookUrl} target="_blank" rel="noopener noreferrer">
              {FOOTER.facebookLabel}
            </a>
            <span aria-hidden="true"> · </span>
            <a href={"mailto:" + FOOTER.email}>{FOOTER.email}</a>
          </p>
        </footer>
      );
    }

    return (
      <footer
        className={"amu-site-footer amu-site-footer--mini " + className}
        role="contentinfo"
      >
        <div className="amu-site-footer-mini-grid">
          <div className="amu-site-footer-mini-brand">
            <img
              src={LOGO_URL}
              alt={LOGO_ALT}
              className="amu-site-footer-logo"
              width="72"
              height="32"
            />
            <div>
              <p className="amu-site-footer-mini-title">
                {FOOTER.shortName || FOOTER.unitName}
              </p>
              <p className="amu-site-footer-mini-tagline">{FOOTER.tagline}</p>
            </div>
          </div>

          <div className="amu-site-footer-mini-col">
            <p className="amu-site-footer-mini-label">Contact</p>
            <ul className="amu-site-footer-mini-list">
              <li>{FOOTER.address}</li>
              <li>
                <a href={"mailto:" + FOOTER.email}>{FOOTER.email}</a>
              </li>
              <li>
                Tel {FOOTER.phone}
                <span className="amu-site-footer-mini-sep" aria-hidden="true">
                  {" "}
                  ·{" "}
                </span>
                Fax {FOOTER.fax}
              </li>
            </ul>
          </div>

          <div className="amu-site-footer-mini-col">
            <p className="amu-site-footer-mini-label">Links</p>
            <ul className="amu-site-footer-mini-list amu-site-footer-mini-list--inline">
              <li>
                <a
                  href={FOOTER.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {FOOTER.websiteLabel}
                </a>
              </li>
              <li>
                <a
                  href={FOOTER.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {FOOTER.facebookLabel}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="amu-site-footer-mini-copy">
          © {year} Bukidnon State University — Academic Mentoring Unit
        </p>
      </footer>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.AmuFooter = AmuFooter;
})();
