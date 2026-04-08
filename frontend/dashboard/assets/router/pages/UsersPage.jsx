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

  function UserDetailsModal({ user, onClose, onUpdate, startInEdit = false }) {
    const [editMode, setEditMode] = useState(startInEdit);
    const [formData, setFormData] = useState({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      is_staff: user.is_staff,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      setEditMode(!!startInEdit);
    }, [startInEdit, user.id]);

    async function handleSave() {
      setSaving(true);
      try {
        const result = await fetchJSON(`/api/users/${user.id}/update/`, {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify(formData),
        });
        if (result.ok) {
          onUpdate(result.data.user);
          setEditMode(false);
        } else {
          notify("error", "Update Failed", result.data?.error || "Unable to update user.");
        }
      } catch (e) {
        notify("error", "Update Failed", e.message || "Unable to update user.");
      }
      setSaving(false);
    }

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-dialog" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">User Details: {user.full_name || user.username}</h2>
            <button type="button" className="modal-close" onClick={onClose}>&times;</button>
          </div>

          <div className="modal-body">
            {editMode ? (
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />

                <label>Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />

                <label>Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />

                <label style={{ marginTop: "1rem" }}>
                  <input
                    type="checkbox"
                    checked={formData.is_staff}
                    onChange={(e) => setFormData({ ...formData, is_staff: e.target.checked })}
                  />
                  {" "}Is Staff Member
                </label>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <strong>Username</strong>
                  <p>{user.username}</p>
                </div>

                <div>
                  <strong>Email</strong>
                  <p>{user.email}</p>
                </div>

                <div>
                  <strong>Name</strong>
                  <p>{user.full_name || "—"}</p>
                </div>

                <div>
                  <strong>Role</strong>
                  <p>{getRoleDisplay(user)}</p>
                </div>

                <div>
                  <strong>Status</strong>
                  <p>
                    <span className={`status-badge ${user.is_active ? "status-active" : "status-inactive"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>

                <div>
                  <strong>Staff</strong>
                  <p>{user.is_staff ? "Yes" : "No"}</p>
                </div>

                <div>
                  <strong>Joined</strong>
                  <p>{formatDate(user.date_joined)}</p>
                </div>

                <div>
                  <strong>Approval Status</strong>
                  <p>{getApprovalStatus(user)}</p>
                </div>

                {user.mentor_profile && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <strong>Mentor Profile</strong>
                    <div style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                      <p><strong>Program:</strong> {user.mentor_profile.program}</p>
                      <p><strong>Year:</strong> {user.mentor_profile.year_level}</p>
                      <p><strong>Capacity:</strong> {user.mentor_profile.capacity}</p>
                    </div>
                  </div>
                )}

                {user.mentee_profile && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <strong>Mentee Profile</strong>
                    <div style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                      <p><strong>Program:</strong> {user.mentee_profile.program}</p>
                      <p><strong>Year:</strong> {user.mentee_profile.year_level}</p>
                      <p><strong>Student ID:</strong> {user.mentee_profile.student_id_no || "—"}</p>
                      <p><strong>Contact:</strong> {user.mentee_profile.contact_no || "—"}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            {editMode ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditMode(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEditMode(true)}
              >
                Edit User
              </button>
            )}
          </div>
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
            setLoading(true);
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
              const toggler = row.is_active
                ? '<button class="btn btn-sm btn-warning" data-action="deactivate">Deactivate</button>'
                : '<button class="btn btn-sm btn-success" data-action="activate">Activate</button>';
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
                  <button class="btn btn-sm btn-info" data-action="edit">Edit</button>
                  <details class="users-actions-menu">
                    <summary class="btn btn-sm" aria-label="More actions">More</summary>
                    <div class="users-actions-menu-list">
                      ${toggler}
                      ${mentorApprove}
                      ${menteeApprove}
                      <button class="btn btn-sm btn-danger" data-action="delete">Delete</button>
                    </div>
                  </details>
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

        if (action === "edit") {
          await handleViewUser(userId, true);
          return;
        }
        if (action === "activate") {
          await handleActivate(userId);
          return;
        }
        if (action === "deactivate") {
          await handleDeactivate(userId);
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
        if (action === "delete") {
          await handleDelete(userId);
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
          reloadTable();
        } else {
          notify("error", "Action Failed", result.data?.error || "Unable to deactivate user.");
        }
      } catch (e) {
        notify("error", "Action Failed", e.message || "Unable to deactivate user.");
      }
      setActionLoading(null);
    }

    async function handleDelete(userId) {
      if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
      setActionLoading(userId);
      try {
        const result = await fetchJSON(`/api/users/${userId}/delete/`, {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
        });
        if (result.ok) {
          reloadTable();
        } else {
          notify("error", "Delete Failed", result.data?.error || "Unable to delete user.");
        }
      } catch (e) {
        notify("error", "Delete Failed", e.message || "Unable to delete user.");
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
      notify("info", "Add User", "Use the sign up flow to create a new user account.");
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

        {selectedUser && (
          <UserDetailsModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            startInEdit={modalStartInEdit}
            onUpdate={(updatedUser) => {
              setUsersById((prev) => ({ ...prev, [updatedUser.id]: updatedUser }));
              setSelectedUser(updatedUser);
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
