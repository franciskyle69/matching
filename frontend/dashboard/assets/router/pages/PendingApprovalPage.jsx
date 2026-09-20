(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const fetchJSON =
    (window.DashboardApp && window.DashboardApp.Utils && window.DashboardApp.Utils.fetchJSON) ||
    (async (url, opts) => {
      const res = await fetch(url, opts);
      return { ok: res.ok, status: res.status, data: await res.json() };
    });

  // Celebratory gentle chime using Web Audio API (zero external assets)
  function playCelebrationChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const actx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, actx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0, actx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, actx.currentTime + i * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + i * 0.12 + 0.6);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(actx.currentTime + i * 0.12);
        osc.stop(actx.currentTime + i * 0.12 + 0.7);
      });
    } catch (_) {}
  }

  // Pure Canvas Confetti Engine (60 FPS, zero dependencies)
  function launchConfetti(canvas) {
    if (!canvas) return () => {};
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const colors = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F43F5E"];
    const particles = [];
    const particleCount = 130;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: width * 0.5 + (Math.random() * 200 - 100),
        y: height * 0.45 + (Math.random() * 100 - 50),
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.75) * 20 - 4,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 14,
        tilt: Math.random() * 10,
        tiltSpeed: Math.random() * 0.1 + 0.05,
        shape: Math.random() > 0.4 ? "rect" : Math.random() > 0.5 ? "circle" : "star",
        opacity: 1,
      });
    }

    let animationFrameId;
    let startTime = performance.now();

    function render(currentTime) {
      const elapsed = currentTime - startTime;
      ctx.clearRect(0, 0, width, height);

      let activeParticles = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // gravity
        p.vx *= 0.985; // air drag
        p.rotation += p.rotationSpeed;
        p.tilt += p.tiltSpeed;

        if (elapsed > 3500) {
          p.opacity -= 0.015;
        }

        if (p.opacity > 0 && p.y < height + 50) {
          activeParticles++;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;

          if (p.shape === "rect") {
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          } else if (p.shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            for (let s = 0; s < 5; s++) {
              ctx.lineTo(Math.cos(((18 + s * 72) * Math.PI) / 180) * p.size, -Math.sin(((18 + s * 72) * Math.PI) / 180) * p.size);
              ctx.lineTo(Math.cos(((54 + s * 72) * Math.PI) / 180) * (p.size / 2), -Math.sin(((54 + s * 72) * Math.PI) / 180) * (p.size / 2));
            }
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (activeParticles > 0 && elapsed < 6000) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, width, height);
        window.removeEventListener("resize", onResize);
      }
    }

    animationFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
    };
  }

  function PendingApprovalPage() {
    const ctx = useContext(AppContext);
    const user = ctx && ctx.user;
    const handleLogout = ctx && ctx.handleLogout;
    const setActiveTab = ctx && ctx.setActiveTab;
    const loadMe = ctx && ctx.loadMe;
    const setUser = ctx && ctx.setUser;

    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [lastCheckedTime, setLastCheckedTime] = useState(null);

    const isRejected = user?.approval_status === "REJECTED" || (ctx && ctx.activeTab === "account-rejected");
    const isInitiallyApproved =
      !isRejected &&
      user &&
      (user.approval_status === "ACTIVE" ||
        (user.role === "mentor" && user.mentor_approved === true) ||
        (user.role === "mentee" && user.mentee_approved === true));

    const [isApproved, setIsApproved] = useState(Boolean(isInitiallyApproved));
    const [showCelebration, setShowCelebration] = useState(Boolean(isInitiallyApproved));
    const canvasRef = useRef(null);

    const displayName =
      (user && (user.full_name || user.display_name || [user.first_name, user.last_name].filter(Boolean).join(" "))) ||
      user?.email ||
      "Student Mentee";

    const roleLabel =
      user?.role === "mentor"
        ? "Student Mentor"
        : user?.role === "instructor_mentor"
        ? "Faculty Mentor"
        : "Student Mentee";

    const partnerRole = user?.role === "mentor" ? "mentees" : "mentors";

    // Trigger celebration & confetti
    const triggerCelebration = () => {
      setIsApproved(true);
      setShowCelebration(true);
      playCelebrationChime();
      if (canvasRef.current) {
        launchConfetti(canvasRef.current);
      }
    };

    // If user is already approved on initial render, trigger celebration
    useEffect(() => {
      if (isInitiallyApproved) {
        triggerCelebration();
      }
    }, []);

    // Live Automatic Polling for Coordinator Approval (every 3.5 seconds)
    useEffect(() => {
      if (isApproved || isRejected) return;

      let isMounted = true;
      const pollApprovalStatus = async () => {
        try {
          const res = await fetchJSON("/api/me/?force=1");
          if (!isMounted) return;
          setLastCheckedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

          if (res && res.ok && res.data) {
            const updatedUser = res.data;
            const nowApproved =
              updatedUser.approval_status === "ACTIVE" ||
              (updatedUser.role === "mentor" && updatedUser.mentor_approved === true) ||
              (updatedUser.role === "mentee" && updatedUser.mentee_approved === true);

            if (nowApproved) {
              if (setUser) setUser(updatedUser);
              triggerCelebration();
            }
          }
        } catch (_) {}
      };

      const intervalId = setInterval(pollApprovalStatus, 3500);
      return () => {
        isMounted = false;
        clearInterval(intervalId);
      };
    }, [isApproved, isRejected, setUser]);

    // Manual check status handler
    const handleManualCheck = async () => {
      setCheckingStatus(true);
      try {
        if (loadMe) {
          const fresh = await loadMe({ force: true });
          if (fresh && (fresh.approval_status === "ACTIVE" || fresh.mentor_approved || fresh.mentee_approved)) {
            triggerCelebration();
          }
        } else {
          const res = await fetchJSON("/api/me/?force=1");
          if (res && res.ok && res.data) {
            if (setUser) setUser(res.data);
            if (res.data.approval_status === "ACTIVE" || res.data.mentor_approved || res.data.mentee_approved) {
              triggerCelebration();
            }
          }
        }
        setLastCheckedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      } catch (_) {
      } finally {
        setTimeout(() => setCheckingStatus(false), 500);
      }
    };

    // Proceed to dashboard
    const handleEnterDashboard = () => {
      const targetTab = user?.role === "mentor" ? "home" : "matching";
      if (setActiveTab) {
        setActiveTab(targetTab);
      }
      try {
        window.location.hash = targetTab;
      } catch (_) {}
    };

    return (
      <div className="pending-approval-page page-shell neu-approval-shell">
        {/* Confetti Overlay Canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: 999999,
          }}
        />

        {showCelebration || isApproved ? (
          /* ═══════════════════════════════════════════════════════════════
             NEUMORPHIC CELEBRATION CARD (AFTER APPROVAL)
             ═══════════════════════════════════════════════════════════════ */
          <div className="neu-card-surface neu-celebrate-card">
            {/* Top Sparkle Pill */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div className="neu-sparkle-badge">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  <path d="M5 3v4" />
                  <path d="M19 17v4" />
                  <path d="M3 5h4" />
                  <path d="M17 19h4" />
                </svg>
                <span>Account Approved & Active</span>
              </div>
            </div>

            {/* Convex Trophy Emblem */}
            <div className="neu-convex-emblem neu-trophy-float" style={{ borderColor: "rgba(16, 185, 129, 0.4)" }}>
              <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            </div>

            <h2 style={{ fontSize: "2.1rem", fontWeight: 800, marginBottom: "0.75rem", letterSpacing: "-0.03em" }}>
              Congratulations, {displayName}!
            </h2>

            <p style={{ fontSize: "1.1rem", lineHeight: 1.6, maxWidth: 620, margin: "0 auto 2.25rem auto", opacity: 0.85 }}>
              Your account has been officially approved by the Academic Mentoring Unit Coordinator. You now have full access to PeerLink as an active <strong>{roleLabel}</strong>.
            </p>

            {/* Neumorphic Unlocked Feature Grid with Aligned Icons */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "2.5rem" }}>
              <div className="neu-detail-tile" style={{ textAlign: "center", padding: "1.5rem 1.25rem" }}>
                <div className="neu-feature-icon-wrapper neu-icon-matching">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.22 19.85c-.18.18-.5.21-.71 0-.18-.18-.21-.5 0-.71l3.39-3.39-1.41-1.41-3.39 3.39c-.19.2-.51.19-.71 0-.21-.21-.18-.53 0-.71l3.39-3.39-1.41-1.41-3.39 3.39c-.18.18-.5.21-.71 0-.19-.19-.19-.51 0-.71l3.39-3.39-1.42-1.41-3.39 3.39c-.18.18-.5.21-.71 0-.19-.2-.19-.51 0-.71L9.52 8.4l1.87 1.86c.95.95 2.59.94 3.54 0 .98-.98.98-2.56 0-3.54l-1.86-1.86.28-.28c.78-.78 2.05-.78 2.83 0l4.24 4.24c.78.78.78 2.05 0 2.83zm9.61-6.78c1.56-1.56 1.56-4.09 0-5.66l-4.24-4.24c-1.56-1.56-4.09-1.56-5.66 0l-.28.28-.28-.28c-1.56-1.56-4.09-1.56-5.66 0L2.17 6.71C.75 8.13.62 10.34 1.77 11.9l1.45-1.45c-.39-.75-.26-1.7.37-2.33l3.54-3.54c.78-.78 2.05-.78 2.83 0l3.56 3.56c.18.18.21.5 0 .71s-.53.18-.71 0L9.52 5.57l-5.8 5.79c-.98.97-.98 2.56 0 3.54.39.39.89.63 1.42.7.07.52.3 1.02.7 1.42s.9.63 1.42.7c.07.52.3 1.02.7 1.42s.9.63 1.42.7c.07.54.31 1.03.7 1.42.47.47 1.1.73 1.77.73s1.3-.26 1.77-.73z" />
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "0.35rem" }}>Smart Matching</div>
                <div style={{ fontSize: "0.84rem", opacity: 0.75, lineHeight: 1.45 }}>
                  Connect with compatible {partnerRole} tailored to your academic needs.
                </div>
              </div>

              <div className="neu-detail-tile" style={{ textAlign: "center", padding: "1.5rem 1.25rem" }}>
                <div className="neu-feature-icon-wrapper neu-icon-messaging">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    <circle cx="8" cy="11.5" r="1" fill="currentColor" strokeWidth="0" />
                    <circle cx="12" cy="11.5" r="1" fill="currentColor" strokeWidth="0" />
                    <circle cx="16" cy="11.5" r="1" fill="currentColor" strokeWidth="0" />
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "0.35rem" }}>Direct Messaging</div>
                <div style={{ fontSize: "0.84rem", opacity: 0.75, lineHeight: 1.45 }}>
                  Seamlessly collaborate and communicate with your peer partners.
                </div>
              </div>

              <div className="neu-detail-tile" style={{ textAlign: "center", padding: "1.5rem 1.25rem" }}>
                <div className="neu-feature-icon-wrapper neu-icon-booking">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <path d="m9 16 2 2 4-4" strokeWidth="2.2" />
                  </svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "0.35rem" }}>Session Bookings</div>
                <div style={{ fontSize: "0.84rem", opacity: 0.75, lineHeight: 1.45 }}>
                  Schedule, log, and attend structured mentoring sessions.
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="neu-btn neu-btn-primary"
                onClick={handleEnterDashboard}
                style={{ minWidth: 230, fontSize: "1.05rem", padding: "0.95rem 2.25rem", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
              >
                <span>Enter Dashboard</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════════════
             NEUMORPHIC PENDING APPROVAL CARD (WHILE UNDER REVIEW)
             ═══════════════════════════════════════════════════════════════ */
          <div className="neu-card-surface">
            {/* Top Status Tag */}
            <div style={{ marginBottom: "1.75rem" }}>
              <div className="neu-recessed-well">
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    backgroundColor: isRejected ? "#EF4444" : "#F59E0B",
                    display: "inline-block",
                    boxShadow: isRejected ? "0 0 10px #EF4444" : "0 0 10px #F59E0B",
                  }}
                />
                <span style={{ color: isRejected ? "#DC2626" : "#D97706" }}>
                  {isRejected ? "Account Application Rejected" : "Account Under Review"}
                </span>
              </div>
            </div>

            {/* Hero Emblem */}
            <div className="neu-convex-emblem">
              {isRejected ? (
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              ) : (
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              )}
            </div>

            <h2 style={{ fontSize: "1.95rem", fontWeight: 800, marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
              {isRejected ? "Account Application Not Approved" : "Account Pending Coordinator Approval"}
            </h2>

            <p style={{ fontSize: "1.05rem", lineHeight: 1.6, maxWidth: 620, margin: "0 auto 2.25rem auto", opacity: 0.85 }}>
              {isRejected
                ? "Your registration credentials and preferences were reviewed and not approved by the Academic Mentoring Unit Coordinator. Please contact AMU administration if you believe this was in error."
                : "Thank you for completing onboarding! Your institutional credentials and preferences are currently being reviewed by an Academic Mentoring Unit Coordinator. You will automatically gain full access once approved."}
            </p>

            {/* Neumorphic Quick Details Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2.25rem" }}>
              <div className="neu-detail-tile">
                <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                  Candidate
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{displayName}</div>
              </div>

              <div className="neu-detail-tile">
                <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                  Role Track
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{roleLabel}</div>
              </div>

              <div className="neu-detail-tile">
                <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                  Student ID
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.student_id_no || "Registered"}</div>
              </div>

              <div className="neu-detail-tile">
                <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                  Affiliation
                </div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>BukSU Main • BSIT</div>
              </div>
            </div>

            {/* Live Polling Radar Indicator */}
            {!isRejected && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
                <div className="neu-live-radar">
                  <span className="neu-radar-dot" />
                  <span>
                    Auto-checking approval status {lastCheckedTime ? `(Last checked ${lastCheckedTime})` : "live"}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              {!isRejected && (
                <button
                  type="button"
                  className="neu-btn neu-btn-primary"
                  onClick={handleManualCheck}
                  disabled={checkingStatus}
                  style={{ minWidth: 160 }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className={checkingStatus ? "neu-spin" : ""}
                  >
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                  <span>{checkingStatus ? "Checking..." : "Check Status"}</span>
                </button>
              )}

              <button
                type="button"
                className="neu-btn neu-btn-secondary"
                onClick={() => setProfileModalOpen(true)}
                style={{ minWidth: 180 }}
              >
                View Submitted Profile
              </button>

              <button
                type="button"
                className="neu-btn neu-btn-secondary"
                onClick={handleLogout}
                style={{ minWidth: 130 }}
              >
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* Read-Only Profile Modal with Neumorphic Styling */}
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
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "1rem",
            }}
            onClick={() => setProfileModalOpen(false)}
          >
            <div
              className="neu-card-surface"
              style={{
                width: "100%",
                maxWidth: 560,
                maxHeight: "88vh",
                overflowY: "auto",
                borderRadius: "24px",
                padding: "2.25rem",
                textAlign: "left",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
                <h3 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0 }}>
                  Submitted Profile Summary
                </h3>
                <button
                  type="button"
                  className="neu-btn neu-btn-secondary"
                  onClick={() => setProfileModalOpen(false)}
                  style={{ padding: "6px 12px", minWidth: "auto", fontSize: "0.9rem" }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="neu-detail-tile">
                  <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>
                    Full Name
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700 }}>{displayName}</div>
                </div>

                <div className="neu-detail-tile">
                  <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>
                    Institutional Email
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700 }}>{user?.email || "—"}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="neu-detail-tile">
                    <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>
                      Student ID No.
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.student_id_no || "—"}</div>
                  </div>

                  <div className="neu-detail-tile">
                    <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>
                      Contact No.
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.contact_no || "—"}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="neu-detail-tile">
                    <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>
                      Admission Type
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.admission_type || "Regular"}</div>
                  </div>

                  <div className="neu-detail-tile">
                    <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>
                      Biological Sex
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{user?.sex ? user.sex.toUpperCase() : "—"}</div>
                  </div>
                </div>

                <div className="neu-detail-tile">
                  <div style={{ fontSize: "0.72rem", opacity: 0.65, fontWeight: 700, textTransform: "uppercase", marginBottom: "4px" }}>
                    Academic Affiliation
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>BukSU Main Campus • BSIT Department</div>
                </div>
              </div>

              <div style={{ marginTop: "2.25rem", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="neu-btn neu-btn-primary"
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
