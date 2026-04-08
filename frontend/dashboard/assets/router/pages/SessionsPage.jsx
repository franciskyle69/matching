(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { formatDate, LoadingSpinner, OrbitingDotsLoader } = Utils;

  const CommentThread =
    window.DashboardApp.CommentThread ||
    function CommentThreadPlaceholder() {
      return null;
    };

  function formatMinutesAsHours(min) {
    const m = Number(min) || 0;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return mins > 0 ? `${h}h ${mins}min` : `${h}h`;
  }

  const WEEKLY_SESSION_LIMIT_MINUTES = 120;

  function getWeekBounds(referenceDate) {
    const parsed = new Date(referenceDate);
    if (Number.isNaN(parsed.getTime())) return null;
    const weekStart = new Date(parsed);
    const dayIndex = weekStart.getDay();
    const daysSinceMonday = (dayIndex + 6) % 7;
    weekStart.setDate(weekStart.getDate() - daysSinceMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return { weekStart, weekEnd };
  }

  function getWeeklyCompletedMinutes(sessions, referenceDate) {
    const bounds = getWeekBounds(referenceDate);
    if (!bounds) return 0;
    return (sessions || []).reduce((total, session) => {
      if ((session.status || "") !== "completed") return total;
      const scheduledAt = new Date(session.scheduled_at);
      if (Number.isNaN(scheduledAt.getTime())) return total;
      if (scheduledAt >= bounds.weekStart && scheduledAt < bounds.weekEnd) {
        return total + (Number(session.duration_minutes) || 0);
      }
      return total;
    }, 0);
  }

  function toDateTimeLocalMinString(dateObj) {
    const d = dateObj instanceof Date ? dateObj : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function openNativeDateTimePicker(event) {
    const input = event.currentTarget;
    if (!input || typeof input.showPicker !== "function") return;
    try {
      input.showPicker();
    } catch (_err) {
      // Some browsers block picker opening outside trusted user gestures.
    }
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
            <p className="session-meeting-notes-text">
              {session.meeting_notes || "No notes yet."}
            </p>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => {
                setEditValue(session.meeting_notes || "");
                setEditing(true);
              }}
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="session-meeting-notes-edit">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Take meeting notes…"
              rows={3}
            />
            <div className="btn-row" style={{ marginTop: "8px" }}>
              <button
                type="button"
                className="btn small"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Spinner inline />
                ) : (
                  "Save"
                )}
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => {
                  setEditing(false);
                  setEditValue(session.meeting_notes || "");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function SessionCardWithReschedule({
    session,
    isMentor,
    rescheduleId,
    rescheduleForm,
    setRescheduleForm,
    setRescheduleId,
    options,
    topicsBySubject,
    handleReschedule,
    handleStatusUpdate,
    handleUpdateMeetingNotes,
    commentsByKey,
    commentKey,
    loadComments,
    addComment,
    weeklyLimitReached,
  }) {
    const showReschedule = rescheduleId === session.id;
    const menteeLabel = session.mentee_display_name || session.mentee_username;
    const mentorLabel = session.mentor_display_name || session.mentor_username;
    return (
      <div className="session-card" key={session.id}>
        <div className="session-card-header">
          <div className="session-card-main">
            <p className="session-card-title">
              {menteeLabel} with {mentorLabel}
            </p>
            <p className="session-card-meta">
              {formatDate(session.scheduled_at)}
            </p>
            <p className="session-card-subject">
              {session.subject || "No subject"}
              {session.topic ? " · " + session.topic : ""}
              {(session.duration_minutes || 0) > 0
                ? " · " + session.duration_minutes + " min"
                : ""}
            </p>
            {session.notes && (
              <div className="session-card-notes">{session.notes}</div>
            )}
          </div>
          <span className={"status-pill " + session.status}>
            {session.status}
          </span>
        </div>
        {isMentor && (
          <div className="session-card-actions">
            <button
              className="btn secondary small"
              onClick={() => {
                setRescheduleId(session.id);
                setRescheduleForm({
                  subject_id: session.subject_id || "",
                  topic_id: session.topic_id || "",
                  scheduled_at: session.scheduled_at
                    ? session.scheduled_at.slice(0, 16)
                    : "",
                  duration_minutes: session.duration_minutes || 60,
                  notes: session.notes || "",
                });
              }}
            >
              Reschedule
            </button>
            <button
              className="btn small"
              onClick={() => handleStatusUpdate(session.id, "completed")}
            >
              Mark completed
            </button>
            <button
              className="btn danger small"
              onClick={() => handleStatusUpdate(session.id, "cancelled")}
            >
              Cancel session
            </button>
          </div>
        )}
        {showReschedule && (
          <div className="session-reschedule-panel">
            <h3>Change date or details</h3>
            <div className="form-grid">
              <div>
                <label>Subject</label>
                <select
                  value={rescheduleForm.subject_id}
                  onChange={(e) =>
                    setRescheduleForm({
                      ...rescheduleForm,
                      subject_id: e.target.value,
                      topic_id: "",
                    })
                  }
                >
                  <option value="">Select subject</option>
                  {(options.subjects || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Topic</label>
                <select
                  value={rescheduleForm.topic_id}
                  onChange={(e) =>
                    setRescheduleForm({
                      ...rescheduleForm,
                      topic_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select topic</option>
                  {(topicsBySubject[rescheduleForm.subject_id] || []).map(
                    (t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label htmlFor={`reschedule-date-time-${session.id}`}>
                  Date & time
                </label>
                <input
                  id={`reschedule-date-time-${session.id}`}
                  type="datetime-local"
                  min={minDateTimeLocal}
                  value={rescheduleForm.scheduled_at}
                  onFocus={openNativeDateTimePicker}
                  onClick={openNativeDateTimePicker}
                  onChange={(e) =>
                    setRescheduleForm({
                      ...rescheduleForm,
                      scheduled_at: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label>Duration</label>
                <input
                  type="number"
                  min="15"
                  step="15"
                  value={rescheduleForm.duration_minutes}
                  onChange={(e) =>
                    setRescheduleForm({
                      ...rescheduleForm,
                      duration_minutes: e.target.value,
                    })
                  }
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Notes</label>
                <textarea
                  value={rescheduleForm.notes}
                  onChange={(e) =>
                    setRescheduleForm({
                      ...rescheduleForm,
                      notes: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            {weeklyLimitReached && (
              <p className="session-needs-help-helper">
                This week already has 2 hours of completed sessions. Choose
                another week.
              </p>
            )}
            <div className="btn-row" style={{ marginTop: "12px" }}>
              <button
                className="btn"
                onClick={() => handleReschedule(session.id)}
                disabled={weeklyLimitReached}
              >
                Save changes
              </button>
              <button
                className="btn secondary"
                onClick={() => setRescheduleId(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
        {handleUpdateMeetingNotes && (
          <MeetingNotesBlock
            session={session}
            onSave={handleUpdateMeetingNotes}
          />
        )}
        <CommentThread
          targetType="session"
          targetId={session.id}
          comments={commentsByKey}
          loadComments={loadComments}
          addComment={addComment}
          commentKey={commentKey}
        />
      </div>
    );
  }

  function SessionsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      sessionsLoading,
      sessionsData,
      options,
      topicsBySubject,
      createForm,
      setCreateForm,
      createSessionLoading,
      rescheduleId,
      setRescheduleId,
      rescheduleForm,
      setRescheduleForm,
      handleCreateSession,
      handleReschedule,
      handleStatusUpdate,
      handleUpdateMeetingNotes,
      commentsByKey,
      commentKey,
      loadComments,
      addComment,
      sessionsPairMenteeId,
      setSessionsPairMenteeId,
      myMentor,
      setActiveTab,
    } = ctx;
    const Spinner = LoadingSpinner;
    const minDateTimeLocal = toDateTimeLocalMinString(new Date());
    if (!sessionsData) return null;
    const isMentor = sessionsData.is_mentor;
    const isStaffView = sessionsData.is_staff_view;
    const progressByMentee = sessionsData.progress_by_mentee || [];
    const weeklySessionLimitMinutes =
      sessionsData.weekly_session_limit_minutes ?? WEEKLY_SESSION_LIMIT_MINUTES;
    const acceptedMentees =
      progressByMentee.length > 0
        ? progressByMentee
        : (options.mentees || []).map((m) => ({
            mentee_id: m.id,
            mentee_username: m.username,
          mentee_display_name: m.display_name || m.username,
            total_completed_minutes: 0,
            progress_percent: 0,
            difficulty_subjects: Array.isArray(m.difficulty_subjects)
              ? m.difficulty_subjects
              : [],
            difficulty_topics: Array.isArray(m.difficulty_topics)
              ? m.difficulty_topics
              : [],
            difficulty_level: m.difficulty_level ?? null,
          }));

    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const weekEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 7,
    );

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

    const commentKeyFn =
      typeof commentKey === "function" ? commentKey : (t, id) => t + ":" + id;
    const sessionCardProps = {
      isMentor,
      rescheduleId,
      rescheduleForm,
      setRescheduleForm,
      setRescheduleId,
      options,
      topicsBySubject,
      handleReschedule,
      handleStatusUpdate,
      handleUpdateMeetingNotes,
      commentsByKey: commentsByKey || {},
      commentKey: commentKeyFn,
      loadComments: loadComments || (() => {}),
      addComment: addComment || (async () => {}),
    };

    const targetHours = sessionsData.progress_target_hours ?? 12;

    if (isMentor && !isStaffView && sessionsPairMenteeId == null) {
      return (
        <div className="home-dashboard-space sessions-page">
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">
            Choose a mentee to view sessions and schedule new ones. Only
            official mentor–mentee pairs from Matching are shown.
          </p>
          {sessionsLoading && (
            <div className="sessions-section">
              <h3 className="sessions-section-title">My mentees</h3>
              {[1, 2].map((i) => (
                <div key={i} className="session-card-skeleton">
                  <div className="loading-skeleton" />
                  <div className="loading-skeleton" />
                </div>
              ))}
            </div>
          )}
          {!sessionsLoading && acceptedMentees.length === 0 && (
            <div className="fancy-empty sessions-empty">
              <span className="fancy-empty-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="24"
                  height="24"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <p className="muted">You have no official mentees yet.</p>
              <p
                className="muted"
                style={{ marginTop: "8px", fontSize: "14px" }}
              >
                Go to Matching to review mentee requests and accept your first
                mentee.
              </p>
              <div className="btn-row" style={{ marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setActiveTab("matching")}
                >
                  Go to Matching
                </button>
              </div>
            </div>
          )}
          {!sessionsLoading && acceptedMentees.length > 0 && (
            <section className="sessions-section">
              <h3 className="sessions-section-title">My mentees</h3>
              <div className="mentee-pair-cards">
                {acceptedMentees.map((entry) => (
                  <button
                    type="button"
                    key={entry.mentee_id}
                    className="mentee-pair-card"
                    onClick={() => setSessionsPairMenteeId(entry.mentee_id)}
                  >
                    <span className="mentee-pair-card-name">
                      {entry.mentee_display_name || entry.mentee_username}
                    </span>
                    <span className="mentee-pair-card-stats">
                      {formatMinutesAsHours(entry.total_completed_minutes)} /{" "}
                      {targetHours}h ({Math.round(entry.progress_percent || 0)}
                      %)
                    </span>
                    <div
                      className="progress-bar-wrap small"
                      role="progressbar"
                      aria-valuenow={Math.round(entry.progress_percent || 0)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="progress-bar-fill"
                        style={{
                          width:
                            Math.min(100, entry.progress_percent || 0) + "%",
                        }}
                      />
                    </div>
                    <span className="mentee-pair-card-action">
                      View sessions →
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      );
    }

    const pairEntry =
      isMentor && sessionsPairMenteeId != null
        ? acceptedMentees.find(
            (e) => Number(e.mentee_id) === Number(sessionsPairMenteeId),
          )
        : null;
    const pairMenteeName = pairEntry ? (pairEntry.mentee_display_name || pairEntry.mentee_username) : "Mentee";
    const normalizeLabel = (value) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const difficultySubjects = new Set(
      (pairEntry?.difficulty_subjects || pairEntry?.subjects || []).map(
        normalizeLabel,
      ),
    );
    const difficultyTopics = new Set(
      (pairEntry?.difficulty_topics || pairEntry?.topics || []).map(
        normalizeLabel,
      ),
    );
    const selectedSubject = (options.subjects || []).find(
      (s) => String(s.id) === String(createForm.subject_id),
    );
    const selectedTopic = (topicsBySubject[createForm.subject_id] || []).find(
      (t) => String(t.id) === String(createForm.topic_id),
    );
    const selectedSubjectNeedsHelp = !!(
      selectedSubject &&
      difficultySubjects.has(normalizeLabel(selectedSubject.name))
    );
    const selectedTopicNeedsHelp = !!(
      selectedTopic && difficultyTopics.has(normalizeLabel(selectedTopic.name))
    );
    const upcomingForPair =
      isMentor && sessionsPairMenteeId != null
        ? (sessionsData.upcoming || []).filter(
            (s) => Number(s.mentee_id) === Number(sessionsPairMenteeId),
          )
        : sessionsData.upcoming || [];
    const historyForPair =
      isMentor && sessionsPairMenteeId != null
        ? (sessionsData.history || []).filter(
            (s) => Number(s.mentee_id) === Number(sessionsPairMenteeId),
          )
        : sessionsData.history || [];
    const upcomingBuckets = groupUpcomingByBucket(upcomingForPair);
    const createWeeklyCompletedMinutes = createForm.scheduled_at
      ? getWeeklyCompletedMinutes(historyForPair, createForm.scheduled_at)
      : 0;
    const createWeeklyLimitReached =
      !!createForm.scheduled_at &&
      createWeeklyCompletedMinutes >= weeklySessionLimitMinutes;
    const rescheduleWeeklyCompletedMinutes =
      rescheduleId != null && rescheduleForm.scheduled_at
        ? getWeeklyCompletedMinutes(historyForPair, rescheduleForm.scheduled_at)
        : 0;
    const rescheduleWeeklyLimitReached =
      !!rescheduleId &&
      !!rescheduleForm.scheduled_at &&
      rescheduleWeeklyCompletedMinutes >= weeklySessionLimitMinutes;

    return (
      <div className="home-dashboard-space sessions-page">
        {isMentor && !isStaffView && sessionsPairMenteeId != null && (
          <button
            type="button"
            className="sessions-back-link"
            onClick={() => setSessionsPairMenteeId(null)}
          >
            ← Back to my mentees
          </button>
        )}
        <h1 className="page-title">
          {isMentor && !isStaffView && sessionsPairMenteeId != null
            ? `Sessions with ${pairMenteeName}`
            : "Sessions"}
        </h1>
        <p className="page-subtitle">
          {isStaffView
            ? "View all mentoring sessions."
            : isMentor && sessionsPairMenteeId != null
              ? "Schedule and manage sessions for this mentee. Only official mentor–mentee pairs (accepted in Matching) can create sessions."
              : "Schedule and manage mentoring sessions."}
        </p>
        {!sessionsLoading && !isStaffView && !isMentor && myMentor && (
          <div
            className="mentee-official-mentor-card"
            style={{ marginTop: "8px" }}
          >
            <div className="mentee-official-mentor-main">
              <div className="mentee-official-mentor-avatar">
                <div className="sidebar-avatar-wrapper">
                  {myMentor.avatar_url ? (
                    <img
                      src={myMentor.avatar_url}
                      alt={myMentor.display_name || myMentor.username}
                      className="sidebar-avatar"
                    />
                  ) : (
                    <div className="sidebar-avatar fallback">
                      {(myMentor.display_name || myMentor.username || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <div className="mentee-official-mentor-text">
                <p className="stat-label" style={{ marginBottom: 2 }}>
                  Your official mentor
                </p>
                <p className="stat-value" style={{ marginBottom: 2 }}>
                  {myMentor.display_name || myMentor.username}
                </p>
                {myMentor.accepted_at && (
                  <p className="muted" style={{ fontSize: "12px" }}>
                    Accepted {formatDate(myMentor.accepted_at)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        {!sessionsLoading &&
          isMentor &&
          !isStaffView &&
          sessionsPairMenteeId != null &&
          !pairEntry && (
            <div
              className="sessions-pair-not-found"
              style={{
                padding: "12px 16px",
                background: "var(--surface-2)",
                borderRadius: "8px",
                marginBottom: "16px",
              }}
            >
              <p className="muted" style={{ margin: 0 }}>
                This mentee is not in your official list. Only accepted
                mentor–mentee pairs can schedule sessions. Go to Matching to
                accept mentees.
              </p>
              <button
                type="button"
                className="btn secondary small"
                style={{ marginTop: "8px" }}
                onClick={() => setSessionsPairMenteeId(null)}
              >
                Back to my mentees
              </button>
            </div>
          )}
        {!sessionsLoading &&
          !isStaffView &&
          !isMentor &&
          (sessionsData.upcoming?.[0]?.mentor_display_name ||
            sessionsData.history?.[0]?.mentor_display_name ||
            sessionsData.upcoming?.[0]?.mentor_username ||
            sessionsData.history?.[0]?.mentor_username) && (
            <p className="sessions-mentor-dedicated">
              Your mentoring with{" "}
              <strong>
                {sessionsData.upcoming?.[0]?.mentor_display_name ||
                  sessionsData.history?.[0]?.mentor_display_name ||
                  sessionsData.upcoming?.[0]?.mentor_username ||
                  sessionsData.history?.[0]?.mentor_username}
              </strong>
            </p>
          )}
        {!sessionsLoading &&
          !isStaffView &&
          !isMentor &&
          sessionsData.progress != null && (
            <div className="progress-block progress-block-mentee">
              <h3 className="progress-block-title">Mentoring progress</h3>
              <p className="progress-block-text">
                {formatMinutesAsHours(
                  sessionsData.progress.total_completed_minutes,
                )}{" "}
                / {sessionsData.progress_target_hours ?? 12}h
                <span className="progress-percent">
                  {" "}
                  ({Math.round(sessionsData.progress.progress_percent || 0)}%)
                </span>
              </p>
              <div
                className="progress-bar-wrap"
                role="progressbar"
                aria-valuenow={Math.round(
                  sessionsData.progress.progress_percent || 0,
                )}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="progress-bar-fill"
                  style={{
                    width:
                      Math.min(
                        100,
                        sessionsData.progress.progress_percent || 0,
                      ) + "%",
                  }}
                />
              </div>
            </div>
          )}
        {!sessionsLoading &&
          isMentor &&
          !isStaffView &&
          sessionsPairMenteeId != null &&
          pairEntry && (
            <div className="progress-block progress-block-mentee">
              <h3 className="progress-block-title">
                Progress with {pairMenteeName}
              </h3>
              <p className="progress-block-text">
                {formatMinutesAsHours(pairEntry.total_completed_minutes)} /{" "}
                {targetHours}h
                <span className="progress-percent">
                  {" "}
                  ({Math.round(pairEntry.progress_percent || 0)}%)
                </span>
              </p>
              <div
                className="progress-bar-wrap"
                role="progressbar"
                aria-valuenow={Math.round(pairEntry.progress_percent || 0)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="progress-bar-fill"
                  style={{
                    width: Math.min(100, pairEntry.progress_percent || 0) + "%",
                  }}
                />
              </div>
            </div>
          )}
        {sessionsLoading && (
          <>
            <Spinner title="Loading sessions…" subtitle="Fetching your sessions" />
            <div className="sessions-section">
              <h3 className="sessions-section-title">Upcoming</h3>
              {[1, 2, 3].map((i) => (
                <div key={i} className="session-card-skeleton">
                  <div className="loading-skeleton" />
                  <div className="loading-skeleton" />
                  <div className="loading-skeleton" />
                </div>
              ))}
            </div>
            <div className="sessions-section">
              <h3 className="sessions-section-title">Past sessions</h3>
              <div className="session-card-skeleton">
                <div className="loading-skeleton" />
                <div className="loading-skeleton" />
                <div className="loading-skeleton" />
              </div>
            </div>
          </>
        )}
        {!sessionsLoading && (
          <>
            {isMentor &&
              !isStaffView &&
              sessionsPairMenteeId != null &&
              pairEntry && (
                <div className="session-create-card">
                  <h2>New session with {pairMenteeName}</h2>
                  <div
                    className="session-focus-note"
                    title="These are areas where the mentee marked 'Have Difficulty' in their questionnaire."
                  >
                    <strong>Mentee needs help in:</strong>
                    {difficultySubjects.size === 0 &&
                    difficultyTopics.size === 0 ? (
                      <span className="muted">
                        {" "}
                        No specific difficulty areas reported yet.
                      </span>
                    ) : (
                      <div className="session-focus-chips">
                        {(pairEntry?.difficulty_subjects || []).map((name) => (
                          <span
                            key={`subj-${name}`}
                            className="session-focus-chip needs-help"
                          >
                            {name}{" "}
                            <span className="session-focus-badge">
                              Needs Help
                            </span>
                          </span>
                        ))}
                        {(pairEntry?.difficulty_topics || []).map((name) => (
                          <span
                            key={`topic-${name}`}
                            className="session-focus-chip needs-help"
                          >
                            {name}{" "}
                            <span className="session-focus-badge">
                              Needs Help
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-grid">
                    <div
                      className={
                        "session-create-field " +
                        (selectedSubjectNeedsHelp ? "needs-help" : "")
                      }
                    >
                      <label>Subject</label>
                      <select
                        value={createForm.subject_id}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            subject_id: e.target.value,
                            topic_id: "",
                          })
                        }
                      >
                        <option value="">Select subject</option>
                        {(options.subjects || []).map((s) => {
                          const needsHelp = difficultySubjects.has(
                            normalizeLabel(s.name),
                          );
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {needsHelp ? " - Needs Help" : ""}
                            </option>
                          );
                        })}
                      </select>
                      {selectedSubjectNeedsHelp && (
                        <p className="session-needs-help-helper">
                          This subject is marked as a difficulty area.
                        </p>
                      )}
                    </div>
                    <div
                      className={
                        "session-create-field " +
                        (selectedTopicNeedsHelp ? "needs-help" : "")
                      }
                    >
                      <label>Topic</label>
                      <select
                        value={createForm.topic_id}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            topic_id: e.target.value,
                          })
                        }
                      >
                        <option value="">Select topic</option>
                        {(topicsBySubject[createForm.subject_id] || []).map(
                          (t) => {
                            const needsHelp = difficultyTopics.has(
                              normalizeLabel(t.name),
                            );
                            return (
                              <option key={t.id} value={t.id}>
                                {t.name}
                                {needsHelp ? " - Needs Help" : ""}
                              </option>
                            );
                          },
                        )}
                      </select>
                      {selectedTopicNeedsHelp && (
                        <p className="session-needs-help-helper">
                          This topic is marked as a difficulty area.
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="create-session-date-time">
                        Date & time
                      </label>
                      <input
                        id="create-session-date-time"
                        type="datetime-local"
                        min={minDateTimeLocal}
                        value={createForm.scheduled_at}
                        onFocus={openNativeDateTimePicker}
                        onClick={openNativeDateTimePicker}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            scheduled_at: e.target.value,
                          })
                        }
                      />
                      {createWeeklyLimitReached && (
                        <p className="session-needs-help-helper">
                          This week already has 2 hours of completed sessions.
                          Choose another week.
                        </p>
                      )}
                    </div>
                    <div>
                      <label>Duration</label>
                      <div
                        className="duration-presets"
                        style={{ marginBottom: "8px" }}
                      >
                        {[30, 60, 90].map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={
                              Number(createForm.duration_minutes) === m
                                ? "active"
                                : ""
                            }
                            onClick={() =>
                              setCreateForm({
                                ...createForm,
                                duration_minutes: m,
                              })
                            }
                          >
                            {m} min
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="15"
                        step="15"
                        value={createForm.duration_minutes}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            duration_minutes: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label>Notes (optional)</label>
                      <textarea
                        value={createForm.notes}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            notes: e.target.value,
                          })
                        }
                        placeholder="Agenda, materials…"
                      />
                    </div>
                  </div>
                  <div className="btn-row" style={{ marginTop: "16px" }}>
                    <button
                      className="btn"
                      onClick={() => handleCreateSession(sessionsPairMenteeId)}
                      disabled={
                        createSessionLoading || createWeeklyLimitReached
                      }
                    >
                      {createSessionLoading ? (
                        <Spinner inline />
                      ) : (
                        "Schedule session"
                      )}
                    </button>
                  </div>
                </div>
              )}
            <section className="sessions-section">
              <h3 className="sessions-section-title">
                Upcoming
                {upcomingForPair.length > 0 && (
                  <span className="count">{upcomingForPair.length}</span>
                )}
              </h3>
              {upcomingForPair.length === 0 && (
                <div className="fancy-empty sessions-empty">
                  <span className="fancy-empty-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="24"
                      height="24"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <p className="muted">
                    No upcoming sessions
                    {isMentor && sessionsPairMenteeId != null
                      ? " with this mentee yet. Use the form above to schedule your first meeting."
                      : "."}
                  </p>
                </div>
              )}
              {upcomingForPair.length > 0 && (
                <>
                  {upcomingBuckets.today.length > 0 && (
                    <>
                      <div className="sessions-subheading">Today</div>
                      {upcomingBuckets.today.map((session) => (
                        <SessionCardWithReschedule
                          key={session.id}
                          session={session}
                          {...sessionCardProps}
                          weeklyLimitReached={rescheduleWeeklyLimitReached}
                        />
                      ))}
                    </>
                  )}
                  {upcomingBuckets.week.length > 0 && (
                    <>
                      <div className="sessions-subheading">This week</div>
                      {upcomingBuckets.week.map((session) => (
                        <SessionCardWithReschedule
                          key={session.id}
                          session={session}
                          {...sessionCardProps}
                          weeklyLimitReached={rescheduleWeeklyLimitReached}
                        />
                      ))}
                    </>
                  )}
                  {upcomingBuckets.later.length > 0 && (
                    <>
                      <div className="sessions-subheading">Later</div>
                      {upcomingBuckets.later.map((session) => (
                        <SessionCardWithReschedule
                          key={session.id}
                          session={session}
                          {...sessionCardProps}
                          weeklyLimitReached={rescheduleWeeklyLimitReached}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </section>
            <section className="sessions-section">
              <h3 className="sessions-section-title">
                Past sessions
                {historyForPair.length > 0 && (
                  <span className="count">{historyForPair.length}</span>
                )}
              </h3>
              {historyForPair.length === 0 ? (
                <div className="fancy-empty sessions-empty">
                  <span className="fancy-empty-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      width="24"
                      height="24"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                  <p className="muted">No past sessions yet.</p>
                </div>
              ) : (
                historyForPair.map((session) => (
                  <div className="session-card history-card" key={session.id}>
                    <div className="session-card-header">
                      <div className="session-card-main">
                        <p className="session-card-title">
                          {session.mentee_display_name || session.mentee_username} with{" "}
                          {session.mentor_display_name || session.mentor_username}
                        </p>
                        <p className="session-card-meta">
                          {formatDate(session.scheduled_at)}
                        </p>
                        <p className="session-card-subject">
                          {session.subject || "No subject"}
                          {session.topic ? " · " + session.topic : ""}
                        </p>
                      </div>
                      <span className={"status-pill " + session.status}>
                        {session.status}
                      </span>
                    </div>
                    {handleUpdateMeetingNotes && (
                      <MeetingNotesBlock
                        session={session}
                        onSave={handleUpdateMeetingNotes}
                      />
                    )}
                    <CommentThread
                      targetType="session"
                      targetId={session.id}
                      comments={commentsByKey || {}}
                      loadComments={loadComments || (() => {})}
                      addComment={addComment || (async () => {})}
                      commentKey={commentKeyFn}
                    />
                  </div>
                ))
              )}
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
