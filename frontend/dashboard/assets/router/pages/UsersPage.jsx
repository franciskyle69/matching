(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useMemo, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { getCookie, fetchJSON } = Utils;

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString([], { dateStyle: "short" });
  }

  function formatUsername(user) {
    if (user.full_name && user.full_name !== user.username) {
      return `${user.full_name} (@${user.username})`;
    }
    return user.username;
  }

  function getRoleDisplay(user) {
    if (user.role === "both") return "Mentor & Mentee";
    if (user.role === "mentor") return "Mentor";
    if (user.role === "mentee") return "Mentee";
    if (user.role === "staff") return "Staff";
    return "—";
  }

  function getApprovalStatus(user) {
    if (!user.role || user.role === "none") return "—";
    
    if (user.role === "mentor") {
      return user.mentor_approved ? "✓ Approved" : "Pending";
    }
    if (user.role === "mentee") {
      return user.mentee_approved ? "✓ Approved" : "Pending";
    }
    if (user.role === "both") {
      const mentorApproved = user.mentor_approved ? "✓" : "✗";
      const menteeApproved = user.mentee_approved ? "✓" : "✗";
      return `Mentor: ${mentorApproved} | Mentee: ${menteeApproved}`;
    }
    return "—";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function notify(type, title, text) {
    if (window.Swal && typeof window.Swal.fire === "function") {
      window.Swal.fire({ icon: type, title, text });
      return;
    }
    alert(text || title);
  }

  function ensureDataTablesLoaded() {
    const hasDataTables =
      !!window.jQuery &&
      !!window.jQuery.fn &&
      !!window.jQuery.fn.DataTable;
    if (hasDataTables) return Promise.resolve();
    if (window.DashboardApp.__datatablesLoadPromise) {
      return window.DashboardApp.__datatablesLoadPromise;
    }

    window.DashboardApp.__datatablesLoadPromise = new Promise((resolve, reject) => {
      const ensureStyle = (id, href) => {
        if (document.querySelector(`link[${id}='1']`)) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        link.setAttribute(id, "1");
        document.head.appendChild(link);
      };

      ensureStyle("data-dt-core-style", "https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css");

      function loadScriptOnce(attr, src) {
        return new Promise((res, rej) => {
          const existing = document.querySelector(`script[${attr}='1']`);
          if (existing) {
            if (existing.getAttribute("data-loaded") === "1") {
              res();
              return;
            }
            existing.addEventListener("load", () => res(), { once: true });
            existing.addEventListener("error", () => rej(new Error("Failed to load DataTables dependencies.")), { once: true });
            return;
          }

          const script = document.createElement("script");
          script.src = src;
          script.async = true;
          script.setAttribute(attr, "1");
          script.onload = () => {
            script.setAttribute("data-loaded", "1");
            res();
          };
          script.onerror = () => rej(new Error("Failed to load DataTables dependencies."));
          document.body.appendChild(script);
        });
      }

      loadScriptOnce("data-jquery-script", "https://code.jquery.com/jquery-3.7.1.min.js")
        .then(() => loadScriptOnce("data-dt-script", "https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"))
        .then(() => resolve())
        .catch((err) => reject(err));
    });

    return window.DashboardApp.__datatablesLoadPromise;
  }

  const ROLE_OPTIONS = [
    {
      id: "mentor",
      title: "Mentor",
      description:
        "Has a mentor profile. Can be matched with mentees and manage mentor workflows.",
      icon: "M",
    },
    {
      id: "mentee",
      title: "Mentee",
      description:
        "Has a mentee profile. Receives mentor recommendations and participates in mentoring.",
      icon: "E",
    },
    {
      id: "staff",
      title: "Staff (Admin)",
      description:
        "Administrative user with access to approvals, activity logs, subjects, and system management.",
      icon: "A",
    },
  ];

  function deriveInitialRole(user) {
    if (user.is_staff) return "staff";
    if (user.role === "mentor" || user.role === "mentee") return user.role;
    if (user.role === "both") return "mentor";
    return "mentee";
  }

  function buildInitialForm(user) {
    return {
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      selected_role: deriveInitialRole(user),
      is_active: !!user.is_active,
    };
  }

  function getRoleSaveSupport(user, selectedRole) {
    if (selectedRole === "staff") {
      return { supported: true, message: "" };
    }
    if (user.role === "both" && (selectedRole === "mentor" || selectedRole === "mentee")) {
      return { supported: true, message: "" };
    }
    if (user.role === selectedRole) {
      return { supported: true, message: "" };
    }
    return {
      supported: false,
      message:
        "Mentor/Mentee role assignment is profile-based in this system. This modal can toggle staff access and update user info.",
    };
  }

  function UserForm({ formData, errors, onFieldChange }) {
    return (
      <section className="users-edit-section" aria-labelledby="users-edit-info-heading">
        <div className="users-edit-section-header">
          <h3 id="users-edit-info-heading" className="users-edit-section-title">User Info</h3>
        </div>
        <div className="users-edit-fields">
          <div className="users-edit-field-wrap">
            <label className="users-edit-label" htmlFor="edit-user-first-name">First Name</label>
            <input
              id="edit-user-first-name"
              type="text"
              className={`users-edit-input ${errors.first_name ? "is-invalid" : ""}`}
              value={formData.first_name}
              onChange={(e) => onFieldChange("first_name", e.target.value)}
              autoComplete="given-name"
            />
            {errors.first_name && <p className="users-edit-error">{errors.first_name}</p>}
          </div>

          <div className="users-edit-field-wrap">
            <label className="users-edit-label" htmlFor="edit-user-last-name">Last Name</label>
            <input
              id="edit-user-last-name"
              type="text"
              className={`users-edit-input ${errors.last_name ? "is-invalid" : ""}`}
              value={formData.last_name}
              onChange={(e) => onFieldChange("last_name", e.target.value)}
              autoComplete="family-name"
            />
            {errors.last_name && <p className="users-edit-error">{errors.last_name}</p>}
          </div>

          <div className="users-edit-field-wrap">
            <label className="users-edit-label" htmlFor="edit-user-email">Email</label>
            <input
              id="edit-user-email"
              type="email"
              className={`users-edit-input ${errors.email ? "is-invalid" : ""}`}
              value={formData.email}
              onChange={(e) => onFieldChange("email", e.target.value)}
              autoComplete="email"
            />
            {errors.email && <p className="users-edit-error">{errors.email}</p>}
          </div>
        </div>
      </section>
    );
  }

  function RoleSelector({ selectedRole, onSelect, options = ROLE_OPTIONS }) {
    return (
      <div className="users-role-selector" role="radiogroup" aria-label="Role selection">
        {options.map((role) => {
          const selected = selectedRole === role.id;
          return (
            <button
              key={role.id}
              type="button"
              className={`users-role-card ${selected ? "is-selected" : ""}`}
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(role.id)}
            >
              <span className="users-role-card-icon" aria-hidden="true">{role.icon}</span>
              <span className="users-role-card-content">
                <span className="users-role-card-title">{role.title}</span>
                <span className="users-role-card-description">{role.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  function CreateUserModal({ onClose, onCreated }) {
    const [formData, setFormData] = useState({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      selected_role: "mentor",
    });
    const [showValidation, setShowValidation] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      function onEscape(ev) {
        if (ev.key === "Escape") {
          onClose();
        }
      }
      window.addEventListener("keydown", onEscape);
      return () => window.removeEventListener("keydown", onEscape);
    }, [onClose]);

    function onFieldChange(field, value) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }

    const errors = useMemo(() => {
      const nextErrors = {};
      const email = String(formData.email || "").trim();
      if (!String(formData.first_name || "").trim()) {
        nextErrors.first_name = "First name is required.";
      }
      if (!String(formData.last_name || "").trim()) {
        nextErrors.last_name = "Last name is required.";
      }
      if (!email) {
        nextErrors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        nextErrors.email = "Please enter a valid email address.";
      }
      return nextErrors;
    }, [formData.email, formData.first_name, formData.last_name]);

    const saveDisabled = saving || Object.keys(errors).length > 0;

    async function handleCreate() {
      if (saveDisabled) {
        setShowValidation(true);
        return;
      }

      setSaving(true);
      try {
        const result = await fetchJSON(`/api/users/create/`, {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({
            first_name: String(formData.first_name || "").trim(),
            middle_name: String(formData.middle_name || "").trim(),
            last_name: String(formData.last_name || "").trim(),
            email: String(formData.email || "").trim(),
            role: formData.selected_role,
          }),
        });

        if (!result.ok) {
          const apiErrors = result.data?.errors;
          if (apiErrors && typeof apiErrors === "object") {
            const message = Object.values(apiErrors).flat().filter(Boolean).join(" ") || "Unable to create user.";
            notify("error", "Create Failed", message);
          } else {
            notify("error", "Create Failed", result.data?.error || "Unable to create user.");
          }
          return;
        }

        notify("success", "User Created", result.data?.message || "User created and password emailed.");
        onCreated(result.data?.user);
        onClose();
      } catch (e) {
        notify("error", "Create Failed", e.message || "Unable to create user.");
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="modal-overlay users-edit-modal-overlay" onClick={onClose}>
        <div className="modal-dialog users-edit-modal" onClick={(e) => e.stopPropagation()}>
          <div className="users-edit-header">
            <div>
              <h2 className="users-edit-title">Add User</h2>
              <p className="users-edit-subtitle">Create a mentor or mentee account without file upload. A temporary password will be emailed automatically.</p>
            </div>
            <button type="button" className="users-edit-close" onClick={onClose} aria-label="Close create modal">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="users-edit-content">
            <section className="users-edit-section" aria-labelledby="users-create-info-heading">
              <div className="users-edit-section-header">
                <h3 id="users-create-info-heading" className="users-edit-section-title">User Info</h3>
              </div>
              <div className="users-edit-fields">
                <div className="users-edit-field-wrap">
                  <label className="users-edit-label" htmlFor="create-user-first-name">First Name</label>
                  <input
                    id="create-user-first-name"
                    type="text"
                    className={`users-edit-input ${showValidation && errors.first_name ? "is-invalid" : ""}`}
                    value={formData.first_name}
                    onChange={(e) => onFieldChange("first_name", e.target.value)}
                    autoComplete="given-name"
                  />
                  {showValidation && errors.first_name && <p className="users-edit-error">{errors.first_name}</p>}
                </div>
                <div className="users-edit-field-wrap">
                  <label className="users-edit-label" htmlFor="create-user-middle-name">Middle Name</label>
                  <input
                    id="create-user-middle-name"
                    type="text"
                    className="users-edit-input"
                    value={formData.middle_name}
                    onChange={(e) => onFieldChange("middle_name", e.target.value)}
                    autoComplete="additional-name"
                  />
                </div>
                <div className="users-edit-field-wrap">
                  <label className="users-edit-label" htmlFor="create-user-last-name">Last Name</label>
                  <input
                    id="create-user-last-name"
                    type="text"
                    className={`users-edit-input ${showValidation && errors.last_name ? "is-invalid" : ""}`}
                    value={formData.last_name}
                    onChange={(e) => onFieldChange("last_name", e.target.value)}
                    autoComplete="family-name"
                  />
                  {showValidation && errors.last_name && <p className="users-edit-error">{errors.last_name}</p>}
                </div>
                <div className="users-edit-field-wrap">
                  <label className="users-edit-label" htmlFor="create-user-email">Email</label>
                  <input
                    id="create-user-email"
                    type="email"
                    className={`users-edit-input ${showValidation && errors.email ? "is-invalid" : ""}`}
                    value={formData.email}
                    onChange={(e) => onFieldChange("email", e.target.value)}
                    autoComplete="email"
                  />
                  {showValidation && errors.email && <p className="users-edit-error">{errors.email}</p>}
                </div>
              </div>
            </section>

            <section className="users-edit-section" aria-labelledby="users-create-role-heading">
              <div className="users-edit-section-header">
                <h3 id="users-create-role-heading" className="users-edit-section-title">Role</h3>
              </div>
              <RoleSelector
                selectedRole={formData.selected_role}
                onSelect={(roleId) => onFieldChange("selected_role", roleId)}
                options={ROLE_OPTIONS}
              />
              <p className="users-edit-warning">The account will be created active, and the temporary password will be sent to the email address above.</p>
            </section>
          </div>

          <div className="users-edit-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={saveDisabled}>
              {saving ? "Creating..." : "Create User"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function ModalFooter({
    editMode,
    saving,
    saveDisabled,
    onClose,
    onCancelEdit,
    onSave,
    onStartEdit,
  }) {
    return (
      <div className="users-edit-footer">
        {editMode ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={onSave} disabled={saveDisabled}>
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={onStartEdit}>
              Edit User
            </button>
          </>
        )}
      </div>
    );
  }

  function renderConnectionList(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return <span className="users-edit-meta-value">None</span>;
    }
    return (
      <ul className="users-connections-list">
        {items.map((item) => (
          <li key={`${item.user_id}:${item.username}`}>
            {item.display_name || item.username}
          </li>
        ))}
      </ul>
    );
  }

  function UserDetailsModal({ user, onClose, onUpdate, startInEdit = false }) {
    const initialForm = useMemo(() => buildInitialForm(user), [user]);
    const [formData, setFormData] = useState(initialForm);
    const [editMode, setEditMode] = useState(!!startInEdit);
    const [showValidation, setShowValidation] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      setFormData(buildInitialForm(user));
      setEditMode(!!startInEdit);
      setShowValidation(false);
    }, [startInEdit, user.id]);

    useEffect(() => {
      function onEscape(ev) {
        if (ev.key === "Escape") {
          onClose();
        }
      }
      window.addEventListener("keydown", onEscape);
      return () => window.removeEventListener("keydown", onEscape);
    }, [onClose]);

    function onFieldChange(field, value) {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }

    const errors = useMemo(() => {
      const nextErrors = {};
      const email = String(formData.email || "").trim();
      if (!String(formData.first_name || "").trim()) {
        nextErrors.first_name = "First name is required.";
      }
      if (!String(formData.last_name || "").trim()) {
        nextErrors.last_name = "Last name is required.";
      }
      if (!email) {
        nextErrors.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        nextErrors.email = "Please enter a valid email address.";
      }
      return nextErrors;
    }, [formData.email, formData.first_name, formData.last_name]);

    const roleSupport = useMemo(
      () => getRoleSaveSupport(user, formData.selected_role),
      [formData.selected_role, user],
    );

    const hasChanges = useMemo(() => {
      return (
        String(formData.first_name || "").trim() !== String(initialForm.first_name || "").trim() ||
        String(formData.last_name || "").trim() !== String(initialForm.last_name || "").trim() ||
        String(formData.email || "").trim() !== String(initialForm.email || "").trim() ||
        formData.selected_role !== initialForm.selected_role ||
        !!formData.is_active !== !!initialForm.is_active
      );
    }, [formData, initialForm]);

    const saveDisabled =
      saving || !hasChanges || Object.keys(errors).length > 0 || !roleSupport.supported;

    async function handleSave() {
      if (saveDisabled) {
        setShowValidation(true);
        return;
      }

      setSaving(true);
      try {
        let latestUser = user;
        const shouldUpdateBasics =
          String(formData.first_name || "").trim() !== String(initialForm.first_name || "").trim() ||
          String(formData.last_name || "").trim() !== String(initialForm.last_name || "").trim() ||
          String(formData.email || "").trim() !== String(initialForm.email || "").trim() ||
          formData.selected_role !== initialForm.selected_role;

        if (shouldUpdateBasics) {
          const updatePayload = {
            first_name: String(formData.first_name || "").trim(),
            last_name: String(formData.last_name || "").trim(),
            email: String(formData.email || "").trim(),
            is_staff: formData.selected_role === "staff",
          };

          const updateResult = await fetchJSON(`/api/users/${user.id}/update/`, {
            method: "POST",
            headers: { "X-CSRFToken": getCookie("csrftoken") },
            body: JSON.stringify(updatePayload),
          });

          if (!updateResult.ok) {
            notify("error", "Update Failed", updateResult.data?.error || "Unable to update user.");
            return;
          }
          latestUser = updateResult.data.user;
        }

        if (!!formData.is_active !== !!initialForm.is_active) {
          const statusResult = await fetchJSON(`/api/users/${user.id}/activate-deactivate/`, {
            method: "POST",
            headers: { "X-CSRFToken": getCookie("csrftoken") },
            body: JSON.stringify({ is_active: !!formData.is_active }),
          });

          if (!statusResult.ok) {
            notify("error", "Update Failed", statusResult.data?.error || "Unable to update user status.");
            return;
          }
          latestUser = statusResult.data.user;
        }

        onUpdate(latestUser);
        onClose();
      } catch (e) {
        notify("error", "Update Failed", e.message || "Unable to update user.");
      }
      setSaving(false);
    }

    const activeRole = editMode ? formData.selected_role : deriveInitialRole(user);
    const activeRoleInfo = ROLE_OPTIONS.find((entry) => entry.id === activeRole);

    return (
      <div className="modal-overlay users-edit-modal-overlay" onClick={onClose}>
        <div className="modal-dialog users-edit-modal" onClick={(e) => e.stopPropagation()}>
          <div className="users-edit-header">
            <div>
              <h2 className="users-edit-title">{editMode ? "Edit User" : "View User"}</h2>
              <p className="users-edit-subtitle">{user.email || user.username}</p>
            </div>
            <button type="button" className="users-edit-close" onClick={onClose} aria-label="Close edit modal">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="users-edit-content">
            {editMode ? (
              <UserForm formData={formData} errors={showValidation ? errors : {}} onFieldChange={onFieldChange} />
            ) : (
              <section className="users-edit-section" aria-labelledby="users-view-info-heading">
                <div className="users-edit-section-header">
                  <h3 id="users-view-info-heading" className="users-edit-section-title">User Info</h3>
                </div>
                <div className="users-edit-meta users-edit-meta-wide">
                  <div>
                    <span className="users-edit-meta-label">First name</span>
                    <span className="users-edit-meta-value">{user.first_name || "—"}</span>
                  </div>
                  <div>
                    <span className="users-edit-meta-label">Last name</span>
                    <span className="users-edit-meta-value">{user.last_name || "—"}</span>
                  </div>
                </div>
                <div className="users-edit-meta users-edit-meta-wide">
                  <div>
                    <span className="users-edit-meta-label">Email</span>
                    <span className="users-edit-meta-value">{user.email || "—"}</span>
                  </div>
                  <div>
                    <span className="users-edit-meta-label">Role</span>
                    <span className="users-edit-meta-value">{getRoleDisplay(user)}</span>
                  </div>
                </div>
              </section>
            )}

            <section className="users-edit-section" aria-labelledby="users-edit-role-heading">
              <div className="users-edit-section-header">
                <h3 id="users-edit-role-heading" className="users-edit-section-title">Role &amp; Permissions</h3>
              </div>
              {editMode ? (
                <RoleSelector selectedRole={formData.selected_role} onSelect={(roleId) => onFieldChange("selected_role", roleId)} />
              ) : (
                <div className="users-role-readonly-card">
                  <p className="users-role-panel-title">Current role</p>
                  <p className="users-role-readonly-title">{activeRoleInfo?.title || "User"}</p>
                  <p className="users-role-card-description">{activeRoleInfo?.description || "No role profile assigned."}</p>
                </div>
              )}
              {editMode && !roleSupport.supported && (
                <p className="users-edit-warning">{roleSupport.message}</p>
              )}

              <div className="users-role-conditional-panel" data-role={activeRole}>
                {activeRole === "mentor" && (
                  <div className="users-role-conditional-content">
                    <p className="users-role-panel-title">Mentor Profile Summary</p>
                    <p>Subjects: {Array.isArray(user.mentor_profile?.subjects) ? user.mentor_profile.subjects.join(", ") : "Not provided"}</p>
                    <p>Expertise level: {user.mentor_profile?.expertise_level ?? "Not provided"}</p>
                    <p>Capacity: {user.mentor_profile?.capacity ?? "Not provided"}</p>
                  </div>
                )}
                {activeRole === "mentee" && (
                  <div className="users-role-conditional-content">
                    <p className="users-role-panel-title">Mentee Preferences Summary</p>
                    <p>Difficulty level: {user.mentee_profile?.difficulty_level ?? "Not provided"}</p>
                    <p>Preferred subjects: {Array.isArray(user.mentee_profile?.subjects) ? user.mentee_profile.subjects.join(", ") : "Not provided"}</p>
                    <p>Availability: {Array.isArray(user.mentee_profile?.availability) ? user.mentee_profile.availability.join(", ") : "Not provided"}</p>
                  </div>
                )}
                {activeRole === "staff" && (
                  <div className="users-role-conditional-content">
                    <p className="users-role-panel-title">Admin Permissions Summary</p>
                    <p>Access to approvals, activity logs, subjects management, and backup tools.</p>
                    <p>Can update user accounts and manage moderation workflows.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="users-edit-section" aria-labelledby="users-edit-actions-heading">
              <div className="users-edit-section-header">
                <h3 id="users-edit-actions-heading" className="users-edit-section-title">Actions</h3>
              </div>
              {editMode ? (
                <label className="users-status-toggle">
                  <input
                    type="checkbox"
                    checked={!!formData.is_active}
                    onChange={(e) => onFieldChange("is_active", e.target.checked)}
                  />
                  <span className="users-status-toggle-track" aria-hidden="true">
                    <span className="users-status-toggle-thumb" />
                  </span>
                  <span className="users-status-toggle-label">{formData.is_active ? "Active" : "Inactive"}</span>
                </label>
              ) : (
                <span className={`status-badge ${user.is_active ? "status-active" : "status-inactive"}`}>
                  {user.is_active ? "Active" : "Inactive"}
                </span>
              )}

              <div className="users-edit-meta">
                <div>
                  <span className="users-edit-meta-label">Username</span>
                  <span className="users-edit-meta-value">{user.username}</span>
                </div>
                <div>
                  <span className="users-edit-meta-label">Joined</span>
                  <span className="users-edit-meta-value">{formatDate(user.date_joined)}</span>
                </div>
                <div>
                  <span className="users-edit-meta-label">Approval status</span>
                  <span className="users-edit-meta-value">{getApprovalStatus(user)}</span>
                </div>
              </div>

              <div className="users-edit-meta users-edit-meta-wide">
                <div>
                  <span className="users-edit-meta-label">Mentee of (Mentors)</span>
                  {renderConnectionList(user.mentee_connections)}
                </div>
                <div>
                  <span className="users-edit-meta-label">Mentor of (Mentees)</span>
                  {renderConnectionList(user.mentor_connections)}
                </div>
              </div>

              <div className="users-edit-meta users-edit-meta-wide">
                <div>
                  <span className="users-edit-meta-label">Mentor signup file</span>
                  {user.mentor_profile?.verification_document_url ? (
                    <a
                      className="users-edit-file-link"
                      href={user.mentor_profile.verification_document_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {user.mentor_profile.verification_document_name || "Open uploaded file"}
                    </a>
                  ) : (
                    <span className="users-edit-meta-value">No file uploaded</span>
                  )}
                </div>
                <div>
                  <span className="users-edit-meta-label">Mentee signup file</span>
                  {user.mentee_profile?.verification_document_url ? (
                    <a
                      className="users-edit-file-link"
                      href={user.mentee_profile.verification_document_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {user.mentee_profile.verification_document_name || "Open uploaded file"}
                    </a>
                  ) : (
                    <span className="users-edit-meta-value">No file uploaded</span>
                  )}
                </div>
              </div>
            </section>
          </div>

          <ModalFooter
            editMode={editMode}
            saving={saving}
            saveDisabled={saveDisabled}
            onClose={onClose}
            onCancelEdit={() => {
              setEditMode(false);
              setFormData(buildInitialForm(user));
              setShowValidation(false);
            }}
            onSave={handleSave}
            onStartEdit={() => setEditMode(true)}
          />
        </div>
      </div>
    );
  }

  function UsersPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const isStaff = !!(ctx.user.is_staff || ctx.user.role === "staff");
    if (!isStaff) return null;

    const tableElRef = useRef(null);
    const tableInstanceRef = useRef(null);
    const requestTimerRef = useRef(null);
    const usersCacheRef = useRef(new Map());
    const filtersRef = useRef({
      search: "",
      roleFilter: "",
      statusFilter: "",
      staffFilter: "",
    });

    const [usersById, setUsersById] = useState({});
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [staffFilter, setStaffFilter] = useState("");
    const [tableReady, setTableReady] = useState(false);
    const [tableEngineReady, setTableEngineReady] = useState(
      !!window.jQuery && !!window.jQuery.fn && !!window.jQuery.fn.DataTable,
    );
    const [tableEngineError, setTableEngineError] = useState("");
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalStartInEdit, setModalStartInEdit] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);

    const filters = useMemo(
      () => ({ search, roleFilter, statusFilter, staffFilter }),
      [search, roleFilter, statusFilter, staffFilter],
    );

    useEffect(() => {
      filtersRef.current = filters;
    }, [filters]);

    async function handleViewUser(userId, startInEdit = false) {
      const cached = usersById[userId];
      if (cached && (cached.mentor_profile || cached.mentee_profile)) {
        setModalStartInEdit(startInEdit);
        setSelectedUser(cached);
        return;
      }
      const result = await fetchJSON(`/api/users/${userId}/`);
      if (!result.ok) {
        notify("error", "Load Failed", result.data?.error || "Unable to load user details.");
        return;
      }
      const freshUser = result.data.user;
      setUsersById((prev) => ({ ...prev, [freshUser.id]: freshUser }));
      setModalStartInEdit(startInEdit);
      setSelectedUser(freshUser);
    }

    function clearUsersCache() {
      usersCacheRef.current.clear();
    }

    function reloadTable() {
      if (!tableInstanceRef.current) return;
      setLoading(true);
      tableInstanceRef.current.ajax.reload(null, true);
    }

    useEffect(() => {
      let cancelled = false;
      if (window.jQuery && window.jQuery.fn && window.jQuery.fn.DataTable) {
        setTableEngineReady(true);
        return;
      }
      ensureDataTablesLoaded()
        .then(() => {
          if (!cancelled) {
            setTableEngineReady(true);
            setTableEngineError("");
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setTableEngineError(err?.message || "Failed to load table engine.");
            notify("error", "Users Table Unavailable", "Could not load table engine. Please refresh.");
          }
        });
      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      if (
        !tableEngineReady ||
        !tableElRef.current ||
        tableInstanceRef.current ||
        !window.jQuery ||
        !window.jQuery.fn ||
        !window.jQuery.fn.DataTable
      ) {
        return;
      }

      const $ = window.jQuery;
      const fieldByColumn = ["username", "role", "is_active", "date_joined", "id"];

      const table = $(tableElRef.current).DataTable({
        processing: false,
        serverSide: true,
        searching: false,
        paging: true,
        lengthChange: false,
        info: false,
        pageLength: pageSize,
        order: [[3, "desc"]],
        autoWidth: false,
        dom: "t",
        language: {
          emptyTable: "No users found for the selected filters.",
        },
        ajax: async (dtRequest, callback) => {
          try {
            const liveFilters = filtersRef.current;
            const query = new URLSearchParams();
            const start = Number(dtRequest.start || 0);
            const length = Number(dtRequest.length || pageSize);
            const pageNum = Math.floor(start / Math.max(1, length)) + 1;
            const orderInfo = Array.isArray(dtRequest.order) && dtRequest.order[0]
              ? dtRequest.order[0]
              : { column: 3, dir: "desc" };
            const sortBy = fieldByColumn[orderInfo.column] || "date_joined";

            query.set("page", pageNum);
            query.set("page_size", length);
            query.set("sort_by", sortBy);
            query.set("sort_dir", orderInfo.dir || "desc");
            if (liveFilters.search.trim()) query.set("search", liveFilters.search.trim());
            if (liveFilters.roleFilter) query.set("role", liveFilters.roleFilter);
            if (liveFilters.statusFilter) query.set("is_active", liveFilters.statusFilter === "active" ? "true" : "false");
            if (liveFilters.staffFilter) query.set("is_staff", liveFilters.staffFilter === "yes" ? "true" : "false");

            const cacheKey = query.toString();
            const cached = usersCacheRef.current.get(cacheKey);
            if (cached) {
              setLoading(false);
              setUsersById(cached.usersById);
              setTotal(cached.total);
              setPage(cached.page);
              setTotalPages(cached.totalPages);
              setPageSize(cached.pageSize);
              callback({
                draw: dtRequest.draw,
                recordsTotal: cached.total,
                recordsFiltered: cached.total,
                data: cached.rows,
              });
              return;
            }

            setLoading(true);

            const result = await fetchJSON(`/api/users/?${query.toString()}`, {
              method: "GET",
              headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
            });

            if (!result.ok) {
              callback({
                draw: dtRequest.draw,
                recordsTotal: 0,
                recordsFiltered: 0,
                data: [],
              });
              setLoading(false);
              notify("error", "Load Failed", result.data?.error || "Unable to load users table.");
              return;
            }

            const response = result.data || {};
            const rows = response.users || response.data || [];
            const mapped = {};
            rows.forEach((u) => {
              mapped[u.id] = u;
            });
            setUsersById(mapped);
            setTotal(response.total || 0);
            setPage(response.page || pageNum);
            setTotalPages(response.total_pages || 1);
            setPageSize(length);
            usersCacheRef.current.set(cacheKey, {
              rows,
              usersById: mapped,
              total: response.total || 0,
              page: response.page || pageNum,
              totalPages: response.total_pages || 1,
              pageSize: length,
            });

            callback({
              draw: dtRequest.draw,
              recordsTotal: response.total || 0,
              recordsFiltered: response.total || 0,
              data: rows,
            });
            setLoading(false);
          } catch (err) {
            callback({
              draw: dtRequest.draw,
              recordsTotal: 0,
              recordsFiltered: 0,
              data: [],
            });
            setLoading(false);
            notify("error", "Load Failed", err?.message || "Unable to load users table.");
          }
        },
        columns: [
          {
            data: "username",
            title: "User",
            render: (_value, _type, row) => {
              const fullName = escapeHtml(row.full_name || row.username);
              const username = row.full_name && row.full_name !== row.username
                ? `<span class="users-username">@${escapeHtml(row.username)}</span>`
                : "";
              const email = escapeHtml(row.email || "—");
              const staffBadge = row.is_staff
                ? '<span class="badge badge-staff">Staff</span>'
                : "";
              return `
                <div class="users-user-cell">
                  <div class="users-user-top">
                    <strong>${fullName}</strong>
                    ${username}
                    ${staffBadge}
                  </div>
                  <div class="users-user-email">${email}</div>
                </div>
              `;
            },
          },
          {
            data: "role",
            title: "Role",
            render: (_value, _type, row) => `<span class="users-role-badge">${escapeHtml(getRoleDisplay(row))}</span>`,
          },
          {
            data: "is_active",
            title: "Status",
            className: "dt-center",
            render: (value) => {
              const active = !!value;
              const cls = active ? "status-active" : "status-inactive";
              return `<span class="status-badge ${cls}">${active ? "Active" : "Inactive"}</span>`;
            },
          },
          {
            data: "date_joined",
            title: "Joined",
            render: (value) => formatDate(value),
          },
          {
            data: "id",
            title: "Actions",
            orderable: false,
            searchable: false,
            className: "dt-center",
            render: (_value, _type, row) => {
              const mentorApprove =
                (row.role === "mentor" || row.role === "both") && row.mentor_approved === false
                  ? '<button class="btn btn-sm btn-success" data-action="approve-mentor">Approve Mentor</button>'
                  : "";
              const menteeApprove =
                (row.role === "mentee" || row.role === "both") && row.mentee_approved === false
                  ? '<button class="btn btn-sm btn-success" data-action="approve-mentee">Approve Mentee</button>'
                  : "";
              return `
                <div class="action-buttons users-action-buttons">
                  <button class="btn btn-sm btn-info" data-action="view">View</button>
                  ${mentorApprove}
                  ${menteeApprove}
                </div>
              `;
            },
          },
        ],
      });

      const rowActionHandler = async (ev) => {
        const actionEl = ev.target.closest("button[data-action]");
        if (!actionEl) return;

        const action = actionEl.getAttribute("data-action");
        const rowData = table.row(window.jQuery(actionEl).closest("tr")).data();
        if (!rowData) return;
        const userId = rowData.id;

        if (actionLoading === userId) return;

        if (action === "view") {
          await handleViewUser(userId, false);
          return;
        }
        if (action === "approve-mentor") {
          await handleApprove(userId, "mentor");
          return;
        }
        if (action === "approve-mentee") {
          await handleApprove(userId, "mentee");
          return;
        }
      };

      window.jQuery(tableElRef.current).on("click.usersActions", "button[data-action]", rowActionHandler);

      tableInstanceRef.current = table;
      setTableReady(true);

      return () => {
        if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
        window.jQuery(tableElRef.current).off("click.usersActions");
        if (tableInstanceRef.current) {
          // Keep the table element in the DOM for React; avoid hard-remove teardown.
          tableInstanceRef.current.destroy();
          tableInstanceRef.current = null;
        }
      };
    }, [tableEngineReady]);

    useEffect(() => {
      if (!tableReady) return;
      if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
      requestTimerRef.current = setTimeout(() => reloadTable(), 220);
      return () => {
        if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
      };
    }, [filters, tableReady]);

    async function handleActivate(userId) {
      setActionLoading(userId);
      try {
        const result = await fetchJSON(`/api/users/${userId}/activate-deactivate/`, {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({ is_active: true }),
        });
        if (result.ok) {
          clearUsersCache();
          reloadTable();
        } else {
          notify("error", "Action Failed", result.data?.error || "Unable to activate user.");
        }
      } catch (e) {
        notify("error", "Action Failed", e.message || "Unable to activate user.");
      }
      setActionLoading(null);
    }

    async function handleDeactivate(userId) {
      setActionLoading(userId);
      try {
        const result = await fetchJSON(`/api/users/${userId}/activate-deactivate/`, {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({ is_active: false }),
        });
        if (result.ok) {
          clearUsersCache();
          reloadTable();
        } else {
          notify("error", "Action Failed", result.data?.error || "Unable to deactivate user.");
        }
      } catch (e) {
        notify("error", "Action Failed", e.message || "Unable to deactivate user.");
      }
      setActionLoading(null);
    }

    async function handleApprove(userId, roleType) {
      setActionLoading(userId);
      try {
        const endpoint = roleType === "mentor" ? "mentor-approve" : "mentee-approve";
        const result = await fetchJSON(`/api/users/${userId}/${endpoint}/`, {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({ approved: true }),
        });
        if (result.ok) {
          clearUsersCache();
          reloadTable();
          if (selectedUser) {
            setSelectedUser(result.data.user);
          }
        } else {
          notify("error", "Approval Failed", result.data?.error || "Unable to update approval.");
        }
      } catch (e) {
        notify("error", "Approval Failed", e.message || "Unable to update approval.");
      }
      setActionLoading(null);
    }

    async function handleReject(userId, roleType) {
      setActionLoading(userId);
      try {
        const endpoint = roleType === "mentor" ? "mentor-approve" : "mentee-approve";
        const result = await fetchJSON(`/api/users/${userId}/${endpoint}/`, {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({ approved: false }),
        });
        if (result.ok) {
          clearUsersCache();
          reloadTable();
          if (selectedUser) {
            setSelectedUser(result.data.user);
          }
        } else {
          notify("error", "Approval Failed", result.data?.error || "Unable to update approval.");
        }
      } catch (e) {
        notify("error", "Approval Failed", e.message || "Unable to update approval.");
      }
      setActionLoading(null);
    }

    function handleAddUser() {
      setShowCreateUserModal(true);
    }

    function resetFilters() {
      setSearch("");
      setRoleFilter("");
      setStatusFilter("");
      setStaffFilter("");
    }

    const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const showingTo = total === 0 ? 0 : Math.min(page * pageSize, total);

    return (
      <div className="users-management-page">
        <div className="users-page-header">
          <div>
            <h1 className="page-title users-page-title">User Management</h1>
            <p className="page-subtitle users-page-subtitle">Manage user access, roles, and approvals from a single admin workspace.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleAddUser}>+ Add User</button>
        </div>

        <div className="users-toolbar">
          <div className="users-toolbar-main">
            <input
              type="text"
              className="users-search-input"
              placeholder="Search by name, email, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="users-toolbar-filters">
            <select
              className="users-filter-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              title="Filter by user role"
            >
              <option value="">All Roles</option>
              <option value="mentor">Mentors Only</option>
              <option value="mentee">Mentees Only</option>
              <option value="both">Both Mentor & Mentee</option>
              <option value="none">No Profile</option>
            </select>

            <select
              className="users-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filter by account status"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <select
              className="users-filter-select"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              title="Filter by staff status"
            >
              <option value="">All Users</option>
              <option value="yes">Staff Only</option>
              <option value="no">Non-Staff Only</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetFilters}
            >
              Reset filters
            </button>
          </div>
        </div>

        <div className="users-filter-info">
          {loading ? "Refreshing users..." : `Showing ${showingFrom}-${showingTo} of ${total} users`}
        </div>

        <div className="users-table-status" aria-live="polite">
          {!tableEngineReady && !tableEngineError && "Loading DataTables engine..."}
          {loading && tableEngineReady && "Loading users table..."}
          {tableEngineError && tableEngineError}
        </div>

        <div className="table-wrapper users-table-shell">
          <table ref={tableElRef} className="users-datatable display" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
          </table>
        </div>

        {total === 0 && !loading && tableEngineReady && (
          <div className="users-empty-state">No users found. Try changing filters or search terms.</div>
        )}

        <div className="pagination-section users-pagination">
          <div className="pagination-info">Page {page} of {totalPages}</div>
          <div className="pagination-controls">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => tableInstanceRef.current?.page("previous").draw("page")}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => tableInstanceRef.current?.page("next").draw("page")}
            >
              Next
            </button>
          </div>
        </div>

        {showCreateUserModal && (
          <CreateUserModal
            onClose={() => setShowCreateUserModal(false)}
            onCreated={() => {
              clearUsersCache();
              reloadTable();
            }}
          />
        )}

        {selectedUser && (
          <UserDetailsModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            startInEdit={modalStartInEdit}
            onUpdate={(updatedUser) => {
              setUsersById((prev) => ({ ...prev, [updatedUser.id]: updatedUser }));
              setSelectedUser(updatedUser);
              clearUsersCache();
              reloadTable();
            }}
          />
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["users"] = UsersPage;
})();
