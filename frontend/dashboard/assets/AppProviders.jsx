(function () {
  "use strict";
  const React = window.React;
  const { useEffect, useMemo, useState, useRef } = React;
  const MAIN_TABS =
    (window.DashboardApp && window.DashboardApp.MAIN_TABS) || [];
  const { getCookie, fetchJSON, ensureCsrfToken } =
    (window.DashboardApp && window.DashboardApp.Utils) || {};
  const AppContext =
    (window.DashboardApp && window.DashboardApp.AppContext) ||
    React.createContext(null);
  const Layout = window.DashboardApp.Layout;
  function getIsPendingApproval(userData) {
    return !!(
      userData &&
      ((userData.role === "mentor" && userData.mentor_approved === false) ||
        (userData.role === "mentee" && userData.mentee_approved === false))
    );
  }
  function getPendingApprovalLandingTab(userData) {
    if (!userData) return "settings";
    if (userData.must_change_password) return "settings";
    if (needsCompleteProfile(userData)) return "onboarding";
    if (userData.role === "mentee" || userData.role === "mentor") {
      return "onboarding";
    }
    return "settings";
  }

  function needsCompleteProfile(userData) {
    return !!userData && userData.is_onboarded === false;
  }

  function isPendingApprovalMessage(message) {
    return /pending approval by coordinator/i.test(String(message || ""));
  }

  function cloneJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  const EMPTY_MENTOR_PROFILE = {
    subjects: [],
    topics: [],
    competency_ids: [],
    competency_levels: {},
    expertise_level: null,
    years_experience: null,
    teaching_experience_years: null,
    role: "",
    capacity: 5,
    gender: "",
    year_level: 0,
    availability: [],
  };

  const EMPTY_MENTEE_MATCHING = {
    subjects: [],
    topics: [],
    competency_ids: [],
    competency_needs: {},
    difficulty_level: null,
    preferred_learning_style: "",
    availability: [],
  };

  function getPortalAuthRole() {
    const fromUrl = new URLSearchParams(window.location.search || "").get(
      "role",
    );
    const fromStore =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem("portalRole")
        : null;
    const role = fromUrl || fromStore;
    return role === "mentor" || role === "mentee" || role === "staff"
      ? role
      : null;
  }

  /** Hashes may carry a sub-path (e.g. "settings/password"); the tab is the first segment. */
  function resolveTabFromHash(rawHash) {
    const value = String(rawHash || "").replace(/^#/, "");
    if (!value) return null;
    const base = value.split("/")[0];
    if (MAIN_TABS.some((tab) => tab.id === base)) return base;
    const hiddenTabs =
      (window.DashboardApp && window.DashboardApp.HIDDEN_TABS) || [];
    return hiddenTabs.some((tab) => tab.id === base) ? base : null;
  }

  function replaceAppUrl(tab) {
    const safeTab = tab || "signin";
    const params = new URLSearchParams();
    // Keep role in the URL only for signup (account creation).
    if (safeTab === "signup") {
      const portalRole = getPortalAuthRole();
      if (portalRole) params.set("role", portalRole);
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `/app/${qs}#${safeTab}`);
  }

  function AppProviders() {
    const [activeTab, setActiveTab] = useState(() => {
      const path = (window.location.pathname || "").replace(/\/+$/, "");
      if (path.endsWith("/app/signin")) return "signin";
      if (path.endsWith("/app/signup")) return "signup";
      if (
        path.endsWith("/app/complete-profile") ||
        path.endsWith("/app/onboarding/complete-profile")
      ) {
        return "complete-profile";
      }
      return "home";
    });
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(() => {
      try {
        return window.sessionStorage.getItem("peerlink_access_token") || "";
      } catch (_) {
        return "";
      }
    });
    const [stats, setStats] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [authRequired, setAuthRequired] = useState(false);
    const [authCheckDone, setAuthCheckDone] = useState(false);
    const [error, setError] = useState("");
    const [authMessage, setAuthMessage] = useState("");
    const [authAlert, setAuthAlert] = useState(null);
    const [matchingLoading, setMatchingLoading] = useState(false);
    const [matchingResults, setMatchingResults] = useState([]);
    const [matchingMode, setMatchingMode] = useState("one_to_one");
    const [matchingMinScore, setMatchingMinScore] = useState(0.3);
    const [lastRunMode, setLastRunMode] = useState(null);
    const [lastRunMinScore, setLastRunMinScore] = useState(null);
    const [menteeRecLoading, setMenteeRecLoading] = useState(false);
    const [menteeRecommendations, setMenteeRecommendations] = useState([]);
    const [menteeRecMeta, setMenteeRecMeta] = useState({
      empty_reason: null,
      message: "",
      suggested_time_slots: [],
    });
    const [notificationsLoading, setNotificationsLoading] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
      email: "",
      display_name: "",
      avatar_url: "",
      bio: "",
      tags: [],
    });
    const [menteeProfile, setMenteeProfile] = useState({
      program: "",
      year_level: 0,
      campus: "",
      student_id_no: "",
      contact_no: "",
      admission_type: "",
      sex: "",
    });
    const [menteeProfileSaving, setMenteeProfileSaving] = useState(false);
    const [completeProfileSaving, setCompleteProfileSaving] = useState(false);
    const [onboardingSaving, setOnboardingSaving] = useState(false);
    const [signInLoading, setSignInLoading] = useState(false);
    const [signUpLoading, setSignUpLoading] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [signInForm, setSignInForm] = useState({
      identifier: "",
      password: "",
    });
    const emptySignUpForm = {
      display_name: "",
      password: "",
      confirm_password: "",
      role: "mentor",
      mentor_role: "",
      gender: "",
      year_level: "",
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      password1: "",
      password2: "",
      letter_of_intent: [],
      study_load: [],
      grade: [],
      student_verification_documents: [],
    };
    const [signUpForm, setSignUpForm] = useState(emptySignUpForm);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [approvalsLoading, setApprovalsLoading] = useState(false);
    const [approvalActionKey, setApprovalActionKey] = useState(null);
    const [pendingMentors, setPendingMentors] = useState([]);
    const [pendingMentees, setPendingMentees] = useState([]);
    const [showMenteeInfoModal, setShowMenteeInfoModal] = useState(false);
    const [showMentorInfoModal, setShowMentorInfoModal] = useState(false);
    const [mentorProfile, setMentorProfile] = useState(() =>
      cloneJson(EMPTY_MENTOR_PROFILE),
    );
    const [mentorProfileSaving, setMentorProfileSaving] = useState(false);
    const [menteeMatching, setMenteeMatching] = useState(() =>
      cloneJson(EMPTY_MENTEE_MATCHING),
    );
    const [menteeMatchingSaving, setMenteeMatchingSaving] = useState(false);
    const [chosenMentorId, setChosenMentorId] = useState(null);
    const [mentorRequestsLoading, setMentorRequestsLoading] = useState(false);
    const [mentorRequests, setMentorRequests] = useState([]);
    const [myMentor, setMyMentor] = useState(null);
    const [acceptMenteeLoading, setAcceptMenteeLoading] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [announcementsLoading, setAnnouncementsLoading] = useState(false);
    const [announcementsLoaded, setAnnouncementsLoaded] = useState(false);
    const [announcementMessage, setAnnouncementMessage] = useState("");
    const [announcementMenteeOptions, setAnnouncementMenteeOptions] = useState(
      [],
    );
    const [announcementTargetType, setAnnouncementTargetType] = useState("all");
    const [announcementRecipientIds, setAnnouncementRecipientIds] = useState(
      [],
    );
    const [postAnnouncementLoading, setPostAnnouncementLoading] =
      useState(false);
    const [commentsByKey, setCommentsByKey] = useState({});
    const [toasts, setToasts] = useState([]);
    const toastIdRef = useRef(0);
    const [backups, setBackups] = useState([]);
    const [backupDir, setBackupDir] = useState("");
    const [backupsLoading, setBackupsLoading] = useState(false);
    const [backupCreateLoading, setBackupCreateLoading] = useState(false);
    const [backupRestoreLoading, setBackupRestoreLoading] = useState(false);
    const [activityLogs, setActivityLogs] = useState([]);
    const [activityLogsLoading, setActivityLogsLoading] = useState(false);
    const [activityLogsPage, setActivityLogsPage] = useState(1);
    const [activityLogsPageSize, setActivityLogsPageSize] = useState(20);
    const [activityLogsTotal, setActivityLogsTotal] = useState(0);
    const [activityLogsTotalPages, setActivityLogsTotalPages] = useState(1);
    const activityLogsCacheRef = useRef(new Map());
    const [globalSearchResults, setGlobalSearchResults] = useState([]);
    const [postsFeed, setPostsFeed] = useState([]);
    const [postsFeedLoaded, setPostsFeedLoaded] = useState(false);
    const [postsFeedLoading, setPostsFeedLoading] = useState(false);
    const [postsFeedHasMore, setPostsFeedHasMore] = useState(false);
    const [postsFeedLoadingMore, setPostsFeedLoadingMore] = useState(false);
    const [viewedMentorProfile, setViewedMentorProfile] = useState(null);
    const [mentorProfileHashId, setMentorProfileHashId] = useState(null);
    const [viewedUserProfile, setViewedUserProfile] = useState(null);
    const [menteeRecUpdating, setMenteeRecUpdating] = useState(false);
    const prevActiveTabRef = useRef(activeTab);
    const lastMatchingRunRef = useRef(0);
    const lockoutCountdownRef = useRef(null);
    const signInPathRef = useRef(false);
    const meInFlightRef = useRef(null);
    const meLastFetchTsRef = useRef(0);
    const ME_MIN_FETCH_INTERVAL_MS = 30000;
    const unsavedChangesDirtyRef = useRef(false);
    const lastSavedMentorProfileRef = useRef(cloneJson(EMPTY_MENTOR_PROFILE));
    const lastSavedMenteeMatchingRef = useRef(cloneJson(EMPTY_MENTEE_MATCHING));
    const [leaveGuard, setLeaveGuard] = useState(null);
    const [theme, setThemeState] = useState("light");

    function toggleTheme() {
      // System is locked to light mode (Neumorphic Soft UI)
      setThemeState("light");
    }

    function isSignInPathFlow() {
      const path = (window.location.pathname || "").replace(/\/+$/, "");
      return path.endsWith("/app/signin");
    }

    function addToast(message, type = "success") {
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        3200,
      );
    }

    function setUnsavedChangesDirty(dirty) {
      unsavedChangesDirtyRef.current = !!dirty;
    }

    function requestLeave(action) {
      if (!action) return;
      if (!unsavedChangesDirtyRef.current) {
        if (typeof action.run === "function") action.run();
        return;
      }
      setLeaveGuard(action);
    }

    function requestTabChange(tabId) {
      if (!tabId || tabId === activeTab) return;
      requestLeave({
        type: "tab",
        run: () => setActiveTab(tabId),
      });
    }

    function confirmDiscardLeave() {
      const action = leaveGuard;
      unsavedChangesDirtyRef.current = false;
      setLeaveGuard(null);
      setMentorProfile(
        cloneJson(lastSavedMentorProfileRef.current || EMPTY_MENTOR_PROFILE),
      );
      setMenteeMatching(
        cloneJson(lastSavedMenteeMatchingRef.current || EMPTY_MENTEE_MATCHING),
      );
      if (action && typeof action.run === "function") action.run();
    }

    function cancelLeave() {
      setLeaveGuard(null);
    }

    useEffect(() => {
      if (!leaveGuard) return undefined;
      function onKeyDown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          setLeaveGuard(null);
        }
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [leaveGuard]);

    useEffect(() => {
      window.DashboardApp = window.DashboardApp || {};
      const notifyBridge = (message, type = "success") => {
        if (!message) return;
        addToast(String(message), type);
      };
      window.DashboardApp.notify = notifyBridge;
      return () => {
        if (
          window.DashboardApp &&
          window.DashboardApp.notify === notifyBridge
        ) {
          delete window.DashboardApp.notify;
        }
      };
    }, []);

    function clearLockoutCountdown() {
      if (lockoutCountdownRef.current) {
        clearInterval(lockoutCountdownRef.current);
        lockoutCountdownRef.current = null;
      }
    }

    useEffect(() => {
      // Entire system is strictly light mode (Neumorphic Soft UI)
      document.documentElement.setAttribute("data-theme", "light");
      window.localStorage.setItem("theme", "light");
    }, [theme]);

    useEffect(() => {
      if (typeof ensureCsrfToken === "function") {
        ensureCsrfToken();
      } else {
        fetchJSON("/api/csrf/");
      }
      loadMe({ force: false });
    }, []);

    useEffect(() => {
      const onPageShow = (event) => {
        const stale =
          Date.now() - meLastFetchTsRef.current > ME_MIN_FETCH_INTERVAL_MS;
        if (event.persisted && stale) {
          loadMe({ force: false });
        }
      };
      window.addEventListener("pageshow", onPageShow);
      return () => window.removeEventListener("pageshow", onPageShow);
    }, []);

    useEffect(() => {
      return () => {
        clearLockoutCountdown();
      };
    }, []);

    useEffect(() => {
      if (!authAlert) clearLockoutCountdown();
    }, [authAlert]);

    useEffect(() => {
      signInPathRef.current = isSignInPathFlow();
      const raw = window.location.hash.replace("#", "");
      if (raw.startsWith("profile/mentor")) {
        setActiveTab("profile");
        const m = raw.match(/profile\/mentor\/(\d+)/);
        setMentorProfileHashId(m ? parseInt(m[1], 10) : null);
      } else if (resolveTabFromHash(raw)) {
        setActiveTab(resolveTabFromHash(raw));
      } else if (isSignInPathFlow()) {
        setActiveTab("signin");
      }
    }, []);

    useEffect(() => {
      if (!authCheckDone) return;
      const hash = window.location.hash.replace("#", "");
      const validTabs = [
        ...MAIN_TABS.map((t) => t.id),
        ...((window.DashboardApp && window.DashboardApp.HIDDEN_TABS) || []).map(
          (t) => t.id,
        ),
        "signin",
        "signup",
      ];
      if (
        user &&
        (hash === "signin" || hash === "signup") &&
        !signInPathRef.current &&
        !getIsPendingApproval(user)
      ) {
        setActiveTab("home");
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}#home`,
        );
      } else if (hash.startsWith("profile/mentor")) {
        setActiveTab("profile");
        const m = hash.match(/profile\/mentor\/(\d+)/);
        setMentorProfileHashId(m ? parseInt(m[1], 10) : null);
      } else if (validTabs.includes(hash)) {
        setActiveTab(hash);
      } else if (resolveTabFromHash(hash)) {
        setActiveTab(resolveTabFromHash(hash));
      }
    }, [authCheckDone, user]);

    useEffect(() => {
      if (!authCheckDone) return;
      const params = new URLSearchParams(window.location.search || "");
      const role = params.get("role");
      if (role === "mentor" || role === "mentee" || role === "staff") {
        try {
          sessionStorage.setItem("portalRole", role);
        } catch {
          /* ignore */
        }
      }
      if (role === "staff" && activeTab === "signup") {
        setActiveTab("signin");
        replaceAppUrl("signin");
      } else if (role === "mentor" || role === "mentee") {
        if (activeTab === "signup") {
          setSignUpForm((prev) => ({ ...prev, role }));
        }
      }
    }, [authCheckDone, activeTab]);

    useEffect(() => {
      if (!authCheckDone || !authRequired) return;
      // Role portal is only required when creating an account.
      if (activeTab !== "signup") return;
      const oauthError = String(
        new URLSearchParams(window.location.search || "").get("oauth_error") ||
          "",
      ).toLowerCase();
      if (oauthError === "account_exists") return;
      if (!getPortalAuthRole()) {
        window.location.replace("/portal/");
      }
    }, [authCheckDone, authRequired, activeTab]);

    useEffect(() => {
      if (!authCheckDone) return;
      if (!authRequired) return;
      if (activeTab === "signin" || activeTab === "signup") return;
      setActiveTab("signin");
      replaceAppUrl("signin");
    }, [authCheckDone, authRequired, activeTab]);

    useEffect(() => {
      if (!authCheckDone) return;
      const path = (window.location.pathname || "").replace(/\/+$/, "");
      const search = window.location.search || "";
      const normalizedSearch = search.replace(/^\?/, "");
      const hasOauthParams =
        /(?:^|&)oauth=/.test(normalizedSearch) ||
        /(?:^|&)role_required=/.test(normalizedSearch) ||
        /(?:^|&)oauth_error=/.test(normalizedSearch) ||
        /(?:^|&)activated=/.test(normalizedSearch) ||
        /(?:^|&)activation_error=/.test(normalizedSearch);
      const authPathVariant =
        path.endsWith("/app/signin") || path.endsWith("/app/signup");
      if (!hasOauthParams && !authPathVariant) return;

      const oauthError = new URLSearchParams(normalizedSearch).get(
        "oauth_error",
      );
      if (oauthError) {
        const code = String(oauthError).toLowerCase();
        if (code === "account_exists" && activeTab !== "signup") {
          setActiveTab("signup");
        } else if (code === "no_account" && activeTab !== "signin") {
          setActiveTab("signin");
        }
        return;
      }

      if (authRequired || !user) {
        // Keep OAuth query params only while on Sign In so the page can show the right UI state.
        if (hasOauthParams) {
          if (activeTab === "signup") {
            replaceAppUrl("signup");
            return;
          }
          window.history.replaceState(null, "", `/app/signin${search}`);
          if (activeTab !== "signin") setActiveTab("signin");
          return;
        }
        replaceAppUrl(activeTab === "signup" ? "signup" : "signin");
        return;
      }

      if (needsCompleteProfile(user)) {
        replaceAppUrl("onboarding");
        return;
      }

      if (getIsPendingApproval(user)) {
        replaceAppUrl(getPendingApprovalLandingTab(user));
        return;
      }

      const validTabIds = new Set([
        ...MAIN_TABS.map((t) => t.id),
        ...((window.DashboardApp && window.DashboardApp.HIDDEN_TABS) || []).map(
          (t) => t.id,
        ),
        "complete-profile",
        "settings",
      ]);
      replaceAppUrl(validTabIds.has(activeTab) ? activeTab : "home");
    }, [authCheckDone, authRequired, user, activeTab]);

    useEffect(() => {
      if (!authCheckDone) return;
      const params = new URLSearchParams(window.location.search || "");
      const oauthError = (params.get("oauth_error") || "").toLowerCase();
      if (!oauthError) return;

      if (oauthError === "institutional_email") {
        setAuthAlert({
          severity: "error",
          title: "Google sign-in blocked",
          message:
            "Use your institutional email account to continue with Google sign-in.",
        });
      } else if (oauthError === "missing_email") {
        setAuthAlert({
          severity: "error",
          title: "Google sign-in failed",
          message:
            "We could not read your Google account email. Try another Google account.",
        });
      } else if (oauthError === "no_account") {
        setActiveTab("signin");
        setAuthAlert({
          severity: "warning",
          code: "no_account",
          title: "No Account Found",
          message:
            "No account is registered with this Google email. Would you like to create a new account instead?",
        });
      } else if (oauthError === "account_exists") {
        setActiveTab("signup");
        setAuthAlert({
          severity: "warning",
          code: "account_exists",
          title: "Account Already Exists",
          message:
            "An account is already registered with this Google email. Would you like to log in instead?",
        });
      } else {
        return;
      }

      if (oauthError === "account_exists") {
        replaceAppUrl("signup");
      } else {
        replaceAppUrl("signin");
      }
    }, [authCheckDone]);

    useEffect(() => {
      if (!authCheckDone) return;
      const params = new URLSearchParams(window.location.search || "");
      const activated = (params.get("activated") || "").toLowerCase();
      const activationError = (
        params.get("activation_error") || ""
      ).toLowerCase();

      const isTruthy = (v) => ["1", "true", "yes", "on"].includes(v);
      if (isTruthy(activated)) {
        setAuthAlert({
          severity: "success",
          title: "Account activated",
          message: "Your account has been activated. You can log in now.",
        });
      } else if (isTruthy(activationError)) {
        setAuthAlert({
          severity: "error",
          title: "Activation failed",
          message: "Activation link is invalid or expired.",
        });
      }
    }, [authCheckDone]);

    useEffect(() => {
      const onHashChange = () => {
        const hash = window.location.hash.replace("#", "");
        if (hash.startsWith("profile/mentor")) {
          setActiveTab("profile");
          const m = hash.match(/profile\/mentor\/(\d+)/);
          setMentorProfileHashId(m ? parseInt(m[1], 10) : null);
        }
      };
      window.addEventListener("hashchange", onHashChange);
      return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
      if (!authCheckDone) return;
      if (activeTab === "profile" && mentorProfileHashId) {
        window.location.hash = `profile/mentor/${mentorProfileHashId}`;
      } else if (activeTab === "signin" || activeTab === "signup") {
        replaceAppUrl(activeTab);
      } else {
        const currentHash = window.location.hash.replace("#", "");
        // Keep in-page deep links such as "settings/password" intact.
        if (
          currentHash !== activeTab &&
          !currentHash.startsWith(`${activeTab}/`)
        ) {
          window.location.hash = activeTab;
        }
      }
    }, [activeTab, authCheckDone, mentorProfileHashId]);

    useEffect(() => {
      if (!authCheckDone || !user) return;
      if (user.is_onboarded === true && activeTab === "onboarding") {
        setActiveTab("home");
        return;
      }
      if (needsCompleteProfile(user)) {
        if (activeTab !== "onboarding") {
          setActiveTab("onboarding");
        }
        return;
      }
      if (!getIsPendingApproval(user)) return;
      const allowedPendingTabs = new Set([
        "onboarding",
        "complete-profile",
        "mentoring-preferences",
        "mentor-matching-profile",
        "settings",
      ]);
      if (!allowedPendingTabs.has(activeTab)) {
        setActiveTab(getPendingApprovalLandingTab(user));
      }
    }, [authCheckDone, user, activeTab]);

    useEffect(() => {
      if (!authCheckDone || !user) return;
      if (window.DashboardApp.FEATURE_NEWSFEED) return;
      if (activeTab === "newsfeed") {
        setActiveTab("home");
      }
    }, [authCheckDone, user, activeTab]);

    useEffect(() => {
      if (!authCheckDone || !user) return;
      const isStaff = !!(user.is_staff || user.role === "staff");
      if (!isStaff) return;
      // Staff do not have an own Profile page; keep mentor/user profile views.
      if (
        activeTab === "profile" &&
        !viewedMentorProfile &&
        !viewedUserProfile &&
        !mentorProfileHashId
      ) {
        setActiveTab("settings");
      }
    }, [
      authCheckDone,
      user,
      activeTab,
      viewedMentorProfile,
      viewedUserProfile,
      mentorProfileHashId,
    ]);

    useEffect(() => {
      document.title = "PeerLink";
    }, [activeTab]);

    useEffect(() => {
      const body = document.body;
      if (showMenteeInfoModal || showMentorInfoModal) {
        const original = body.style.overflow;
        body.dataset.prevOverflow = original;
        body.style.overflow = "hidden";
      } else if (body.dataset.prevOverflow !== undefined) {
        body.style.overflow = body.dataset.prevOverflow;
        delete body.dataset.prevOverflow;
      }
    }, [showMenteeInfoModal, showMentorInfoModal]);

    useEffect(() => {
      if (!authCheckDone || !user) return;
      if (
        (activeTab === "home" || activeTab === "mentees") &&
        user.role === "mentor"
      ) {
        loadMentorRequests();
      }
      if (
        (activeTab === "matching" || activeTab === "home") &&
        user.role === "mentee"
      ) {
        loadMyMentor({ role: "mentee" });
      }
      if (activeTab === "home" && user.role === "mentee") {
        loadMenteeRecommendations();
      }
      if (activeTab === "announcements" && !announcementsLoaded)
        loadAnnouncements();
      if (activeTab === "matching" || activeTab === "mentees") {
        if (
          prevActiveTabRef.current !== "matching" &&
          prevActiveTabRef.current !== "mentees"
        ) {
          if (user.role === "mentor") loadMentorRequests();
        }
      }
      prevActiveTabRef.current = activeTab;
      if (activeTab === "notifications") {
        loadNotifications();
      }
      if (activeTab === "newsfeed" && !postsFeedLoaded) {
        loadPostsFeed(0);
      }
      if (
        activeTab === "profile" &&
        mentorProfileHashId &&
        (!viewedMentorProfile ||
          (viewedMentorProfile.mentor &&
            viewedMentorProfile.mentor.user_id !== mentorProfileHashId))
      ) {
        loadMentorProfileByUserId(mentorProfileHashId);
      }
      if (activeTab !== "profile" && viewedUserProfile)
        setViewedUserProfile(null);
      if (activeTab === "approvals" && user?.is_staff) loadApprovals();
    }, [
      activeTab,
      authCheckDone,
      user,
      user?.role,
      user?.is_staff,
      mentorProfileHashId,
      viewedMentorProfile,
      postsFeedLoaded,
    ]);

    useEffect(() => {
      if (!user) return;
      const onFocus = () => {
        if (document.visibilityState !== "visible") return;
        const stale =
          Date.now() - meLastFetchTsRef.current > ME_MIN_FETCH_INTERVAL_MS;
        if (stale) loadMe({ force: false });
      };
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }, [user]);

    async function loadMe(options = {}) {
      const force = !!options.force;
      if (
        !force &&
        user &&
        Date.now() - meLastFetchTsRef.current < ME_MIN_FETCH_INTERVAL_MS
      ) {
        return;
      }
      if (meInFlightRef.current) {
        return meInFlightRef.current;
      }

      const requestPromise = fetchJSON(force ? "/api/me/?force=1" : "/api/me/");
      meInFlightRef.current = requestPromise;
      const result = await requestPromise;
      meInFlightRef.current = null;
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
        }
        setAuthRequired(true);
        setActiveTab((prev) => (prev === "signup" ? "signup" : "signin"));
        setAuthCheckDone(true);
        return null;
      }
      meLastFetchTsRef.current = Date.now();
      if (result.data.access_token) {
        setAccessToken(result.data.access_token);
        try {
          window.sessionStorage.setItem(
            "peerlink_access_token",
            result.data.access_token,
          );
        } catch (_) {}
      }
      await loadQuestionnaireOptions();
      const unapproved = getIsPendingApproval(result.data);
      setUser(result.data);
      setStats(result.data.stats);
      setUnreadCount(result.data.unread_notifications || 0);
      setSettingsForm({
        email: result.data.email || "",
        display_name: result.data.full_name || result.data.display_name || "",
        avatar_url: result.data.avatar_url || "",
        bio: result.data.bio || "",
        tags: Array.isArray(result.data.tags) ? [...result.data.tags] : [],
      });
      if (result.data.mentee_info) {
        const info = result.data.mentee_info || {};
        setMenteeProfile({
          program: info.program || "BSIT",
          year_level: Number(info.year_level || 0),
          campus: info.campus || "",
          student_id_no: info.student_id_no || "",
          contact_no: info.contact_no || "",
          admission_type: info.admission_type || "",
          sex: info.sex || "",
        });
      }
      if (result.data.mentor_info) {
        const info = result.data.mentor_info || {};
        const mentorSubjects = Array.isArray(info.subjects)
          ? [...info.subjects]
          : [];
        const mentorTopics = Array.isArray(info.topics) ? [...info.topics] : [];
        const nextMentorProfile = {
          subjects: mentorSubjects,
          topics: mentorTopics,
          competency_ids: Array.isArray(info.competency_ids)
            ? [...info.competency_ids]
            : [],
          competency_levels:
            info.competency_levels && typeof info.competency_levels === "object"
              ? { ...info.competency_levels }
              : {},
          expertise_level:
            info.expertise_level != null ? info.expertise_level : null,
          years_experience:
            info.years_experience != null
              ? Number(info.years_experience)
              : null,
          teaching_experience_years:
            info.teaching_experience_years != null
              ? Number(info.teaching_experience_years)
              : null,
          role: info.role || "",
          capacity: 5,
          gender: info.gender || "",
          year_level: Number(info.year_level || 0),
          program: info.program || "BSIT",
          student_id_no: info.student_id_no || "",
          availability: Array.isArray(info.availability)
            ? [...info.availability]
            : [],
        };
        lastSavedMentorProfileRef.current = cloneJson(nextMentorProfile);
        if (!unsavedChangesDirtyRef.current) {
          setMentorProfile(nextMentorProfile);
        }
      }
      if (result.data.mentee_matching) {
        const mm = result.data.mentee_matching || {};
        const menteeSubjects = Array.isArray(mm.subjects)
          ? [...mm.subjects]
          : [];
        const menteeTopics = Array.isArray(mm.topics) ? [...mm.topics] : [];
        const nextMenteeMatching = {
          subjects: menteeSubjects,
          topics: menteeTopics,
          competency_ids: Array.isArray(mm.competency_ids)
            ? [...mm.competency_ids]
            : [],
          competency_needs:
            mm.competency_needs && typeof mm.competency_needs === "object"
              ? { ...mm.competency_needs }
              : {},
          difficulty_level:
            mm.difficulty_level != null ? mm.difficulty_level : null,
          preferred_learning_style: mm.preferred_learning_style || "",
          availability: Array.isArray(mm.availability)
            ? [...mm.availability]
            : [],
        };
        lastSavedMenteeMatchingRef.current = cloneJson(nextMenteeMatching);
        if (!unsavedChangesDirtyRef.current) {
          setMenteeMatching(nextMenteeMatching);
        }
      }
      const isMentee = result.data.role === "mentee";
      const isMentor = result.data.role === "mentor";
      const generalCompleted = !!result.data.mentee_general_info_completed;
      const mentorQCompleted = !!result.data.mentor_questionnaire_completed;
      setShowMenteeInfoModal(false);
      setShowMentorInfoModal(false);
      setAuthRequired(false);
      if (needsCompleteProfile(result.data)) {
        setActiveTab("onboarding");
        setAuthCheckDone(true);
        return result.data;
      }
      if (unapproved) {
        setAuthAlert({
          severity: "warning",
          title: "Account pending approval",
          message:
            "Review or complete your information below, then wait for coordinator approval.",
        });
        setActiveTab(getPendingApprovalLandingTab(result.data));
        if (result.data.role === "mentee") {
          loadMyMentor({ role: "mentee" });
        }
        setAuthCheckDone(true);
        return result.data;
      }
      const requiredOnboardingTab =
        (isMentee && !generalCompleted) || (isMentor && !mentorQCompleted)
          ? "onboarding"
          : isMentee &&
              !(
                result.data.mentee_questionnaire_completed ??
                result.data.questionnaire_completed
              )
            ? "onboarding"
            : null;
      setActiveTab((prev) =>
        ["signin", "signup"].includes(prev)
          ? requiredOnboardingTab || "home"
          : requiredOnboardingTab || prev,
      );
      if (result.data.role === "mentee") {
        loadMyMentor({ role: "mentee" });
      }
      setAuthCheckDone(true);
      return result.data;
    }

    async function runMatching() {
      const now = Date.now();
      if (now - lastMatchingRunRef.current < 2000) return;
      lastMatchingRunRef.current = now;
      setMatchingLoading(true);
      setError("");
      const params = new URLSearchParams({ mode: matchingMode });
      if (matchingMode === "group")
        params.set("min_score", String(matchingMinScore));
      const result = await fetchJSON(`/api/matching/run/?${params.toString()}`);
      if (!result.ok) {
        setError("Unable to run matching.");
        setMatchingLoading(false);
        return;
      }
      setMatchingResults(result.data.results || []);
      setLastRunMode(result.data.mode || matchingMode);
      setLastRunMinScore(result.data.min_score ?? null);
      setMatchingLoading(false);
    }

    async function loadMentorRequests() {
      setMentorRequestsLoading(true);
      const result = await fetchJSON("/api/matching/mentor-requests/");
      if (result.ok) setMentorRequests(result.data.results || []);
      else setMentorRequests([]);
      setMentorRequestsLoading(false);
    }

    async function loadMyMentor(options = {}) {
      const role = options.role || user?.role;
      if (role !== "mentee") return;
      const result = await fetchJSON("/api/matching/my-mentor/");
      if (result.ok) {
        const mentor = result.data.mentor || null;
        setMyMentor(mentor);
        setChosenMentorId(mentor?.id ?? null);
      } else {
        setMyMentor(null);
        setChosenMentorId(null);
      }
    }

    async function loadMentorProfileByUserId(userId) {
      if (!userId) return;
      const result = await fetchJSON(`/api/matching/mentor-profile/${userId}/`);
      if (result.ok && result.data && !result.data.error) {
        setViewedMentorProfile(result.data);
        setMentorProfileHashId(userId);
      } else {
        setViewedMentorProfile(null);
        setMentorProfileHashId(null);
      }
    }

    async function loadUserProfile(userId) {
      if (!userId) return;
      const result = await fetchJSON(`/api/users/${userId}/profile/`);
      if (result.ok && result.data && !result.data.error) {
        setViewedUserProfile(result.data);
        setActiveTab("profile");
      } else {
        setViewedUserProfile(null);
        setError(result.data?.error || "User not found.");
      }
    }

    async function acceptMentee(menteeId) {
      setError("");
      setAcceptMenteeLoading(menteeId);
      const result = await fetchJSON("/api/matching/mentor-accept-mentee/", {
        method: "POST",
        headers: {
          "X-CSRFToken": getCookie("csrftoken"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mentee_id: menteeId }),
      });
      setAcceptMenteeLoading(null);
      if (!result.ok) {
        setError(result.data?.error || "Failed to accept mentee.");
        return;
      }
      addToast("Mentee accepted.");
      loadMentorRequests();
      setActiveTab("matching");
    }

    async function loadMenteeRecommendations(limit) {
      if (!user || user.role !== "mentee") return;
      const hasCached =
        Array.isArray(menteeRecommendations) &&
        menteeRecommendations.length > 0;
      if (hasCached) {
        setMenteeRecUpdating(true);
      } else {
        setMenteeRecLoading(true);
      }
      setError("");
      const params = new URLSearchParams();
      if (limit) params.set("limit", String(limit));
      const url = params.toString()
        ? `/api/matching/mentee-recommendations/?${params.toString()}`
        : "/api/matching/mentee-recommendations/";
      const result = await fetchJSON(url);
      if (!result.ok) {
        setError(
          result.data?.error || "Unable to load mentor recommendations.",
        );
        setMenteeRecMeta({
          empty_reason: null,
          message: "",
          suggested_time_slots: [],
          from_cache: false,
          elapsed_ms: 0,
        });
        setMenteeRecLoading(false);
        setMenteeRecUpdating(false);
        return;
      }
      setMenteeRecommendations(result.data.results || []);
      setMenteeRecMeta({
        empty_reason: result.data.empty_reason || null,
        message: result.data.message || "",
        suggested_time_slots: Array.isArray(result.data.suggested_time_slots)
          ? result.data.suggested_time_slots
          : [],
        from_cache: !!result.data.from_cache,
        elapsed_ms:
          typeof result.data.elapsed_ms === "number"
            ? result.data.elapsed_ms
            : 0,
      });
      setMenteeRecLoading(false);
      setMenteeRecUpdating(false);
    }

    async function chooseMentor(mentorId) {
      if (!user || user.role !== "mentee") return { ok: false };
      setError("");
      const result = await fetchJSON("/api/matching/mentee-choose-mentor/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify({ mentor_id: mentorId }),
      });
      if (!result.ok) {
        const message = result.data?.error || "Unable to choose this mentor.";
        setError(message);
        addToast(message, "error");
        return { ok: false, code: result.data?.code || null, error: message };
      }
      const successMessage = "Mentor matched successfully.";
      setAuthMessage(successMessage);
      addToast(successMessage, "success");
      setChosenMentorId(mentorId);
      await loadMyMentor();
      await loadMenteeRecommendations();
      loadMentorRequests();
      return { ok: true };
    }

    async function handleSignIn() {
      setError("");
      setAuthMessage("");
      clearLockoutCountdown();
      setAuthAlert(null);
      setSignInLoading(true);
      try {
        const loginBody = { ...signInForm };

        const result = await fetchJSON("/api/auth/login/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify(loginBody),
        });

        // Handle login attempt limit (429 Too Many Requests)
        if (result.status === 429) {
          const lockoutData = result.data || {};
          const attemptsCount = lockoutData.attempts || 0;
          const failureLimit = lockoutData.failure_limit || 5;
          const remainingMinutes = lockoutData.remaining_minutes || 1;
          const penaltyMinutes =
            lockoutData.penalty_minutes || remainingMinutes;

          // Parse locked_until from response, or calculate from remaining_minutes
          let lockedUntilTime = null;
          if (lockoutData.locked_until) {
            lockedUntilTime = new Date(lockoutData.locked_until);
          } else if (remainingMinutes > 0) {
            // Fallback: calculate from remaining_minutes
            lockedUntilTime = new Date(
              Date.now() + remainingMinutes * 60 * 1000,
            );
          }

          // Set up countdown timer for real-time updates
          function updateCountdown() {
            const now = new Date();
            if (!lockedUntilTime) {
              setAuthAlert((prev) =>
                prev
                  ? {
                      ...prev,
                      detail: "⏱️ Retry available: Check back shortly",
                    }
                  : null,
              );
              return;
            }

            const diffMs = Math.max(0, lockedUntilTime - now);
            const totalSeconds = Math.max(0, Math.ceil(diffMs / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            const timeStr = lockedUntilTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            let timeDisplay = "";
            if (totalSeconds > 0) {
              timeDisplay = `in ${minutes}m ${String(seconds).padStart(2, "0")}s`;
            } else if (seconds > 0) {
              timeDisplay = `in ${seconds}s`;
            } else {
              timeDisplay = "now";
            }

            setAuthAlert((prev) =>
              prev
                ? {
                    ...prev,
                    detail: `AXES lockout: ${attemptsCount} of ${failureLimit} failed login attempt(s). Retry in ${remainingMinutes} minute(s) (${timeDisplay} / ${timeStr}).`,
                  }
                : null,
            );

            // If penalty has expired, auto-poll to check if it's been lifted
            if (diffMs <= 0) {
              clearLockoutCountdown();
              // Poll once to confirm lockout is lifted
              fetchJSON("/api/auth/check-lockout/", {
                method: "POST",
                headers: { "X-CSRFToken": getCookie("csrftoken") },
                body: JSON.stringify({ identifier: signInForm.identifier }),
              })
                .then((response) => {
                  if (response.ok && !response.data?.is_locked) {
                    setAuthAlert({
                      severity: "warning",
                      title: "Penalty lifted",
                      message: "You can now try signing in again.",
                    });
                  }
                })
                .catch(() => {});
            }
          }

          setAuthAlert({
            severity: "error",
            title: "Account temporarily locked by AXES",
            message: "Too many failed login attempts.",
            detail: `AXES locked this account after ${attemptsCount} failed attempt(s) out of ${failureLimit}. Lockout duration: ${penaltyMinutes} minute(s).`,
            attempts: `${attemptsCount} of ${failureLimit}`,
          });

          // Show immediately, then tick every second.
          updateCountdown();
          lockoutCountdownRef.current = setInterval(updateCountdown, 1000);

          setError(
            lockoutData.detail ||
              "Account locked due to too many failed attempts.",
          );
          return;
        }

        if (result.status === 403 && result.data?.must_change_password) {
          window.location.replace("/accounts/settings/?must_change_password=1");
          return;
        }

        if (result.status === 403 && result.data?.error) {
          setError(result.data.error);
          setAuthAlert({
            severity: "error",
            title: "Cannot sign in with this role",
            message: result.data.error,
          });
          return;
        }

        if (!result.ok) {
          const errorMsg = result.data?.error || "Unable to sign in.";
          setError(errorMsg);

          // Show warning for regular failed attempts (before lockout)
          if (result.data?.must_change_password) {
            window.location.replace(
              "/accounts/settings/?must_change_password=1",
            );
            return;
          }
          if (result.status === 401 || result.status === 400) {
            const attemptData = result.data || {};
            if (
              attemptData.attempts !== undefined &&
              attemptData.failure_limit !== undefined
            ) {
              const remaining =
                attemptData.failure_limit - attemptData.attempts;
              if (remaining > 0 && remaining <= 2) {
                setAuthAlert({
                  severity: "warning",
                  title: "Login failed",
                  message: "Invalid credentials.",
                  detail: `You have ${remaining} attempt(s) remaining before your account is locked.`,
                });
              } else {
                setAuthAlert({
                  severity: "error",
                  title: "Login failed",
                  message: errorMsg,
                });
              }
            } else {
              setAuthAlert({
                severity: "error",
                title: "Login failed",
                message: errorMsg,
              });
            }
          } else {
            setAuthAlert({
              severity: "error",
              title: "Login failed",
              message: errorMsg,
            });
          }
          return;
        }
        clearLockoutCountdown();
        setAuthAlert(null);
        const profile = await loadMe({ force: true });
        if (!profile) return;
        setActiveTab("home");
      } finally {
        setSignInLoading(false);
      }
    }

    async function handleSignUp() {
      setError("");
      setAuthMessage("");
      setAuthAlert(null);
      setSignUpLoading(true);
      try {
        if (signUpForm.display_name && !signUpForm.first_name) {
          const displayName = String(signUpForm.display_name || "").trim();
          const email = String(signUpForm.email || "")
            .trim()
            .toLowerCase();
          const password = String(signUpForm.password || "");
          const confirmPassword = String(signUpForm.confirm_password || "");
          const institutionalEmail = /^[^\s@]+@(student\.)?buksu\.edu\.ph$/i;
          if (
            !displayName ||
            !institutionalEmail.test(email) ||
            !password ||
            password !== confirmPassword
          ) {
            setAuthAlert({
              severity: "error",
              title: "Check your details",
              message:
                "Enter your name, institutional email, and matching passwords.",
            });
            return;
          }
          const body = new FormData();
          body.append("display_name", displayName);
          body.append("email", email);
          body.append("password", password);
          body.append("confirm_password", confirmPassword);
          const portalRole = getPortalAuthRole();
          if (portalRole === "mentor" || portalRole === "mentee")
            body.append("role", portalRole);
          const result = await fetchJSON("/api/auth/register/", {
            method: "POST",
            raw: true,
            headers: { "X-CSRFToken": getCookie("csrftoken") },
            body,
          });
          if (!result.ok) {
            const message =
              result.data?.error ||
              Object.values(result.data?.errors || {})?.[0]?.[0] ||
              "Unable to create your account.";
            setAuthAlert({
              severity: "error",
              title: "Sign up failed",
              message,
            });
            return;
          }
          const token = result.data?.access_token || "";
          setAccessToken(token);
          try {
            window.sessionStorage.setItem("peerlink_access_token", token);
          } catch (_) {}
          const profile = await loadMe({ force: true });
          if (profile) setActiveTab("onboarding");
          return;
        }
        const portalRole = getPortalAuthRole();
        if (portalRole === "staff") {
          setAuthAlert({
            severity: "error",
            title: "Staff accounts",
            message: "Staff accounts are created by an administrator.",
            detail:
              "Use Sign In with your staff credentials, or contact your coordinator.",
          });
          return;
        }
        const registerRole =
          portalRole === "mentor" || portalRole === "mentee"
            ? portalRole
            : signUpForm.role;
        if (
          portalRole &&
          (portalRole === "mentor" || portalRole === "mentee") &&
          signUpForm.role !== portalRole
        ) {
          setSignUpForm((prev) => ({ ...prev, role: portalRole }));
        }

        const firstName = String(signUpForm.first_name || "").trim();
        const lastName = String(signUpForm.last_name || "").trim();
        const email = String(signUpForm.email || "").trim();
        const password1 = String(signUpForm.password1 || "");
        const password2 = String(signUpForm.password2 || "");

        if (!firstName) {
          setAuthAlert({
            severity: "error",
            title: "First name required",
            message: "Enter your first name to continue signup.",
          });
          return;
        }
        if (!lastName) {
          setAuthAlert({
            severity: "error",
            title: "Last name required",
            message: "Enter your last name to continue signup.",
          });
          return;
        }
        if (!email) {
          setAuthAlert({
            severity: "error",
            title: "Email required",
            message: "Enter your email address to continue signup.",
          });
          return;
        }
        if (!password1) {
          setAuthAlert({
            severity: "error",
            title: "Password required",
            message: "Create a password to continue signup.",
          });
          return;
        }
        if (!password2) {
          setAuthAlert({
            severity: "error",
            title: "Confirm password required",
            message: "Confirm your password to continue signup.",
          });
          return;
        }
        if (password1 !== password2) {
          setAuthAlert({
            severity: "error",
            title: "Passwords do not match",
            message: "Make sure both password fields are the same.",
          });
          return;
        }

        const formData = new FormData();
        formData.append("role", registerRole || "");
        if (portalRole === "mentor" || portalRole === "mentee") {
          formData.append("expected_role", portalRole);
        }
        formData.append("first_name", firstName);
        formData.append("middle_name", signUpForm.middle_name || "");
        formData.append("last_name", lastName);
        formData.append("email", email);
        formData.append("password1", password1);
        formData.append("password2", password2);
        if (registerRole === "mentor") {
          if (!signUpForm.mentor_role) {
            setAuthAlert({
              severity: "error",
              title: "Mentor type required",
              message:
                "Select whether you are signing up as a student mentor or an instructor.",
            });
            return;
          }
          if (
            !["male", "female"].includes(
              String(signUpForm.gender || "").toLowerCase(),
            )
          ) {
            setAuthAlert({
              severity: "error",
              title: "Biological sex required",
              message: "Select your biological sex to continue signup.",
            });
            return;
          }
          formData.append("mentor_role", signUpForm.mentor_role);
          formData.append("gender", signUpForm.gender);
          if (signUpForm.mentor_role === "Senior IT Student") {
            const yearLevel = Number(signUpForm.year_level);
            if (yearLevel !== 3 && yearLevel !== 4) {
              setAuthAlert({
                severity: "error",
                title: "Year level required",
                message:
                  "Select whether you are a 3rd year or 4th year student mentor.",
              });
              return;
            }
            formData.append("year_level", String(yearLevel));
          }
        }

        const isStudentMentor =
          registerRole === "mentor" &&
          signUpForm.mentor_role === "Senior IT Student";
        if (isStudentMentor) {
          const requiredDocs = [
            ["letter_of_intent", "Letter of intent"],
            ["study_load", "Study load"],
            ["grade", "Grade"],
          ];
          const missingDocs = requiredDocs.filter(
            ([key]) => !(signUpForm[key] || []).length,
          );
          if (missingDocs.length) {
            setAuthAlert({
              severity: "error",
              title: "Required documents",
              message: `Upload ${missingDocs
                .map(([, label]) => label.toLowerCase())
                .join(", ")}.`,
            });
            return;
          }
          requiredDocs.forEach(([key]) => {
            (signUpForm[key] || []).forEach((file) => {
              formData.append(key, file);
            });
          });
        } else {
          const files = signUpForm.student_verification_documents || [];
          if (!files.length) {
            setAuthAlert({
              severity: "error",
              title: "Application form required",
              message:
                "Upload your academic mentoring application form to continue signup.",
            });
            return;
          }
          files.forEach((file) => {
            formData.append("student_verification_document", file);
          });
        }

        const result = await fetchJSON("/api/auth/register/", {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken"),
          },
          body: formData,
          raw: true,
        });
        if (!result.ok) {
          const errs = result.data?.errors;
          const message =
            errs && typeof errs === "object"
              ? Object.values(errs).flat().filter(Boolean).map(String).join(" ")
              : result.data?.error || "Unable to create account.";
          setError(message);
          setAuthAlert({
            severity: "error",
            title: "Sign up failed",
            message,
            detail: result.data?.detail || "",
          });
          addToast(message, "error");
          return;
        }
        const message = result.data?.message || "Account created.";
        setAuthMessage(message);
        const keepRole =
          portalRole === "mentor" || portalRole === "mentee"
            ? portalRole
            : "mentor";
        setSignUpForm({
          ...emptySignUpForm,
          role: keepRole,
        });
        setActiveTab("signin");
        replaceAppUrl("signin");
      } finally {
        setSignUpLoading(false);
      }
    }

    async function handleLogout() {
      if (logoutLoading) return;
      if (unsavedChangesDirtyRef.current) {
        requestLeave({
          type: "logout",
          run: () => {
            unsavedChangesDirtyRef.current = false;
            handleLogout();
          },
        });
        return;
      }
      setLogoutLoading(true);
      try {
        await fetch("/api/auth/logout/", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken") || "",
          },
        }).catch(() => {});
      } finally {
        replaceAppUrl("signin");
        window.location.replace("/");
      }
    }

    async function loadPostsFeed(offset = 0) {
      if (offset === 0) setPostsFeedLoading(true);
      else setPostsFeedLoadingMore(true);
      const result = await fetchJSON(
        `/api/posts/feed/?limit=10&offset=${offset}`,
      );
      if (result.ok) {
        const list = result.data.posts || [];
        const hasMore = !!result.data.has_more;
        if (offset === 0) {
          setPostsFeed(list);
        } else {
          setPostsFeed((prev) => [...prev, ...list]);
        }
        setPostsFeedHasMore(hasMore);
      } else {
        if (offset === 0) setPostsFeed([]);
        setPostsFeedHasMore(false);
      }
      setPostsFeedLoaded(true);
      setPostsFeedLoading(false);
      setPostsFeedLoadingMore(false);
    }

    async function loadNotifications() {
      setNotificationsLoading(true);
      const result = await fetchJSON("/api/notifications/");
      if (result.ok) setNotifications(result.data.items || []);
      else {
        setError(result.data?.error || "Unable to load notifications.");
        setNotifications([]);
      }
      setNotificationsLoading(false);
    }

    async function loadQuestionnaireOptions() {
      const result = await fetchJSON("/api/questionnaire/options/");
      if (!result.ok) return false;
      const data = result.data || {};
      const subjects = Array.isArray(data.subjects) ? data.subjects : [];
      const categoryLabels = data.category_labels || {};
      const categoryOrder = Array.isArray(data.category_order)
        ? data.category_order
        : ["major", "ge", "nstp", "pe"];
      const topicMap = data.topic_map || {};
      const topicSet = new Set();
      Object.values(topicMap).forEach((values) => {
        (Array.isArray(values) ? values : []).forEach((topic) => {
          const text = String(topic || "").trim();
          if (text) topicSet.add(text);
        });
      });
      window.DashboardApp = window.DashboardApp || {};
      window.DashboardApp.SUBJECT_CATALOG = subjects.map((item) => ({
        name: item.name,
        code: item.code || "",
        category: item.category || "major",
      }));
      window.DashboardApp.SUBJECT_CATEGORY_LABELS = categoryLabels;
      window.DashboardApp.SUBJECT_CATEGORY_ORDER = categoryOrder;
      window.DashboardApp.MENTOR_SUBJECT_OPTIONS = subjects.map(
        (item) => item.name,
      );
      window.DashboardApp.QUESTIONNAIRE_TOPIC_MAP = topicMap;
      window.DashboardApp.MENTOR_TOPIC_OPTIONS = Array.from(topicSet).sort(
        (a, b) => String(a).localeCompare(String(b)),
      );
      return true;
    }

    async function loadApprovals() {
      setApprovalsLoading(true);
      const result = await fetchJSON("/api/approvals/pending/");
      if (result.ok) {
        setPendingMentors(result.data.pending_mentors || []);
        setPendingMentees(result.data.pending_mentees || []);
      } else {
        setError(result.data?.error || "Unable to load pending users.");
        setPendingMentors([]);
        setPendingMentees([]);
      }
      setApprovalsLoading(false);
    }

    async function loadAnnouncements() {
      setAnnouncementsLoading(true);
      const result = await fetchJSON("/api/announcements/");
      if (result.ok) {
        setAnnouncements(result.data.announcements || []);
        setAnnouncementMenteeOptions(result.data.mentee_options || []);
      } else {
        setError(result.data?.error || "Unable to load announcements.");
        setAnnouncements([]);
      }
      setAnnouncementsLoaded(true);
      setAnnouncementsLoading(false);
    }

    async function postAnnouncement() {
      const msg = (announcementMessage || "").trim();
      if (!msg) return;
      setError("");
      setPostAnnouncementLoading(true);
      try {
        const body = { message: msg };
        if (
          announcementTargetType === "specific" &&
          announcementRecipientIds.length > 0
        ) {
          body.recipient_ids = announcementRecipientIds;
        }
        const result = await fetchJSON("/api/announcements/create/", {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!result.ok) {
          setError(result.data?.error || "Failed to post announcement.");
          return;
        }
        setAnnouncementMessage("");
        addToast("Announcement posted.");
        // Force refresh and keep cache in sync
        setAnnouncementsLoaded(false);
        loadAnnouncements();
      } finally {
        setPostAnnouncementLoading(false);
      }
    }

    async function handleDeleteAnnouncement(announcementId) {
      setError("");
      const result = await fetchJSON(
        `/api/announcements/${announcementId}/delete/`,
        { method: "POST", headers: { "X-CSRFToken": getCookie("csrftoken") } },
      );
      if (!result.ok) {
        setError(result.data?.error || "Failed to delete announcement.");
        return;
      }
      addToast("Announcement removed.");
      setAnnouncementsLoaded(false);
      loadAnnouncements();
    }

    function commentKey(targetType, targetId) {
      return targetType + ":" + targetId;
    }

    async function loadComments(targetType, targetId) {
      const key = commentKey(targetType, targetId);
      const result = await fetchJSON(
        "/api/comments/" + targetType + "/" + targetId + "/",
      );
      if (result.ok)
        setCommentsByKey((prev) => ({
          ...prev,
          [key]: result.data.comments || [],
        }));
      else setCommentsByKey((prev) => ({ ...prev, [key]: [] }));
    }

    async function addComment(targetType, targetId, content) {
      const trimmed = (content || "").trim();
      if (!trimmed) return;
      const result = await fetchJSON("/api/comments/create/", {
        method: "POST",
        headers: {
          "X-CSRFToken": getCookie("csrftoken"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          content: trimmed,
        }),
      });
      if (!result.ok) {
        setError(result.data?.error || "Failed to add comment.");
        return;
      }
      const key = commentKey(targetType, targetId);
      setCommentsByKey((prev) => ({
        ...prev,
        [key]: [...(prev[key] || []), result.data.comment],
      }));
    }

    async function handleApproveMentor(mentorId) {
      setError("");
      setApprovalActionKey("mentor:" + mentorId);
      try {
        const result = await fetchJSON("/api/approvals/approve-mentor/", {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mentor_id: mentorId }),
        });
        if (!result.ok) {
          setError(result.data?.error || "Failed to approve mentor.");
          return;
        }
        setAuthMessage("Mentor approved.");
        setPendingMentors((prev) => prev.filter((m) => m.id !== mentorId));
      } finally {
        setApprovalActionKey(null);
      }
    }

    async function handleRejectMentor(mentorId) {
      setError("");
      setApprovalActionKey("mentor:" + mentorId);
      try {
        const result = await fetchJSON("/api/approvals/reject-mentor/", {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mentor_id: mentorId }),
        });
        if (!result.ok) {
          setError(result.data?.error || "Failed to reject mentor.");
          return;
        }
        setAuthMessage("Mentor rejected.");
        setPendingMentors((prev) => prev.filter((m) => m.id !== mentorId));
      } finally {
        setApprovalActionKey(null);
      }
    }

    async function handleApproveMentee(menteeId) {
      setError("");
      setApprovalActionKey("mentee:" + menteeId);
      try {
        const result = await fetchJSON("/api/approvals/approve-mentee/", {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mentee_id: menteeId }),
        });
        if (!result.ok) {
          setError(result.data?.error || "Failed to approve mentee.");
          return;
        }
        setAuthMessage("Mentee approved.");
        setPendingMentees((prev) => prev.filter((m) => m.id !== menteeId));
      } finally {
        setApprovalActionKey(null);
      }
    }

    async function handleRejectMentee(menteeId) {
      setError("");
      setApprovalActionKey("mentee:" + menteeId);
      try {
        const result = await fetchJSON("/api/approvals/reject-mentee/", {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mentee_id: menteeId }),
        });
        if (!result.ok) {
          setError(result.data?.error || "Failed to reject mentee.");
          return;
        }
        setAuthMessage("Mentee rejected.");
        setPendingMentees((prev) => prev.filter((m) => m.id !== menteeId));
      } finally {
        setApprovalActionKey(null);
      }
    }

    async function handleMarkAllRead() {
      const result = await fetchJSON("/api/notifications/mark-all-read/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      if (!result.ok) {
        setError(result.data?.error || "Unable to mark notifications as read.");
        return;
      }
      loadNotifications();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      addToast("All notifications marked as read.", "success");
    }

    async function handleMarkRead(notificationId) {
      const result = await fetchJSON(
        `/api/notifications/${notificationId}/read/`,
        {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
        },
      );
      if (!result.ok) {
        setError(result.data?.error || "Unable to mark notification as read.");
        return;
      }
      loadNotifications();
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );
    }

    async function handleSettingsSave() {
      setSettingsSaving(true);
      setError("");
      const result = await fetchJSON("/api/me/update/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify(settingsForm),
      });
      if (!result.ok) {
        const errs = result.data?.errors;
        const message =
          errs && typeof errs === "object"
            ? Object.values(errs).flat().filter(Boolean).join(" ") ||
              "Unable to update account."
            : result.data?.error || "Unable to update account.";
        setError(message);
        setSettingsSaving(false);
        return false;
      }
      addToast("Settings saved.");
      await loadMe({ force: true });
      setSettingsSaving(false);
      return true;
    }

    async function handleBioSave(bio) {
      const result = await fetchJSON("/api/me/bio/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify({ bio }),
      });
      if (!result.ok) {
        setError(result.data?.error || "Unable to update bio.");
        return false;
      }
      setUser((prev) => (prev ? { ...prev, bio: result.data.bio } : prev));
      setSettingsForm((prev) => ({ ...prev, bio: result.data.bio }));
      addToast("Bio updated.");
      return true;
    }

    async function handleTagsSave(tags) {
      const result = await fetchJSON("/api/me/tags/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify({ tags }),
      });
      if (!result.ok) {
        setError(result.data?.error || "Unable to update tags.");
        return false;
      }
      setUser((prev) => (prev ? { ...prev, tags: result.data.tags } : prev));
      setSettingsForm((prev) => ({ ...prev, tags: result.data.tags }));
      addToast("Interests updated.");
      return true;
    }

    async function handleMenteeProfileSave() {
      if (!user || user.role !== "mentee") return false;
      setError("");
      const requiredFields = ["campus", "student_id_no", "contact_no", "sex"];
      const missing = requiredFields.filter(
        (field) => !String(menteeProfile[field] || "").trim(),
      );
      if (missing.length > 0) {
        const message =
          "Please complete all general information fields before saving.";
        setError(message);
        addToast(message, "warning");
        return false;
      }
      setMenteeProfileSaving(true);
      const payload = {
        program: "BSIT",
        year_level: 1,
        campus: menteeProfile.campus,
        student_id_no: menteeProfile.student_id_no,
        contact_no: menteeProfile.contact_no,
        sex: menteeProfile.sex,
      };
      const result = await fetchJSON("/api/me/mentee-profile/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        setError(result.data?.error || "Unable to update mentee profile.");
        setMenteeProfileSaving(false);
        return false;
      }
      setMenteeProfile((prev) => ({ ...prev, ...result.data }));
      setUser((prev) =>
        prev ? { ...prev, mentee_general_info_completed: true } : prev,
      );
      addToast("Profile saved.");
      setShowMenteeInfoModal(false);
      setAuthMessage("Your general information was updated.");
      setMenteeProfileSaving(false);
      setActiveTab((prev) =>
        prev === "onboarding" || prev === "complete-profile"
          ? "onboarding"
          : prev,
      );
      return true;
    }

    async function saveCompleteProfileFallback(payload) {
      const data = payload || {};
      const isMentor = user && user.role === "mentor";
      if (isMentor) {
        const mentorRes = await fetchJSON("/api/me/mentor-profile/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({
            program: data.program,
            student_id_no: data.student_id_no,
            year_level: data.year_level,
            role: data.track === "faculty" ? "Instructor" : "Senior IT Student",
          }),
        });
        if (!mentorRes.ok) return mentorRes;
      } else {
        const menteeRes = await fetchJSON("/api/me/mentee-profile/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({
            program: "BSIT",
            year_level: 1,
            campus: data.campus,
            student_id_no: data.student_id_no,
            contact_no: data.contact_no,
            sex: data.sex,
          }),
        });
        if (!menteeRes.ok) return menteeRes;
      }
      if (Array.isArray(data.interests) && data.interests.length) {
        await fetchJSON("/api/me/tags/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify({ tags: data.interests }),
        });
      }
      return {
        ok: true,
        status: 200,
        data: {
          is_profile_complete: true,
          tags: Array.isArray(data.interests) ? data.interests : [],
          mentee_info: isMentor ? undefined : data,
          mentor_info: isMentor
            ? {
                program: data.program,
                year_level: data.year_level,
                student_id_no: data.student_id_no,
                role:
                  data.track === "faculty" ? "Instructor" : "Senior IT Student",
              }
            : undefined,
        },
      };
    }

    async function handleCompleteProfileSave(payload) {
      setCompleteProfileSaving(true);
      setError("");
      let result = await fetchJSON("/api/me/complete-profile/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify(payload || {}),
      });
      if (!result.ok && (result.status === 404 || result.status === 405)) {
        result = await saveCompleteProfileFallback(payload);
      }
      if (!result.ok) {
        setCompleteProfileSaving(false);
        const message =
          (result.data && result.data.error) ||
          (result.status === 404
            ? "Could not save profile. Refresh the page and try again."
            : "Please complete the required fields.");
        setError(message);
        addToast(message, "warning");
        return {
          ok: false,
          errors: (result.data && result.data.errors) || {},
          message,
        };
      }
      if (result.data.mentee_info) {
        setMenteeProfile((prev) => ({ ...prev, ...result.data.mentee_info }));
      }
      if (result.data.mentor_info) {
        setMentorProfile((prev) => ({ ...prev, ...result.data.mentor_info }));
      }
      if (Array.isArray(result.data.tags)) {
        setSettingsForm((prev) => ({ ...prev, tags: [...result.data.tags] }));
        setUser((prev) =>
          prev
            ? {
                ...prev,
                tags: [...result.data.tags],
                is_profile_complete: true,
                mentee_general_info_completed:
                  prev.role === "mentee"
                    ? true
                    : prev.mentee_general_info_completed,
              }
            : prev,
        );
      } else {
        setUser((prev) =>
          prev ? { ...prev, is_profile_complete: true } : prev,
        );
      }
      addToast("Account details saved.");
      setCompleteProfileSaving(false);
      await loadMe({ force: true });
      return { ok: true, data: result.data };
    }

    async function handleOnboardingComplete(formData) {
      setOnboardingSaving(true);
      setError("");
      const result = await fetchJSON("/api/user/complete-onboarding/", {
        method: "POST",
        raw: true,
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: formData,
      });
      if (!result.ok) {
        const message = result.data?.error || "Unable to complete onboarding.";
        setError(message);
        addToast(message, "warning");
        setOnboardingSaving(false);
        return { ok: false, message };
      }
      setUser((previous) => ({
        ...(previous || {}),
        ...(result.data.user || {}),
        is_onboarded: true,
      }));
      setOnboardingSaving(false);
      setActiveTab("home");
      return { ok: true, data: result.data.user };
    }

    async function handleMentorProfileSave(overrides) {
      if (!user || user.role !== "mentor") return;
      const profile = { ...mentorProfile, ...(overrides || {}) };
      const sanitizedSubjects = Array.isArray(profile.subjects)
        ? [...profile.subjects]
        : [];
      const sanitizedTopics = Array.isArray(profile.topics)
        ? [...profile.topics]
        : [];
      setError("");
      const hasPrefs =
        sanitizedSubjects.length > 0 ||
        sanitizedTopics.length > 0 ||
        (profile.expertise_level != null &&
          profile.expertise_level >= 1 &&
          profile.expertise_level <= 5) ||
        (Array.isArray(profile.availability) &&
          profile.availability.length > 0);
      if (!hasPrefs) {
        const message =
          "Please set at least one matching preference (subjects, topics, expertise, or availability).";
        setError(message);
        addToast(message, "warning");
        return false;
      }
      setMentorProfileSaving(true);
      try {
        const payload = {
          subjects: sanitizedSubjects,
          topics: sanitizedTopics,
          competency_ids: Array.isArray(profile.competency_ids)
            ? [...profile.competency_ids]
            : [],
          competency_levels: Object.entries(
            profile.competency_levels &&
              typeof profile.competency_levels === "object"
              ? profile.competency_levels
              : {},
          ).map(([competencyId, proficiencyLevel]) => ({
            competency_id: Number(competencyId),
            proficiency_level: Number(proficiencyLevel),
          })),
          expertise_level: profile.expertise_level,
          years_experience:
            profile.years_experience != null
              ? Number(profile.years_experience)
              : null,
          teaching_experience_years:
            profile.teaching_experience_years != null
              ? Number(profile.teaching_experience_years)
              : null,
          capacity: 5,
          availability: profile.availability || [],
        };
        const result = await fetchJSON("/api/me/mentor-profile/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify(payload),
        });
        if (!result.ok) {
          setError(result.data?.error || "Unable to update mentor profile.");
          return false;
        }
        setMentorProfile((prev) => {
          const next = { ...prev, ...result.data };
          lastSavedMentorProfileRef.current = cloneJson(next);
          return next;
        });
        await loadMe({ force: true });
        // Invalidate any existing staff/mentor matching results to avoid stale pairs
        setMatchingResults([]);
        setLastRunMode(null);
        setLastRunMinScore(null);
        setUser((prev) =>
          prev ? { ...prev, mentor_questionnaire_completed: true } : prev,
        );
        setShowMentorInfoModal(false);
        if (result.data?.mentor_role_locked && result.data?.message) {
          addToast(result.data.message, "warning");
        } else {
          setAuthMessage("Your mentor profile was updated.");
          addToast("Profile saved.");
        }
        setActiveTab((prev) => {
          if (prev === "onboarding") return "onboarding";
          const pending = user && user.mentor_approved === false;
          const incomplete = !(user && user.mentor_questionnaire_completed);
          if (pending || incomplete) return "onboarding";
          return prev;
        });
        return true;
      } finally {
        setMentorProfileSaving(false);
      }
    }

    async function handleMenteeMatchingSave(overrides) {
      if (!user || user.role !== "mentee") return;
      const matching = { ...menteeMatching, ...(overrides || {}) };
      const sanitizedSubjects = Array.isArray(matching.subjects)
        ? [...matching.subjects]
        : [];
      const sanitizedTopics = Array.isArray(matching.topics)
        ? [...matching.topics]
        : [];
      setError("");
      const hasPrefs =
        sanitizedSubjects.length > 0 ||
        sanitizedTopics.length > 0 ||
        (matching.difficulty_level != null &&
          matching.difficulty_level >= 1 &&
          matching.difficulty_level <= 5) ||
        (Array.isArray(matching.availability) &&
          matching.availability.length > 0);
      if (!hasPrefs) {
        const message =
          "Please set at least one matching preference (subjects, topics, difficulty, preferred gender, or availability).";
        setError(message);
        addToast(message, "warning");
        return false;
      }
      setMenteeMatchingSaving(true);
      try {
        const payload = {
          subjects: sanitizedSubjects,
          topics: sanitizedTopics,
          competency_ids: Array.isArray(matching.competency_ids)
            ? [...matching.competency_ids]
            : [],
          competency_needs: Object.entries(
            matching.competency_needs &&
              typeof matching.competency_needs === "object"
              ? matching.competency_needs
              : {},
          ).map(([competencyId, needLevel]) => ({
            competency_id: Number(competencyId),
            need_level: Number(needLevel),
          })),
          difficulty_level: matching.difficulty_level,
          preferred_learning_style: matching.preferred_learning_style || "",
          availability: matching.availability || [],
        };
        const result = await fetchJSON("/api/me/mentee-matching/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify(payload),
        });
        if (!result.ok) {
          setError(
            result.data?.error || "Unable to update mentoring preferences.",
          );
          return false;
        }
        setMenteeMatching((prev) => {
          const next = { ...prev, ...result.data };
          lastSavedMenteeMatchingRef.current = cloneJson(next);
          return next;
        });
        await loadMe({ force: true });
        // Invalidate current recommendations so changes take effect immediately
        setMenteeRecommendations([]);
        setMenteeRecMeta({
          empty_reason: null,
          message: "",
          suggested_time_slots: [],
        });
        setChosenMentorId(null);
        if (activeTab === "matching") {
          // Refresh recommendations right away if mentee is on Matching tab
          loadMenteeRecommendations();
        }
        setAuthMessage("Your mentoring preferences were updated.");
        addToast("Mentoring preferences saved.");
        setUser((prev) =>
          prev
            ? {
                ...prev,
                mentee_questionnaire_completed: true,
                questionnaire_completed: true,
              }
            : prev,
        );
        setActiveTab((prev) => {
          if (prev === "onboarding") return "onboarding";
          if (user && user.mentee_approved === false) return "onboarding";
          return prev;
        });
        return true;
      } finally {
        setMenteeMatchingSaving(false);
      }
    }

    async function loadActivityLogs(params = {}) {
      const page = Math.max(1, Number.parseInt(params.page ?? 1, 10) || 1);
      const pageSize = Math.min(
        100,
        Math.max(1, Number.parseInt(params.page_size ?? 20, 10) || 20),
      );
      const normalizedSearch = (params.search || "").trim();
      const normalizedDateFrom = params.date_from || "";
      const normalizedDateTo = params.date_to || "";
      const cacheKey = JSON.stringify({
        page,
        pageSize,
        search: normalizedSearch,
        date_from: normalizedDateFrom,
        date_to: normalizedDateTo,
      });
      const cached = activityLogsCacheRef.current.get(cacheKey);
      if (cached) {
        setActivityLogs(cached.logs);
        setActivityLogsPage(cached.page);
        setActivityLogsPageSize(cached.page_size);
        setActivityLogsTotal(cached.total);
        setActivityLogsTotalPages(cached.total_pages);
        setActivityLogsLoading(false);
        return cached;
      }

      setActivityLogsLoading(true);
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("page_size", String(pageSize));
      if (normalizedSearch) q.set("search", normalizedSearch);
      if (normalizedDateFrom) q.set("date_from", normalizedDateFrom);
      if (normalizedDateTo) q.set("date_to", normalizedDateTo);
      const result = await fetchJSON(
        "/api/activity-logs/" + (q.toString() ? "?" + q.toString() : ""),
      );
      if (result.ok) {
        const response = result.data || {};
        const logs = response.logs || [];
        const resolvedPage = response.page || page;
        const resolvedPageSize = response.page_size || pageSize;
        const resolvedTotal = response.total || logs.length || 0;
        const resolvedTotalPages = response.total_pages || 1;
        setActivityLogs(logs);
        setActivityLogsPage(resolvedPage);
        setActivityLogsPageSize(resolvedPageSize);
        setActivityLogsTotal(resolvedTotal);
        setActivityLogsTotalPages(resolvedTotalPages);
        activityLogsCacheRef.current.set(cacheKey, {
          logs,
          page: resolvedPage,
          page_size: resolvedPageSize,
          total: resolvedTotal,
          total_pages: resolvedTotalPages,
        });
      } else {
        setActivityLogs([]);
        setActivityLogsPage(page);
        setActivityLogsPageSize(pageSize);
        setActivityLogsTotal(0);
        setActivityLogsTotalPages(1);
      }
      setActivityLogsLoading(false);
    }

    async function loadGlobalSearch(q) {
      const query = (q || "").trim();
      if (!query) {
        setGlobalSearchResults([]);
        return;
      }
      const result = await fetchJSON(
        `/api/search/?q=${encodeURIComponent(query)}`,
      );
      if (!result.ok) {
        setGlobalSearchResults([]);
        return;
      }
      setGlobalSearchResults(result.data.results || []);
    }

    async function loadBackups() {
      setBackupsLoading(true);
      const result = await fetchJSON("/api/backup/");
      if (result.ok) {
        setBackups(result.data.backups || []);
        setBackupDir(result.data.backup_dir || "");
      } else {
        setBackups([]);
      }
      setBackupsLoading(false);
    }

    async function createBackup() {
      setBackupCreateLoading(true);
      setError("");
      const result = await fetchJSON("/api/backup/create/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      setBackupCreateLoading(false);
      if (!result.ok) {
        setError(result.data?.error || "Failed to create backup.");
        return;
      }
      addToast("Backup created.");
      loadBackups();
    }

    async function restoreBackup(file) {
      const allowed = /\.(json|gz|zip|bz2|sql|psql|dump|backup)$/i;
      if (!file || !allowed.test(file.name)) {
        setError("Please select a valid backup file.");
        return;
      }
      setBackupRestoreLoading(true);
      setError("");
      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await fetch("/api/backup/restore/", {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data.error || "Restore failed.");
          return;
        }
        addToast("Restore completed. Reloading…");
        setTimeout(() => window.location.reload(), 1500);
      } finally {
        setBackupRestoreLoading(false);
      }
    }

    async function restoreBackupById(backupId) {
      setBackupRestoreLoading(true);
      setError("");
      const result = await fetchJSON(`/api/backup/${backupId}/restore/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      setBackupRestoreLoading(false);
      if (!result.ok) {
        setError(result.data?.error || "Restore failed.");
        return;
      }
      addToast("Restore completed. Reloading…");
      setTimeout(() => window.location.reload(), 1500);
    }

    async function deleteBackup(backupId) {
      setError("");
      const result = await fetchJSON(`/api/backup/${backupId}/delete/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      if (!result.ok) {
        setError(result.data?.error || "Failed to delete backup.");
        return;
      }
      addToast("Backup deleted.");
      loadBackups();
    }

    async function downloadBackup(backupId) {
      try {
        const response = await fetch(`/api/backup/${backupId}/download/`, {
          credentials: "include",
        });
        if (!response.ok) return;
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "backup_" + backupId + ".json";
        a.click();
        URL.revokeObjectURL(url);
        addToast("Download started.");
      } catch (e) {
        setError("Download failed.");
      }
    }

    async function handleAvatarChange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const maxBytes = 2 * 1024 * 1024;
      if (file.size > maxBytes) {
        const msg = "Please choose an image smaller than 2 MB.";
        setError(msg);
        addToast(msg, "warning");
        event.target.value = "";
        return;
      }
      setError("");
      setAvatarUploading(true);
      const formData = new FormData();
      formData.append("avatar", file);
      try {
        const response = await fetch("/api/me/avatar/", {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: formData,
        });
        const data = (await response.json()) || {};
        if (!response.ok) {
          const msg = data.error || "Unable to upload profile picture.";
          setError(msg);
          addToast(msg, "error");
          return;
        }
        const newUrl = data.avatar_url || "";
        setUser((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
        setSettingsForm((prev) => ({ ...prev, avatar_url: newUrl }));
      } catch (err) {
        const msg = "Network error while uploading profile picture.";
        setError(msg);
        addToast(msg, "error");
      } finally {
        setAvatarUploading(false);
        event.target.value = "";
      }
    }

    const isAuthenticated = !authRequired && user;
    const isPendingApproval = getIsPendingApproval(user);
    const showSignInPrompt =
      authCheckDone &&
      authRequired &&
      !["signin", "signup"].includes(activeTab);

    useEffect(() => {
      const unapproved = user && getIsPendingApproval(user);
      if (
        isAuthenticated &&
        ["signin", "signup"].includes(activeTab) &&
        !signInPathRef.current &&
        !unapproved
      ) {
        setActiveTab("home");
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}#home`,
        );
      }
    }, [isAuthenticated, activeTab, user]);

    useEffect(() => {
      if (!authMessage) return;
      addToast(authMessage, "success");
    }, [authMessage]);

    useEffect(() => {
      if (!error) return;
      if (isPendingApprovalMessage(error)) return;
      if (["signin", "signup"].includes(activeTab)) return;
      addToast(error, "error");
    }, [error, activeTab]);

    const contextValue = {
      user,
      setUser,
      stats,
      pendingApprovalLandingTab: getPendingApprovalLandingTab(user),
      unreadCount,
      authRequired,
      setAuthRequired,
      authCheckDone,
      setAuthCheckDone,
      accessToken,
      activeTab,
      setActiveTab,
      requestTabChange,
      error,
      setError,
      authMessage,
      setAuthMessage,
      authAlert,
      setAuthAlert,
      signInLoading,
      signUpLoading,
      logoutLoading,
      signInForm,
      setSignInForm,
      signUpForm,
      setSignUpForm,
      matchingLoading,
      matchingResults,
      matchingMode,
      setMatchingMode,
      matchingMinScore,
      setMatchingMinScore,
      lastRunMode,
      lastRunMinScore,
      runMatching,
      menteeRecLoading,
      menteeRecommendations,
      menteeRecMeta,
      loadMenteeRecommendations,
      chooseMentor,
      mentorRequestsLoading,
      mentorRequests,
      loadMentorRequests,
      acceptMentee,
      acceptMenteeLoading,
      myMentor,
      loadMyMentor,
      notificationsLoading,
      notifications,
      loadNotifications,
      handleMarkAllRead,
      handleMarkRead,
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
      completeProfileSaving,
      handleCompleteProfileSave,
      onboardingSaving,
      handleOnboardingComplete,
      handleMenteeProfileSave,
      mentorProfile,
      setMentorProfile,
      mentorProfileSaving,
      handleMentorProfileSave,
      menteeMatching,
      setMenteeMatching,
      menteeMatchingSaving,
      handleMenteeMatchingSave,
      showMenteeInfoModal,
      showMentorInfoModal,
      approvalsLoading,
      approvalActionKey,
      pendingMentors,
      pendingMentees,
      loadApprovals,
      handleApproveMentor,
      handleRejectMentor,
      handleApproveMentee,
      handleRejectMentee,
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
      activityLogs,
      activityLogsLoading,
      activityLogsPage,
      activityLogsPageSize,
      activityLogsTotal,
      activityLogsTotalPages,
      loadActivityLogs,
      postsFeed,
      postsFeedLoaded,
      postsFeedLoading,
      loadPostsFeed,
      setPostsFeed,
      postsFeedHasMore,
      postsFeedLoadingMore,
      chosenMentorId,
      announcements,
      announcementsLoading,
      announcementMessage,
      setAnnouncementMessage,
      announcementMenteeOptions,
      announcementTargetType,
      setAnnouncementTargetType,
      announcementRecipientIds,
      setAnnouncementRecipientIds,
      postAnnouncementLoading,
      loadAnnouncements,
      postAnnouncement,
      handleDeleteAnnouncement,
      commentsByKey,
      commentKey,
      loadComments,
      addComment,
      loadMe,
      handleSignIn,
      handleSignUp,
      handleLogout,
      theme,
      toggleTheme,
      isAuthenticated,
      isPendingApproval,
      showSignInPrompt,
      menteeRecUpdating,
      addToast,
      setUnsavedChangesDirty,
      globalSearchResults,
      loadGlobalSearch,
      viewedMentorProfile,
      setViewedMentorProfile,
      mentorProfileHashId,
      setMentorProfileHashId,
      loadMentorProfileByUserId,
      viewedUserProfile,
      setViewedUserProfile,
      loadUserProfile,
    };

    const LayoutComponent = Layout;
    const ThemeProvider =
      window.Mui && window.Mui.ThemeProvider ? window.Mui.ThemeProvider : null;
    const muiTheme = window.DashboardApp && window.DashboardApp.theme;
    const appTree = (
      <AppContext.Provider value={contextValue}>
        <LayoutComponent />
        {leaveGuard ? (
          <div
            className="unsaved-leave-backdrop"
            onClick={cancelLeave}
            role="presentation"
          >
            <div
              className="unsaved-leave-modal modal-paper-container"
              role="dialog"
              aria-modal="true"
              aria-labelledby="unsaved-leave-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="unsaved-leave-title" className="unsaved-leave-title">
                Unsaved changes
              </h3>
              <p className="unsaved-leave-copy">
                You have changes that have not been saved. If you leave now,
                those changes will be lost.
              </p>
              <div className="unsaved-leave-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={confirmDiscardLeave}
                >
                  Discard changes
                </button>
                <button type="button" className="btn" onClick={cancelLeave}>
                  Keep editing
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={"toast toast-" + (t.type || "success")}>
              {t.message}
            </div>
          ))}
        </div>
      </AppContext.Provider>
    );
    if (ThemeProvider && muiTheme) {
      return <ThemeProvider theme={muiTheme}>{appTree}</ThemeProvider>;
    }
    return appTree;
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.AppProviders = AppProviders;
  if (typeof module !== "undefined" && module.exports)
    module.exports = { AppProviders };
})();
