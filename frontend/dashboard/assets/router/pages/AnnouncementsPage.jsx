(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay)
      return (
        "Today at " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    return (
      d.toLocaleDateString([], { dateStyle: "medium" }) +
      " at " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }

  function CommentThread({
    targetType,
    targetId,
    comments,
    loadComments,
    addComment,
    commentKey,
  }) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const keyFn =
      typeof commentKey === "function" ? commentKey : (t, id) => t + ":" + id;
    const key = keyFn(targetType, targetId);
    const list = comments[key] || [];
    const loaded = Array.isArray(comments[key]);

    useEffect(() => {
      if (open && !loaded) loadComments(targetType, targetId);
    }, [open, loaded, targetType, targetId, loadComments]);

    async function handleSubmit() {
      const t = (input || "").trim();
      if (!t || submitting) return;
      setSubmitting(true);
      try {
        await addComment(targetType, targetId, t);
        setInput("");
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div className="comment-thread">
        <button
          type="button"
          className="comment-thread-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"} comments{" "}
          {list.length > 0 && (
            <span className="comment-count">({list.length})</span>
          )}
        </button>
        {open && (
          <div className="comment-thread-body">
            <ul className="comment-list" aria-label="Comments">
              {!loaded ? (
                <li className="comment-item muted">Loading…</li>
              ) : list.length === 0 ? (
                <li className="comment-item muted">No comments yet.</li>
              ) : (
                list.map((c) => (
                  <li key={c.id} className="comment-item">
                    <span className="comment-author">
                      {c.author_display_name || c.author_username}
                    </span>
                    <span className="comment-meta">
                      {" "}
                      · {formatDate(c.created_at)}
                    </span>
                    <p className="comment-content">{c.content}</p>
                  </li>
                ))
              )}
            </ul>
            <div className="comment-input-row">
              <textarea
                className="comment-input"
                placeholder="Add a comment…"
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
                className="btn small"
                onClick={handleSubmit}
                disabled={!input.trim() || submitting}
              >
                {submitting ? "Posting…" : "Comment"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const AUDIENCE_OPTIONS = [
    { value: "all", label: "All mentees" },
    { value: "specific", label: "Specific mentees" },
  ];

  function AudienceSegmentedControl({ value, onChange, labelledBy }) {
    function handleKeyDown(event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const index = AUDIENCE_OPTIONS.findIndex((o) => o.value === value);
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next =
        AUDIENCE_OPTIONS[
          (index + delta + AUDIENCE_OPTIONS.length) % AUDIENCE_OPTIONS.length
        ];
      onChange(next.value);
    }

    return (
      <div
        className="segmented-control"
        role="radiogroup"
        aria-labelledby={labelledBy}
        onKeyDown={handleKeyDown}
      >
        {AUDIENCE_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              className={
                "segmented-option" + (active ? " is-active" : "")
              }
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  function AnnouncementsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      user,
      announcements,
      announcementsLoading,
      announcementMessage,
      setAnnouncementMessage,
      announcementMenteeOptions,
      announcementTargetType,
      setAnnouncementTargetType,
      announcementRecipientIds,
      setAnnouncementRecipientIds,
      postAnnouncementLoading,
      loadAnnouncements,
      postAnnouncement,
      handleDeleteAnnouncement,
      commentsByKey,
      commentKey,
      loadComments,
      addComment,
    } = ctx;
    const isMentor = user?.role === "mentor";
    const Spinner = LoadingSpinner;
    const messageRef = useRef(null);
    const composerRef = useRef(null);

    function toggleRecipient(id) {
      setAnnouncementRecipientIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    }

    function handleAudienceChange(next) {
      setAnnouncementTargetType(next);
      if (next === "all") setAnnouncementRecipientIds([]);
    }

    const menteeCount = announcementMenteeOptions.length;
    const latestAnnouncement = announcements.reduce(
      (latest, item) =>
        !latest || new Date(item.created_at) > new Date(latest.created_at)
          ? item
          : latest,
      null,
    );

    function focusComposer() {
      if (composerRef.current) {
        composerRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      window.setTimeout(() => {
        if (messageRef.current) {
          messageRef.current.focus();
        }
      }, 220);
    }

    return (
      <div className="announcements-page page-shell">
        {/* Kasandigan Open Native Header — Zero box container */}
        <header className="kasandigan-header">
          <div className="kasandigan-header-content">
            <div className="kasandigan-badge">
              <span className="kasandigan-badge-dot" />
              <span>Academic Mentoring Unit • Community Board</span>
            </div>
            <h1 className="kasandigan-title">Announcements</h1>
            <p className="kasandigan-subtitle">
              {isMentor
                ? "Post announcements to your mentees and respond to discussion threads."
                : "Official notices and study announcements from faculty and peer mentors."}
            </p>
          </div>
          <div className="kasandigan-header-actions">
            <button
              type="button"
              className="btn kasandigan-btn-secondary"
              onClick={loadAnnouncements}
            >
              Refresh Feed
            </button>
          </div>
        </header>

        <div className="announcements-grid">
          <div className="announcements-main">
            {isMentor && (
              <section
                className="announcement-card announcement-card--composer kasandigan-card"
                ref={composerRef}
                aria-labelledby="announcement-composer-title"
              >
                <h2
                  className="announcement-section-title"
                  id="announcement-composer-title"
                >
                  Post an announcement
                </h2>

                <div className="announcement-field">
                  <label
                    className="announcement-field-label"
                    htmlFor="announcement-message"
                  >
                    Message
                  </label>
                  <textarea
                    id="announcement-message"
                    ref={messageRef}
                    className="announcement-input announcement-textarea"
                    placeholder="Write your message or notification…"
                    value={announcementMessage}
                    onChange={(e) => setAnnouncementMessage(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="announcement-field">
                  <span
                    className="announcement-field-label"
                    id="announcement-audience-label"
                  >
                    Send to
                  </span>
                  <AudienceSegmentedControl
                    value={announcementTargetType}
                    onChange={handleAudienceChange}
                    labelledBy="announcement-audience-label"
                  />
                </div>

                {announcementTargetType === "specific" && (
                  <div className="announcement-recipients" aria-live="polite">
                    <div className="announcement-recipients-head">
                      <p className="announcement-recipients-title">
                        Choose mentees
                      </p>
                      <p className="announcement-recipients-meta">
                        {menteeCount === 0
                          ? "No mentees available"
                          : `${announcementRecipientIds.length} of ${menteeCount} selected`}
                      </p>
                    </div>
                    {menteeCount > 0 ? (
                      <div
                        className="announcement-chip-group"
                        role="group"
                        aria-label="Mentee recipients"
                      >
                        {announcementMenteeOptions.map((m) => {
                          const selected = announcementRecipientIds.includes(
                            m.id,
                          );
                          return (
                            <button
                              key={m.id}
                              type="button"
                              role="checkbox"
                              aria-checked={selected}
                              className={
                                "announcement-chip" +
                                (selected ? " is-selected" : "")
                              }
                              onClick={() => toggleRecipient(m.id)}
                            >
                              <span
                                className="announcement-chip-check"
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                              {m.display_name || m.username}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="announcement-empty-note">
                        You have no accepted mentees yet. Pair with mentees in
                        Matching first to send to specific mentees.
                      </p>
                    )}
                  </div>
                )}

                <div className="announcement-composer-actions">
                  <span className="announcement-composer-hint">
                    {announcementTargetType === "all"
                      ? `Goes to all ${menteeCount} of your mentees.`
                      : `Goes to ${announcementRecipientIds.length} selected mentee${announcementRecipientIds.length === 1 ? "" : "s"}.`}
                  </span>
                  <button
                    type="button"
                    className="btn announcement-post-submit"
                    onClick={postAnnouncement}
                    disabled={
                      !announcementMessage.trim() ||
                      postAnnouncementLoading ||
                      (announcementTargetType === "specific" &&
                        announcementRecipientIds.length === 0)
                    }
                  >
                    {postAnnouncementLoading ? (
                      <Spinner inline />
                    ) : (
                      "Post announcement"
                    )}
                  </button>
                </div>
              </section>
            )}

            <section
              className="announcements-feed announcements-list"
              aria-labelledby="announcements-feed-title"
            >
              <div className="announcements-feed-head">
                <h2
                  className="announcement-section-title"
                  id="announcements-feed-title"
                >
                  Recent announcements
                </h2>
                {!announcementsLoading && announcements.length > 0 && (
                  <span className="announcements-feed-count">
                    {announcements.length} total
                  </span>
                )}
              </div>
              {announcementsLoading &&
                [1, 2].map((i) => (
                  <div key={i} className="announcement-card-skeleton">
                    <div className="loading-skeleton" />
                    <div className="loading-skeleton" />
                    <div className="loading-skeleton" />
                    <div className="loading-skeleton" />
                  </div>
                ))}
              {!announcementsLoading && announcements.length === 0 && (
                <div className="fancy-empty announcements-empty kasandigan-card">
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
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <p className="muted">No announcements yet.</p>
                  <div className="btn-row announcements-empty-actions">
                    {isMentor ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={focusComposer}
                      >
                        Write your first announcement
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={loadAnnouncements}
                      >
                        Refresh announcements
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!announcementsLoading &&
                announcements.length > 0 &&
                announcements.map((ann) => (
                  <article
                    key={ann.id}
                    className="announcement-card announcement-card--post kasandigan-card"
                  >
                    <div className="announcement-header">
                      <span className="announcement-author">
                        {ann.mentor_display_name || ann.mentor_username}
                      </span>
                      <span className="announcement-date">
                        {formatDate(ann.created_at)}
                      </span>
                      {user.role === "mentor" &&
                        String(ann.mentor_user_id) === String(user.id) &&
                        handleDeleteAnnouncement && (
                          <button
                            type="button"
                            className="btn danger small announcement-delete-btn"
                            style={{ marginLeft: "auto" }}
                            onClick={() => handleDeleteAnnouncement(ann.id)}
                            title="Delete announcement"
                            aria-label="Delete announcement"
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              style={{ flexShrink: 0 }}
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            <span>Delete</span>
                          </button>
                        )}
                    </div>
                    {(ann.recipient_display_names &&
                      ann.recipient_display_names.length > 0) ||
                    (ann.recipient_usernames &&
                      ann.recipient_usernames.length > 0) ? (
                      <p className="announcement-to">
                        To:{" "}
                        {(ann.recipient_display_names &&
                        ann.recipient_display_names.length > 0
                          ? ann.recipient_display_names
                          : ann.recipient_usernames
                        ).join(", ")}
                      </p>
                    ) : (
                      <p className="announcement-to">To: Everyone</p>
                    )}
                    <p className="announcement-message">{ann.message}</p>
                    <CommentThread
                      targetType="announcement"
                      targetId={ann.id}
                      comments={commentsByKey}
                      loadComments={loadComments}
                      addComment={addComment}
                      commentKey={commentKey}
                    />
                  </article>
                ))}
            </section>
          </div>

          <aside className="announcements-rail" aria-label="Announcement summary">
            <section className="announcement-card announcement-card--rail kasandigan-card">
              <div className="announcement-card-head">
                <h2 className="announcement-card-title">At a glance</h2>
              </div>
              <div className="announcement-stat-grid">
                <div className="announcement-stat">
                  <span className="announcement-stat-value">
                    {announcements.length}
                  </span>
                  <span className="announcement-stat-label">Announcements</span>
                </div>
                {isMentor && (
                  <div className="announcement-stat">
                    <span className="announcement-stat-value">
                      {menteeCount}
                    </span>
                    <span className="announcement-stat-label">Mentees</span>
                  </div>
                )}
              </div>
              <p className="announcement-rail-note">
                {latestAnnouncement
                  ? `Last posted ${formatDate(latestAnnouncement.created_at)}.`
                  : isMentor
                    ? "Nothing posted yet — your first announcement will appear here."
                    : "Nothing from your mentors yet."}
              </p>
            </section>

            {isMentor && (
              <section className="announcement-card announcement-card--rail kasandigan-card">
                <div className="announcement-card-head">
                  <h2 className="announcement-card-title">Your mentees</h2>
                  <span className="announcement-recipients-meta">
                    {announcementTargetType === "specific"
                      ? `${announcementRecipientIds.length} targeted`
                      : "All targeted"}
                  </span>
                </div>
                {menteeCount > 0 ? (
                  <ul className="announcement-roster">
                    {announcementMenteeOptions.map((m) => (
                      <li
                        key={m.id}
                        className={
                          "announcement-roster-item" +
                          (announcementTargetType === "all" ||
                          announcementRecipientIds.includes(m.id)
                            ? " is-selected"
                            : "")
                        }
                      >
                        {m.display_name || m.username}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="announcement-empty-note">
                    No accepted mentees yet.
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.announcements = AnnouncementsPage;
  window.DashboardApp.CommentThread = CommentThread;
  window.DashboardApp.formatCommentDate = formatDate;
  if (typeof module !== "undefined" && module.exports)
    module.exports = { AnnouncementsPage, CommentThread };
})();
