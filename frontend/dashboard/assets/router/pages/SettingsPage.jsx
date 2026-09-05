import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";

(function () {
  "use strict";
  const React = window.React;
  const { useContext, useState, useEffect, useRef } = React;
  const AppContext = window.DashboardApp.AppContext;
  const { getCookie, fetchJSON, DashboardIcon } =
    window.DashboardApp.Utils || {};

  const BIO_MAX = 200;
  const MAX_TAGS = 8;
  const OPEN_SECTION_STORAGE_KEY = "settings:open-section";
  const TAB_IDS = ["account", "password", "academic"];
  const LEGACY_SECTION_MAP = { general: "academic", bio: "account" };

  /** Reads the section from a "settings/<section>" hash so links can open one directly. */
  function sectionFromHash() {
    const raw = String(window.location.hash || "").replace(/^#/, "");
    if (!raw.startsWith("settings")) return null;
    const section = raw.split("/")[1] || "";
    const normalized = LEGACY_SECTION_MAP[section] || section;
    return TAB_IDS.includes(normalized) ? normalized : null;
  }

  function writeSectionHash(section) {
    const base = window.location.pathname + window.location.search;
    const next = section ? `${base}#settings/${section}` : `${base}#settings`;
    window.history.replaceState(null, "", next);
  }

  const PASSWORD_STRENGTH_LABELS = [
    "Too weak",
    "Too weak",
    "Weak",
    "Almost there",
    "Strong",
  ];

  function formatYearLevel(value) {
    const level = Number(value);
    if (!level) return "—";
    if (level === 1) return "1st Year";
    if (level === 2) return "2nd Year";
    if (level === 3) return "3rd Year";
    if (level === 4) return "4th Year";
    return `Year ${level}`;
  }

  function SettingsTabNav({ tabs, activeTab, onChange }) {
    const handleTabChange = (_event, value) => {
      onChange(value);
    };
    return (
      <Tabs
        allowScrollButtonsMobile
        aria-label="Settings sections"
        className="settings-tabs"
        onChange={handleTabChange}
        scrollButtons="auto"
        value={activeTab}
        variant="scrollable"
      >
        {tabs.map((tab) => (
          <Tab key={tab.id} label={tab.label} value={tab.id} />
        ))}
      </Tabs>
    );
  }

  function getPasswordChecks(password) {
    const value = String(password || "");
    return [
      { id: "length", label: "At least 10 characters", ok: value.length >= 10 },
      { id: "lower", label: "One lowercase letter", ok: /[a-z]/.test(value) },
      { id: "upper", label: "One uppercase letter", ok: /[A-Z]/.test(value) },
      { id: "number", label: "One number", ok: /\d/.test(value) },
    ];
  }

  function ReadOnlyBadge() {
    return (
      <span className="settings-readonly-badge" aria-label="Read only">
        🔒 Read only
      </span>
    );
  }

  function BioAndInterestsCard({
    bio,
    tags,
    onBioSave,
    onTagsSave,
    onDirtyChange,
    registerActions,
  }) {
    const [bioText, setBioText] = useState(bio);
    const [bioSaving, setBioSaving] = useState(false);
    const [localTags, setLocalTags] = useState(tags);
    const [tagInput, setTagInput] = useState("");
    const [tagsSaving, setTagsSaving] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [tagError, setTagError] = useState("");
    const suggestionsRef = useRef(null);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
      setBioText(bio);
    }, [bio]);
    useEffect(() => {
      setLocalTags(tags);
    }, [tags]);

    useEffect(() => {
      function handleClickOutside(e) {
        if (
          suggestionsRef.current &&
          !suggestionsRef.current.contains(e.target) &&
          inputRef.current &&
          !inputRef.current.contains(e.target)
        ) {
          setShowSuggestions(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleTagInputChange(value) {
      setTagInput(value);
      setTagError("");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.trim().length > 0) {
        debounceRef.current = setTimeout(async () => {
          const res = await fetchJSON(
            `/api/tags/suggestions/?q=${encodeURIComponent(value.trim())}`,
          );
          if (res.ok) {
            const existing = new Set(localTags.map((t) => t.toLowerCase()));
            setSuggestions(
              (res.data.suggestions || []).filter(
                (s) => !existing.has(s.toLowerCase()),
              ),
            );
            setShowSuggestions(true);
          }
        }, 250);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }

    function addTag(name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (localTags.length >= MAX_TAGS) {
        setTagError("Maximum " + MAX_TAGS + " tags allowed.");
        return;
      }
      if (localTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        setTagError("Tag already added.");
        return;
      }
      setLocalTags([...localTags, trimmed]);
      setTagInput("");
      setSuggestions([]);
      setShowSuggestions(false);
      setTagError("");
    }

    function removeTag(idx) {
      setLocalTags(localTags.filter((_, i) => i !== idx));
      setTagError("");
    }

    function handleTagKeyDown(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        addTag(tagInput);
      }
    }

    async function saveBio() {
      setBioSaving(true);
      await onBioSave(bioText);
      setBioSaving(false);
    }

    async function saveTags() {
      setTagsSaving(true);
      await onTagsSave(localTags);
      setTagsSaving(false);
    }

    const bioChanged = bioText !== bio;
    const tagsChanged = JSON.stringify(localTags) !== JSON.stringify(tags);
    const isDirty = bioChanged || tagsChanged;

    useEffect(() => {
      if (onDirtyChange) onDirtyChange(isDirty);
    }, [isDirty]);

    useEffect(() => {
      return () => {
        if (onDirtyChange) onDirtyChange(false);
      };
    }, []);

    useEffect(() => {
      if (!registerActions) return;
      registerActions({
        save: async () => {
          let ok = true;
          if (bioChanged) {
            setBioSaving(true);
            ok = (await onBioSave(bioText)) !== false;
            setBioSaving(false);
          }
          if (ok && tagsChanged) {
            setTagsSaving(true);
            ok = (await onTagsSave(localTags)) !== false;
            setTagsSaving(false);
          }
          return ok;
        },
        discard: () => {
          setBioText(bio);
          setLocalTags(tags);
          setTagInput("");
          setTagError("");
          setSuggestions([]);
          setShowSuggestions(false);
        },
      });
    }, [bio, tags, bioText, localTags, bioChanged, tagsChanged]);

    return (
      <div className="settings-bio-panel">
        <h3 className="settings-bio-panel-title">Bio &amp; interests</h3>
        <p className="settings-helper-text">
          Tell others about yourself and what you&apos;re interested in.
        </p>
        <div className="settings-bio-section">
          <div className="settings-section-label">Bio</div>
          <div className="form-group settings-bio-form-group">
            <textarea
              className="bio-textarea"
              value={bioText}
              onChange={(e) => setBioText(e.target.value.slice(0, BIO_MAX))}
              placeholder="Write a short bio about yourself..."
              rows={4}
              maxLength={BIO_MAX}
            />
            <div className="settings-bio-toolbar">
              <div className="bio-char-count">
                <span
                  className={
                    bioText.length > BIO_MAX - 20 ? "bio-char-warn" : ""
                  }
                >
                  {bioText.length}
                </span>
                /{BIO_MAX}
              </div>
              <button
                type="button"
                className="btn small"
                onClick={saveBio}
                disabled={bioSaving || !bioChanged}
              >
                {bioSaving
                  ? "Saving\u2026"
                  : bioChanged
                    ? "Save bio"
                    : "No changes"}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-bio-divider" role="presentation" />

        <div className="settings-tags-section">
          <div className="settings-section-label">Interests / Tags</div>
          <p className="field-helper settings-tags-helper">
            Add up to {MAX_TAGS} tags. Type and press Enter or select from
            suggestions.
          </p>

          <div className="tag-input-container">
            <div className="tag-input-pills">
              {localTags.map((t, i) => (
                <span key={t + i} className="sp-tag-pill sp-tag-pill--editable">
                  {t}
                  <button
                    type="button"
                    className="sp-tag-remove"
                    onClick={() => removeTag(i)}
                    aria-label={"Remove " + t}
                  >
                    &times;
                  </button>
                </span>
              ))}
              {localTags.length < MAX_TAGS && (
                <input
                  ref={inputRef}
                  type="text"
                  className="tag-input-field"
                  value={tagInput}
                  onChange={(e) => handleTagInputChange(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onFocus={() => {
                    if (tagInput.trim()) setShowSuggestions(true);
                  }}
                  placeholder={
                    localTags.length === 0
                      ? "e.g. Python, Web Dev, UI/UX"
                      : "Add tag\u2026"
                  }
                />
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="tag-suggestions" ref={suggestionsRef}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="tag-suggestion-item"
                    onClick={() => addTag(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          {tagError && <p className="sp-file-error">{tagError}</p>}

          <div className="settings-tags-toolbar">
            <button
              type="button"
              className="btn small"
              onClick={saveTags}
              disabled={tagsSaving || !tagsChanged}
            >
              {tagsSaving
                ? "Saving\u2026"
                : tagsChanged
                  ? "Save interests"
                  : "No changes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function SettingsPage() {
    const ctx = useContext(AppContext);
    if (!ctx || !ctx.user) return null;
    const {
      user,
      setUser,
      setError,
      addToast,
      settingsForm,
      setSettingsForm,
      settingsSaving,
      handleSettingsSave,
      handleBioSave,
      handleTagsSave,
      handleAvatarChange,
      avatarUploading,
      menteeProfile,
      setMenteeProfile,
      menteeProfileSaving,
      handleMenteeProfileSave,
      setUnsavedChangesDirty,
    } = ctx;

    const [activeTab, setActiveTab] = useState(() => {
      const fromHash = sectionFromHash();
      if (fromHash) return fromHash;
      try {
        const stored =
          window.sessionStorage.getItem(OPEN_SECTION_STORAGE_KEY) ?? "account";
        return LEGACY_SECTION_MAP[stored] || stored;
      } catch {
        return "account";
      }
    });
    const [bioDirty, setBioDirty] = useState(false);
    const [savingAll, setSavingAll] = useState(false);
    const [savedAt, setSavedAt] = useState(0);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const bioActionsRef = useRef({ save: null, discard: null });
    const generalSavedRef = useRef(null);
    const generalEditedRef = useRef(false);
    const [passwordEmail, setPasswordEmail] = useState("");
    const [passwordVerificationCode, setPasswordVerificationCode] =
      useState("");
    const [passwordForm, setPasswordForm] = useState({
      new_password1: "",
      new_password2: "",
    });
    const [passwordCodeSent, setPasswordCodeSent] = useState(false);
    const [passwordCodeVerified, setPasswordCodeVerified] = useState(false);
    const [passwordCodeSending, setPasswordCodeSending] = useState(false);
    const [passwordCodeVerifying, setPasswordCodeVerifying] = useState(false);
    const [passwordChanging, setPasswordChanging] = useState(false);
    const [passwordResendSeconds, setPasswordResendSeconds] = useState(0);
    const [passwordStatus, setPasswordStatus] = useState({
      tone: "muted",
      message: "",
    });
    const passwordCodeInputRef = useRef(null);
    const passwordNewPasswordRef = useRef(null);

    useEffect(() => {
      if (!passwordCodeSent && !passwordCodeVerified) {
        setPasswordEmail(settingsForm.email || user.email || "");
      }
    }, [
      settingsForm.email,
      user.email,
      passwordCodeSent,
      passwordCodeVerified,
    ]);

    useEffect(() => {
      try {
        window.sessionStorage.setItem(OPEN_SECTION_STORAGE_KEY, activeTab);
      } catch {
        /* storage unavailable */
      }
      writeSectionHash(activeTab);
    }, [activeTab]);

    useEffect(() => {
      function onHashChange() {
        const section = sectionFromHash();
        if (section) setActiveTab(section);
      }
      window.addEventListener("hashchange", onHashChange);
      return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
      if (passwordResendSeconds <= 0) return undefined;
      const timer = window.setInterval(() => {
        setPasswordResendSeconds((current) => (current > 0 ? current - 1 : 0));
      }, 1000);
      return () => window.clearInterval(timer);
    }, [passwordResendSeconds]);

    function selectTab(tabId) {
      setActiveTab(tabId);
    }

    async function handleRemoveAvatar() {
      if (!settingsForm.avatar_url) return;
      setSettingsForm((prev) => ({ ...prev, avatar_url: "" }));
      setUser((prev) => (prev ? { ...prev, avatar_url: "" } : prev));
      addToast("Profile photo removed from preview. Upload a new photo to save one.");
    }

    async function handleSendPasswordCode() {
      setError("");
      setPasswordStatus({ tone: "muted", message: "" });
      const email = String(passwordEmail || "").trim();
      if (!email) {
        setPasswordStatus({
          tone: "error",
          message: "Enter the email address that should receive the code.",
        });
        return;
      }
      setPasswordCodeSending(true);
      const result = await fetchJSON("/api/me/password-code/send/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify({ email }),
      });
      setPasswordCodeSending(false);
      if (!result.ok) {
        const message =
          result.data?.errors && typeof result.data.errors === "object"
            ? Object.values(result.data.errors)
                .flat()
                .filter(Boolean)
                .join(" ") ||
              result.data?.error ||
              "Unable to send verification code."
            : result.data?.error || "Unable to send verification code.";
        setPasswordCodeVerified(false);
        setPasswordStatus({ tone: "error", message });
        return;
      }
      setPasswordCodeSent(true);
      setPasswordCodeVerified(false);
      setPasswordVerificationCode("");
      setPasswordForm({ new_password1: "", new_password2: "" });
      setPasswordResendSeconds(Number(result.data?.cooldown_seconds || 60));
      setPasswordStatus({
        tone: "success",
        message: result.data?.message || "Verification code sent.",
      });
      addToast(result.data?.message || "Verification code sent.");
      window.setTimeout(() => {
        passwordCodeInputRef.current?.focus();
      }, 0);
    }

    async function handleVerifyPasswordCode() {
      setError("");
      setPasswordStatus({ tone: "muted", message: "" });
      if (String(passwordVerificationCode || "").trim().length !== 6) {
        setPasswordStatus({
          tone: "error",
          message: "Enter the 6-digit verification code.",
        });
        return;
      }
      setPasswordCodeVerifying(true);
      const result = await fetchJSON("/api/me/password-code/verify/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify({ verification_code: passwordVerificationCode }),
      });
      setPasswordCodeVerifying(false);
      if (!result.ok) {
        const message =
          result.data?.errors && typeof result.data.errors === "object"
            ? Object.values(result.data.errors)
                .flat()
                .filter(Boolean)
                .join(" ") ||
              result.data?.error ||
              "Invalid verification code."
            : result.data?.error || "Invalid verification code.";
        setPasswordCodeVerified(false);
        setPasswordStatus({ tone: "error", message });
        return;
      }
      setPasswordCodeVerified(true);
      setPasswordStatus({
        tone: "success",
        message:
          result.data?.message ||
          "Code verified. You can now set a new password.",
      });
      addToast(result.data?.message || "Code verified.");
      window.setTimeout(() => {
        passwordNewPasswordRef.current?.focus();
      }, 0);
    }

    async function handleChangePasswordWithCode() {
      setError("");
      setPasswordStatus({ tone: "muted", message: "" });
      if (!passwordCodeVerified) {
        setPasswordStatus({
          tone: "error",
          message: "Verify the code before updating your password.",
        });
        return;
      }
      setPasswordChanging(true);
      const result = await fetchJSON("/api/me/password-code/change/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify({
          new_password1: passwordForm.new_password1,
          new_password2: passwordForm.new_password2,
        }),
      });
      setPasswordChanging(false);
      if (!result.ok) {
        const errs = result.data?.errors;
        const message =
          errs && typeof errs === "object"
            ? Object.values(errs).flat().filter(Boolean).join(" ") ||
              "Unable to change password."
            : result.data?.error || "Unable to change password.";
        setPasswordStatus({ tone: "error", message });
        return;
      }
      setPasswordForm({
        new_password1: "",
        new_password2: "",
      });
      setPasswordVerificationCode("");
      setPasswordCodeSent(false);
      setPasswordCodeVerified(false);
      setPasswordResendSeconds(0);
      setPasswordStatus({
        tone: "success",
        message: result.data?.message || "Password updated successfully.",
      });
      addToast(result.data?.message || "Password updated successfully.");
    }

    const passwordChecks = getPasswordChecks(passwordForm.new_password1);
    const passwordScore = passwordChecks.filter((check) => check.ok).length;
    const passwordMeetsRules = passwordScore === passwordChecks.length;
    const passwordsMatch =
      !!passwordForm.new_password1 &&
      !!passwordForm.new_password2 &&
      passwordForm.new_password1 === passwordForm.new_password2;
    const canUpdatePassword =
      passwordCodeVerified &&
      passwordMeetsRules &&
      passwordsMatch &&
      !passwordChanging;
    const resendLabel =
      passwordResendSeconds > 0
        ? `Resend code (${passwordResendSeconds}s)`
        : passwordCodeSent
          ? "Resend code"
          : "Send code";

    const accountChanged =
      String(settingsForm.email || "").trim() !==
      String(user.email || "").trim();

    const generalRequiredFields = [
      "campus",
      "student_id_no",
      "contact_no",
      "admission_type",
      "sex",
    ];
    const generalMissingCount = generalRequiredFields.filter(
      (field) => !String((menteeProfile || {})[field] || "").trim(),
    ).length;

    const isMentee = user.role === "mentee";
    const serializedGeneral = JSON.stringify(menteeProfile || {});
    if (!generalEditedRef.current) {
      generalSavedRef.current = serializedGeneral;
    }
    const generalChanged =
      isMentee && generalSavedRef.current !== serializedGeneral;

    function updateMenteeProfile(patch) {
      generalEditedRef.current = true;
      setMenteeProfile({ ...menteeProfile, ...patch });
    }

    const dirtyLabels = [
      accountChanged && "Account",
      bioDirty && "Bio & interests",
      generalChanged && "Academic & personal info",
    ].filter(Boolean);
    const isDirty = dirtyLabels.length > 0;
    const justSaved = savedAt > 0 && !isDirty;

    const settingsTabs = [
      { id: "account", label: "Account Profile" },
      { id: "password", label: "Password & Security" },
    ];
    if (isMentee) {
      settingsTabs.push({
        id: "academic",
        label: "Academic & Personal Info",
      });
    }

    useEffect(() => {
      if (typeof setUnsavedChangesDirty === "function") {
        setUnsavedChangesDirty(isDirty);
      }
    }, [isDirty]);

    // Leaving the page always goes through the leave guard, so pending edits are
    // rolled back the same way the bio/interests draft state is.
    const revertRef = useRef({});
    revertRef.current = {
      accountChanged,
      generalChanged,
      email: user.email || "",
      generalSnapshot: generalSavedRef.current,
    };

    useEffect(() => {
      return () => {
        if (typeof setUnsavedChangesDirty === "function") {
          setUnsavedChangesDirty(false);
        }
        const pending = revertRef.current || {};
        if (pending.accountChanged) {
          setSettingsForm((prev) => ({ ...prev, email: pending.email }));
        }
        if (pending.generalChanged && pending.generalSnapshot) {
          try {
            setMenteeProfile(JSON.parse(pending.generalSnapshot));
          } catch {
            /* keep current values when the snapshot is unreadable */
          }
        }
      };
    }, []);

    useEffect(() => {
      if (!isDirty) return undefined;
      function onBeforeUnload(event) {
        event.preventDefault();
        event.returnValue = "";
      }
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
      if (!savedAt) return undefined;
      const timeoutId = window.setTimeout(() => setSavedAt(0), 2600);
      return () => window.clearTimeout(timeoutId);
    }, [savedAt]);

    async function handleGeneralSave() {
      const ok = (await handleMenteeProfileSave()) !== false;
      if (ok) generalEditedRef.current = false;
      return ok;
    }

    async function handleSaveAll() {
      setSavingAll(true);
      let ok = true;
      if (accountChanged) {
        ok = (await handleSettingsSave()) !== false;
      }
      if (ok && bioDirty && bioActionsRef.current.save) {
        ok = (await bioActionsRef.current.save()) !== false;
      }
      if (ok && generalChanged) {
        ok = await handleGeneralSave();
      }
      setSavingAll(false);
      if (ok) setSavedAt(Date.now());
    }

    function handleDiscardAll() {
      setSettingsForm({ ...settingsForm, email: user.email || "" });
      if (bioActionsRef.current.discard) bioActionsRef.current.discard();
      if (generalChanged) {
        generalEditedRef.current = false;
        try {
          setMenteeProfile(JSON.parse(generalSavedRef.current));
        } catch {
          /* keep current values when the snapshot is unreadable */
        }
      }
    }

    return (
      <div
        className={
          "home-dashboard-space settings-page-shell page-shell" +
          (user.role === "mentee"
            ? " settings-page-shell--mentee"
            : user.role === "mentor"
              ? " settings-page-shell--mentor"
              : "")
        }
      >
        <header className="settings-page-head">
          <h1 className="page-title settings-page-title">Settings</h1>
          <p className="page-subtitle settings-page-head-subtitle">
            Manage your account, security, and profile information.
          </p>
        </header>

        <SettingsTabNav
          tabs={settingsTabs}
          activeTab={activeTab}
          onChange={selectTab}
        />

        {activeTab === "account" && (
          <div className="settings-tab-panel">
            <h2 className="settings-tab-panel-title">Account Profile</h2>
            <p className="settings-tab-panel-subtitle">
              Update the email and photo used across the dashboard.
            </p>
            <div className="form-grid responsive-form-row">
              <div className="form-group">
                <label htmlFor="settings-display-name" className="settings-label">
                  Display name
                  <ReadOnlyBadge />
                </label>
                <input
                  id="settings-display-name"
                  type="text"
                  className="readonly-field-input"
                  value={
                    settingsForm.display_name || user.display_name || "—"
                  }
                  readOnly
                  disabled
                />
                <p className="field-helper settings-helper-text settings-helper-text--bright">
                  Taken from your enrolment record. Contact an administrator if
                  it needs to change.
                </p>
              </div>
              <div className="form-group">
                <label htmlFor="settings-email" className="settings-label">
                  Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={settingsForm.email}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, email: e.target.value })
                  }
                  placeholder="your@email.com"
                />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="settings-label">Profile picture</label>
                <div className="settings-avatar-block">
                  <button
                    type="button"
                    className="settings-avatar-uploader"
                    onClick={() => {
                      const input = document.getElementById(
                        "settings-avatar-input",
                      );
                      if (input) input.click();
                    }}
                  >
                    <div className="settings-avatar-preview">
                      {settingsForm.avatar_url ? (
                        <img
                          src={settingsForm.avatar_url}
                          alt="Profile preview"
                          className="settings-avatar-img"
                        />
                      ) : (
                        <div className="settings-avatar-fallback">
                          {(
                            settingsForm.display_name ||
                            user.display_name ||
                            user.full_name ||
                            settingsForm.email ||
                            user.email ||
                            "?"
                          )
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="settings-avatar-overlay">
                      <span
                        className="settings-avatar-overlay-icon"
                        aria-hidden="true"
                      >
                        <DashboardIcon name="camera" size={18} />
                      </span>
                      <span className="settings-avatar-overlay-text">
                        {avatarUploading ? "Uploading…" : "Change photo"}
                      </span>
                    </div>
                  </button>
                  <div className="settings-avatar-meta">
                    <input
                      id="settings-avatar-input"
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleAvatarChange}
                      disabled={avatarUploading}
                      style={{ display: "none" }}
                    />
                    <div className="settings-avatar-actions">
                      <button
                        type="button"
                        className="settings-btn-upload"
                        onClick={() => {
                          const input = document.getElementById(
                            "settings-avatar-input",
                          );
                          if (input) input.click();
                        }}
                        disabled={avatarUploading}
                      >
                        {avatarUploading ? "Uploading…" : "Upload photo"}
                      </button>
                      <button
                        type="button"
                        className="settings-btn-text"
                        onClick={handleRemoveAvatar}
                        disabled={avatarUploading || !settingsForm.avatar_url}
                      >
                        Remove
                      </button>
                    </div>
                    <p className="field-helper settings-helper-text">
                      Clear front-facing photo (PNG or JPG, max 5MB).
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {accountChanged && (
              <div className="settings-tab-footer">
                <button
                  className="btn"
                  onClick={handleSettingsSave}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? "Saving..." : "Save email changes"}
                </button>
              </div>
            )}

            <BioAndInterestsCard
              bio={settingsForm.bio || ""}
              tags={Array.isArray(settingsForm.tags) ? settingsForm.tags : []}
              onBioSave={handleBioSave}
              onTagsSave={handleTagsSave}
              onDirtyChange={setBioDirty}
              registerActions={(actions) => {
                bioActionsRef.current = actions;
              }}
            />
          </div>
        )}

        {activeTab === "password" && (
          <div className="settings-tab-panel">
            <h2 className="settings-tab-panel-title">Password &amp; Security</h2>
            <p className="settings-tab-panel-subtitle">
              Verify your email, then set a new password.
            </p>
            <div className="settings-password-flow-v2">
              <section className="settings-password-step-v2">
                <div className="settings-password-step-header">
                  <span className="settings-password-step-badge">1</span>
                  <div>
                    <h3 className="settings-password-step-title">
                      Request verification code
                    </h3>
                    <p className="field-helper settings-helper-text">
                      We&apos;ll send a 6-digit code to your account email.
                    </p>
                  </div>
                </div>
                <div className="form-group settings-password-email-group">
                  <label className="settings-label">Email address</label>
                  <input
                    type="email"
                    className="readonly-field-input"
                    value={passwordEmail}
                    readOnly
                    aria-readonly="true"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                <div className="settings-password-actions">
                  <button
                    type="button"
                    className="settings-btn-upload"
                    onClick={handleSendPasswordCode}
                    disabled={
                      passwordCodeSending ||
                      passwordCodeVerifying ||
                      passwordChanging ||
                      !passwordEmail.trim() ||
                      passwordResendSeconds > 0
                    }
                  >
                    {passwordCodeSending ? "Sending..." : resendLabel}
                  </button>
                </div>
              </section>

              <section
                className={
                  "settings-password-step-v2" +
                  (passwordCodeSent ? "" : " is-muted")
                }
              >
                <div className="settings-password-step-header">
                  <span className="settings-password-step-badge">2</span>
                  <div>
                    <h3 className="settings-password-step-title">
                      Verify &amp; update
                    </h3>
                    <p className="field-helper settings-helper-text">
                      Enter the code and choose a new password.
                    </p>
                  </div>
                </div>
                <div className="form-group settings-password-code-group">
                  <label className="settings-label">Verification code</label>
                  <input
                    ref={passwordCodeInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={passwordVerificationCode}
                    onChange={(e) => {
                      const nextValue = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      setPasswordVerificationCode(nextValue);
                      setPasswordCodeVerified(false);
                    }}
                    disabled={!passwordCodeSent}
                  />
                  <p className="field-helper settings-helper-text">
                    {passwordCodeSent
                      ? "The code expires after 10 minutes."
                      : "Send a code first to unlock this step."}
                  </p>
                </div>
                <div className="settings-password-actions">
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handleVerifyPasswordCode}
                    disabled={
                      !passwordCodeSent ||
                      passwordCodeVerifying ||
                      passwordVerificationCode.length !== 6 ||
                      passwordCodeVerified
                    }
                  >
                    {passwordCodeVerifying
                      ? "Verifying..."
                      : passwordCodeVerified
                        ? "Code verified"
                        : "Verify code"}
                  </button>
                </div>

                <div
                  className={
                    "form-grid settings-password-grid responsive-form-row" +
                    (passwordCodeVerified ? "" : " is-muted")
                  }
                  style={{ marginTop: 20 }}
                >
                  <div className="form-group">
                    <label htmlFor="settings-new-password" className="settings-label">
                      New password
                    </label>
                    <div className="settings-password-input">
                      <input
                        id="settings-new-password"
                        ref={passwordNewPasswordRef}
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.new_password1}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            new_password1: e.target.value,
                          }))
                        }
                        placeholder="Enter new password"
                        disabled={!passwordCodeVerified}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="settings-password-toggle"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        disabled={!passwordCodeVerified}
                        aria-pressed={showNewPassword}
                      >
                        {showNewPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="settings-confirm-password" className="settings-label">
                      Confirm new password
                    </label>
                    <div className="settings-password-input">
                      <input
                        id="settings-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordForm.new_password2}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            new_password2: e.target.value,
                          }))
                        }
                        placeholder="Confirm new password"
                        disabled={!passwordCodeVerified}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="settings-password-toggle"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        disabled={!passwordCodeVerified}
                        aria-pressed={showConfirmPassword}
                      >
                        {showConfirmPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>
                {passwordForm.new_password1 ? (
                  <div className="settings-password-meter">
                    <div
                      className="settings-password-meter-track"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={passwordChecks.length}
                      aria-valuenow={passwordScore}
                      aria-label="Password strength"
                    >
                      <span
                        className={
                          "settings-password-meter-fill is-score-" +
                          passwordScore
                        }
                        style={{
                          width: `${(passwordScore / passwordChecks.length) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="settings-password-meter-label">
                      {PASSWORD_STRENGTH_LABELS[passwordScore]}
                    </span>
                  </div>
                ) : null}
                <div className="settings-password-validation">
                  {passwordCodeVerified && (
                    <ul
                      className="settings-password-rules"
                      aria-label="Password requirements"
                    >
                      {passwordChecks.map((check) => (
                        <li
                          key={check.id}
                          className={
                            "settings-password-check" +
                            (check.ok ? " is-ok" : "")
                          }
                        >
                          <span
                            className="settings-password-check-icon"
                            aria-hidden="true"
                          >
                            {check.ok ? "\u2713" : "\u2022"}
                          </span>
                          {check.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {passwordCodeVerified &&
                  !passwordsMatch &&
                  passwordForm.new_password2 ? (
                    <p className="field-helper settings-password-validation-text is-error">
                      Passwords do not match.
                    </p>
                  ) : null}
                  {passwordCodeVerified && passwordMeetsRules && passwordsMatch ? (
                    <p className="field-helper settings-password-validation-text is-success">
                      Password looks good.
                    </p>
                  ) : null}
                </div>
                <div className="settings-password-actions settings-password-actions--primary">
                  <button
                    type="button"
                    className="settings-btn-upload"
                    onClick={handleChangePasswordWithCode}
                    disabled={!canUpdatePassword}
                  >
                    {passwordChanging ? "Saving..." : "Save new password"}
                  </button>
                </div>
              </section>

              {passwordStatus.message && (
                <p
                  className={
                    "field-helper settings-password-feedback is-" +
                    passwordStatus.tone
                  }
                  role="status"
                  aria-live="polite"
                >
                  {passwordStatus.message}
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "academic" && isMentee && (
          <div className="settings-tab-panel">
            <h2 className="settings-tab-panel-title">
              Academic &amp; Personal Info
            </h2>
            <p className="settings-tab-panel-subtitle">
              Review institution-managed records and update your contact details.
            </p>
            <div className="settings-academic-grid">
              <div className="settings-info-card">
                <span className="settings-institution-badge">
                  🔒 Managed by Institution
                </span>
                <h3 className="settings-info-card-title">Academic record</h3>
                <div className="form-grid responsive-form-row">
                  <div className="form-group">
                    <label className="settings-label">Campus</label>
                    <input
                      className="readonly-field-input"
                      value={menteeProfile.campus || "—"}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="settings-label">Student ID No.</label>
                    <input
                      className="readonly-field-input"
                      value={menteeProfile.student_id_no || "—"}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="settings-label">Course / Program</label>
                    <input
                      className="readonly-field-input"
                      value={menteeProfile.program || "—"}
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="settings-label">Year level</label>
                    <input
                      className="readonly-field-input"
                      value={formatYearLevel(menteeProfile.year_level)}
                      readOnly
                      disabled
                    />
                  </div>
                </div>
                <p className="field-helper settings-helper-text settings-helper-text--bright">
                  These fields come from your enrolment record. Contact an
                  administrator if anything looks incorrect.
                </p>
              </div>

              <div className="settings-info-card">
                <h3 className="settings-info-card-title">
                  Personal &amp; contact information
                </h3>
                <div className="form-grid responsive-form-row">
                  <div className="form-group">
                    <label className="settings-label">Contact No. *</label>
                    <input
                      value={menteeProfile.contact_no}
                      onChange={(e) =>
                        updateMenteeProfile({
                          contact_no: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 11),
                        })
                      }
                      placeholder="11 digits only"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                    />
                  </div>
                  <div className="form-group">
                    <label className="settings-label">Admission type *</label>
                    <select
                      value={menteeProfile.admission_type || ""}
                      onChange={(e) =>
                        updateMenteeProfile({ admission_type: e.target.value })
                      }
                    >
                      <option value="">Select admission type</option>
                      <option value="regular">Regular</option>
                      <option value="transferee">Transferee</option>
                      <option value="shiftee">Shiftee</option>
                      <option value="returnee">Returnee</option>
                      <option value="irregular">Irregular</option>
                      {menteeProfile.admission_type &&
                        ![
                          "regular",
                          "transferee",
                          "shiftee",
                          "returnee",
                          "irregular",
                        ].includes(
                          String(menteeProfile.admission_type).toLowerCase(),
                        ) && (
                          <option value={menteeProfile.admission_type}>
                            {menteeProfile.admission_type}
                          </option>
                        )}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="settings-label">Biological sex *</label>
                    <select
                      value={menteeProfile.sex || ""}
                      onChange={(e) =>
                        updateMenteeProfile({ sex: e.target.value })
                      }
                    >
                      <option value="">Select biological sex</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {generalChanged && (
              <div className="settings-tab-footer">
                <button
                  className="btn"
                  onClick={handleGeneralSave}
                  disabled={menteeProfileSaving}
                >
                  {menteeProfileSaving ? "Saving..." : "Save changes"}
                </button>
                {generalMissingCount > 0 && (
                  <p className="field-helper settings-helper-text" role="status">
                    {generalMissingCount} required field
                    {generalMissingCount === 1 ? "" : "s"} still missing.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {(isDirty || justSaved) && (
          <div
            className={
              "mp-sticky-bar settings-sticky-bar" +
              (isDirty ? " is-dirty" : " is-saved")
            }
            role="status"
            aria-live="polite"
          >
            <div className="mp-sticky-meta">
              <p className="mp-sticky-title">
                {isDirty ? "Unsaved changes" : "Saved"}
              </p>
              <p className="mp-sticky-subtitle">
                {isDirty ? dirtyLabels.join(", ") : "Your settings were updated."}
              </p>
            </div>
            {isDirty && (
              <div className="mp-sticky-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={handleDiscardAll}
                  disabled={savingAll}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleSaveAll}
                  disabled={savingAll}
                >
                  {savingAll ? "Saving..." : "Save changes"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages.settings = SettingsPage;
})();
