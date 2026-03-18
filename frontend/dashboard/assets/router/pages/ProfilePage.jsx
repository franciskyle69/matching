(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const { getCookie, fetchJSON, formatDate } = window.DashboardApp.Utils || {};
  const PLACEHOLDER_AVATAR = window.DashboardApp.PLACEHOLDER_AVATAR || "";

  function relativeTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const sec = Math.floor((now - d) / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return min + "m ago";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + "h ago";
    const day = Math.floor(hr / 24);
    if (day < 7) return day + "d ago";
    return d.toLocaleDateString();
  }

  const CATEGORY_LABELS = { achievement: "Achievement", project: "Project", update: "Update" };
  const CATEGORY_ICONS = { achievement: "\u{1F3C6}", project: "\u{1F4BB}", update: "\u{1F4DD}" };
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

  /* ── Shared sub-components ── */

  function StatBlock({ value, label }) {
    return (
      <div className="sp-stat">
        <span className="sp-stat-value">{value ?? 0}</span>
        <span className="sp-stat-label">{label}</span>
      </div>
    );
  }

  function PostComposerTrigger({ avatarUrl, username, onClick }) {
    const name = username || "there";
    return (
      <button type="button" className="sp-whats-on-your-mind" onClick={onClick} aria-label={"Create a post. What's on your mind, " + name + "?"}>
        <div className="sp-woym-avatar">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span className="sp-woym-avatar-fallback">{(name || "?")[0].toUpperCase()}</span>}
        </div>
        <span className="sp-woym-placeholder">What&apos;s on your mind, {name}?</span>
      </button>
    );
  }

  function PostComposer({ onPost, posting }) {
    const [text, setText] = useState("");
    const [category, setCategory] = useState("update");
    const [imageFile, setImageFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [fileError, setFileError] = useState("");
    const fileRef = useRef(null);
    const dragCounter = useRef(0);

    function validateAndSet(file) {
      setFileError("");
      if (!file) return;
      if (!ALLOWED_TYPES.includes(file.type)) { setFileError("Only image files are allowed (JPEG, PNG, GIF, WebP, SVG)."); return; }
      if (file.size > MAX_FILE_SIZE) { setFileError("Image must be under 10 MB."); return; }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
    function handleFileInput(e) { validateAndSet(e.target.files?.[0]); }
    function handleDragEnter(e) { e.preventDefault(); e.stopPropagation(); dragCounter.current++; setDragOver(true); }
    function handleDragLeave(e) { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragOver(false); } }
    function handleDragOver(e) { e.preventDefault(); e.stopPropagation(); }
    function handleDrop(e) { e.preventDefault(); e.stopPropagation(); dragCounter.current = 0; setDragOver(false); validateAndSet(e.dataTransfer?.files?.[0]); }
    function removeImage() { setImageFile(null); setPreview(null); setFileError(""); if (fileRef.current) fileRef.current.value = ""; }
    function submit() { if (!text.trim() && !imageFile) return; onPost({ text, category, imageFile }); setText(""); setCategory("update"); removeImage(); }

    return (
      <div className="sp-composer">
        <textarea className="sp-composer-input" placeholder="Share an achievement, project, or update\u2026" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        {preview ? (
          <div className="sp-composer-preview">
            <img src={preview} alt="Preview" />
            <button type="button" className="sp-composer-preview-remove" onClick={removeImage} aria-label="Remove image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <button type="button" className="sp-composer-preview-replace" onClick={() => fileRef.current?.click()} aria-label="Replace image">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </button>
          </div>
        ) : (
          <div className={"sp-dropzone" + (dragOver ? " sp-dropzone-active" : "")} onClick={() => fileRef.current?.click()} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>
            <div className="sp-dropzone-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <p className="sp-dropzone-text">Drag & drop or <span className="sp-dropzone-link">click to upload</span></p>
            <span className="sp-dropzone-hint">JPEG, PNG, GIF, WebP up to 10 MB</span>
          </div>
        )}
        {fileError && <p className="sp-file-error">{fileError}</p>}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileInput} />
        <div className="sp-composer-bar">
          <div className="sp-composer-actions">
            <div className="sp-category-pills">
              {["update", "achievement", "project"].map((c) => (
                <button key={c} type="button" className={"sp-category-pill" + (category === c ? " active" : "")} onClick={() => setCategory(c)}>
                  {CATEGORY_ICONS[c]} {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <button className="btn small" onClick={submit} disabled={posting || (!text.trim() && !imageFile)}>{posting ? "Posting\u2026" : "Post"}</button>
        </div>
      </div>
    );
  }

  function PostCard({ post, onLike, onDelete, isOwner, onOpen }) {
    return (
      <div className="sp-post-card">
        <div className="sp-post-header">
          <div className="sp-post-author-avatar">
            {post.author_avatar ? <img src={post.author_avatar} alt="" /> : <span className="sp-post-author-fallback">{(post.author_username || "?")[0].toUpperCase()}</span>}
          </div>
          <div className="sp-post-meta">
            <span className="sp-post-author-name">{post.author_username}</span>
            <span className="sp-post-time">{relativeTime(post.created_at)}</span>
          </div>
          <span className={"sp-post-category-badge sp-cat-" + post.category}>{CATEGORY_ICONS[post.category]} {CATEGORY_LABELS[post.category]}</span>
        </div>
        <div className="sp-post-clickable" onClick={() => onOpen && onOpen(post)}>
          {post.text && <p className="sp-post-text">{post.text}</p>}
          {post.image_url && <div className="sp-post-image-wrap"><img src={post.image_url} alt="Post" className="sp-post-image" loading="lazy" /></div>}
        </div>
        <div className="sp-post-actions">
          <button type="button" className={"sp-post-action-btn" + (post.liked_by_me ? " liked" : "")} onClick={() => onLike(post.id)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={post.liked_by_me ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>{post.likes_count || 0}</span>
          </button>
          <button type="button" className="sp-post-action-btn" onClick={() => onOpen && onOpen(post)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{post.comments_count || 0}</span>
          </button>
          {isOwner && (
            <button type="button" className="sp-post-action-btn sp-post-delete" onClick={() => onDelete(post.id)} title="Delete post">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Post Detail Modal with Comments ── */

  function PostModal({ post, onClose, onLike, onPostUpdate, currentUserId, commentsCache, setCommentsCache }) {
    const [closing, setClosing] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentsLoaded, setCommentsLoaded] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
      if (!post) return;
      function onKey(e) { if (e.key === "Escape") dismiss(); }
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      const cached = commentsCache && commentsCache[post.id];
      if (cached) {
        setComments(cached);
        setCommentsLoaded(true);
      } else {
        loadComments();
      }
      return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }, [post?.id, commentsCache]);

    async function loadComments() {
      const res = await fetchJSON(`/api/posts/${post.id}/comments/`);
      if (res.ok) {
        const list = res.data.comments || [];
        setComments(list);
        setCommentsLoaded(true);
        if (typeof setCommentsCache === "function") {
          setCommentsCache((prev) => ({ ...(prev || {}), [post.id]: list }));
        }
      }
    }

    async function handleSubmitComment() {
      if (!newComment.trim() || submitting) return;
      setSubmitting(true);
      try {
        const res = await fetchJSON(`/api/posts/${post.id}/comments/create/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({ content: newComment }),
        });
        if (res.ok && res.data.comment) {
          setComments((prev) => {
            const next = [...prev, res.data.comment];
            if (typeof setCommentsCache === "function") {
              setCommentsCache((cachePrev) => ({ ...(cachePrev || {}), [post.id]: next }));
            }
            return next;
          });
          setNewComment("");
          if (onPostUpdate) onPostUpdate(post.id, { comments_count: comments.length + 1 });
          setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
        }
      } finally { setSubmitting(false); }
    }

    function handleModalLike() {
      onLike(post.id);
    }

    function dismiss() { setClosing(true); setTimeout(() => { setClosing(false); onClose(); }, 200); }

    if (!post) return null;

    return (
      <div className={"sp-modal-backdrop" + (closing ? " sp-modal-exit" : "")} onClick={dismiss}>
        <div className={"sp-pm" + (closing ? " sp-modal-exit" : "")} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="sp-modal-close" onClick={dismiss} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          {post.image_url ? (
            <div className="sp-pm-split">
              <div className="sp-pm-image-side">
                <img src={post.image_url} alt="Post" className="sp-pm-image" />
              </div>
              <div className="sp-pm-detail-side" ref={scrollRef}>
                <PostModalContent post={post} onLike={handleModalLike} comments={comments} commentsLoaded={commentsLoaded} newComment={newComment} setNewComment={setNewComment} handleSubmitComment={handleSubmitComment} submitting={submitting} />
              </div>
            </div>
          ) : (
            <div className="sp-pm-single" ref={scrollRef}>
              <PostModalContent post={post} onLike={handleModalLike} comments={comments} commentsLoaded={commentsLoaded} newComment={newComment} setNewComment={setNewComment} handleSubmitComment={handleSubmitComment} submitting={submitting} />
            </div>
          )}
        </div>
      </div>
    );
  }

  function PostModalContent({ post, onLike, comments, commentsLoaded, newComment, setNewComment, handleSubmitComment, submitting }) {
    return (
      <>
        <div className="sp-pm-header">
          <div className="sp-post-author-avatar">
            {post.author_avatar ? <img src={post.author_avatar} alt="" /> : <span className="sp-post-author-fallback">{(post.author_username || "?")[0].toUpperCase()}</span>}
          </div>
          <div className="sp-post-meta">
            <span className="sp-post-author-name">{post.author_username}</span>
            <span className="sp-post-time">{relativeTime(post.created_at)}</span>
          </div>
          <span className={"sp-post-category-badge sp-cat-" + post.category}>{CATEGORY_ICONS[post.category]} {CATEGORY_LABELS[post.category]}</span>
        </div>

        {post.text && <p className="sp-pm-text">{post.text}</p>}

        <div className="sp-pm-actions">
          <button type="button" className={"sp-post-action-btn" + (post.liked_by_me ? " liked" : "")} onClick={() => onLike(post.id)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={post.liked_by_me ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>{post.likes_count || 0} likes</span>
          </button>
          <span className="sp-pm-comment-count">{comments.length} comment{comments.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="sp-pm-divider" />

        <div className="sp-pm-comments">
          {!commentsLoaded && <p className="sp-pm-loading">Loading comments\u2026</p>}
          {commentsLoaded && comments.length === 0 && <p className="sp-pm-empty">No comments yet. Be the first!</p>}
          {comments.map((c) => (
            <div key={c.id} className="sp-pm-comment">
              <div className="sp-pm-comment-avatar">
                {c.author_avatar ? <img src={c.author_avatar} alt="" /> : <span className="sp-post-author-fallback">{(c.author_username || "?")[0].toUpperCase()}</span>}
              </div>
              <div className="sp-pm-comment-body">
                <div className="sp-pm-comment-bubble">
                  <span className="sp-pm-comment-author">{c.author_username}</span>
                  <span className="sp-pm-comment-text">{c.content}</span>
                </div>
                <span className="sp-pm-comment-time">{relativeTime(c.created_at)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="sp-pm-compose">
          <input
            type="text"
            className="sp-pm-compose-input"
            placeholder="Write a comment\u2026"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
          />
          <button type="button" className="sp-pm-compose-send" onClick={handleSubmitComment} disabled={submitting || !newComment.trim()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </>
    );
  }

  function GalleryGrid({ images, onImageClick }) {
    if (!images || images.length === 0) {
      return (
        <div className="sp-gallery-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          <p>No images yet</p>
          <span>Share an achievement or project with a photo to start your gallery</span>
        </div>
      );
    }
    return (
      <div className="sp-gallery-grid">
        {images.map((img) => (
          <button key={img.id} type="button" className="sp-gallery-item" onClick={() => onImageClick(img)}>
            <img src={img.image_url} alt={img.text || "Gallery"} loading="lazy" />
            <div className="sp-gallery-overlay">
              <div className="sp-gallery-overlay-content">
                <span className={"sp-gallery-badge sp-cat-" + img.category}>{CATEGORY_ICONS[img.category]} {CATEGORY_LABELS[img.category]}</span>
                {img.text && <p className="sp-gallery-title">{img.text.length > 60 ? img.text.slice(0, 60) + "\u2026" : img.text}</p>}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  function ImageModal({ image, onClose }) {
    const [closing, setClosing] = useState(false);
    useEffect(() => {
      if (!image) return;
      function onKey(e) { if (e.key === "Escape") dismiss(); }
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }, [image]);
    function dismiss() { setClosing(true); setTimeout(() => { setClosing(false); onClose(); }, 200); }
    if (!image) return null;
    return (
      <div className={"sp-modal-backdrop" + (closing ? " sp-modal-exit" : "")} onClick={dismiss}>
        <div className={"sp-modal-content" + (closing ? " sp-modal-exit" : "")} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="sp-modal-close" onClick={dismiss} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img src={image.image_url} alt={image.text || "Full view"} className="sp-modal-image" />
          <div className="sp-modal-body">
            <div className="sp-modal-badge-row">
              <span className={"sp-gallery-badge sp-cat-" + image.category}>{CATEGORY_ICONS[image.category]} {CATEGORY_LABELS[image.category]}</span>
              <span className="sp-modal-time">{relativeTime(image.created_at)}</span>
            </div>
            {image.text && <p className="sp-modal-caption">{image.text}</p>}
          </div>
        </div>
      </div>
    );
  }

  /* ── Cover Photo ── */

  function CoverPhoto({ coverUrl, onUpload, uploading, isOwner }) {
    const coverRef = useRef(null);
    return (
      <div className="sp-cover">
        <div className="sp-cover-clip">
          {coverUrl ? (
            <img src={coverUrl} alt="Cover" className="sp-cover-img" />
          ) : (
            <div className="sp-cover-gradient" />
          )}
        </div>
        <div className="sp-cover-overlay" />
        {isOwner && (
          <>
            <button type="button" className="sp-cover-edit-btn" onClick={() => coverRef.current?.click()} disabled={uploading}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
              {uploading ? "Uploading\u2026" : "Edit Cover"}
            </button>
            <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]); }} />
          </>
        )}
      </div>
    );
  }

  /* ── Sidebar ── */

  function Sidebar({ user, isMentor, isMentee, menteeProfile, mentorProfile, menteeMatching, profileStats, avatarUrl, setActiveTab }) {
    const subjects = isMentor ? (mentorProfile.subjects || []) : (menteeMatching.subjects || []);
    const topics = isMentor ? (mentorProfile.topics || []) : (menteeMatching.topics || []);
    const availability = isMentor ? (mentorProfile.availability || []) : (menteeMatching.availability || []);
    const bio = user.bio || "";
    const tags = Array.isArray(user.tags) ? user.tags : [];

    return (
      <aside className="sp-sidebar">
        <div className="sp-sidebar-identity">
          <div className="sp-avatar-wrap sp-avatar-wrap--lg">
            {avatarUrl ? <img src={avatarUrl} alt={user.username} className="sp-avatar-img" /> : <span className="sp-avatar-fallback">{(user.username || "?")[0].toUpperCase()}</span>}
          </div>
          <h1 className="sp-profile-name">{user.username}</h1>
          <p className="sp-profile-subtitle">
            <span className={"prof-role-badge prof-role-badge--" + (isMentor ? "mentor" : isMentee ? "mentee" : "user")}>{isMentor ? "Mentor" : isMentee ? "Mentee" : "User"}</span>
          </p>
          {user.email && <span className="sp-profile-email">{user.email}</span>}
        </div>

        {bio ? (
          <p className="sp-bio">{bio}</p>
        ) : (
          <p className="sp-bio sp-bio--empty">No bio added yet</p>
        )}

        {tags.length > 0 && (
          <div className="sp-tags-display">
            {tags.map((t) => <span key={t} className="sp-tag-pill">{t}</span>)}
          </div>
        )}

        <div className="sp-stats-row">
          <StatBlock value={profileStats.posts_count} label="Posts" />
          <StatBlock value={profileStats.connections} label="Connections" />
          <StatBlock value={profileStats.sessions_completed} label="Sessions" />
          <StatBlock value={profileStats.images_count} label="Gallery" />
        </div>

        <div className="sp-profile-actions">
          <button className="btn secondary small sp-action-full" onClick={() => setActiveTab("settings")}>Edit profile</button>
        </div>

        <div className="sp-sidebar-card">
          <h4 className="sp-sidebar-card-title">{isMentor ? "Mentor details" : isMentee ? "Student details" : "Details"}</h4>
          {isMentee && (
            <>
              <div className="sp-sidebar-row"><span className="sp-sidebar-icon">🎓</span><span>{menteeProfile.program || "—"}</span></div>
              <div className="sp-sidebar-row"><span className="sp-sidebar-icon">📅</span><span>Year {menteeProfile.year_level || "—"}</span></div>
              <div className="sp-sidebar-row"><span className="sp-sidebar-icon">🏫</span><span>{menteeProfile.campus || "—"}</span></div>
            </>
          )}
          {isMentor && (
            <>
              <div className="sp-sidebar-row"><span className="sp-sidebar-icon">⚥</span><span>{mentorProfile.gender || "—"}</span></div>
              {mentorProfile.expertise_level != null && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">📊</span><span>Expertise: {mentorProfile.expertise_level}/5</span></div>}
              {mentorProfile.capacity != null && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">👥</span><span>{mentorProfile.capacity} mentee slots</span></div>}
            </>
          )}
        </div>

        {(subjects.length > 0 || topics.length > 0) && (
          <div className="sp-sidebar-card">
            <h4 className="sp-sidebar-card-title">{isMentee ? "Difficulty areas" : "Expertise"}</h4>
            {subjects.length > 0 && <div className="prof-chip-list sp-chip-wrap">{subjects.map((s) => <span key={s} className="prof-chip prof-chip--accent">{s}</span>)}</div>}
            {topics.length > 0 && <div className="prof-chip-list sp-chip-wrap">{topics.map((t) => <span key={t} className="prof-chip">{t}</span>)}</div>}
          </div>
        )}

        {availability.length > 0 && (
          <div className="sp-sidebar-card">
            <h4 className="sp-sidebar-card-title">Availability</h4>
            <div className="sp-sidebar-avail">{availability.map((s) => <span key={s} className="prof-avail-slot"><span className="prof-avail-clock">🕒</span>{s}</span>)}</div>
          </div>
        )}
      </aside>
    );
  }

  /* ── Viewed Mentor Profile (from matching page) ── */

  function ViewedMentorProfile({ match, onBack, chooseMentor, chosenMentorId, isMentee }) {
    const mentor = match.mentor || {};
    const d = match.match_details || {};
    const mentorSubjects = mentor.subjects?.length ? mentor.subjects : d.mentor_subjects || [];
    const mentorTopics = mentor.topics?.length ? mentor.topics : d.mentor_topics || [];
    const availability = Array.isArray(mentor.availability) ? mentor.availability : [];

    return (
      <div className="sp-wide">
        <div className="sp-cover">
          <div className="sp-cover-clip">
            <div className="sp-cover-gradient" />
          </div>
          <div className="sp-cover-overlay" />
        </div>
        <div className="sp-layout">
          <aside className="sp-sidebar">
            <div className="sp-sidebar-identity">
              <div className="sp-avatar-wrap sp-avatar-wrap--lg">
                <img src={mentor.avatar_url || PLACEHOLDER_AVATAR} alt={match.mentor_username} className="sp-avatar-img" />
              </div>
              <h1 className="sp-profile-name">{match.mentor_username}</h1>
              <p className="sp-profile-subtitle"><span className="prof-role-badge prof-role-badge--mentor">Mentor</span></p>
              {mentor.role && <span className="sp-profile-email">{mentor.role}</span>}
            </div>
            <div className="sp-profile-actions">
              {isMentee && typeof chooseMentor === "function" && match.mentor_id && (
                <button className="btn small sp-action-full" onClick={() => chooseMentor(match.mentor_id)} disabled={chosenMentorId === match.mentor_id}>
                  {chosenMentorId === match.mentor_id ? "Requested" : "Request this mentor"}
                </button>
              )}
              <button className="btn secondary small sp-action-full" onClick={onBack}>Back to Matching</button>
            </div>
            <div className="sp-sidebar-card">
              <h4 className="sp-sidebar-card-title">About</h4>
              <div className="sp-sidebar-row"><span className="sp-sidebar-icon">⚥</span><span>{mentor.gender || "—"}</span></div>
              {mentor.expertise_level != null && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">📊</span><span>Expertise: {mentor.expertise_level}/5</span></div>}
              {mentor.capacity != null && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">👥</span><span>{mentor.capacity} mentee slots</span></div>}
            </div>
            {(mentorSubjects.length > 0 || mentorTopics.length > 0) && (
              <div className="sp-sidebar-card">
                <h4 className="sp-sidebar-card-title">Expertise</h4>
                {mentorSubjects.length > 0 && <div className="prof-chip-list sp-chip-wrap">{mentorSubjects.map((s) => <span key={s} className="prof-chip prof-chip--accent">{s}</span>)}</div>}
                {mentorTopics.length > 0 && <div className="prof-chip-list sp-chip-wrap">{mentorTopics.map((t) => <span key={t} className="prof-chip">{t}</span>)}</div>}
              </div>
            )}
            {availability.length > 0 && (
              <div className="sp-sidebar-card">
                <h4 className="sp-sidebar-card-title">Availability</h4>
                <div className="sp-sidebar-avail">{availability.map((s) => <span key={s} className="prof-avail-slot"><span className="prof-avail-clock">🕒</span>{s}</span>)}</div>
              </div>
            )}
          </aside>
          <main className="sp-main">
            <p className="muted" style={{ textAlign: "center", padding: "40px 0" }}>Visit this mentor's full profile to see their posts and gallery.</p>
          </main>
        </div>
      </div>
    );
  }

  /* ── Viewed User Profile (from search) ── */

  function ViewedUserProfile({ profile, onBack, currentUser }) {
    const [tab, setTab] = useState("posts");
    const [posts, setPosts] = useState([]);
    const [galleryImages, setGalleryImages] = useState([]);
    const [postsLoaded, setPostsLoaded] = useState(false);
    const [galleryLoaded, setGalleryLoaded] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [openPost, setOpenPost] = useState(null);
    const [commentsCache, setCommentsCache] = useState({});

    const userId = profile.id;

    async function loadPosts() {
      const res = await fetchJSON(`/api/posts/?user_id=${userId}`);
      if (res.ok) { setPosts(res.data.posts || []); setPostsLoaded(true); }
    }
    async function loadGallery() {
      const res = await fetchJSON(`/api/gallery/?user_id=${userId}`);
      if (res.ok) { setGalleryImages(res.data.images || []); setGalleryLoaded(true); }
    }

    useEffect(() => { loadPosts(); }, [userId]);
    useEffect(() => { if (tab === "gallery" && !galleryLoaded) loadGallery(); }, [tab]);

    async function handleLike(postId) {
      const res = await fetchJSON(`/api/posts/${postId}/like/`, { method: "POST", headers: { "X-CSRFToken": getCookie("csrftoken") } });
      if (res.ok) {
        const update = { liked_by_me: res.data.liked, likes_count: res.data.likes_count };
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, ...update } : p));
        setOpenPost((prev) => prev && prev.id === postId ? { ...prev, ...update } : prev);
      }
    }

    function handlePostUpdate(postId, fields) {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, ...fields } : p));
      setOpenPost((prev) => prev && prev.id === postId ? { ...prev, ...fields } : prev);
    }

    async function handleGalleryImageClick(img) {
      const post = posts.find((p) => p.id === img.id);
      if (post) { setOpenPost(post); return; }
      const res = await fetchJSON(`/api/posts/${img.id}/`);
      if (res.ok && res.data.post) setOpenPost(res.data.post);
      else setLightboxImage(img);
    }

    const isMentor = profile.role === "mentor";
    const isMentee = profile.role === "mentee";
    const subjects = profile.subjects || [];
    const topics = profile.topics || [];
    const availability = profile.availability || [];
    const bio = profile.bio || "";
    const tags = profile.tags || [];
    const details = profile.details || {};

    return (
      <div className="sp-wide">
        <div className="sp-cover">
          <div className="sp-cover-clip">
            {profile.cover_url ? <img src={profile.cover_url} alt="Cover" className="sp-cover-img" /> : <div className="sp-cover-gradient" />}
          </div>
          <div className="sp-cover-overlay" />
        </div>
        <div className="sp-layout">
          <aside className="sp-sidebar">
            <div className="sp-sidebar-identity">
              <div className="sp-avatar-wrap sp-avatar-wrap--lg">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} className="sp-avatar-img" /> : <span className="sp-avatar-fallback">{(profile.username || "?")[0].toUpperCase()}</span>}
              </div>
              <h1 className="sp-profile-name">{profile.username}</h1>
              <p className="sp-profile-subtitle">
                <span className={"prof-role-badge prof-role-badge--" + (isMentor ? "mentor" : isMentee ? "mentee" : "user")}>{isMentor ? "Mentor" : isMentee ? "Mentee" : "User"}</span>
              </p>
            </div>

            {bio ? <p className="sp-bio">{bio}</p> : <p className="sp-bio sp-bio--empty">No bio added yet</p>}

            {tags.length > 0 && (
              <div className="sp-tags-display">
                {tags.map((t) => <span key={t} className="sp-tag-pill">{t}</span>)}
              </div>
            )}

            <div className="sp-stats-row">
              <StatBlock value={profile.posts_count} label="Posts" />
              <StatBlock value={profile.images_count} label="Gallery" />
            </div>

            <div className="sp-profile-actions">
              <button className="btn secondary small sp-action-full" onClick={onBack}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
            </div>

            {Object.keys(details).length > 0 && (
              <div className="sp-sidebar-card">
                <h4 className="sp-sidebar-card-title">{isMentor ? "Mentor details" : isMentee ? "Student details" : "Details"}</h4>
                {isMentee && (
                  <>
                    {details.program && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">🎓</span><span>{details.program}</span></div>}
                    {details.year_level && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">📅</span><span>Year {details.year_level}</span></div>}
                    {details.campus && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">🏫</span><span>{details.campus}</span></div>}
                  </>
                )}
                {isMentor && (
                  <>
                    {details.gender && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">⚥</span><span>{details.gender}</span></div>}
                    {details.expertise_level != null && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">📊</span><span>Expertise: {details.expertise_level}/5</span></div>}
                    {details.capacity != null && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">👥</span><span>{details.capacity} mentee slots</span></div>}
                    {details.role && <div className="sp-sidebar-row"><span className="sp-sidebar-icon">💼</span><span>{details.role}</span></div>}
                  </>
                )}
              </div>
            )}

            {(subjects.length > 0 || topics.length > 0) && (
              <div className="sp-sidebar-card">
                <h4 className="sp-sidebar-card-title">{isMentee ? "Difficulty areas" : "Expertise"}</h4>
                {subjects.length > 0 && <div className="prof-chip-list sp-chip-wrap">{subjects.map((s) => <span key={s} className="prof-chip prof-chip--accent">{s}</span>)}</div>}
                {topics.length > 0 && <div className="prof-chip-list sp-chip-wrap">{topics.map((t) => <span key={t} className="prof-chip">{t}</span>)}</div>}
              </div>
            )}

            {availability.length > 0 && (
              <div className="sp-sidebar-card">
                <h4 className="sp-sidebar-card-title">Availability</h4>
                <div className="sp-sidebar-avail">{availability.map((s) => <span key={s} className="prof-avail-slot"><span className="prof-avail-clock">🕒</span>{s}</span>)}</div>
              </div>
            )}
          </aside>

          <main className="sp-main">
            <div className="sp-tabs">
              {["posts", "gallery"].map((t) => (
                <button key={t} type="button" className={"sp-tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
                  {t === "posts" ? "Posts" : "Gallery"}
                </button>
              ))}
            </div>
            <div className="sp-main-body">
              {tab === "posts" && (
                <>
                  {posts.length === 0 && postsLoaded && <p className="muted" style={{ textAlign: "center", padding: "32px 0" }}>No posts yet.</p>}
                  {posts.map((p) => <PostCard key={p.id} post={p} onLike={handleLike} onDelete={() => {}} isOwner={false} onOpen={setOpenPost} />)}
                </>
              )}
              {tab === "gallery" && <GalleryGrid images={galleryImages} onImageClick={handleGalleryImageClick} />}
            </div>
          </main>
        </div>

        {lightboxImage && <ImageModal image={lightboxImage} onClose={() => setLightboxImage(null)} />}
        {openPost && (
          <PostModal
            post={openPost}
            onClose={() => setOpenPost(null)}
            onLike={handleLike}
            onPostUpdate={handlePostUpdate}
            currentUserId={currentUser?.id}
            commentsCache={commentsCache}
            setCommentsCache={setCommentsCache}
          />
        )}
      </div>
    );
  }

  /* ── Main Profile Page ── */

  function ProfilePage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      user, menteeProfile, mentorProfile, menteeMatching,
      viewedMentorProfile, setViewedMentorProfile, mentorProfileHashId, setMentorProfileHashId,
      setActiveTab, chooseMentor, chosenMentorId, loadMe,
      viewedUserProfile, setViewedUserProfile,
      postsFeed, postsFeedLoaded, loadPostsFeed, setPostsFeed,
    } = ctx;

    const isMentor = user.role === "mentor";
    const isMentee = user.role === "mentee";

    const [tab, setTab] = useState("posts");
    const [posts, setPosts] = useState(() => postsFeed || []);
    const [galleryImages, setGalleryImages] = useState([]);
    const [profileStats, setProfileStats] = useState({});
    const [posting, setPosting] = useState(false);
    const [postsLoaded, setPostsLoaded] = useState(false);
    const [galleryLoaded, setGalleryLoaded] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [coverUploading, setCoverUploading] = useState(false);
    const [openPost, setOpenPost] = useState(null);
    const [showComposerModal, setShowComposerModal] = useState(false);
    const [commentsCache, setCommentsCache] = useState({});

    async function loadGallery() { const res = await fetchJSON("/api/gallery/"); if (res.ok) { setGalleryImages(res.data.images || []); setGalleryLoaded(true); } }
    async function loadStats() { const res = await fetchJSON("/api/profile-stats/"); if (res.ok) setProfileStats(res.data || {}); }

    useEffect(() => {
      if (viewedMentorProfile) return;
      loadStats();
      if (postsFeedLoaded) {
        setPosts(postsFeed || []);
        setPostsLoaded(true);
      } else {
        (async () => {
          await loadPostsFeed();
        })();
      }
    }, [viewedMentorProfile, postsFeedLoaded, postsFeed]);
    useEffect(() => { if (tab === "gallery" && !galleryLoaded) loadGallery(); }, [tab]);
    useEffect(() => {
      if (!showComposerModal) return;
      function onKey(e) { if (e.key === "Escape") setShowComposerModal(false); }
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }, [showComposerModal]);

    async function handlePost({ text, category, imageFile }) {
      setPosting(true);
      try {
        const fd = new FormData();
        fd.append("text", text); fd.append("category", category);
        if (imageFile) fd.append("image", imageFile);
        const res = await fetchJSON("/api/posts/create/", { method: "POST", headers: { "X-CSRFToken": getCookie("csrftoken") }, body: fd, raw: true });
        if (res.ok && res.data.post) {
          setPosts((prev) => [res.data.post, ...prev]);
          setPostsFeed((prev) => [res.data.post, ...(prev || [])]);
          loadStats();
          if (res.data.post.image_url) setGalleryLoaded(false);
          return true;
        }
        return false;
      } finally { setPosting(false); }
    }

    async function handleLike(postId) {
      const res = await fetchJSON(`/api/posts/${postId}/like/`, { method: "POST", headers: { "X-CSRFToken": getCookie("csrftoken") } });
      if (res.ok) {
        const update = { liked_by_me: res.data.liked, likes_count: res.data.likes_count };
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, ...update } : p));
        setPostsFeed((prev) => (prev || []).map((p) => p.id === postId ? { ...p, ...update } : p));
        setOpenPost((prev) => prev && prev.id === postId ? { ...prev, ...update } : prev);
      }
    }

    function handlePostUpdate(postId, fields) {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, ...fields } : p));
      setPostsFeed((prev) => (prev || []).map((p) => p.id === postId ? { ...p, ...fields } : p));
      setOpenPost((prev) => prev && prev.id === postId ? { ...prev, ...fields } : prev);
    }

    async function handleGalleryImageClick(img) {
      const post = posts.find((p) => p.id === img.id);
      if (post) { setOpenPost(post); return; }
      const res = await fetchJSON(`/api/posts/${img.id}/`);
      if (res.ok && res.data.post) setOpenPost(res.data.post);
      else setLightboxImage(img);
    }

    async function handleDelete(postId) {
      const res = await fetchJSON(`/api/posts/${postId}/delete/`, { method: "POST", headers: { "X-CSRFToken": getCookie("csrftoken") } });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setPostsFeed((prev) => (prev || []).filter((p) => p.id !== postId));
        loadStats();
        setGalleryLoaded(false);
      }
    }

    async function handleCoverUpload(file) {
      setCoverUploading(true);
      try {
        const fd = new FormData();
        fd.append("cover", file);
        const res = await fetchJSON("/api/me/cover/", { method: "POST", headers: { "X-CSRFToken": getCookie("csrftoken") }, body: fd, raw: true });
        if (res.ok && res.data.cover_url) { if (typeof loadMe === "function") loadMe(); }
      } finally { setCoverUploading(false); }
    }

    if (viewedUserProfile) {
      return <ViewedUserProfile profile={viewedUserProfile} currentUser={user} onBack={() => setViewedUserProfile(null)} />;
    }

    if (viewedMentorProfile) {
      return <ViewedMentorProfile match={viewedMentorProfile} isMentee={isMentee} chooseMentor={chooseMentor} chosenMentorId={chosenMentorId} onBack={() => { setViewedMentorProfile(null); setMentorProfileHashId && setMentorProfileHashId(null); }} />;
    }

    const avatarUrl = user.avatar_url || menteeProfile?.avatar_url || mentorProfile?.avatar_url;
    const coverUrl = user.cover_url || "";

    return (
      <div className="sp-wide">
        <CoverPhoto coverUrl={coverUrl} onUpload={handleCoverUpload} uploading={coverUploading} isOwner={true} />

        <div className="sp-layout">
          <Sidebar user={user} isMentor={isMentor} isMentee={isMentee} menteeProfile={menteeProfile || {}} mentorProfile={mentorProfile || {}} menteeMatching={menteeMatching || {}} profileStats={profileStats} avatarUrl={avatarUrl} setActiveTab={setActiveTab} />

          <main className="sp-main">
            <div className="sp-tabs">
              {["posts", "gallery"].map((t) => (
                <button key={t} type="button" className={"sp-tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
                  {t === "posts" ? "Posts" : "Gallery"}
                </button>
              ))}
            </div>

            <div className="sp-main-body">
              {tab === "posts" && (
                <>
                  <PostComposerTrigger avatarUrl={avatarUrl} username={user.username} onClick={() => setShowComposerModal(true)} />
                  {posts.length === 0 && postsLoaded && <p className="muted" style={{ textAlign: "center", padding: "32px 0" }}>No posts yet. Share your first achievement or update!</p>}
                  {posts.map((p) => <PostCard key={p.id} post={p} onLike={handleLike} onDelete={handleDelete} isOwner={p.author_id === user.id} onOpen={setOpenPost} />)}
                </>
              )}
              {tab === "gallery" && <GalleryGrid images={galleryImages} onImageClick={handleGalleryImageClick} />}
            </div>
          </main>
        </div>

        {showComposerModal && (
          <div className="sp-composer-modal-backdrop" onClick={() => setShowComposerModal(false)}>
            <div className="sp-composer-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-composer-modal-header">
                <h3 className="sp-composer-modal-title">Create post</h3>
                <button type="button" className="sp-composer-modal-close" onClick={() => setShowComposerModal(false)} aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="sp-composer-modal-body">
                <PostComposer
                  onPost={async (payload) => {
                    const success = await handlePost(payload);
                    if (success) setShowComposerModal(false);
                  }}
                  posting={posting}
                />
              </div>
            </div>
          </div>
        )}

        {lightboxImage && <ImageModal image={lightboxImage} onClose={() => setLightboxImage(null)} />}
        {openPost && (
          <PostModal
            post={openPost}
            onClose={() => setOpenPost(null)}
            onLike={handleLike}
            onPostUpdate={handlePostUpdate}
            currentUserId={user.id}
            commentsCache={commentsCache}
            setCommentsCache={setCommentsCache}
          />
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.profile = ProfilePage;
})();
