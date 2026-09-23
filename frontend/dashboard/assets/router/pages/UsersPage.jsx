(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useMemo, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const Utils = window.DashboardApp.Utils || {};
  const { getCookie, fetchJSON } = Utils;
  const formatSlotList =
    (window.DashboardApp.Availability &&
      window.DashboardApp.Availability.formatSlotList) ||
    ((slots) => (Array.isArray(slots) ? slots.join(", ") : ""));

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString([], { dateStyle: "short" });
  }

  const ROLE_FILTER_OPTIONS = [
    { value: "", label: "All roles" },
    { value: "mentor", label: "Mentors only" },
    { value: "mentee", label: "Mentees only" },
    { value: "both", label: "Mentor & mentee" },
    { value: "none", label: "No profile" },
  ];

  const STATUS_FILTER_OPTIONS = [
    { value: "", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  const ACCESS_FILTER_OPTIONS = [
    { value: "", label: "All users" },
    { value: "yes", label: "Staff only" },
    { value: "no", label: "Non-staff only" },
  ];

  const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

  function optionLabel(options, value) {
    const match = options.find((option) => option.value === value);
    return match ? match.label : value;
  }

  function getInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Stable hue per user so avatars keep the same colour between renders. */
  function avatarHue(seed) {
    const text = String(seed || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) % 360;
    }
    return hash;
  }

  function roleVariant(user) {
    if (user.role === "both") return "both";
    if (user.role === "mentor") {
      const mRole = String(user.mentor_profile?.role || user.mentor_role || "").toLowerCase();
      if (mRole.includes("instructor") || mRole.includes("faculty")) return "instructor";
      return "student-mentor";
    }
    if (user.role === "mentee") return "mentee";
    if (user.role === "staff" || user.is_staff) return "staff";
    return "none";
  }

  function pendingApprovalLabel(user) {
    if (user.role === "mentor") {
      return user.mentor_approved === false ? "Pending approval" : "";
    }
    if (user.role === "mentee") {
      return user.mentee_approved === false ? "Pending approval" : "";
    }
    if (user.role === "both") {
      const pending = [];
      if (user.mentor_approved === false) pending.push("mentor");
      if (user.mentee_approved === false) pending.push("mentee");
      return pending.length ? `Pending ${pending.join(" & ")}` : "";
    }
    return "";
  }

  function renderVerificationDocs(profile, fallbackLabel) {
    if (!profile) {
      return <span className="users-edit-meta-value">No file uploaded</span>;
    }
    const groups = [
      ["letter_of_intent", "Letter of intent"],
      ["study_load", "Study load"],
      ["grade", "Grade"],
      ["application", "Application form"],
    ];
    const byKind = profile.verification_documents_by_kind || {};
    const filled = groups.filter(([kind]) => (byKind[kind] || []).length);
    if (filled.length) {
      return filled.map(([kind, label]) => (
        <div key={kind}>
          <span className="users-edit-meta-label">{label}</span>
          <div className="users-edit-file-list">
            {(byKind[kind] || []).map((doc, index) => (
              <a
                key={doc.id || `${kind}-${index}`}
                className="users-edit-file-link"
                href={doc.url}
                target="_blank"
                rel="noreferrer"
              >
                {doc.name || "Open uploaded file"}
              </a>
            ))}
          </div>
        </div>
      ));
    }
    if (profile.verification_document_url) {
      return (
        <div>
          <span className="users-edit-meta-label">{fallbackLabel}</span>
          <a
            className="users-edit-file-link"
            href={profile.verification_document_url}
            target="_blank"
            rel="noreferrer"
          >
            {profile.verification_document_name || "Open uploaded file"}
          </a>
        </div>
      );
    }
    return (
      <div>
        <span className="users-edit-meta-label">{fallbackLabel}</span>
        <span className="users-edit-meta-value">No file uploaded</span>
      </div>
    );
  }

  function formatUsername(user) {
    if (user.full_name && user.full_name !== user.username) {
      return `${user.full_name} (@${user.username})`;
    }
    return user.username;
  }

  function getRoleDisplay(user) {
    if (user.role === "both") {
      const mRole = String(user.mentor_profile?.role || user.mentor_role || "").toLowerCase();
      const isInst = mRole.includes("instructor") || mRole.includes("faculty");
      return `${isInst ? "Instructor" : "Student Mentor"} & Mentee`;
    }
    if (user.role === "mentor") {
      const mRole = String(user.mentor_profile?.role || user.mentor_role || "").toLowerCase();
      if (mRole.includes("instructor") || mRole.includes("faculty")) return "Instructor";
      return "Student Mentor";
    }
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
    if (
      window.DashboardApp &&
      typeof window.DashboardApp.notify === "function"
    ) {
      window.DashboardApp.notify(type, title, text);
      return;
    }
    alert(text || title);
  }

  function ensureDataTablesLoaded() {
    return Promise.resolve();
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
      id: "both",
      title: "Both (Mentor & Mentee)",
      description:
        "Has both mentor and mentee profiles. Can participate in both capacities.",
      icon: "B",
    },
    {
      id: "staff",
      title: "Staff (Admin)",
      description:
        "Administrative user with access to approvals, activity logs, and system management.",
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
      password: "",
      selected_role: "mentor",
    });
    const [showPassword, setShowPassword] = useState(false);
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
      const pwd = String(formData.password || "").trim();
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
      if (pwd && pwd.length < 8) {
        nextErrors.password = "Custom password must be at least 8 characters.";
      }
      return nextErrors;
    }, [formData.email, formData.first_name, formData.last_name, formData.password]);

    const saveDisabled = saving || Object.keys(errors).length > 0;

    async function handleCreate() {
      if (Object.keys(errors).length > 0) {
        setShowValidation(true);
        const firstError = Object.values(errors)[0] || "Please fill in all required fields.";
        notify("warning", "Incomplete Form", firstError);
        return;
      }
      if (saving) return;

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
            password: String(formData.password || "").trim(),
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

        notify("success", "User Created", result.data?.message || "User created and credentials emailed.");
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
              <p className="users-edit-subtitle">Create a user account. If no password is specified, a secure temporary password will be generated and emailed.</p>
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
                  <label className="users-edit-label" htmlFor="create-user-first-name">First Name *</label>
                  <input
                    id="create-user-first-name"
                    type="text"
                    className={`users-edit-input ${showValidation && errors.first_name ? "is-invalid" : ""}`}
                    value={formData.first_name}
                    onChange={(e) => onFieldChange("first_name", e.target.value)}
                    autoComplete="given-name"
                    required
                    aria-required="true"
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
                  <label className="users-edit-label" htmlFor="create-user-last-name">Last Name *</label>
                  <input
                    id="create-user-last-name"
                    type="text"
                    className={`users-edit-input ${showValidation && errors.last_name ? "is-invalid" : ""}`}
                    value={formData.last_name}
                    onChange={(e) => onFieldChange("last_name", e.target.value)}
                    autoComplete="family-name"
                    required
                    aria-required="true"
                  />
                  {showValidation && errors.last_name && <p className="users-edit-error">{errors.last_name}</p>}
                </div>
                <div className="users-edit-field-wrap">
                  <label className="users-edit-label" htmlFor="create-user-email">Email *</label>
                  <input
                    id="create-user-email"
                    type="email"
                    className={`users-edit-input ${showValidation && errors.email ? "is-invalid" : ""}`}
                    value={formData.email}
                    onChange={(e) => onFieldChange("email", e.target.value)}
                    autoComplete="email"
                    required
                    aria-required="true"
                  />
                  {showValidation && errors.email && <p className="users-edit-error">{errors.email}</p>}
                </div>
                <div className="users-edit-field-wrap full-width" style={{ gridColumn: "1 / -1" }}>
                  <label className="users-edit-label" htmlFor="create-user-password">
                    Password <span style={{ fontWeight: "normal", color: "var(--users-muted, #64748b)", fontSize: "11px" }}>(Optional - leave blank to auto-generate)</span>
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      id="create-user-password"
                      type={showPassword ? "text" : "password"}
                      className={`users-edit-input ${showValidation && errors.password ? "is-invalid" : ""}`}
                      style={{ paddingRight: "40px", width: "100%" }}
                      value={formData.password}
                      onChange={(e) => onFieldChange("password", e.target.value)}
                      placeholder="Custom password or leave empty to auto-generate"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: "8px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--users-muted, #64748b)",
                        display: "flex",
                        alignItems: "center",
                        padding: "4px",
                      }}
                    >
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {showValidation && errors.password && <p className="users-edit-error">{errors.password}</p>}
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
              <p className="users-edit-warning">The account will be created with the selected role. The login credentials and password will be emailed to the user automatically.</p>
            </section>
          </div>

          <div className="users-edit-footer">
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="btn" onClick={handleCreate} disabled={saving}>
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
    onDelete,
    deleteDisabled,
  }) {
    return (
      <div className="users-edit-footer">
        {editMode ? (
          <>
            <button type="button" className="btn secondary" onClick={onCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={onSave} disabled={saving}>
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn secondary" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn danger" onClick={onDelete} disabled={deleteDisabled}>
              {deleteDisabled ? "Delete Disabled" : "Delete Account"}
            </button>
            <button type="button" className="btn" onClick={onStartEdit}>
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
      if (Object.keys(errors).length > 0) {
        setShowValidation(true);
        const firstError = Object.values(errors)[0] || "Please check the required fields.";
        notify("warning", "Invalid Input", firstError);
        return;
      }
      if (!roleSupport.supported) {
        notify("warning", "Unsupported Role", roleSupport.message || "This role change cannot be saved.");
        return;
      }
      if (!hasChanges) {
        notify("info", "No Changes", "No changes were made to save.");
        return;
      }
      if (saving) return;

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

        notify("success", "User Updated", "User details saved successfully.");
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
                    <p>Availability: {Array.isArray(user.mentee_profile?.availability) ? formatSlotList(user.mentee_profile.availability) : "Not provided"}</p>
                  </div>
                )}
                {activeRole === "staff" && (
                  <div className="users-role-conditional-content">
                    <p className="users-role-panel-title">Admin Permissions Summary</p>
                    <p>Access to approvals, activity logs, and backup tools.</p>
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                    <span className="users-edit-meta-value">{getApprovalStatus(user)}</span>
                    {(user.role === "mentor" || user.role === "both") && user.mentor_approved === false && (
                      <button
                        type="button"
                        className="users-action-btn approve-btn"
                        onClick={async () => {
                          await handleApprove(user.id, "mentor");
                          handleViewUser(user.id);
                        }}
                        disabled={actionLoading === user.id}
                        style={{ padding: "3px 10px", fontSize: "12px" }}
                      >
                        ✓ Approve Mentor
                      </button>
                    )}
                    {(user.role === "mentee" || user.role === "both") && user.mentee_approved === false && (
                      <button
                        type="button"
                        className="users-action-btn approve-btn"
                        onClick={async () => {
                          await handleApprove(user.id, "mentee");
                          handleViewUser(user.id);
                        }}
                        disabled={actionLoading === user.id}
                        style={{ padding: "3px 10px", fontSize: "12px" }}
                      >
                        ✓ Approve Mentee
                      </button>
                    )}
                  </div>
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
                {user.mentor_profile
                  ? renderVerificationDocs(
                      user.mentor_profile,
                      "Mentor signup file",
                    )
                  : null}
                {user.mentee_profile
                  ? renderVerificationDocs(
                      user.mentee_profile,
                      "Mentee signup file",
                    )
                  : null}
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
            onDelete={() => handleDeleteUser(user.id)}
            deleteDisabled={!!(user.id && ctx.user && Number(user.id) === Number(ctx.user.id)) || actionLoading === user.id}
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
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [staffFilter, setStaffFilter] = useState("");
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [sortBy, setSortBy] = useState("date_joined");
    const [sortDir, setSortDir] = useState("desc");
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalStartInEdit, setModalStartInEdit] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [userTab, setUserTab] = useState("all");
    const adminPairings = ctx.adminPairings || [];

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

    const fetchUsersData = async (
      targetPage = page,
      targetPageSize = pageSize,
      targetSortBy = sortBy,
      targetSortDir = sortDir,
      liveFilters = filters,
    ) => {
      try {
        setLoading(true);
        const query = new URLSearchParams();
        query.set("page", targetPage);
        query.set("page_size", targetPageSize);
        query.set("sort_by", targetSortBy);
        query.set("sort_dir", targetSortDir);
        if (liveFilters.search && liveFilters.search.trim()) {
          query.set("search", liveFilters.search.trim());
        }
        if (liveFilters.roleFilter) {
          query.set("role", liveFilters.roleFilter);
        }
        if (liveFilters.statusFilter) {
          query.set("is_active", liveFilters.statusFilter === "active" ? "true" : "false");
        }
        if (liveFilters.staffFilter) {
          query.set("is_staff", liveFilters.staffFilter === "yes" ? "true" : "false");
        }

        const cacheKey = query.toString();
        const cached = usersCacheRef.current.get(cacheKey);
        if (cached) {
          setLoading(false);
          setUsers(cached.rows);
          setUsersById(cached.usersById);
          setTotal(cached.total);
          setPage(cached.page);
          setTotalPages(cached.totalPages);
          setPageSize(cached.pageSize);
          return;
        }

        const result = await fetchJSON(`/api/users/?${query.toString()}`, {
          method: "GET",
          headers: { "X-CSRFToken": getCookie("csrftoken") || "" },
        });

        if (!result.ok) {
          setLoading(false);
          setUsers([]);
          notify("error", "Load Failed", result.data?.error || "Unable to load users table.");
          return;
        }

        const response = result.data || {};
        const rows = response.users || response.data || [];
        const mapped = {};
        rows.forEach((u) => {
          mapped[u.id] = u;
        });
        setUsers(rows);
        setUsersById((prev) => ({ ...prev, ...mapped }));
        setTotal(response.total || 0);
        setPage(response.page || targetPage);
        setTotalPages(response.total_pages || 1);
        setPageSize(targetPageSize);

        usersCacheRef.current.set(cacheKey, {
          rows,
          usersById: mapped,
          total: response.total || 0,
          page: response.page || targetPage,
          totalPages: response.total_pages || 1,
          pageSize: targetPageSize,
        });
        setLoading(false);
      } catch (err) {
        setLoading(false);
        setUsers([]);
        notify("error", "Load Failed", err?.message || "Unable to load users table.");
      }
    };

    function reloadTable() {
      fetchUsersData(page, pageSize, sortBy, sortDir, filters);
    }

    useEffect(() => {
      if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
      requestTimerRef.current = setTimeout(() => {
        fetchUsersData(1, pageSize, sortBy, sortDir, filters);
      }, 200);
      return () => {
        if (requestTimerRef.current) clearTimeout(requestTimerRef.current);
      };
    }, [filters, pageSize, sortBy, sortDir]);

    function handleSort(colName) {
      if (sortBy === colName) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(colName);
        setSortDir("asc");
      }
    }

    async function handleDeleteUser(userId) {
      const targetUser = usersById[userId] || selectedUser;
      if (!targetUser) return;
      if (Number(targetUser.id) === Number(ctx.user.id)) {
        notify("error", "Delete Blocked", "You cannot delete your own admin account.");
        return;
      }

      const targetLabel = targetUser.full_name || targetUser.username || "this user";
      const confirmed = window.confirm(
        `Are you sure you want to permanently delete ${targetLabel}? This will delete their account entirely.`,
      );
      if (!confirmed) return;

      setActionLoading(userId);
      try {
        const result = await fetchJSON(`/api/users/${userId}/delete/`, {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
        });
        if (result.ok) {
          clearUsersCache();
          reloadTable();
          if (selectedUser && Number(selectedUser.id) === Number(userId)) {
            setSelectedUser(null);
          }
          notify("success", "Account Deleted", `${targetLabel}'s account was permanently deleted.`);
        } else {
          notify("error", "Delete Failed", result.data?.error || "Unable to delete user.");
        }
      } catch (e) {
        notify("error", "Delete Failed", e.message || "Unable to delete user.");
      }
      setActionLoading(null);
    }

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
          notify("success", "User Activated", "User account has been activated.");
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
          notify("info", "User Deactivated", "User account has been deactivated.");
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
          const updatedUser = result.data?.user;
          if (updatedUser) {
            setUsersById((prev) => ({ ...prev, [userId]: updatedUser }));
            setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
          }
          clearUsersCache();
          reloadTable();
          if (selectedUser && Number(selectedUser.id) === Number(userId)) {
            setSelectedUser(updatedUser || result.data.user);
          }
          notify("success", "Approved", `${roleType === "mentor" ? "Mentor" : "Mentee"} role approved successfully.`);
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

    const hasActiveFilters = !!(search || roleFilter || statusFilter || staffFilter);
    const activeFilterChips = [];
    if (search) {
      activeFilterChips.push({
        key: "search",
        name: "Search",
        value: search,
        clear: () => setSearch(""),
      });
    }
    if (roleFilter) {
      activeFilterChips.push({
        key: "role",
        name: "Role",
        value: optionLabel(ROLE_FILTER_OPTIONS, roleFilter),
        clear: () => setRoleFilter(""),
      });
    }
    if (statusFilter) {
      activeFilterChips.push({
        key: "status",
        name: "Status",
        value: optionLabel(STATUS_FILTER_OPTIONS, statusFilter),
        clear: () => setStatusFilter(""),
      });
    }
    if (staffFilter) {
      activeFilterChips.push({
        key: "access",
        name: "Access",
        value: optionLabel(ACCESS_FILTER_OPTIONS, staffFilter),
        clear: () => setStaffFilter(""),
      });
    }

    return (
      <div className="users-management-space users-management-page page-shell">
        {/* Kasandigan Open Native Header — Zero box container */}
        <header className="kasandigan-header">
          <div className="kasandigan-header-content">
            <div className="kasandigan-badge">
              <span className="kasandigan-badge-dot" />
              <span>Academic Mentoring Unit • Operations Console</span>
            </div>
            <h1 className="kasandigan-title">User Management</h1>
            <p className="kasandigan-subtitle">
              Manage user access, roles, and approvals from a single admin workspace.
            </p>
          </div>
          <div className="kasandigan-header-actions">
            <div className="approvals-summary-pill">
              <span className="approvals-summary-pill-count">{total}</span>
              <span>{total === 1 ? "User" : "Users"}</span>
            </div>
            <button
              type="button"
              className="btn kasandigan-btn-primary"
              onClick={handleAddUser}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add User</span>
            </button>
          </div>
        </header>

        {/* Section View Switcher */}
        <div className="users-nav-pills-row" style={{ display: "flex", gap: 10, margin: "14px 0 20px 0" }}>
          <button
            type="button"
            className={`btn small ${userTab === "all" ? "primary" : "secondary"}`}
            onClick={() => setUserTab("all")}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            All Accounts ({total})
          </button>
          <button
            type="button"
            className={`btn small ${userTab === "paired" ? "primary" : "secondary"}`}
            onClick={() => setUserTab("paired")}
            style={{ borderRadius: 10, fontWeight: 600 }}
          >
            Paired Users ({adminPairings.length})
          </button>
        </div>

        {userTab === "paired" ? (
          window.DashboardApp.AdminPairedUsersView ? (
            <window.DashboardApp.AdminPairedUsersView />
          ) : (
            <div className="card text-center" style={{ padding: 48 }}>Loading paired users…</div>
          )
        ) : (
          <div className="users-management-card kasandigan-card">
          <div className="users-toolbar">
            <div className="users-search-field">
              <svg
                className="users-search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.65" y1="16.65" x2="21" y2="21" />
              </svg>
              <input
                type="search"
                id="users-search"
                className="users-search-input"
                placeholder="Search by name, email, or username"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="users-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <div className="users-toolbar-filters">
              <div className="users-filter-group">
                <label htmlFor="users-filter-role">Role</label>
                <select
                  id="users-filter-role"
                  className="users-filter-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  {ROLE_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="users-filter-group">
                <label htmlFor="users-filter-status">Status</label>
                <select
                  id="users-filter-status"
                  className="users-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="users-filter-group">
                <label htmlFor="users-filter-access">Access</label>
                <select
                  id="users-filter-access"
                  className="users-filter-select"
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                >
                  {ACCESS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn secondary users-reset-btn"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="users-results-bar">
            <span className="users-filter-info" aria-live="polite">
              {loading ? (
                "Refreshing users…"
              ) : total === 0 ? (
                "No users match the current filters"
              ) : (
                <>
                  Showing <strong>{showingFrom}–{showingTo}</strong> of{" "}
                  <strong>{total}</strong> users
                </>
              )}
            </span>

            {activeFilterChips.length > 0 && (
              <div className="users-active-filters">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="users-filter-chip"
                    onClick={chip.clear}
                    title={`Remove ${chip.name} filter`}
                  >
                    <span className="users-filter-chip-name">{chip.name}</span>
                    <span className="users-filter-chip-value">{chip.value}</span>
                    <span className="users-filter-chip-x" aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}

            <label className="users-page-size">
              <span>Rows</span>
              <select
                className="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!next) return;
                  setPageSize(next);
                  fetchUsersData(1, next, sortBy, sortDir, filters);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="table-wrapper users-table-shell">
            <table className="users-datatable display" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th onClick={() => handleSort("username")} className="users-th-sortable">
                    User {sortBy === "username" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th onClick={() => handleSort("role")} className="users-th-sortable">
                    Role {sortBy === "role" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th onClick={() => handleSort("is_active")} className="users-th-sortable dt-center">
                    Status {sortBy === "is_active" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th onClick={() => handleSort("date_joined")} className="users-th-sortable">
                    Joined {sortBy === "date_joined" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                  <th className="dt-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="users-td-loading" style={{ textAlign: "center", padding: "36px" }}>
                      <div className="users-table-loading-spinner">Loading users…</div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="users-td-empty" style={{ textAlign: "center", padding: "36px" }}>
                      <div className="users-empty-state">No users found. Try changing filters or search terms.</div>
                    </td>
                  </tr>
                ) : (
                  users.map((row) => {
                    const displayName = row.full_name || row.username;
                    const initials = getInitials(displayName);
                    const hue = avatarHue(row.username || row.email || row.id);
                    const pending = pendingApprovalLabel(row);
                    const isCurrentUser = Number(row.id) === Number(ctx.user.id);
                    const isActionBusy = actionLoading === row.id;

                    return (
                      <tr key={`user-${row.id}`} className="users-table-row">
                        <td>
                          <div className="users-user-cell">
                            <span
                              className="users-avatar"
                              style={{ "--users-avatar-hue": hue }}
                              aria-hidden="true"
                            >
                              {initials}
                            </span>
                            <div className="users-user-info">
                              <div className="users-user-top">
                                <span className="users-user-name">{displayName}</span>
                                {row.full_name && row.full_name !== row.username && (
                                  <span className="users-username">@{row.username}</span>
                                )}
                                {row.is_staff && (
                                  <span className="badge badge-staff">Staff</span>
                                )}
                              </div>
                              <div className="users-user-email">{row.email || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="users-role-cell">
                            <span className={`users-role-badge users-role-badge--${roleVariant(row)}`}>
                              {getRoleDisplay(row)}
                            </span>
                            {pending && (
                              <span className="users-pending-pill">{pending}</span>
                            )}
                          </div>
                        </td>
                        <td className="dt-center">
                          <span className={`status-badge ${row.is_active ? "status-active" : "status-inactive"}`}>
                            <span className="users-status-dot" aria-hidden="true" />
                            {row.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <span className="users-joined-cell">{formatDate(row.date_joined)}</span>
                        </td>
                        <td className="dt-center">
                          <div className="action-buttons users-action-buttons">
                            <button
                              type="button"
                              className="users-action-btn view-btn"
                              onClick={() => handleViewUser(row.id, false)}
                              disabled={isActionBusy}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              <span>View</span>
                            </button>
                            {(row.role === "mentor" || row.role === "both") && row.mentor_approved === false && (
                              <button
                                type="button"
                                className="users-action-btn approve-btn"
                                onClick={() => handleApprove(row.id, "mentor")}
                                disabled={isActionBusy}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Approve Mentor</span>
                              </button>
                            )}
                            {(row.role === "mentee" || row.role === "both") && row.mentee_approved === false && (
                              <button
                                type="button"
                                className="users-action-btn approve-btn"
                                onClick={() => handleApprove(row.id, "mentee")}
                                disabled={isActionBusy}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                <span>Approve Mentee</span>
                              </button>
                            )}
                            {!isCurrentUser && (
                              <button
                                type="button"
                                className="users-action-btn delete-btn"
                                onClick={() => handleDeleteUser(row.id)}
                                disabled={isActionBusy}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination-section users-pagination">
            <div className="pagination-info">
              Page {page} of {totalPages}
            </div>
            <div className="pagination-controls">
              <button
                type="button"
                className="btn secondary"
                disabled={page <= 1 || loading}
                onClick={() => fetchUsersData(page - 1, pageSize, sortBy, sortDir, filters)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn secondary"
                disabled={page >= totalPages || loading}
                onClick={() => fetchUsersData(page + 1, pageSize, sortBy, sortDir, filters)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        )}

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
