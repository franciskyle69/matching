(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { LoadingSpinner } = Utils;

  function formatBackupDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    try {
      return d.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return d.toISOString();
    }
  }

  function BackupPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const isStaff = !!(ctx.user.is_staff || ctx.user.role === "staff");
    if (!isStaff) return null;

    const {
      backups,
      backupDir,
      backupsLoading,
      backupCreateLoading,
      backupRestoreLoading,
      loadBackups,
      createBackup,
      restoreBackup,
      restoreBackupById,
      deleteBackup,
      downloadBackup,
      setError,
    } = ctx;

    const Spinner = LoadingSpinner;
    const fileInputRef = useRef(null);

    useEffect(() => {
      loadBackups();
    }, []);

    function handleUploadClick() {
      fileInputRef.current?.click();
    }

    function onFileChange(e) {
      const file = e.target.files?.[0];
      if (file) restoreBackup(file);
      e.target.value = "";
    }

    return (
      <div className="card backup-page">
        <h1 className="page-title">Backup & Restore</h1>
        <p className="page-subtitle">
          Save or restore a full snapshot of the site data (users, sessions,
          announcements, and more).
        </p>

        <div className="backup-alert" role="alert">
          <span className="backup-alert-icon" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Important Information</strong>
            <p>
              Restoring a backup will replace <strong>ALL</strong> current data.
              Always create a new backup before restoring to prevent data loss.
            </p>
          </div>
        </div>

        <section className="backup-card">
          <h2 className="backup-card-title">
            <span className="backup-card-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </span>
            Create New Backup
          </h2>
          <p className="backup-card-desc">
            Creates a complete backup of all collections as a database backup file: users,
            mentors, mentees, subjects, sessions, announcements, and more.
            Stored in <code>{backupDir || "backups/"}</code>.
          </p>
          <div className="backup-card-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={createBackup}
              disabled={backupCreateLoading}
            >
              {backupCreateLoading ? (
                <Spinner inline />
              ) : (
                "Create Backup Now"
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,.gz,.zip,.bz2,.sql,.psql,.dump,.backup"
              onChange={onFileChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="btn btn-success"
              onClick={handleUploadClick}
              disabled={backupRestoreLoading}
            >
              {backupRestoreLoading ? (
                <Spinner inline />
              ) : (
                "Upload & Restore"
              )}
            </button>
          </div>
        </section>

        <section className="backup-card">
          <div className="backup-history-header">
            <h2 className="backup-card-title">
              <span className="backup-card-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </span>
              Backup History
            </h2>
            <button
              type="button"
              className="btn secondary small"
              onClick={loadBackups}
              disabled={backupsLoading}
            >
              {backupsLoading ? <Spinner inline /> : null} Refresh
            </button>
          </div>
          {backupsLoading && backups.length === 0 ? (
            <Spinner title="Loading backups…" subtitle="Fetching available backup files" />
          ) : backups.length === 0 ? (
            <p className="muted backup-empty">
              No backups yet. Create one above.
            </p>
          ) : (
            <div className="table-wrapper">
              <table className="table backup-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Size</th>
                    <th>Records</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div>{formatBackupDate(b.created)}</div>
                        <div className="backup-id">{b.id}</div>
                      </td>
                      <td>{b.size_display}</td>
                      <td>{b.records}</td>
                      <td>
                        <div className="backup-actions">
                          <button
                            type="button"
                            className="btn btn-warning small"
                            onClick={() => restoreBackupById(b.id)}
                            disabled={backupRestoreLoading}
                            title="Restore to this backup"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className="btn btn-info small"
                            onClick={() => downloadBackup(b.id)}
                            title="Download backup file"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            className="btn danger small"
                            onClick={() => deleteBackup(b.id)}
                            title="Delete backup file"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.backup = BackupPage;
})();
