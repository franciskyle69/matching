(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect, useMemo, useRef, useState } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function getInitials(name, fallback) {
    const source = (name || fallback || "").trim();
    if (!source) return "U";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function shortenFileName(fileName, maxLen = 42) {
    const text = String(fileName || "");
    if (!text) return "Verification document";
    if (text.length <= maxLen) return text;
    const extIndex = text.lastIndexOf(".");
    if (extIndex <= 0) return text.slice(0, maxLen - 1) + "…";
    const ext = text.slice(extIndex);
    const keep = Math.max(12, maxLen - ext.length - 1);
    return text.slice(0, keep) + "…" + ext;
  }

  function isImageFile(href, fileName) {
    const target = String(fileName || href || "").toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(target);
  }

  function normalizeCloudinaryPdfUrl(href) {
    return String(href || "").trim();
  }

  function getFileTypeLabel(href, fileName) {
    const target = String(fileName || href || "").toLowerCase();
    if (/\.pdf(\?|$)/.test(target)) return "PDF";
    if (/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(target)) return "Image";
    return "File";
  }

  function buildViewerSrc(href, page, zoom) {
    const clean = String(href || "").trim();
    if (!clean) return "";
    const base = clean.split("#")[0];
    return `${base}#page=${page}&zoom=${zoom}`;
  }

  function getApprovalsProgramLabel() {
    return "BSIT";
  }

  function getApprovalsYearLabel() {
    return "1st Year";
  }

  function StatusBadge({ complete }) {
    if (complete) {
      return <span className="approval-badge approval-badge-complete">Complete</span>;
    }
    return <span className="approval-badge approval-badge-incomplete">Incomplete</span>;
  }

  function DocumentPreviewCard({ href, text, onView }) {
    if (!href) return null;
    const normalizedHref = normalizeCloudinaryPdfUrl(href);
    const image = isImageFile(normalizedHref, text);
    return (
      <div className="approval-document">
        <div className="approval-document-preview" role="img" aria-label="Verification document preview">
          {image ? (
            <img src={normalizedHref} alt={text || "Verification document"} className="approval-document-thumb" />
          ) : (
            <svg className="approval-document-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
              <path d="M14 2v5h5" />
              <path d="M9 13h6" />
              <path d="M9 17h6" />
            </svg>
          )}
        </div>
        <div className="approval-document-meta">
          <p className="approval-document-name" title={text || "Verification document"}>
            {shortenFileName(text || "Verification document")}
          </p>
          <div className="approval-document-actions">
            <button type="button" className="btn small secondary" onClick={onView}>
              View
            </button>
            <a href={normalizedHref} target="_blank" rel="noreferrer" className="btn small">
              Download
            </a>
          </div>
        </div>
      </div>
    );
  }

  function DetailChip({ label, value }) {
    if (value == null || value === "") return null;
    const text = Array.isArray(value) ? value.join(", ") : String(value);
    return (
      <div className="approval-detail-chip">
        <span className="approval-detail-chip-label">{label}</span>
        <span className="approval-detail-chip-value">{text}</span>
      </div>
    );
  }

  function ApprovalsUserRow({
    item,
    type,
    loading,
    onApprove,
    onRejectAsk,
    onPreview,
    Spinner,
  }) {
    const [expanded, setExpanded] = useState(false);
    const m = item;
    const fullName = [m.first_name, m.last_name]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
    const displayName = fullName || m.full_name || m.display_name || m.username || m.email || "Unknown user";
    const initials = getInitials(displayName, m.email || m.username);
    const summary = `${getApprovalsProgramLabel()} • ${getApprovalsYearLabel()}`;

    return (
      <article className="approval-row" onClick={() => setExpanded((v) => !v)}>
        <div className="approval-row-main">
          <div className="approval-row-left">
            <div className="approval-avatar" aria-hidden="true">{initials}</div>
            <div className="approval-row-name-block">
              <h3 className="approval-row-name">{displayName}</h3>
              <p className="approval-row-email">{m.email || "No email"}</p>
            </div>
          </div>

          <div className="approval-row-summary">{summary || "No profile summary"}</div>

          <div className="approval-row-right">
            <StatusBadge complete={!!m.general_info_complete} />
            <button
              type="button"
              className="btn secondary small approval-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "Hide" : "Details"}
            </button>
            {loading ? (
              <Spinner inline />
            ) : (
              <>
                <button
                  type="button"
                  className="btn small approval-accept-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(m.id);
                  }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="btn secondary small approval-reject-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRejectAsk(type, m.id, displayName);
                  }}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        </div>

        {expanded && (
          <div className="approval-row-secondary" onClick={(e) => e.stopPropagation()}>
            <div className="approval-secondary-doc">
              <p className="approval-subtle-label">Verification document</p>
              <DocumentPreviewCard
                href={m.verification_document_url}
                text={m.verification_document_name || "Verification document"}
                onView={() => onPreview(
                  m.verification_document_url,
                  m.verification_document_name,
                  m.verification_document_pages || m.verification_page_count || m.total_pages || 1
                )}
              />
            </div>

            <div className="approval-secondary-details">
              <p className="approval-subtle-label">User details</p>
              <div className="approval-detail-chip-grid">
                <DetailChip label="Program" value={getApprovalsProgramLabel()} />
                <DetailChip label="Year" value={getApprovalsYearLabel()} />
                {type === "mentor" && <DetailChip label="Role" value={m.role} />}
                {type === "mentor" && <DetailChip label="Expertise" value={m.expertise_level} />}
                {type === "mentee" && <DetailChip label="Campus" value={m.campus} />}
                {type === "mentee" && <DetailChip label="Student ID" value={m.student_id_no} />}
                {type === "mentee" && <DetailChip label="Contact" value={m.contact_no} />}
                {type === "mentee" && <DetailChip label="Admission" value={m.admission_type} />}
                <DetailChip label="Subjects" value={m.subjects?.length ? m.subjects : null} />
                <DetailChip label="Topics" value={m.topics?.length ? m.topics : null} />
                <DetailChip label="Interests" value={m.interests} />
              </div>
            </div>
          </div>
        )}
      </article>
    );
  }

  function ViewerToolbar({
    zoom,
    onZoomOut,
    onZoomIn,
    page,
    totalPages,
    onPrev,
    onNext,
    canPrev,
    canNext,
    onToggleSidebar,
    sidebarOpen,
    sidebarEnabled,
    onFullscreen,
    onDownload,
    onOpenNewTab,
  }) {
    const showPageControls = totalPages > 1;
    return (
      <div className="file-viewer-toolbar" role="toolbar" aria-label="Document controls">
        <div className="file-viewer-toolbar-group">
          <button type="button" className="file-icon-btn" onClick={onToggleSidebar} aria-label={sidebarOpen ? "Hide page sidebar" : "Show page sidebar"} disabled={!sidebarEnabled}>
            <span aria-hidden="true">☰</span>
          </button>
          <button type="button" className="file-icon-btn" onClick={onZoomOut} aria-label="Zoom out">
            <span aria-hidden="true">−</span>
          </button>
          <div className="file-zoom-indicator" aria-live="polite">{zoom}%</div>
          <button type="button" className="file-icon-btn" onClick={onZoomIn} aria-label="Zoom in">
            <span aria-hidden="true">+</span>
          </button>
        </div>

        {showPageControls ? (
          <div className="file-viewer-toolbar-group">
            <button type="button" className="file-icon-btn" onClick={onPrev} disabled={!canPrev} aria-label="Previous page">
              <span aria-hidden="true">←</span>
            </button>
            <div className="file-page-indicator" aria-live="polite">Page {page} of {totalPages}</div>
            <button type="button" className="file-icon-btn" onClick={onNext} disabled={!canNext} aria-label="Next page">
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : (
          <div className="file-viewer-toolbar-group">
            <div className="file-page-indicator file-page-indicator-muted">Single page document</div>
          </div>
        )}

        <div className="file-viewer-toolbar-group">
          <button type="button" className="file-icon-btn" onClick={onFullscreen} aria-label="Toggle fullscreen">
            <span aria-hidden="true">⛶</span>
          </button>
          <button type="button" className="file-icon-btn" onClick={onDownload} aria-label="Download document">
            <span aria-hidden="true">↓</span>
          </button>
          <button type="button" className="file-icon-btn" onClick={onOpenNewTab} aria-label="Open in new tab">
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    );
  }

  function ThumbnailSidebar({ open, page, totalPages, onJump }) {
    if (totalPages <= 1) return null;
    const pages = Array.from({ length: totalPages }, (_, idx) => idx + 1);
    return (
      <aside className={`file-thumb-sidebar ${open ? "" : "collapsed"}`} aria-label="Page thumbnails" aria-hidden={!open}>
        <div className="file-thumb-sidebar-head">Pages</div>
        <div className="file-thumb-list">
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`file-thumb-item ${p === page ? "active" : ""}`}
              onClick={() => onJump(p)}
              aria-label={`Go to page ${p}`}
            >
              <span className="file-thumb-preview">{p}</span>
              <span className="file-thumb-label">Page {p}</span>
            </button>
          ))}
        </div>
      </aside>
    );
  }

  function FileViewerModal({ open, data, onClose }) {
    const modalRef = useRef(null);
    const [zoom, setZoom] = useState(100);
    const [page, setPage] = useState(1);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const normalizedHref = useMemo(() => normalizeCloudinaryPdfUrl(data?.href), [data]);
    const image = useMemo(() => isImageFile(normalizedHref, data?.name), [normalizedHref, data]);
    const fileType = useMemo(() => getFileTypeLabel(normalizedHref, data?.name), [normalizedHref, data]);
    const totalPages = useMemo(() => {
      const fromData = Number(data?.pageCount || data?.page_count || data?.totalPages || data?.total_pages || 1);
      const safe = Number.isFinite(fromData) && fromData > 0 ? Math.floor(fromData) : 1;
      return image ? 1 : safe;
    }, [data, image]);
    const sidebarEnabled = !image && totalPages > 1;
    const sidebarVisible = sidebarEnabled && sidebarOpen;
    const viewerSrc = useMemo(() => (image ? normalizedHref : buildViewerSrc(normalizedHref, page, zoom)), [image, normalizedHref, page, zoom]);

    useEffect(() => {
      if (!open) return;
      setZoom(100);
      setPage(1);
      setSidebarOpen(totalPages > 1);
      setIsLoading(true);
      setHasError(false);
    }, [open, normalizedHref, totalPages]);

    useEffect(() => {
      if (page > totalPages) {
        setPage(totalPages);
      }
    }, [page, totalPages]);

    useEffect(() => {
      if (!open) return;
      function onKeydown(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key === "ArrowRight") {
          if (totalPages <= 1) return;
          e.preventDefault();
          setPage((prev) => Math.min(totalPages, prev + 1));
          return;
        }
        if (e.key === "ArrowLeft") {
          if (totalPages <= 1) return;
          e.preventDefault();
          setPage((prev) => Math.max(1, prev - 1));
        }
      }
      window.addEventListener("keydown", onKeydown);
      return () => window.removeEventListener("keydown", onKeydown);
    }, [open, onClose, totalPages]);

    if (!open || !data || !normalizedHref) return null;

    function toggleFullscreen() {
      const el = modalRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
        return;
      }
      el.requestFullscreen?.();
    }

    function handleDownload() {
      window.open(normalizedHref, "_blank", "noopener,noreferrer");
    }

    return (
      <div className="file-viewer-overlay" onClick={onClose} role="presentation">
        <div className="file-viewer-modal" role="dialog" aria-modal="true" aria-label="Document viewer" onClick={(e) => e.stopPropagation()} ref={modalRef}>
          <header className="file-viewer-header">
            <div className="file-viewer-meta">
              <h3 className="file-viewer-title" title={data.name || "Document"}>{shortenFileName(data.name || "Document", 90)}</h3>
              <span className="file-type-badge">{fileType}</span>
              <span className="file-size-meta">Size unavailable</span>
            </div>
            <button type="button" className="file-close-btn" onClick={onClose} aria-label="Close viewer">×</button>
          </header>

          <div className="file-viewer-stage">
            <ThumbnailSidebar open={sidebarVisible} page={page} totalPages={totalPages} onJump={setPage} />

            <section className="file-viewer-main">
              <ViewerToolbar
                zoom={zoom}
                onZoomOut={() => setZoom((z) => Math.max(50, z - 10))}
                onZoomIn={() => setZoom((z) => Math.min(250, z + 10))}
                page={page}
                totalPages={totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                canPrev={page > 1}
                canNext={page < totalPages}
                onToggleSidebar={() => setSidebarOpen((v) => !v)}
                sidebarOpen={sidebarOpen}
                sidebarEnabled={sidebarEnabled}
                onFullscreen={toggleFullscreen}
                onDownload={handleDownload}
                onOpenNewTab={() => window.open(normalizedHref, "_blank", "noopener,noreferrer")}
              />

              <div className="file-viewer-canvas">
                {isLoading && (
                  <div className="file-loading-skeleton" role="status" aria-live="polite">
                    <div className="file-loading-shimmer" />
                    <span>Loading document...</span>
                  </div>
                )}

                {hasError && (
                  <div className="file-error-state" role="alert">
                    <p>Could not preview this file in the modal.</p>
                    <a href={normalizedHref} target="_blank" rel="noreferrer" className="btn small">Open in new tab</a>
                  </div>
                )}

                {!hasError && image && (
                  <div className="file-image-stage">
                    <img
                      src={normalizedHref}
                      alt={data.name || "Document preview"}
                      className="file-viewer-image"
                      style={{ transform: `scale(${zoom / 100})` }}
                      onLoad={() => setIsLoading(false)}
                      onError={() => {
                        setHasError(true);
                        setIsLoading(false);
                      }}
                    />
                  </div>
                )}

                {!hasError && !image && (
                  <iframe
                    title={data.name || "Document preview"}
                    src={viewerSrc}
                    className="file-viewer-iframe"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                      setHasError(true);
                      setIsLoading(false);
                    }}
                  />
                )}
              </div>
            </section>
          </div>

          <footer className="file-viewer-footer">
            <a href={normalizedHref} target="_blank" rel="noreferrer" className="btn secondary">Open in New Tab</a>
            <a href={normalizedHref} target="_blank" rel="noreferrer" className="btn">Download</a>
          </footer>
        </div>
      </div>
    );
  }

  function RejectConfirmModal({ open, target, loading, onConfirm, onCancel }) {
    if (!open || !target) return null;
    return (
      <div className="approval-modal-backdrop" onClick={onCancel} role="presentation">
        <div className="approval-modal approval-confirm-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="approval-modal-header">
            <h3 className="approval-modal-title">Confirm rejection</h3>
          </div>
          <p className="approval-confirm-copy">
            Reject <strong>{target.name}</strong>? This action will remove the account from pending approvals.
          </p>
          <div className="approval-confirm-actions">
            {loading ? (
              <Spinner inline />
            ) : (
              <>
                <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
                <button type="button" className="btn approval-reject-btn" onClick={onConfirm}>Reject user</button>
              </>
            )}
          </div>
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
    const [previewData, setPreviewData] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);

    const mentorCardLoading = (id) => approvalActionKey === "mentor:" + id;
    const menteeCardLoading = (id) => approvalActionKey === "mentee:" + id;
    if (!user.is_staff) return <div className="card"><div className="staff-only-msg">This page is for staff only.</div></div>;

    function openPreview(href, name, pageCount) {
      if (!href) return;
      const normalizedHref = normalizeCloudinaryPdfUrl(href);
      setPreviewData({ href: normalizedHref, name, pageCount });
    }

    function askReject(type, id, name) {
      setRejectTarget({ type, id, name: name || "this user" });
    }

    function confirmReject() {
      if (!rejectTarget) return;
      if (rejectTarget.type === "mentor") {
        handleRejectMentor(rejectTarget.id);
      } else {
        handleRejectMentee(rejectTarget.id);
      }
      setRejectTarget(null);
    }

    const rejectLoading = rejectTarget
      ? approvalActionKey === `${rejectTarget.type}:${rejectTarget.id}`
      : false;

    return (
      <div className="card approvals-page-shell">
        <div className="approvals-page-header">
          <h1 className="page-title">User approvals</h1>
          <p className="page-subtitle">Compact review queue for pending mentors and mentees.</p>
        </div>

        {approvalsLoading && <Spinner title="Loading approvals…" subtitle="Fetching pending users" />}
        {!approvalsLoading && (
          <div className="approvals-grid approvals-grid-modern">
            <section className="approvals-section">
              <h2 className="section-title">Pending mentors ({pendingMentors.length})</h2>
              {pendingMentors.length === 0 && <p className="muted">No pending mentors.</p>}
              {pendingMentors.length > 0 && (
                <div className="approval-rows-list">
                  {pendingMentors.map((m) => (
                    <ApprovalsUserRow
                      key={`mentor-${m.id}`}
                      item={m}
                      type="mentor"
                      loading={mentorCardLoading(m.id)}
                      onApprove={handleApproveMentor}
                      onRejectAsk={askReject}
                      onPreview={openPreview}
                      Spinner={Spinner}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="approvals-section">
              <h2 className="section-title">Pending mentees ({pendingMentees.length})</h2>
              {pendingMentees.length === 0 && <p className="muted">No pending mentees.</p>}
              {pendingMentees.length > 0 && (
                <div className="approval-rows-list">
                  {pendingMentees.map((m) => (
                    <ApprovalsUserRow
                      key={`mentee-${m.id}`}
                      item={m}
                      type="mentee"
                      loading={menteeCardLoading(m.id)}
                      onApprove={handleApproveMentee}
                      onRejectAsk={askReject}
                      onPreview={openPreview}
                      Spinner={Spinner}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        <FileViewerModal open={!!previewData} data={previewData} onClose={() => setPreviewData(null)} />
        <RejectConfirmModal
          open={!!rejectTarget}
          target={rejectTarget}
          loading={rejectLoading}
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.approvals = ApprovalsPage;
})();
