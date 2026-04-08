(function () {
  "use strict";
  const React = window.React;
  const { useContext } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function SubjectsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const { user, subjectsLoading, subjectsData, subjectForm, setSubjectForm, subjectEditId, setSubjectEditId, subjectDeleteId, setSubjectDeleteId, handleCreateSubject, handleUpdateSubject, handleDeleteSubject } = ctx;
    const Spinner = LoadingSpinner;
    if (!user.is_staff) return <div className="card"><div className="staff-only-msg">This page is for staff only.</div></div>;
    return (
      <div className="card">
        <h1 className="page-title">Subjects</h1>
        <p className="page-subtitle">Manage subjects (admin).</p>
        <div className="subject-form-panel">
          <h3>{subjectEditId ? "Edit subject" : "Add subject"}</h3>
          <div className="form-grid">
            <div><label>Name</label><input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="Subject name" /></div>
            <div><label>Description</label><input value={subjectForm.description} onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })} placeholder="Optional description" /></div>
          </div>
          <div className="btn-row" style={{ marginTop: "12px" }}>{subjectEditId ? <><button className="btn" onClick={handleUpdateSubject}>Save changes</button><button className="btn secondary" onClick={() => { setSubjectEditId(null); setSubjectForm({ name: "", description: "" }); }}>Cancel</button></> : <button className="btn" onClick={handleCreateSubject}>Add subject</button>}</div>
        </div>
        {subjectsLoading && <Spinner title="Loading subjects…" subtitle="Fetching available subjects" />}
        {!subjectsLoading && subjectsData.length === 0 && <div className="subjects-empty-msg">No subjects yet. Add one above.</div>}
        {!subjectsLoading && subjectsData.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {subjectsData.map((s) => (
              <li key={s.id} className="subject-list-item">
                <div><span className="subject-name">{s.name}</span>{s.description && <span className="subject-desc">{s.description}</span>}</div>
                <div className="btn-row">
                  <button className="btn secondary small" onClick={() => { setSubjectEditId(s.id); setSubjectForm({ name: s.name || "", description: s.description || "" }); }}>Edit</button>
                  {subjectDeleteId === s.id ? <><span className="muted" style={{ margin: "0 8px" }}>Delete?</span><button className="btn danger small" onClick={() => handleDeleteSubject(s.id)}>Yes</button><button className="btn secondary small" onClick={() => setSubjectDeleteId(null)}>No</button></> : <button className="btn danger small" onClick={() => setSubjectDeleteId(s.id)}>Delete</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.subjects = SubjectsPage;
})();
