(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function TopicBadge({ topic }) {
    return <span className="topic-badge">{topic.name}</span>;
  }

  function SubjectCard({ subject, isSelected, onEdit }) {
    const topics = Array.isArray(subject.topics) ? subject.topics : [];

    return (
      <article className={`subject-card${isSelected ? " is-selected" : ""}`}>
        <div className="subject-card-header">
          <div>
            <p className="subject-card-label">Subject</p>
            <h3 className="subject-card-title">{subject.name}</h3>
          </div>
          <span className="subject-card-status">Predefined</span>
        </div>
        <div className="subject-card-body">
          {subject.description ? (
            <p className="subject-card-description">{subject.description}</p>
          ) : (
            <p className="subject-card-description subject-card-description--empty">No description provided.</p>
          )}
          <div className="subject-card-topic-head">
            <span className="subject-card-label">Topics</span>
            <span className="subject-readonly-note">Read-only</span>
          </div>
          <div className="subject-card-topics" aria-label={`${subject.name} topics`}>
            {topics.length > 0 ? topics.map((topic) => <TopicBadge key={topic.id} topic={topic} />) : <span className="subject-card-empty-topics">No topics defined.</span>}
          </div>
        </div>
        <div className="subject-card-actions">
          <button type="button" className="btn secondary small" onClick={onEdit}>Edit</button>
        </div>
      </article>
    );
  }

  function SubjectEditModal({ subject, form, onChange, onClose, onSave }) {
    useEffect(() => {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (event) => {
        if (event.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = previousOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [onClose]);

    const topics = Array.isArray(subject?.topics) ? subject.topics : [];

    return (
      <div className="subject-edit-modal-backdrop" role="presentation" onClick={onClose}>
        <div className="subject-edit-modal" role="dialog" aria-modal="true" aria-labelledby="subject-edit-modal-title" onClick={(event) => event.stopPropagation()}>
          <div className="subject-edit-modal-header">
            <div>
              <p className="subject-card-label">Edit subject</p>
              <h2 id="subject-edit-modal-title">{subject.name}</h2>
            </div>
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close edit modal">×</button>
          </div>
          <p className="subject-edit-modal-copy">Only the subject name and description can change. Topics are display-only because the BSIT scope is predefined.</p>
          <div className="subject-edit-modal-topics">
            <div className="subject-card-topic-head">
              <span className="subject-card-label">Topics</span>
              <span className="subject-readonly-note">Read-only</span>
            </div>
            <div className="subject-card-topics">
              {topics.length > 0 ? topics.map((topic) => <TopicBadge key={topic.id} topic={topic} />) : <span className="subject-card-empty-topics">No topics defined.</span>}
            </div>
          </div>
          <div className="subject-edit-modal-form">
            <div className="form-grid">
              <div>
                <label htmlFor="subject-name">Subject name</label>
                <input id="subject-name" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Subject name" />
              </div>
              <div>
                <label htmlFor="subject-description">Description</label>
                <input id="subject-description" value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} placeholder="Optional description" />
              </div>
            </div>
          </div>
          <div className="subject-edit-modal-footer">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn" onClick={onSave}>Save changes</button>
          </div>
        </div>
      </div>
    );
  }

  function SubjectsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const { user, subjectsLoading, subjectsData, subjectForm, setSubjectForm, subjectEditId, setSubjectEditId, handleUpdateSubject } = ctx;
    const Spinner = LoadingSpinner;
    const selectedSubject = subjectsData.find((subject) => subject.id === subjectEditId) || null;

    function openEditor(subject) {
      setSubjectEditId(subject.id);
      setSubjectForm({ name: subject.name || "", description: subject.description || "" });
    }

    function closeEditor() {
      setSubjectEditId(null);
      setSubjectForm({ name: "", description: "" });
    }

    if (!user.is_staff) return <div className="card"><div className="staff-only-msg">This page is for staff only.</div></div>;

    return (
      <div className="card subjects-page-shell">
        <div className="subjects-page-header">
          <p className="subject-card-label">BSIT 1st year scope</p>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">Predefined subjects and topics only. Edit subject details, keep topics read-only, and avoid introducing out-of-scope data.</p>
        </div>
        {subjectsLoading && <Spinner title="Loading subjects…" subtitle="Fetching predefined BSIT subjects" />}
        {!subjectsLoading && subjectsData.length === 0 && <div className="subjects-empty-msg">No predefined subjects are available.</div>}
        {!subjectsLoading && subjectsData.length > 0 && (
          <div className="subject-card-grid">
            {subjectsData.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} isSelected={subjectEditId === subject.id} onEdit={() => openEditor(subject)} />
            ))}
          </div>
        )}
        {selectedSubject && (
          <SubjectEditModal
            subject={selectedSubject}
            form={subjectForm}
            onChange={setSubjectForm}
            onClose={closeEditor}
            onSave={handleUpdateSubject}
          />
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.subjects = SubjectsPage;
})();
