(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatDate, LoadingSpinner } = Utils;

  const CommentThread = window.DashboardApp.CommentThread || function CommentThreadPlaceholder() { return null; };

  function formatMinutesAsHours(min) {
    const m = Number(min) || 0;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return mins > 0 ? `${h}h ${mins}min` : `${h}h`;
  }

  function MeetingNotesBlock({ session, onSave }) {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(session.meeting_notes || "");
    const [saving, setSaving] = useState(false);
    const Spinner = Utils.LoadingSpinner;
    async function handleSave() {
      setSaving(true);
      try {
        await onSave(session.id, editValue);
        setEditing(false);
      } finally {
        setSaving(false);
      }
    }
    return (
      <div className="session-meeting-notes">
        <label className="session-meeting-notes-label">Meeting notes</label>
        {!editing ? (
          <div className="session-meeting-notes-display">
            <p className="session-meeting-notes-text">{session.meeting_notes || "No notes yet."}</p>
            <button type="button" className="btn secondary small" onClick={() => { setEditValue(session.meeting_notes || ""); setEditing(true); }}>Edit</button>
          </div>
        ) : (
          <div className="session-meeting-notes-edit">
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Take meeting notes…" rows={3} />
            <div className="btn-row" style={{ marginTop: "8px" }}>
              <button type="button" className="btn small" onClick={handleSave} disabled={saving}>{saving ? <span className="loading-inline"><Spinner inline /> Saving…</span> : "Save"}</button>
              <button type="button" className="btn secondary small" onClick={() => { setEditing(false); setEditValue(session.meeting_notes || ""); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function SessionCardWithReschedule({ session, isMentor, rescheduleId, rescheduleForm, setRescheduleForm, setRescheduleId, options, topicsBySubject, handleReschedule, handleStatusUpdate, handleUpdateMeetingNotes, commentsByKey, commentKey, loadComments, addComment }) {
    const showReschedule = rescheduleId === session.id;
    return (
      <div className="session-card" key={session.id}>
        <div className="session-card-header">
          <div className="session-card-main">
            <p className="session-card-title">{session.mentee_username} with {session.mentor_username}</p>
            <p className="session-card-meta">{formatDate(session.scheduled_at)}</p>
            <p className="session-card-subject">
              {session.subject || "No subject"}
              {session.topic ? " · " + session.topic : ""}
              {(session.duration_minutes || 0) > 0 ? " · " + session.duration_minutes + " min" : ""}
            </p>
            {session.notes && <div className="session-card-notes">{session.notes}</div>}
          </div>
          <span className={"status-pill " + session.status}>{session.status}</span>
        </div>
        {isMentor && (
          <div className="session-card-actions">
            <button className="btn secondary small" onClick={() => { setRescheduleId(session.id); setRescheduleForm({ subject_id: session.subject_id || "", topic_id: session.topic_id || "", scheduled_at: session.scheduled_at ? session.scheduled_at.slice(0, 16) : "", duration_minutes: session.duration_minutes || 60, notes: session.notes || "" }); }}>Reschedule</button>
            <button className="btn small" onClick={() => handleStatusUpdate(session.id, "completed")}>Mark completed</button>
            <button className="btn danger small" onClick={() => handleStatusUpdate(session.id, "cancelled")}>Cancel session</button>
          </div>
        )}
        {showReschedule && (
          <div className="session-reschedule-panel">
            <h3>Change date or details</h3>
            <div className="form-grid">
              <div><label>Subject</label><select value={rescheduleForm.subject_id} onChange={(e) => setRescheduleForm({ ...rescheduleForm, subject_id: e.target.value, topic_id: "" })}><option value="">Select subject</option>{(options.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label>Topic</label><select value={rescheduleForm.topic_id} onChange={(e) => setRescheduleForm({ ...rescheduleForm, topic_id: e.target.value })}><option value="">Select topic</option>{(topicsBySubject[rescheduleForm.subject_id] || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label>Date & time</label><input type="datetime-local" value={rescheduleForm.scheduled_at} onChange={(e) => setRescheduleForm({ ...rescheduleForm, scheduled_at: e.target.value })} /></div>
              <div><label>Duration</label><input type="number" min="15" step="15" value={rescheduleForm.duration_minutes} onChange={(e) => setRescheduleForm({ ...rescheduleForm, duration_minutes: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Notes</label><textarea value={rescheduleForm.notes} onChange={(e) => setRescheduleForm({ ...rescheduleForm, notes: e.target.value })} /></div>
            </div>
            <div className="btn-row" style={{ marginTop: "12px" }}>
              <button className="btn" onClick={() => handleReschedule(session.id)}>Save changes</button>
              <button className="btn secondary" onClick={() => setRescheduleId(null)}>Close</button>
            </div>
          </div>
        )}
        {handleUpdateMeetingNotes && <MeetingNotesBlock session={session} onSave={handleUpdateMeetingNotes} />}
        <CommentThread targetType="session" targetId={session.id} comments={commentsByKey} loadComments={loadComments} addComment={addComment} commentKey={commentKey} />
      </div>
    );
  }

  function SessionsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const { sessionsLoading, sessionsData, options, topicsBySubject, createForm, setCreateForm, createSessionLoading, rescheduleId, setRescheduleId, rescheduleForm, setRescheduleForm, handleCreateSession, handleReschedule, handleStatusUpdate, handleUpdateMeetingNotes, commentsByKey, commentKey, loadComments, addComment, sessionsPairMenteeId, setSessionsPairMenteeId } = ctx;
    const Spinner = LoadingSpinner;
    if (!sessionsData) return null;
    const isMentor = sessionsData.is_mentor;
    const isStaffView = sessionsData.is_staff_view;
    const progressByMentee = sessionsData.progress_by_mentee || [];
    const acceptedMentees = progressByMentee.length > 0 ? progressByMentee : (options.mentees || []).map((m) => ({ mentee_id: m.id, mentee_username: m.username, total_completed_minutes: 0, progress_percent: 0 }));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

    function groupUpcomingByBucket(list) {
      const buckets = { today: [], week: [], later: [] };
      (list || []).forEach((session) => {
        const d = new Date(session.scheduled_at);
        if (d >= todayStart && d < todayEnd) buckets.today.push(session);
        else if (d >= todayEnd && d < weekEnd) buckets.week.push(session);
        else if (d >= weekEnd) buckets.later.push(session);
        else buckets.today.push(session);
      });
      return buckets;
    }

    const commentKeyFn = typeof commentKey === "function" ? commentKey : (t, id) => t + ":" + id;
    const sessionCardProps = { isMentor, rescheduleId, rescheduleForm, setRescheduleForm, setRescheduleId, options, topicsBySubject, handleReschedule, handleStatusUpdate, handleUpdateMeetingNotes, commentsByKey: commentsByKey || {}, commentKey: commentKeyFn, loadComments: loadComments || (() => {}), addComment: addComment || (async () => {}) };

    const targetHours = sessionsData.progress_target_hours ?? 12;

    if (isMentor && !isStaffView && sessionsPairMenteeId == null) {
      return (
        <div className="card sessions-page">
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">Choose a mentee to view sessions and schedule new ones. Only official mentor–mentee pairs from Matching are shown.</p>
          {sessionsLoading && (
            <div className="sessions-section">
              <h3 className="sessions-section-title">My mentees</h3>
              {[1, 2].map((i) => (
                <div key={i} className="session-card-skeleton"><div className="loading-skeleton" /><div className="loading-skeleton" /></div>
              ))}
            </div>
          )}
          {!sessionsLoading && acceptedMentees.length === 0 && (
            <div className="fancy-empty sessions-empty">
              <span className="fancy-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              <p className="muted">You have no official mentees yet.</p>
              <p className="muted" style={{ marginTop: "8px", fontSize: "14px" }}>Accept a mentee in Matching to get a dedicated page and schedule sessions.</p>
            </div>
          )}
          {!sessionsLoading && acceptedMentees.length > 0 && (
            <section className="sessions-section">
              <h3 className="sessions-section-title">My mentees</h3>
              <div className="mentee-pair-cards">
                {acceptedMentees.map((entry) => (
                  <button type="button" key={entry.mentee_id} className="mentee-pair-card" onClick={() => setSessionsPairMenteeId(entry.mentee_id)}>
                    <span className="mentee-pair-card-name">{entry.mentee_username}</span>
                    <span className="mentee-pair-card-stats">{formatMinutesAsHours(entry.total_completed_minutes)} / {targetHours}h ({Math.round(entry.progress_percent || 0)}%)</span>
                    <div className="progress-bar-wrap small" role="progressbar" aria-valuenow={Math.round(entry.progress_percent || 0)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="progress-bar-fill" style={{ width: Math.min(100, entry.progress_percent || 0) + "%" }} />
                    </div>
                    <span className="mentee-pair-card-action">View sessions →</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      );
    }

    const pairEntry = isMentor && sessionsPairMenteeId != null ? acceptedMentees.find((e) => Number(e.mentee_id) === Number(sessionsPairMenteeId)) : null;
    const pairMenteeName = pairEntry ? pairEntry.mentee_username : "Mentee";
    const upcomingForPair = isMentor && sessionsPairMenteeId != null ? (sessionsData.upcoming || []).filter((s) => Number(s.mentee_id) === Number(sessionsPairMenteeId)) : (sessionsData.upcoming || []);
    const historyForPair = isMentor && sessionsPairMenteeId != null ? (sessionsData.history || []).filter((s) => Number(s.mentee_id) === Number(sessionsPairMenteeId)) : (sessionsData.history || []);
    const upcomingBuckets = groupUpcomingByBucket(upcomingForPair);

    return (
      <div className="card sessions-page">
        {isMentor && !isStaffView && sessionsPairMenteeId != null && (
          <button type="button" className="sessions-back-link" onClick={() => setSessionsPairMenteeId(null)}>← Back to my mentees</button>
        )}
        <h1 className="page-title">{isMentor && !isStaffView && sessionsPairMenteeId != null ? `Sessions with ${pairMenteeName}` : "Sessions"}</h1>
        <p className="page-subtitle">{isStaffView ? "View all mentoring sessions." : isMentor && sessionsPairMenteeId != null ? "Schedule and manage sessions for this mentee. Only official mentor–mentee pairs (accepted in Matching) can create sessions." : "Schedule and manage mentoring sessions."}</p>
        {!sessionsLoading && isMentor && !isStaffView && sessionsPairMenteeId != null && !pairEntry && (
          <div className="sessions-pair-not-found" style={{ padding: "12px 16px", background: "var(--surface-2)", borderRadius: "8px", marginBottom: "16px" }}>
            <p className="muted" style={{ margin: 0 }}>This mentee is not in your official list. Only accepted mentor–mentee pairs can schedule sessions. Go to Matching to accept mentees.</p>
            <button type="button" className="btn secondary small" style={{ marginTop: "8px" }} onClick={() => setSessionsPairMenteeId(null)}>Back to my mentees</button>
          </div>
        )}
        {!sessionsLoading && !isStaffView && !isMentor && (sessionsData.upcoming?.[0]?.mentor_username || sessionsData.history?.[0]?.mentor_username) && (
          <p className="sessions-mentor-dedicated">Your mentoring with <strong>{sessionsData.upcoming?.[0]?.mentor_username || sessionsData.history?.[0]?.mentor_username}</strong></p>
        )}
        {!sessionsLoading && !isStaffView && !isMentor && sessionsData.progress != null && (
          <div className="progress-block progress-block-mentee">
            <h3 className="progress-block-title">Mentoring progress</h3>
            <p className="progress-block-text">
              {formatMinutesAsHours(sessionsData.progress.total_completed_minutes)} / {(sessionsData.progress_target_hours ?? 12)}h
              <span className="progress-percent"> ({Math.round(sessionsData.progress.progress_percent || 0)}%)</span>
            </p>
            <div className="progress-bar-wrap" role="progressbar" aria-valuenow={Math.round(sessionsData.progress.progress_percent || 0)} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar-fill" style={{ width: Math.min(100, sessionsData.progress.progress_percent || 0) + "%" }} />
            </div>
          </div>
        )}
        {!sessionsLoading && isMentor && !isStaffView && sessionsPairMenteeId != null && pairEntry && (
          <div className="progress-block progress-block-mentee">
            <h3 className="progress-block-title">Progress with {pairMenteeName}</h3>
            <p className="progress-block-text">
              {formatMinutesAsHours(pairEntry.total_completed_minutes)} / {targetHours}h
              <span className="progress-percent"> ({Math.round(pairEntry.progress_percent || 0)}%)</span>
            </p>
            <div className="progress-bar-wrap" role="progressbar" aria-valuenow={Math.round(pairEntry.progress_percent || 0)} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar-fill" style={{ width: Math.min(100, pairEntry.progress_percent || 0) + "%" }} />
            </div>
          </div>
        )}
        {sessionsLoading && (
          <>
            <div className="sessions-section">
              <h3 className="sessions-section-title">Upcoming</h3>
              {[1, 2, 3].map((i) => (
                <div key={i} className="session-card-skeleton">
                  <div className="loading-skeleton" /><div className="loading-skeleton" /><div className="loading-skeleton" />
                </div>
              ))}
            </div>
            <div className="sessions-section">
              <h3 className="sessions-section-title">Past sessions</h3>
              <div className="session-card-skeleton">
                <div className="loading-skeleton" /><div className="loading-skeleton" /><div className="loading-skeleton" />
              </div>
            </div>
          </>
        )}
        {!sessionsLoading && (
          <>
            {isMentor && !isStaffView && sessionsPairMenteeId != null && pairEntry && (
              <div className="session-create-card">
                <h2>New session with {pairMenteeName}</h2>
                <div className="form-grid">
                  <div><label>Subject</label><select value={createForm.subject_id} onChange={(e) => setCreateForm({ ...createForm, subject_id: e.target.value, topic_id: "" })}><option value="">Select subject</option>{(options.subjects || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div><label>Topic</label><select value={createForm.topic_id} onChange={(e) => setCreateForm({ ...createForm, topic_id: e.target.value })}><option value="">Select topic</option>{(topicsBySubject[createForm.subject_id] || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                  <div><label>Date & time</label><input type="datetime-local" value={createForm.scheduled_at} onChange={(e) => setCreateForm({ ...createForm, scheduled_at: e.target.value })} /></div>
                  <div><label>Duration</label><div className="duration-presets" style={{ marginBottom: "8px" }}>{[30, 60, 90].map((m) => <button key={m} type="button" className={Number(createForm.duration_minutes) === m ? "active" : ""} onClick={() => setCreateForm({ ...createForm, duration_minutes: m })}>{m} min</button>)}</div><input type="number" min="15" step="15" value={createForm.duration_minutes} onChange={(e) => setCreateForm({ ...createForm, duration_minutes: e.target.value })} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label>Notes (optional)</label><textarea value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Agenda, materials…" /></div>
                </div>
                <div className="btn-row" style={{ marginTop: "16px" }}><button className="btn" onClick={() => handleCreateSession(sessionsPairMenteeId)} disabled={createSessionLoading}>{createSessionLoading ? <span className="loading-inline"><Spinner inline /> Scheduling session…</span> : "Schedule session"}</button></div>
              </div>
            )}
            <section className="sessions-section">
              <h3 className="sessions-section-title">Upcoming{upcomingForPair.length > 0 && <span className="count">{upcomingForPair.length}</span>}</h3>
              {upcomingForPair.length === 0 && (
                <div className="fancy-empty sessions-empty">
                  <span className="fancy-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  </span>
                  <p className="muted">No upcoming sessions.</p>
                </div>
              )}
              {upcomingForPair.length > 0 && (
                <>
                  {upcomingBuckets.today.length > 0 && (<><div className="sessions-subheading">Today</div>{upcomingBuckets.today.map((session) => <SessionCardWithReschedule key={session.id} session={session} {...sessionCardProps} />)}</>)}
                  {upcomingBuckets.week.length > 0 && (<><div className="sessions-subheading">This week</div>{upcomingBuckets.week.map((session) => <SessionCardWithReschedule key={session.id} session={session} {...sessionCardProps} />)}</>)}
                  {upcomingBuckets.later.length > 0 && (<><div className="sessions-subheading">Later</div>{upcomingBuckets.later.map((session) => <SessionCardWithReschedule key={session.id} session={session} {...sessionCardProps} />)}</>)}
                </>
              )}
            </section>
            <section className="sessions-section">
              <h3 className="sessions-section-title">Past sessions{historyForPair.length > 0 && <span className="count">{historyForPair.length}</span>}</h3>
              {historyForPair.length === 0 ? (
                <div className="fancy-empty sessions-empty">
                  <span className="fancy-empty-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </span>
                  <p className="muted">No past sessions yet.</p>
                </div>
              ) : historyForPair.map((session) => (
                <div className="session-card history-card" key={session.id}>
                  <div className="session-card-header">
                    <div className="session-card-main"><p className="session-card-title">{session.mentee_username} with {session.mentor_username}</p><p className="session-card-meta">{formatDate(session.scheduled_at)}</p><p className="session-card-subject">{session.subject || "No subject"}{session.topic ? " · " + session.topic : ""}</p></div>
                    <span className={"status-pill " + session.status}>{session.status}</span>
                  </div>
                  {handleUpdateMeetingNotes && <MeetingNotesBlock session={session} onSave={handleUpdateMeetingNotes} />}
                  <CommentThread targetType="session" targetId={session.id} comments={commentsByKey || {}} loadComments={loadComments || (() => {})} addComment={addComment || (async () => {})} commentKey={commentKeyFn} />
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.sessions = SessionsPage;
})();
