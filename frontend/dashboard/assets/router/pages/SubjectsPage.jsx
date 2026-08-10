(function () {
  "use strict";
  const React = window.React;
  const { useContext, useEffect } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function TopicBadge({ topic }) {
    const inactive = topic && topic.is_active === false;
    return (
      <span className={"topic-badge" + (inactive ? " is-inactive" : "")}>
        {topic.name}
      </span>
    );
  }

  function SubjectCard({ subject, isSelected, onEdit }) {
    const topics = Array.isArray(subject.topics) ? subject.topics : [];

    return (
      <article className={`subject-card${isSelected ? " is-selected" : ""}`}>
        <div className="subject-card-header">
          <div>
            <p className="subject-card-label">{subject.category_label || "Subject"}</p>
            <h3 className="subject-card-title">
              {subject.code ? `${subject.code} · ${subject.name}` : subject.name}
            </h3>
          </div>
          <span className={"subject-card-status" + (subject.is_minor ? " is-minor" : "")}>
            {subject.is_minor ? "Minor" : "Major"}
          </span>
        </div>
        <div className="subject-card-body">
          {subject.description ? (
            <p className="subject-card-description">{subject.description}</p>
          ) : (
            <p className="subject-card-description subject-card-description--empty">No description provided.</p>
          )}
          <div className="subject-card-topic-head">
            <span className="subject-card-label">Topics</span>
            <span className="subject-readonly-note">Coordinator-managed</span>
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

  function SubjectEditModal({
    subject,
    form,
    onChange,
    topicForm,
    onTopicFormChange,
    topicEditId,
    topicActionKey,
    onStartCreateTopic,
    onStartEditTopic,
    onSubmitTopic,
    onToggleTopicStatus,
    onClose,
    onSave,
  }) {
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
    const isEditingTopic = !!topicEditId;
    const topicBusy =
      topicActionKey === "create" ||
      topicActionKey === "update:" + String(topicEditId || "");

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
          <p className="subject-edit-modal-copy">
            Subject entries are predefined. You can add, edit, archive, and
            restore topics under this subject.
          </p>
          <div className="subject-edit-modal-topics">
            <div className="subject-card-topic-head">
              <span className="subject-card-label">Topics</span>
              <span className="subject-readonly-note">Soft-delete only</span>
            </div>
            <div className="subject-topic-manage-form">
              <div className="form-grid">
                <div>
                  <label htmlFor="topic-name">Topic name</label>
                  <input
                    id="topic-name"
                    value={topicForm.name}
                    onChange={(event) =>
                      onTopicFormChange({
                        ...topicForm,
                        name: event.target.value,
                        subject_id: String(subject.id),
                      })
                    }
                    placeholder="Add topic name"
                  />
                </div>
                <div>
                  <label htmlFor="topic-status">Status</label>
                  <select
                    id="topic-status"
                    value={topicForm.status || "active"}
                    onChange={(event) =>
                      onTopicFormChange({
                        ...topicForm,
                        status: event.target.value,
                        subject_id: String(subject.id),
                      })
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={onStartCreateTopic}
                >
                  New topic
                </button>
                <button
                  type="button"
                  className="btn small"
                  disabled={!String(topicForm.name || "").trim() || topicBusy}
                  onClick={onSubmitTopic}
                >
                  {isEditingTopic ? "Update topic" : "Create topic"}
                </button>
              </div>
            </div>
            <div className="subject-card-topics subject-card-topics--managed">
              {topics.length > 0 ? (
                topics.map((topic) => (
                  <div key={topic.id} className="subject-topic-row">
                    <TopicBadge topic={topic} />
                    <div className="subject-topic-row-actions">
                      <button
                        type="button"
                        className="btn secondary small"
                        disabled={topicActionKey === "status:" + topic.id}
                        onClick={() => onStartEditTopic(topic)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn secondary small"
                        disabled={topicActionKey === "status:" + topic.id}
                        onClick={() =>
                          onToggleTopicStatus(
                            topic,
                            topic.is_active ? "inactive" : "active",
                          )
                        }
                      >
                        {topic.is_active ? "Archive" : "Restore"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <span className="subject-card-empty-topics">No topics defined.</span>
              )}
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
    const {
      user,
      subjectsLoading,
      subjectsData,
      subjectForm,
      setSubjectForm,
      subjectEditId,
      setSubjectEditId,
      topicForm,
      setTopicForm,
      topicEditId,
      setTopicEditId,
      topicActionKey,
      handleUpdateSubject,
      handleCreateTopic,
      handleUpdateTopic,
      handleSetTopicStatus,
    } = ctx;
    const Spinner = LoadingSpinner;
    const selectedSubject = subjectsData.find((subject) => subject.id === subjectEditId) || null;

    function openEditor(subject) {
      setSubjectEditId(subject.id);
      setSubjectForm({ name: subject.name || "", description: subject.description || "" });
      setTopicEditId(null);
      setTopicForm({ subject_id: String(subject.id), name: "", status: "active" });
    }

    function closeEditor() {
      setSubjectEditId(null);
      setSubjectForm({ name: "", description: "" });
      setTopicEditId(null);
      setTopicForm({ subject_id: "", name: "", status: "active" });
    }

    function startCreateTopic() {
      if (!selectedSubject) return;
      setTopicEditId(null);
      setTopicForm({
        subject_id: String(selectedSubject.id),
        name: "",
        status: "active",
      });
    }

    function startEditTopic(topic) {
      if (!selectedSubject || !topic) return;
      setTopicEditId(topic.id);
      setTopicForm({
        subject_id: String(selectedSubject.id),
        name: topic.name || "",
        status: topic.is_active ? "active" : "inactive",
      });
    }

    async function submitTopic() {
      if (!selectedSubject) return;
      const payload = {
        subject_id: String(selectedSubject.id),
        name: topicForm.name,
        status: topicForm.status || "active",
      };
      if (topicEditId) {
        await handleUpdateTopic(topicEditId, payload);
        return;
      }
      await handleCreateTopic(payload);
    }

    async function toggleTopicStatus(topic, status) {
      if (!topic) return;
      await handleSetTopicStatus(topic.id, status);
    }

    if (!user.is_staff) return <div className="card"><div className="staff-only-msg">This page is for staff only.</div></div>;

    return (
      <div className="card subjects-page-shell page-shell">
        <div className="subjects-page-header page-shell-head">
          <p className="subject-card-label">BSIT 1st year scope</p>
          <div>
            <h1 className="page-title">Subjects</h1>
            <p className="page-subtitle">
              Subjects are predefined by the system. Coordinators can manage
              topic lifecycle using Active/Inactive status.
            </p>
          </div>
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
            topicForm={topicForm}
            onTopicFormChange={setTopicForm}
            topicEditId={topicEditId}
            topicActionKey={topicActionKey}
            onStartCreateTopic={startCreateTopic}
            onStartEditTopic={startEditTopic}
            onSubmitTopic={submitTopic}
            onToggleTopicStatus={toggleTopicStatus}
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
