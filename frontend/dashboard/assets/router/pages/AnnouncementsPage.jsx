(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (sameDay) return "Today at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { dateStyle: "medium" }) + " at " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function CommentThread({ targetType, targetId, comments, loadComments, addComment, commentKey }) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const keyFn = typeof commentKey === "function" ? commentKey : (t, id) => t + ":" + id;
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
        <button type="button" className="comment-thread-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide" : "Show"} comments {list.length > 0 && <span className="comment-count">({list.length})</span>}
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
                    <span className="comment-author">{c.author_username}</span>
                    <span className="comment-meta"> · {formatDate(c.created_at)}</span>
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
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              />
              <button type="button" className="btn small" onClick={handleSubmit} disabled={!input.trim() || submitting}>
                {submitting ? "Posting…" : "Comment"}
              </button>
            </div>
          </div>
        )}
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

    function toggleRecipient(id) {
      setAnnouncementRecipientIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }

    return (
      <div className="home-dashboard-space announcements-page">
        <h1 className="page-title">Announcements</h1>
        <p className="page-subtitle">
          {isMentor ? "Post announcements to your mentees. They can comment below." : "Announcements from your mentors. You can add comments."}
        </p>

        {isMentor && (
          <div className="announcement-post-card">
            <label className="announcement-post-label">Post an announcement</label>
            <textarea
              className="announcement-post-input"
              placeholder="Write your message or notification…"
              value={announcementMessage}
              onChange={(e) => setAnnouncementMessage(e.target.value)}
              rows={4}
            />
            <div className="announcement-send-to">
              <span className="announcement-send-to-label">Send to</span>
              <label className="radio-inline">
                <input
                  type="radio"
                  name="announcement-target"
                  checked={announcementTargetType === "all"}
                  onChange={() => { setAnnouncementTargetType("all"); setAnnouncementRecipientIds([]); }}
                />
                <span>All my mentees</span>
              </label>
              <label className="radio-inline">
                <input
                  type="radio"
                  name="announcement-target"
                  checked={announcementTargetType === "specific"}
                  onChange={() => setAnnouncementTargetType("specific")}
                />
                <span>Specific mentees</span>
              </label>
            </div>
            {announcementTargetType === "specific" && announcementMenteeOptions.length > 0 && (
              <div className="announcement-recipients-checkboxes">
                {announcementMenteeOptions.map((m) => (
                  <label key={m.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={announcementRecipientIds.includes(m.id)}
                      onChange={() => toggleRecipient(m.id)}
                    />
                    <span>{m.username}</span>
                  </label>
                ))}
              </div>
            )}
            {announcementTargetType === "specific" && announcementMenteeOptions.length === 0 && (
              <p className="muted announcement-no-mentees">You have no mentees with sessions yet. Schedule a session first to send to specific mentees.</p>
            )}
            <div className="btn-row" style={{ marginTop: "12px" }}>
              <button
                className="btn"
                onClick={postAnnouncement}
                disabled={
                  !announcementMessage.trim() ||
                  postAnnouncementLoading ||
                  (announcementTargetType === "specific" && announcementRecipientIds.length === 0)
                }
              >
                {postAnnouncementLoading ? <span className="loading-inline"><Spinner inline /> Posting…</span> : "Post announcement"}
              </button>
            </div>
          </div>
        )}

        <section className="announcements-list">
          <h2 className="section-title">Recent announcements</h2>
          {announcementsLoading && (
            <>
              {[1, 2].map((i) => (
                <div key={i} className="announcement-card-skeleton">
                  <div className="loading-skeleton" /><div className="loading-skeleton" /><div className="loading-skeleton" /><div className="loading-skeleton" />
                </div>
              ))}
            </>
          )}
          {!announcementsLoading && announcements.length === 0 && (
            <div className="fancy-empty announcements-empty">
              <span className="fancy-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </span>
              <p className="muted">No announcements yet.</p>
              <div className="btn-row" style={{ marginTop: "10px" }}>
                {isMentor ? (
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  >
                    Post first announcement
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
          {!announcementsLoading && announcements.length > 0 && announcements.map((ann) => (
            <article key={ann.id} className="announcement-card">
              <div className="announcement-header">
                <span className="announcement-author">{ann.mentor_username}</span>
                <span className="announcement-date">{formatDate(ann.created_at)}</span>
                {user.role === "mentor" && ann.mentor_username === user.username && handleDeleteAnnouncement && (
                  <button type="button" className="btn danger small" style={{ marginLeft: "auto" }} onClick={() => handleDeleteAnnouncement(ann.id)}>Delete</button>
                )}
              </div>
              {(ann.recipient_usernames && ann.recipient_usernames.length > 0) ? (
                <p className="announcement-to">To: {ann.recipient_usernames.join(", ")}</p>
              ) : (
                <p className="announcement-to">To: Everyone</p>
              )}
              <div className="announcement-message">{ann.message}</div>
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
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.announcements = AnnouncementsPage;
  window.DashboardApp.CommentThread = CommentThread;
  window.DashboardApp.formatCommentDate = formatDate;
  if (typeof module !== "undefined" && module.exports) module.exports = { AnnouncementsPage, CommentThread };
})();
