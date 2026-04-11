(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useState } = React;
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

  function getInitials(label) {
    return String(label || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  }

  function Avatar({ avatarUrl, label, size = "md" }) {
    return (
      <div className={`session-avatar session-avatar-${size}`} aria-hidden="true">
        {avatarUrl ? (
          <img className="session-avatar-image" src={avatarUrl} alt="" />
        ) : (
          <div className="session-avatar-fallback">{getInitials(label)}</div>
        )}
      </div>
    );
  }

  const SessionAvatar = Avatar;

  function StatusBadge({ status }) {
    const normalized = String(status || "scheduled").toLowerCase();
    let cls = "session-status-scheduled";
    if (normalized === "completed") cls = "session-status-completed";
    else if (normalized === "cancelled") cls = "session-status-cancelled";
    return (
      <span className={`session-status-badge ${cls}`}>
        {normalized}
      </span>
    );
  }

  function SectionHeader({ label, title, count = 0 }) {
    return (
      <div className="sessions-section-header">
        {label ? <p className="sessions-section-label">{label}</p> : null}
        <div className="sessions-section-title-row">
          <h3 className="sessions-section-title">{title}</h3>
          {count > 0 ? <span className="sessions-count-badge">{count}</span> : null}
        </div>
      </div>
    );
  }

  function extractMeetingLink(session) {
    const candidate = [session.notes, session.meeting_notes].find((value) =>
      /https?:\/\//i.test(String(value || "")),
    );
    if (!candidate) return "";
    const match = String(candidate).match(/https?:\/\/[^\s)]+/i);
    return match ? match[0] : "";
  }

  function getSessionNotesPreview(session) {
    return session.notes || session.meeting_notes || "";
  }

  function truncateLinkText(value) {
    if (!value) return "";
    return value.length > 56 ? value.slice(0, 56) + "..." : value;
  }

  function SessionCommentsPanel({
    sessionId,
    commentsByKey,
    loadComments,
    addComment,
    commentKey,
  }) {
    const [input, setInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const Spinner = Utils.LoadingSpinner;
    const keyFn =
      typeof commentKey === "function" ? commentKey : (t, id) => t + ":" + id;
    const key = keyFn("session", sessionId);
    const list = commentsByKey[key] || [];
    const loaded = Array.isArray(commentsByKey[key]);

    useEffect(() => {
      if (!loaded) loadComments("session", sessionId);
    }, [loaded, sessionId, loadComments]);

    async function handleSubmit() {
      const text = (input || "").trim();
      if (!text || submitting) return;
      setSubmitting(true);
      try {
        await addComment("session", sessionId, text);
        setInput("");
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div className="session-comments-panel">
        <ul className="session-comment-list" aria-label="Comments">
          {!loaded ? (
            <li className="session-comment-item muted">Loading comments...</li>
          ) : list.length === 0 ? (
            <li className="session-comment-item muted">No comments yet.</li>
          ) : (
            list.map((comment) => (
              <li key={comment.id} className="session-comment-item">
                <span className="session-comment-author">
                  {comment.author_display_name || comment.author_username}
                </span>
                <span className="session-comment-meta">
                  {formatDate(comment.created_at)}
                </span>
                <p className="session-comment-content">{comment.content}</p>
              </li>
            ))
          )}
        </ul>
        <div className="session-comment-input-row">
          <textarea
            className="session-comment-input"
            placeholder="Add a comment..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            type="button"
            className="btn secondary small"
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
          >
            {submitting ? <Spinner inline /> : "Comment"}
          </button>
        </div>
      </div>
    );
  }

  function ProgressCard({ title, completedMinutes, targetHours, percent, avatarUrl, avatarLabel }) {
    const safePercent = Math.max(0, Math.min(100, percent || 0));
    return (
      <div className="session-progress-card">
        <div className="session-progress-header">
          <div className="session-progress-title-wrap">
            <SessionAvatar avatarUrl={avatarUrl} label={avatarLabel || title} />
            <div>
              <p className="session-progress-title">{title}</p>
              <p className="session-progress-meta">
                {formatMinutesAsHours(completedMinutes)} / {targetHours}h
              </p>
            </div>
          </div>
          <p className="session-progress-percent">{Math.round(safePercent)}%</p>
        </div>
        <div
          className="progress-bar-wrap session-progress-bar"
          role="progressbar"
          aria-valuenow={Math.round(safePercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="progress-bar-fill"
            style={{ width: safePercent + "%" }}
          />
        </div>
      </div>
    );
  }

  function SessionForm({
    pairMenteeName,
    difficultySubjects,
    difficultyTopics,
    createForm,
    setCreateForm,
    options,
    topicsBySubject,
    selectedSubjectNeedsHelp,
    selectedTopicNeedsHelp,
    minDateTimeLocal,
    createWeeklyLimitReached,
    handleCreateSession,
    sessionsPairMenteeId,
    createSessionLoading,
    weeklySessionLimitMinutes,
  }) {
    const Spinner = LoadingSpinner;
    const durationPresets = [30, 60, 90];

    return (
      <section className="session-form-card">
        <div className="session-form-header">
          <div>
            <h2 className="session-form-title">New session with {pairMenteeName}</h2>
            <p className="session-form-subtitle">
              Schedule a focused session without leaving the page.
            </p>
          </div>
          <span className="session-form-kicker">Official pair</span>
        </div>

        <div className="session-focus-note">
          <strong>Mentee needs help in:</strong>
          {difficultySubjects.length === 0 && difficultyTopics.length === 0 ? (
            <span className="muted"> No specific difficulty areas reported yet.</span>
          ) : (
            <div className="session-focus-chips">
              {difficultySubjects.map((name) => (
                <span key={`subj-${name}`} className="session-focus-chip needs-help">
                  {name}
                  <span className="session-focus-badge">Needs Help</span>
                </span>
              ))}
              {difficultyTopics.map((name) => (
                <span key={`topic-${name}`} className="session-focus-chip needs-help">
                  {name}
                  <span className="session-focus-badge">Needs Help</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="form-grid session-form-grid">
          <div
            className={
              "session-create-field " + (selectedSubjectNeedsHelp ? "needs-help" : "")
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
              {(options.subjects || []).map((subject) => {
                const needsHelp = difficultySubjects.includes(subject.name);
                return (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
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
              "session-create-field " + (selectedTopicNeedsHelp ? "needs-help" : "")
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
              {(topicsBySubject[createForm.subject_id] || []).map((topic) => {
                const needsHelp = difficultyTopics.includes(topic.name);
                return (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                    {needsHelp ? " - Needs Help" : ""}
                  </option>
                );
              })}
            </select>
            {selectedTopicNeedsHelp && (
              <p className="session-needs-help-helper">
                This topic is marked as a difficulty area.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="create-session-date-time">Date & time</label>
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
                This week already has {Math.round(weeklySessionLimitMinutes / 60)} hours of completed sessions. Choose another week.
              </p>
            )}
          </div>
          <div>
            <label>Duration</label>
            <div className="duration-presets session-duration-segments">
              {durationPresets.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={
                    Number(createForm.duration_minutes) === minutes ? "active" : ""
                  }
                  onClick={() =>
                    setCreateForm({
                      ...createForm,
                      duration_minutes: minutes,
                    })
                  }
                >
                  {minutes} min
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
              placeholder="Add agenda, links, or materials for the session."
            />
          </div>
        </div>

        <div className="session-form-actions">
          <button
            className="btn"
            onClick={() => handleCreateSession(sessionsPairMenteeId)}
            disabled={createSessionLoading || createWeeklyLimitReached}
          >
            {createSessionLoading ? <Spinner inline /> : "Schedule Session"}
          </button>
        </div>
      </section>
    );
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
              placeholder="Take meeting notes..."
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

  function SessionCard({
    session,
    isMentor,
    allowMentorActions = true,
    onOpenProfile,
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
    minDateTimeLocal,
  }) {
    const [commentsOpen, setCommentsOpen] = useState(false);
    const showReschedule = rescheduleId === session.id;
    const subjectLabel = [session.subject, session.topic].filter(Boolean).join(" - ");
    const extraMeta = session.duration_minutes ? `${session.duration_minutes} min` : "";
    const meetingLink = extractMeetingLink(session);
    const notesPreview = getSessionNotesPreview(session);
    const mentorName = session.mentor_display_name || session.mentor_username || "Mentor";
    const menteeName = session.mentee_display_name || session.mentee_username || "Mentee";
    const mentorUserId = session.mentor_user_id;
    const menteeUserId = session.mentee_user_id;
    const primaryUserId = isMentor ? menteeUserId : mentorUserId;
    const partyAvatarUrl = isMentor ? session.mentee_avatar_url : session.mentor_avatar_url;
    const partyAvatarLabel = isMentor
      ? session.mentee_display_name || session.mentee_username || "Mentee"
      : session.mentor_display_name || session.mentor_username || "Mentor";

    return (
      <div className="session-card" key={session.id}>
        <div className="session-card-header">
          <div className="session-card-main">
            <div className="session-card-title-row">
              <button
                type="button"
                className="session-avatar-btn"
                onClick={() => onOpenProfile && onOpenProfile(primaryUserId)}
                aria-label={`Open profile for ${isMentor ? menteeName : mentorName}`}
              >
                <SessionAvatar
                avatarUrl={partyAvatarUrl}
                label={partyAvatarLabel}
                size="sm"
              />
              </button>
              <div className="session-card-identity">
                <button
                  type="button"
                  className="session-profile-link session-card-title"
                  onClick={() => onOpenProfile && onOpenProfile(menteeUserId)}
                >
                  {menteeName}
                </button>
                <p className="session-card-secondary">
                  with{" "}
                  <button
                    type="button"
                    className="session-profile-link"
                    onClick={() => onOpenProfile && onOpenProfile(mentorUserId)}
                  >
                    {mentorName}
                  </button>
                </p>
              </div>
              <StatusBadge status={session.status} />
            </div>
            <div className="session-card-meta-row">
              <span className="session-card-meta">{formatDate(session.scheduled_at)}</span>
              {subjectLabel ? <span className="session-card-divider">•</span> : null}
              {subjectLabel ? <span className="session-card-meta">{subjectLabel}</span> : null}
              {extraMeta ? <span className="session-card-divider">•</span> : null}
              {extraMeta ? <span className="session-card-meta">{extraMeta}</span> : null}
            </div>
            <div className="session-card-link-row">
              {meetingLink ? (
                <a
                  className="session-card-link"
                  href={meetingLink}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span className="session-card-link-icon" aria-hidden="true">↗</span>
                  <span>{truncateLinkText(meetingLink) || "Open meeting link"}</span>
                </a>
              ) : (
                <p className="session-card-link-muted">No meeting link</p>
              )}
            </div>
            <p className="session-card-notes" title={notesPreview || "No notes yet"}>
              {notesPreview || "No notes yet"}
            </p>
          </div>
        </div>
        <div className="session-card-actions">
          {isMentor && allowMentorActions && (
            <button
              className="btn secondary small session-action-btn"
              onClick={() => {
                setRescheduleId(session.id);
                setRescheduleForm({
                  subject_id: session.subject_id || "",
                  topic_id: session.topic_id || "",
                  scheduled_at: session.scheduled_at ? session.scheduled_at.slice(0, 16) : "",
                  duration_minutes: session.duration_minutes || 60,
                  notes: session.notes || session.meeting_notes || "",
                });
              }}
            >
              Edit
            </button>
          )}
          <button
            className="btn secondary small session-action-btn ghost"
            onClick={() => setCommentsOpen((current) => !current)}
          >
            {commentsOpen ? "Hide comments" : "View comments"}
          </button>
          {isMentor && allowMentorActions && (
            <>
              <button
                className="btn small session-action-btn"
                onClick={() => handleStatusUpdate(session.id, "completed")}
              >
                Mark completed
              </button>
              <button
                className="btn danger small session-action-btn"
                onClick={() => handleStatusUpdate(session.id, "cancelled")}
              >
                Cancel session
              </button>
            </>
          )}
        </div>
        {commentsOpen && (
          <SessionCommentsPanel
            sessionId={session.id}
            commentsByKey={commentsByKey || {}}
            loadComments={loadComments || (() => {})}
            addComment={addComment || (async () => {})}
            commentKey={commentKey}
          />
        )}
        {showReschedule && (
          <div className="session-reschedule-panel">
            <h3>Change date or details</h3>
            <div className="form-grid session-form-grid session-reschedule-grid">
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
                  {(options.subjects || []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
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
                  {(topicsBySubject[rescheduleForm.subject_id] || []).map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
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
                This week already has 2 hours of completed sessions. Choose another week.
              </p>
            )}
            <div className="btn-row session-reschedule-actions">
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
      </div>
    );
  }

  const SessionCardWithReschedule = SessionCard;

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
      loadUserProfile,
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
            user_id: m.user_id,
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

    const targetHours = sessionsData.progress_target_hours ?? 12;

    if (isMentor && !isStaffView && sessionsPairMenteeId == null) {
      return (
        <div className="home-dashboard-space sessions-page">
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">
            Choose a mentee to view sessions and schedule new ones. Only
            official mentor-mentee pairs from Matching are shown.
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
              <p className="muted" style={{ marginTop: "8px", fontSize: "14px" }}>
                Go to Matching to review mentee requests and accept your first mentee.
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
                  <div
                    key={entry.mentee_id}
                    className="mentee-pair-card"
                  >
                        <div className="mentee-pair-card-top">
                          <button
                            type="button"
                            className="session-avatar-btn"
                            onClick={() => openProfileFromSessions(entry.user_id)}
                            aria-label={`Open profile for ${entry.mentee_display_name || entry.mentee_username}`}
                          >
                            <SessionAvatar
                              avatarUrl={entry.avatar_url}
                              label={entry.mentee_display_name || entry.mentee_username}
                              size="sm"
                            />
                          </button>
                          <button
                            type="button"
                            className="session-profile-link mentee-pair-card-name"
                            onClick={() => openProfileFromSessions(entry.user_id)}
                          >
                            {entry.mentee_display_name || entry.mentee_username}
                          </button>
                        </div>
                    <span className="mentee-pair-card-stats">
                      {formatMinutesAsHours(entry.total_completed_minutes)} / {targetHours}h ({Math.round(entry.progress_percent || 0)}%)
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
                        style={{ width: Math.min(100, entry.progress_percent || 0) + "%" }}
                      />
                    </div>
                    <div className="mentee-pair-card-actions">
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => openProfileFromSessions(entry.user_id)}
                      >
                        View profile
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setSessionsPairMenteeId(entry.mentee_id)}
                      >
                        View sessions
                      </button>
                    </div>
                  </div>
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
    const commentKeyFn =
      typeof commentKey === "function" ? commentKey : (t, id) => t + ":" + id;
    function openProfileFromSessions(userId) {
      if (!userId || typeof loadUserProfile !== "function") return;
      loadUserProfile(userId);
    }
    const sessionCardProps = {
      isMentor,
      onOpenProfile: openProfileFromSessions,
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
      minDateTimeLocal,
    };

    return (
      <div className="home-dashboard-space sessions-page">
        {isMentor && !isStaffView && sessionsPairMenteeId != null && (
          <button
            type="button"
            className="sessions-back-link"
            onClick={() => setSessionsPairMenteeId(null)}
          >
            Back to my mentees
          </button>
        )}
        <h1 className="page-title">
          {isMentor && !isStaffView && sessionsPairMenteeId != null
            ? `Sessions with ${pairMenteeName}`
            : "Sessions"}
        </h1>
        <p className="page-subtitle sessions-page-subtitle">
          {isStaffView
            ? "View all mentoring sessions."
            : isMentor && sessionsPairMenteeId != null
              ? "Schedule and manage sessions for this mentee. Only official mentor-mentee pairs (accepted in Matching) can create sessions."
              : "Schedule and manage mentoring sessions."}
        </p>
        {!sessionsLoading && !isStaffView && !isMentor && myMentor && (
          <div
            className="mentee-official-mentor-card"
            style={{ marginTop: "8px" }}
          >
            <div className="mentee-official-mentor-main">
              <button
                type="button"
                className="mentee-official-mentor-avatar"
                onClick={() => openProfileFromSessions(myMentor.user_id)}
              >
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
              </button>
              <div className="mentee-official-mentor-text">
                <p className="stat-label" style={{ marginBottom: 2 }}>
                  Your official mentor
                </p>
                <button
                  type="button"
                  className="session-profile-link stat-value"
                  style={{ marginBottom: 2 }}
                  onClick={() => openProfileFromSessions(myMentor.user_id)}
                >
                  {myMentor.display_name || myMentor.username}
                </button>
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
                mentor-mentee pairs can schedule sessions. Go to Matching to
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
              <button
                type="button"
                className="session-profile-link"
                style={{ fontWeight: 700 }}
                onClick={() =>
                  openProfileFromSessions(
                    sessionsData.upcoming?.[0]?.mentor_user_id ||
                      sessionsData.history?.[0]?.mentor_user_id,
                  )
                }
              >
                {sessionsData.upcoming?.[0]?.mentor_display_name ||
                  sessionsData.history?.[0]?.mentor_display_name ||
                  sessionsData.upcoming?.[0]?.mentor_username ||
                  sessionsData.history?.[0]?.mentor_username}
              </button>
            </p>
          )}
        {!sessionsLoading &&
          !isStaffView &&
          !isMentor &&
          sessionsData.progress != null && (
          <ProgressCard
            title="Mentoring progress"
            completedMinutes={sessionsData.progress.total_completed_minutes}
            targetHours={sessionsData.progress_target_hours ?? 12}
            percent={sessionsData.progress.progress_percent}
            avatarUrl={myMentor?.avatar_url || ""}
            avatarLabel={myMentor?.display_name || myMentor?.username || "Mentor"}
          />
        )}
        {!sessionsLoading &&
          isMentor &&
          !isStaffView &&
          sessionsPairMenteeId != null &&
          pairEntry && (
          <ProgressCard
            title={`Progress with ${pairMenteeName}`}
            completedMinutes={pairEntry.total_completed_minutes}
            targetHours={targetHours}
            percent={pairEntry.progress_percent}
            avatarUrl={pairEntry.avatar_url || ""}
            avatarLabel={pairMenteeName}
          />
        )}
        {sessionsLoading && (
          <>
            <Spinner />
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
                <SessionForm
                  pairMenteeName={pairMenteeName}
                  difficultySubjects={Array.from(difficultySubjects)}
                  difficultyTopics={Array.from(difficultyTopics)}
                  createForm={createForm}
                  setCreateForm={setCreateForm}
                  options={options}
                  topicsBySubject={topicsBySubject}
                  selectedSubjectNeedsHelp={selectedSubjectNeedsHelp}
                  selectedTopicNeedsHelp={selectedTopicNeedsHelp}
                  minDateTimeLocal={minDateTimeLocal}
                  createWeeklyLimitReached={createWeeklyLimitReached}
                  handleCreateSession={handleCreateSession}
                  sessionsPairMenteeId={sessionsPairMenteeId}
                  createSessionLoading={createSessionLoading}
                  weeklySessionLimitMinutes={weeklySessionLimitMinutes}
                />
              )}
            <section className="sessions-section">
              <SectionHeader
                label="Schedule"
                title="Upcoming Sessions"
                count={upcomingForPair.length}
              />
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
                        <SessionCard
                          key={session.id}
                          session={session}
                          {...sessionCardProps}
                          allowMentorActions
                          weeklyLimitReached={rescheduleWeeklyLimitReached}
                        />
                      ))}
                    </>
                  )}
                  {upcomingBuckets.week.length > 0 && (
                    <>
                      <div className="sessions-subheading">This Week</div>
                      {upcomingBuckets.week.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          {...sessionCardProps}
                          allowMentorActions
                          weeklyLimitReached={rescheduleWeeklyLimitReached}
                        />
                      ))}
                    </>
                  )}
                  {upcomingBuckets.later.length > 0 && (
                    <>
                      <div className="sessions-subheading">Later</div>
                      {upcomingBuckets.later.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          {...sessionCardProps}
                          allowMentorActions
                          weeklyLimitReached={rescheduleWeeklyLimitReached}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </section>
            <section className="sessions-section">
              <SectionHeader
                label="Archive"
                title="Past Sessions"
                count={historyForPair.length}
              />
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
                  <SessionCard
                    key={session.id}
                    session={session}
                    {...sessionCardProps}
                    allowMentorActions={false}
                  />
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


