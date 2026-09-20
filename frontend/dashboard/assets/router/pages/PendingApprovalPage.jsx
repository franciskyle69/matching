(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState } = React;
  const AppContext = window.DashboardApp.AppContext;

  function PendingApprovalPage() {
    const ctx = useContext(AppContext);
    const user = ctx && ctx.user;
    const handleLogout = ctx && ctx.handleLogout;
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const isRejected = user?.approval_status === "REJECTED" || (ctx && ctx.activeTab === "account-rejected");

    const displayName =
      (user && (user.full_name || user.display_name || [user.first_name, user.last_name].filter(Boolean).join(" "))) ||
      user?.email ||
      "Student Mentee";

    const roleLabel =
      user?.role === "mentor"
        ? "Mentor Candidate"
        : user?.role === "instructor_mentor"
        ? "Faculty Mentor"
        : "Student Mentee";

    return (
      <div className="pending-approval-page page-shell" style={{ maxWidth: 840, margin: "0 auto", padding: "2rem 1rem" }}>
        <div
          className="matching-card"
          style={{
            textAlign: "center",
            padding: "3.5rem 2rem",
            borderRadius: "24px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top Status Tag */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              borderRadius: "999px",
              backgroundColor: isRejected ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
              border: isRejected ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
              marginBottom: "1.5rem",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: isRejected ? "#EF4444" : "#F59E0B",
                display: "inline-block",
                boxShadow: isRejected ? "0 0 8px #EF4444" : "0 0 8px #F59E0B",
              }}
            />
            <span
              style={{
                color: isRejected ? "#DC2626" : "#D97706",
                fontWeight: 700,
                fontSize: "0.85rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {isRejected ? "Account Application Rejected" : "Account Under Review"}
            </span>
          </div>

          {/* Hero Icon */}
          <div
            style={{
              width: 80,
              height: 80,
              margin: "0 auto 1.5rem auto",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isRejected
                ? "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.08))"
                : "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.08))",
              boxShadow: "inset 2px 2px 5px rgba(255,255,255,0.2), inset -2px -2px 5px rgba(0,0,0,0.2)",
            }}
          >
            {isRejected ? (
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : (
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            )}
          </div>

          <h2 style={{ fontSize: "1.85rem", fontWeight: 800, marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
            {isRejected ? "Account Application Not Approved" : "Account Pending Coordinator Approval"}
          </h2>

          <p
            style={{
              fontSize: "1.05rem",
              lineHeight: 1.6,
              maxWidth: 620,
              margin: "0 auto 2.5rem auto",
              opacity: 0.85,
            }}
          >
            {isRejected
              ? "Your registration credentials and preferences were reviewed and not approved by the Academic Mentoring Unit Coordinator. Please contact AMU administration if you believe this was in error."
              : "Thank you for completing onboarding! Your institutional credentials and preferences are currently being reviewed by an Academic Mentoring Unit Coordinator. You will gain full access once approved."}
          </p>

          {/* Quick Details Pill Row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              justifyContent: "center",
              marginBottom: "2.5rem",
            }}
          >
            <div style={{ padding: "0.75rem 1.25rem", borderRadius: "14px", backgroundColor: "rgba(0,0,0,0.03)", border: "1px solid rgba(148, 163, 184, 0.15)", textAlign: "left" }}>
              <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Candidate</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{displayName}</div>
            </div>
            <div style={{ padding: "0.75rem 1.25rem", borderRadius: "14px", backgroundColor: "rgba(0,0,0,0.03)", border: "1px solid rgba(148, 163, 184, 0.15)", textAlign: "left" }}>
              <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Role Track</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{roleLabel}</div>
            </div>
            <div style={{ padding: "0.75rem 1.25rem", borderRadius: "14px", backgroundColor: "rgba(0,0,0,0.03)", border: "1px solid rgba(148, 163, 184, 0.15)", textAlign: "left" }}>
              <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Student ID</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.student_id_no || "Registered"}</div>
            </div>
            <div style={{ padding: "0.75rem 1.25rem", borderRadius: "14px", backgroundColor: "rgba(0,0,0,0.03)", border: "1px solid rgba(148, 163, 184, 0.15)", textAlign: "left" }}>
              <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Campus & Department</div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>BukSU Main • BSIT</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setProfileModalOpen(true)}
              style={{ minWidth: 180, fontWeight: 700 }}
            >
              View Submitted Profile
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={handleLogout}
              style={{ minWidth: 140, fontWeight: 600 }}
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Read-Only Profile Modal */}
        {profileModalOpen && (
          <div
            className="modal-overlay"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "1rem",
            }}
            onClick={() => setProfileModalOpen(false)}
          >
            <div
              className="matching-card"
              style={{
                width: "100%",
                maxWidth: 540,
                maxHeight: "85vh",
                overflowY: "auto",
                borderRadius: "20px",
                padding: "2rem",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>
                  Submitted Profile Summary
                </h3>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setProfileModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "left" }}>
                <div style={{ padding: "1rem", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Full Name</div>
                  <div style={{ fontSize: "1rem", fontWeight: 700 }}>{displayName}</div>
                </div>

                <div style={{ padding: "1rem", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Institutional Email</div>
                  <div style={{ fontSize: "1rem", fontWeight: 700 }}>{user?.email || "—"}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={{ padding: "1rem", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Student ID No.</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.student_id_no || "—"}</div>
                  </div>

                  <div style={{ padding: "1rem", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Contact No.</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.contact_no || "—"}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={{ padding: "1rem", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Admission Type</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.admission_type || "Regular"}</div>
                  </div>

                  <div style={{ padding: "1rem", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.03)" }}>
                    <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Biological Sex</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.sex ? user.sex.toUpperCase() : "—"}</div>
                  </div>
                </div>

                <div style={{ padding: "1rem", borderRadius: "12px", backgroundColor: "rgba(0,0,0,0.03)" }}>
                  <div style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 600 }}>Academic Affiliation</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>BukSU Main Campus • BSIT Department</div>
                </div>
              </div>

              <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn primary small"
                  onClick={() => setProfileModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["pending-approval"] = PendingApprovalPage;
  window.DashboardApp.Pages["account-pending"] = PendingApprovalPage;
  window.DashboardApp.Pages["account-rejected"] = PendingApprovalPage;
})();
