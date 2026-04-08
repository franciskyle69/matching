(function () {
  "use strict";
  const React = window.React;
  const { useContext } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function DetailRow({ label, value }) {
    if (value == null || value === "") return null;
    return <div className="approval-detail-row"><span className="approval-detail-label">{label}</span><span className="approval-detail-value">{Array.isArray(value) ? value.join(", ") : String(value)}</span></div>;
  }

  function MentorCard({ m, loading, onApprove, onReject, Spinner }) {
    const displayName = m.display_name || m.full_name || m.username;
    return (
      <div className="approval-card">
        <div className="approval-card-header">
          <span className="approval-card-title">
            {displayName}
            {m.general_info_complete && <span className="approval-badge-complete">Info complete</span>}
          </span>
          <div className="btn-row">
            {loading ? (
              <Spinner inline />
            ) : (
              <>
                <button type="button" className="btn small" onClick={() => onApprove(m.id)}>Accept</button>
                <button type="button" className="btn secondary small danger" onClick={() => onReject(m.id)}>Reject</button>
              </>
            )}
          </div>
        </div>
        <div className="approval-card-body">
          <DetailRow label="Email" value={m.email} />
          <DetailRow label="Program" value={m.program} />
          <DetailRow label="Year level" value={m.year_level} />
          <DetailRow label="Role" value={m.role} />
          <DetailRow label="Subjects" value={m.subjects?.length ? m.subjects : null} />
          <DetailRow label="Topics" value={m.topics?.length ? m.topics : null} />
          <DetailRow label="Expertise level" value={m.expertise_level} />
          <DetailRow label="Interests" value={m.interests} />
        </div>
      </div>
    );
  }

  function MenteeCard({ m, loading, onApprove, onReject, Spinner }) {
    const displayName = m.display_name || m.full_name || m.username;
    return (
      <div className="approval-card">
        <div className="approval-card-header">
          <span className="approval-card-title">
            {displayName}
            {m.general_info_complete && <span className="approval-badge-complete">Info complete</span>}
          </span>
          <div className="btn-row">
            {loading ? (
              <Spinner inline />
            ) : (
              <>
                <button type="button" className="btn small" onClick={() => onApprove(m.id)}>Accept</button>
                <button type="button" className="btn secondary small danger" onClick={() => onReject(m.id)}>Reject</button>
              </>
            )}
          </div>
        </div>
        <div className="approval-card-body">
          <DetailRow label="Email" value={m.email} />
          <DetailRow label="Program" value={m.program} />
          <DetailRow label="Year level" value={m.year_level} />
          <DetailRow label="Campus" value={m.campus} />
          <DetailRow label="Student ID" value={m.student_id_no} />
          <DetailRow label="Contact" value={m.contact_no} />
          <DetailRow label="Admission type" value={m.admission_type} />
          <DetailRow label="Subjects" value={m.subjects?.length ? m.subjects : null} />
          <DetailRow label="Topics" value={m.topics?.length ? m.topics : null} />
          <DetailRow label="Interests" value={m.interests} />
        </div>
      </div>
    );
  }

  function ApprovalsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      user,
      approvalsLoading,
      approvalActionKey,
      pendingMentors,
      pendingMentees,
      handleApproveMentor,
      handleRejectMentor,
      handleApproveMentee,
      handleRejectMentee,
    } = ctx;
    const Spinner = LoadingSpinner;
    const mentorCardLoading = (id) => approvalActionKey === "mentor:" + id;
    const menteeCardLoading = (id) => approvalActionKey === "mentee:" + id;
    if (!user.is_staff) return <div className="card"><div className="staff-only-msg">This page is for staff only.</div></div>;

    return (
      <div className="card">
        <h1 className="page-title">Approve users</h1>
        <p className="page-subtitle">Review and accept or reject pending mentor and mentee accounts.</p>
        {approvalsLoading && <Spinner title="Loading approvals…" subtitle="Fetching pending users" />}
        {!approvalsLoading && (
          <div className="approvals-grid">
            <section className="approvals-section">
              <h2 className="section-title">Pending mentors ({pendingMentors.length})</h2>
              {pendingMentors.length === 0 && <p className="muted">No pending mentors.</p>}
              {pendingMentors.length > 0 && pendingMentors.map((m) => <MentorCard key={m.id} m={m} loading={mentorCardLoading(m.id)} onApprove={handleApproveMentor} onReject={handleRejectMentor} Spinner={Spinner} />)}
            </section>
            <section className="approvals-section">
              <h2 className="section-title">Pending mentees ({pendingMentees.length})</h2>
              {pendingMentees.length === 0 && <p className="muted">No pending mentees.</p>}
              {pendingMentees.length > 0 && pendingMentees.map((m) => <MenteeCard key={m.id} m={m} loading={menteeCardLoading(m.id)} onApprove={handleApproveMentee} onReject={handleRejectMentee} Spinner={Spinner} />)}
            </section>
          </div>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.approvals = ApprovalsPage;
})();
