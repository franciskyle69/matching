(function () {
  "use strict";
  const React = window.React;
  const { useEffect, useMemo, useState, useRef } = React;
  const MAIN_TABS =
    (window.DashboardApp && window.DashboardApp.MAIN_TABS) || [];
  const {
    getCookie,
    fetchJSON,
    setAuthToken,
    setRefreshToken,
    clearAuthTokens,
  } =
    (window.DashboardApp && window.DashboardApp.Utils) || {};
  const AppContext =
    (window.DashboardApp && window.DashboardApp.AppContext) ||
    React.createContext(null);
  const Layout = window.DashboardApp.Layout;
  const getAllowedTopicsForSubjects =
    window.DashboardApp.getAllowedTopicsForSubjects || (() => []);
  const filterTopicsForSubjects =
    window.DashboardApp.filterTopicsForSubjects ||
    ((subjects, topics) => (Array.isArray(topics) ? [...topics] : []));

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
    if (userData.role === "mentee") {
      return userData.mentee_general_info_completed ? "settings" : "complete-profile";
    }
    if (userData.role === "mentor") {
      return userData.mentor_questionnaire_completed ? "settings" : "complete-profile";
    }
    return "settings";
  }

  function isPendingApprovalMessage(message) {
    return /pending approval by coordinator/i.test(String(message || ""));
  }

  function replaceAppUrl(tab) {
    const safeTab = tab || "signin";
    window.history.replaceState(null, "", `/app/#${safeTab}`);
  }

  function AppProviders() {
    const [activeTab, setActiveTab] = useState(() => {
      const path = (window.location.pathname || "").replace(/\/+$/, "");
      if (path.endsWith("/app/signin")) return "signin";
      if (path.endsWith("/app/signup")) return "signup";
      return "home";
    });
    const [user, setUser] = useState(null);
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
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionsData, setSessionsData] = useState(null);
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
    const [signInLoading, setSignInLoading] = useState(false);
    const [signUpLoading, setSignUpLoading] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [signInForm, setSignInForm] = useState({
      identifier: "",
      password: "",
    });
    const [signUpForm, setSignUpForm] = useState({
      role: "mentor",
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      password1: "",
      password2: "",
      student_verification_document: null,
    });
    const [createSessionLoading, setCreateSessionLoading] = useState(false);
    const [createForm, setCreateForm] = useState({
      mentee_id: "",
      subject_id: "",
      topic_id: "",
      scheduled_at: "",
      duration_minutes: 60,
      notes: "",
    });
    const [sessionsPairMenteeId, setSessionsPairMenteeId] = useState(null);
    const [rescheduleId, setRescheduleId] = useState(null);
    const [rescheduleForm, setRescheduleForm] = useState({
      subject_id: "",
      topic_id: "",
      scheduled_at: "",
      duration_minutes: 60,
      notes: "",
    });
    const [subjectsLoading, setSubjectsLoading] = useState(false);
    const [subjectsData, setSubjectsData] = useState([]);
    const [subjectsLoaded, setSubjectsLoaded] = useState(false);
    const [subjectForm, setSubjectForm] = useState({
      name: "",
      description: "",
    });
    const [subjectEditId, setSubjectEditId] = useState(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [approvalsLoading, setApprovalsLoading] = useState(false);
    const [approvalActionKey, setApprovalActionKey] = useState(null);
    const [pendingMentors, setPendingMentors] = useState([]);
    const [pendingMentees, setPendingMentees] = useState([]);
    const [notificationsVisited, setNotificationsVisited] = useState(false);
    const [showMenteeInfoModal, setShowMenteeInfoModal] = useState(false);
    const [showMentorInfoModal, setShowMentorInfoModal] = useState(false);
    const [mentorProfile, setMentorProfile] = useState({
      subjects: [],
      topics: [],
      expertise_level: null,
      role: "",
      capacity: 3,
      gender: "",
      availability: [],
    });
    const [mentorProfileSaving, setMentorProfileSaving] = useState(false);
    const [menteeMatching, setMenteeMatching] = useState({
      subjects: [],
      topics: [],
      difficulty_level: null,
      availability: [],
    });
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
    const [theme, setThemeState] = useState(() => {
      if (typeof window === "undefined") return "light";
      const stored = window.localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    });

    function toggleTheme() {
      setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
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

    function clearLockoutCountdown() {
      if (lockoutCountdownRef.current) {
        clearInterval(lockoutCountdownRef.current);
        lockoutCountdownRef.current = null;
      }
    }

    useEffect(() => {
      const effectiveTheme = user && theme === "dark" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", effectiveTheme);
      if (user) window.localStorage.setItem("theme", theme);
    }, [theme, user]);

    useEffect(() => {
      fetchJSON("/api/csrf/");
      loadMe({ force: false });
    }, []);

    useEffect(() => {
      const onPageShow = (event) => {
        const stale = Date.now() - meLastFetchTsRef.current > ME_MIN_FETCH_INTERVAL_MS;
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
      if (raw.startsWith("sessions")) {
        setActiveTab("sessions");
        const m = raw.match(/sessions\/mentee\/(\d+)/);
        setSessionsPairMenteeId(m ? parseInt(m[1], 10) : null);
      } else if (raw.startsWith("profile/mentor")) {
        setActiveTab("profile");
        const m = raw.match(/profile\/mentor\/(\d+)/);
        setMentorProfileHashId(m ? parseInt(m[1], 10) : null);
      } else if (MAIN_TABS.some((tab) => tab.id === raw)) {
        setActiveTab(raw);
      } else if (isSignInPathFlow()) {
        setActiveTab("signin");
      }
    }, []);

    useEffect(() => {
      if (!authCheckDone) return;
      const hash = window.location.hash.replace("#", "");
      const validTabs = [
        ...MAIN_TABS.map((t) => t.id),
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
      } else if (hash.startsWith("sessions")) {
        setActiveTab("sessions");
        const m = hash.match(/sessions\/mentee\/(\d+)/);
        setSessionsPairMenteeId(m ? parseInt(m[1], 10) : null);
      } else if (hash.startsWith("profile/mentor")) {
        setActiveTab("profile");
        const m = hash.match(/profile\/mentor\/(\d+)/);
        setMentorProfileHashId(m ? parseInt(m[1], 10) : null);
      } else if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    }, [authCheckDone, user]);

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
      const authPathVariant = path.endsWith("/app/signin") || path.endsWith("/app/signup");
      if (!hasOauthParams && !authPathVariant) return;

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

      if (getIsPendingApproval(user)) {
        replaceAppUrl(getPendingApprovalLandingTab(user));
        return;
      }

      const validTabIds = new Set([
        ...MAIN_TABS.map((t) => t.id),
        "complete-profile",
        "settings",
        "notifications",
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
      }
    }, [authCheckDone]);

    useEffect(() => {
      if (!authCheckDone) return;
      const params = new URLSearchParams(window.location.search || "");
      const activated = (params.get("activated") || "").toLowerCase();
      const activationError = (params.get("activation_error") || "").toLowerCase();

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
        } else if (hash.startsWith("sessions")) {
          setActiveTab("sessions");
          const m = hash.match(/sessions\/mentee\/(\d+)/);
          setSessionsPairMenteeId(m ? parseInt(m[1], 10) : null);
        }
      };
      window.addEventListener("hashchange", onHashChange);
      return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
      if (!authCheckDone) return;
      if (activeTab === "sessions") {
        window.location.hash = sessionsPairMenteeId
          ? `sessions/mentee/${sessionsPairMenteeId}`
          : "sessions";
      } else if (activeTab === "profile" && mentorProfileHashId) {
        window.location.hash = `profile/mentor/${mentorProfileHashId}`;
      } else {
        window.location.hash = activeTab;
      }
    }, [activeTab, authCheckDone, sessionsPairMenteeId, mentorProfileHashId]);

    useEffect(() => {
      if (!authCheckDone || !user) return;
      if (!getIsPendingApproval(user)) return;
      const allowedPendingTabs = new Set([
        "complete-profile",
        "settings",
      ]);
      if (!allowedPendingTabs.has(activeTab)) {
        setActiveTab(getPendingApprovalLandingTab(user));
      }
    }, [authCheckDone, user, activeTab]);

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
      if (activeTab === "sessions" && sessionsData === null) loadSessions();
      if (
        activeTab === "home" &&
        user?.role === "mentee" &&
        sessionsData === null
      )
        loadSessions();
      if (
        activeTab === "home" &&
        user?.role === "mentor" &&
        sessionsData === null
      )
        loadSessions();
      if (activeTab === "home" && user?.role === "mentor") loadMentorRequests();
      if (
        (activeTab === "home" || activeTab === "sessions") &&
        user?.role === "mentee" &&
        !myMentor
      ) {
        loadMyMentor();
      }
      if (activeTab === "announcements" && !announcementsLoaded)
        loadAnnouncements();
      if (activeTab === "matching") {
        if (prevActiveTabRef.current !== "matching") {
          if (user?.role === "mentor") loadMentorRequests();
          if (user?.role === "mentee") loadMyMentor();
        }
        prevActiveTabRef.current = "matching";
      } else {
        prevActiveTabRef.current = activeTab;
      }
      if (activeTab === "notifications") {
        loadNotifications();
        setNotificationsVisited(true);
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
      if (activeTab === "subjects" && user?.is_staff && !subjectsLoaded)
        loadSubjects();
      if (activeTab === "approvals" && user?.is_staff) loadApprovals();
    }, [
      activeTab,
      user?.role,
      user?.is_staff,
      subjectsLoaded,
      sessionsData,
      myMentor,
      mentorProfileHashId,
      viewedMentorProfile,
    ]);

    useEffect(() => {
      if (!notificationsVisited) return;
      if (activeTab === "notifications") return;
      (async () => {
        await fetchJSON("/api/notifications/mark-all-read/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
        });
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setNotificationsVisited(false);
      })();
    }, [activeTab, notificationsVisited]);

    useEffect(() => {
      if (!user) return;
      const onFocus = () => {
        if (document.visibilityState !== "visible") return;
        const stale = Date.now() - meLastFetchTsRef.current > ME_MIN_FETCH_INTERVAL_MS;
        if (stale) loadMe({ force: false });
      };
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }, [user]);

    async function loadMe(options = {}) {
      const force = !!options.force;
      if (!force && user && Date.now() - meLastFetchTsRef.current < ME_MIN_FETCH_INTERVAL_MS) {
        return;
      }
      if (meInFlightRef.current) {
        return meInFlightRef.current;
      }

      const requestPromise = fetchJSON(force ? "/api/me/?force=1" : "/api/me/");
      meInFlightRef.current = requestPromise;
      const result = await requestPromise;
      meInFlightRef.current = null;
      setAuthCheckDone(true);
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) {
          clearAuthTokens();
        }
        setAuthRequired(true);
        setSessionsData(null);
        setActiveTab((prev) => (prev === "signup" ? "signup" : "signin"));
        return;
      }
      meLastFetchTsRef.current = Date.now();
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
          program: info.program || "",
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
        const mentorTopics = filterTopicsForSubjects(
          mentorSubjects,
          info.topics,
        );
        setMentorProfile({
          subjects: mentorSubjects,
          topics: mentorTopics,
          expertise_level:
            info.expertise_level != null ? info.expertise_level : null,
          role: info.role || "",
          capacity:
            info.capacity != null
              ? Math.max(1, Math.min(5, Number(info.capacity)))
              : 3,
          gender: info.gender || "",
          availability: Array.isArray(info.availability)
            ? [...info.availability]
            : [],
        });
      }
      if (result.data.mentee_matching) {
        const mm = result.data.mentee_matching || {};
        const menteeSubjects = Array.isArray(mm.subjects)
          ? [...mm.subjects]
          : [];
        const menteeTopics = filterTopicsForSubjects(menteeSubjects, mm.topics);
        setMenteeMatching({
          subjects: menteeSubjects,
          topics: menteeTopics,
          difficulty_level:
            mm.difficulty_level != null ? mm.difficulty_level : null,
          availability: Array.isArray(mm.availability)
            ? [...mm.availability]
            : [],
        });
      }
      const isMentee = result.data.role === "mentee";
      const isMentor = result.data.role === "mentor";
      const generalCompleted = !!result.data.mentee_general_info_completed;
      const mentorQCompleted = !!result.data.mentor_questionnaire_completed;
      setShowMenteeInfoModal(!unapproved && isMentee && !generalCompleted);
      setShowMentorInfoModal(!unapproved && isMentor && !mentorQCompleted);
      setAuthRequired(false);
      if (unapproved) {
        setAuthAlert({
          severity: "warning",
          title: "Account pending approval",
          message: "Review or complete your information below, then wait for coordinator approval.",
        });
        setActiveTab(getPendingApprovalLandingTab(result.data));
        return;
      }
      setActiveTab((prev) =>
        ["signin", "signup"].includes(prev)
          ? "home"
          : prev,
      );
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

    async function loadMyMentor() {
      if (!user || user.role !== "mentee") return;
      const result = await fetchJSON("/api/matching/my-mentor/");
      if (result.ok) setMyMentor(result.data.mentor || null);
      else setMyMentor(null);
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
      addToast("Mentee accepted. Opening their sessions page.");
      loadMentorRequests();
      loadSessions();
      setSessionsPairMenteeId(menteeId);
      setActiveTab("sessions");
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
        if (window.Swal && typeof window.Swal.fire === "function")
          window.Swal.fire("Unable to connect mentor", message, "error");
        return { ok: false, code: result.data?.code || null, error: message };
      }
      const successMessage = "Mentor matched successfully. You can now schedule sessions.";
      setAuthMessage(successMessage);
      if (window.Swal && typeof window.Swal.fire === "function")
        window.Swal.fire("Mentor matched", successMessage, "success");
      setChosenMentorId(mentorId);
      await loadMyMentor();
      await loadSessions();
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
        const result = await fetchJSON("/api/auth/login/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify(signInForm),
        });

        // Handle login attempt limit (429 Too Many Requests)
        if (result.status === 429) {
          const lockoutData = result.data || {};
          const attemptsCount = lockoutData.attempts || 0;
          const failureLimit = lockoutData.failure_limit || 5;
          const remainingMinutes = lockoutData.remaining_minutes || 1;
          const penaltyMinutes = lockoutData.penalty_minutes || remainingMinutes;

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

        if (!result.ok) {
          const errorMsg = result.data?.error || "Unable to sign in.";
          setError(errorMsg);

          // Show warning for regular failed attempts (before lockout)
      if (result.data?.must_change_password) {
        window.location.replace("/accounts/settings/?must_change_password=1");
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
        if (result.data?.access_token) {
          setAuthToken(result.data.access_token);
        }
        if (result.data?.refresh_token) {
          setRefreshToken(result.data.refresh_token);
        }
        await loadMe({ force: true });
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
        const formData = new FormData();
        formData.append("role", signUpForm.role || "");
        formData.append("first_name", signUpForm.first_name || "");
        formData.append("middle_name", signUpForm.middle_name || "");
        formData.append("last_name", signUpForm.last_name || "");
        formData.append("email", signUpForm.email || "");
        formData.append("password1", signUpForm.password1 || "");
        formData.append("password2", signUpForm.password2 || "");
        if (signUpForm.student_verification_document) {
          formData.append(
            "student_verification_document",
            signUpForm.student_verification_document,
          );
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
          if (window.Swal && typeof window.Swal.fire === "function")
            window.Swal.fire("Action failed", message, "error");
          return;
        }
        const message = result.data?.message || "Account created.";
        setAuthMessage(message);
        setSignUpForm({
          role: "mentor",
          first_name: "",
          middle_name: "",
          last_name: "",
          email: "",
          password1: "",
          password2: "",
          student_verification_document: null,
        });
        setActiveTab("signin");
      } finally {
        setSignUpLoading(false);
      }
    }

    async function handleLogout() {
      if (logoutLoading) return;
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
        clearAuthTokens();
        replaceAppUrl("signin");
        window.location.replace("/");
      }
    }

    async function loadSessions() {
      setSessionsLoading(true);
      const result = await fetchJSON("/api/sessions/");
      if (result.ok) setSessionsData(result.data);
      else {
        setError(result.data?.error || "Unable to load sessions.");
        setSessionsData({
          upcoming: [],
          history: [],
          options: { mentees: [], subjects: [], topics: [] },
          is_mentor: false,
        });
      }
      setSessionsLoading(false);
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

    async function loadSubjects() {
      setSubjectsLoading(true);
      const result = await fetchJSON("/api/subjects/");
      if (result.ok) {
        setSubjectsData(result.data.items || []);
        setSubjectsLoaded(true);
      } else {
        setError(result.data?.error || "Unable to load subjects.");
        setSubjectsData([]);
        setSubjectsLoaded(true);
      }
      setSubjectsLoading(false);
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

    async function handleUpdateSubject() {
      if (!subjectEditId) return;
      setError("");
      const result = await fetchJSON(`/api/subjects/${subjectEditId}/update/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify(subjectForm),
      });
      if (!result.ok) {
        const errs = result.data?.errors;
        setError(
          errs && typeof errs === "object"
            ? Object.values(errs).flat().filter(Boolean).join(" ")
            : result.data?.error || "Unable to update subject.",
        );
        return;
      }
      setSubjectEditId(null);
      setSubjectForm({ name: "", description: "" });
      loadSubjects();
    }

    async function handleCreateSession(menteeIdOverride) {
      setError("");
      setCreateSessionLoading(true);
      try {
        const payload = {
          ...createForm,
          mentee_id:
            menteeIdOverride != null ? menteeIdOverride : createForm.mentee_id,
          duration_minutes: Number(createForm.duration_minutes || 60),
        };
        const result = await fetchJSON("/api/sessions/create/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify(payload),
        });
        if (!result.ok) {
          setError(result.data?.error || "Unable to schedule session.");
          return;
        }
        setCreateForm({
          mentee_id: "",
          subject_id: "",
          topic_id: "",
          scheduled_at: "",
          duration_minutes: 60,
          notes: "",
        });
        addToast("Session scheduled.");
        await loadSessions();
      } finally {
        setCreateSessionLoading(false);
      }
    }

    async function handleReschedule(sessionId) {
      setError("");
      const payload = {
        ...rescheduleForm,
        duration_minutes: Number(rescheduleForm.duration_minutes || 60),
      };
      const result = await fetchJSON(`/api/sessions/${sessionId}/reschedule/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        setError(result.data?.error || "Unable to reschedule.");
        return;
      }
      setRescheduleId(null);
      addToast("Session rescheduled.");
      loadSessions();
    }

    async function handleStatusUpdate(sessionId, status) {
      setError("");
      const result = await fetchJSON(`/api/sessions/${sessionId}/status/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
        body: JSON.stringify({ status }),
      });
      if (!result.ok) {
        setError(result.data?.error || "Unable to update status.");
        return;
      }
      addToast("Session updated.");
      loadSessions();
    }

    async function handleUpdateMeetingNotes(sessionId, meetingNotes) {
      setError("");
      const result = await fetchJSON(
        `/api/sessions/${sessionId}/meeting-notes/`,
        {
          method: "POST",
          headers: {
            "X-CSRFToken": getCookie("csrftoken"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ meeting_notes: meetingNotes || "" }),
        },
      );
      if (!result.ok) {
        setError(result.data?.error || "Unable to save meeting notes.");
        return;
      }
      addToast("Meeting notes saved.");
      loadSessions();
    }

    async function handleMarkAllRead() {
      await fetchJSON("/api/notifications/mark-all-read/", {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      loadNotifications();
      setUnreadCount(0);
    }

    async function handleMarkRead(notificationId) {
      await fetchJSON(`/api/notifications/${notificationId}/read/`, {
        method: "POST",
        headers: { "X-CSRFToken": getCookie("csrftoken") },
      });
      loadNotifications();
      setUnreadCount((prev) => Math.max(0, prev - 1));
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
        return;
      }
      addToast("Settings saved.");
      await loadMe({ force: true });
      setSettingsSaving(false);
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
      if (!user || user.role !== "mentee") return;
      setError("");
      const requiredFields = [
        "program",
        "campus",
        "student_id_no",
        "contact_no",
        "admission_type",
        "sex",
      ];
      const missing = requiredFields.filter(
        (field) => !String(menteeProfile[field] || "").trim(),
      );
      const yearOk = Number(menteeProfile.year_level) > 0;
      if (missing.length > 0 || !yearOk) {
        const message =
          "Please complete all general information fields before saving.";
        setError(message);
        if (window.Swal && typeof window.Swal.fire === "function")
          window.Swal.fire("Fill in required fields", message, "warning");
        return;
      }
      setMenteeProfileSaving(true);
      const payload = {
        program: menteeProfile.program,
        year_level: menteeProfile.year_level,
        campus: menteeProfile.campus,
        student_id_no: menteeProfile.student_id_no,
        contact_no: menteeProfile.contact_no,
        admission_type: menteeProfile.admission_type,
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
        return;
      }
      setMenteeProfile((prev) => ({ ...prev, ...result.data }));
      setUser((prev) =>
        prev ? { ...prev, mentee_general_info_completed: true } : prev,
      );
      addToast("Profile saved.");
      setShowMenteeInfoModal(false);
      setAuthMessage("Your general information was updated.");
      setMenteeProfileSaving(false);
    }

    async function handleMentorProfileSave() {
      if (!user || user.role !== "mentor") return;
      const profile = mentorProfile;
      const sanitizedSubjects = Array.isArray(profile.subjects)
        ? [...profile.subjects]
        : [];
      const sanitizedTopics = filterTopicsForSubjects(
        sanitizedSubjects,
        profile.topics,
      );
      setError("");
      const hasPrefs =
        sanitizedSubjects.length > 0 ||
        sanitizedTopics.length > 0 ||
        (profile.expertise_level != null &&
          profile.expertise_level >= 1 &&
          profile.expertise_level <= 5) ||
        !!profile.gender ||
        (Array.isArray(profile.availability) &&
          profile.availability.length > 0);
      if (!hasPrefs) {
        const message =
          "Please set at least one matching preference (subjects, topics, expertise, gender, or availability).";
        setError(message);
        if (window.Swal && typeof window.Swal.fire === "function")
          window.Swal.fire("Complete required fields", message, "warning");
        return false;
      }
      setMentorProfileSaving(true);
      try {
        const payload = {
          subjects: sanitizedSubjects,
          topics: sanitizedTopics,
          expertise_level: profile.expertise_level,
          role: profile.role || "",
          capacity: Math.max(1, Math.min(5, Number(profile.capacity || 1))),
          gender: profile.gender || "",
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
        setMentorProfile((prev) => ({ ...prev, ...result.data }));
        await loadMe({ force: true });
        // Invalidate any existing staff/mentor matching results to avoid stale pairs
        setMatchingResults([]);
        setLastRunMode(null);
        setLastRunMinScore(null);
        setUser((prev) =>
          prev ? { ...prev, mentor_questionnaire_completed: true } : prev,
        );
        setShowMentorInfoModal(false);
        setAuthMessage("Your mentor profile was updated.");
        addToast("Profile saved.");
        return true;
      } finally {
        setMentorProfileSaving(false);
      }
    }

    async function handleMenteeMatchingSave() {
      if (!user || user.role !== "mentee") return;
      const matching = menteeMatching;
      const sanitizedSubjects = Array.isArray(matching.subjects)
        ? [...matching.subjects]
        : [];
      const sanitizedTopics = filterTopicsForSubjects(
        sanitizedSubjects,
        matching.topics,
      );
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
        if (window.Swal && typeof window.Swal.fire === "function")
          window.Swal.fire("Complete required fields", message, "warning");
        return false;
      }
      setMenteeMatchingSaving(true);
      try {
        const payload = {
          subjects: sanitizedSubjects,
          topics: sanitizedTopics,
          difficulty_level: matching.difficulty_level,
          availability: matching.availability || [],
        };
        const result = await fetchJSON("/api/me/mentee-matching/", {
          method: "POST",
          headers: { "X-CSRFToken": getCookie("csrftoken") },
          body: JSON.stringify(payload),
        });
        if (!result.ok) {
          setError(
            result.data?.error || "Unable to update mentee questionnaire.",
          );
          return false;
        }
        setMenteeMatching((prev) => ({ ...prev, ...result.data }));
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
        setAuthMessage("Your mentee questionnaire was updated.");
        addToast("Questionnaire saved.");
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
        if (window.Swal && typeof window.Swal.fire === "function")
          window.Swal.fire("Image too large", msg, "warning");
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
          if (window.Swal && typeof window.Swal.fire === "function")
            window.Swal.fire("Upload failed", msg, "error");
          return;
        }
        const newUrl = data.avatar_url || "";
        setUser((prev) => (prev ? { ...prev, avatar_url: newUrl } : prev));
        setSettingsForm((prev) => ({ ...prev, avatar_url: newUrl }));
      } catch (err) {
        const msg = "Network error while uploading profile picture.";
        setError(msg);
        if (window.Swal && typeof window.Swal.fire === "function")
          window.Swal.fire("Network error", msg, "error");
      } finally {
        setAvatarUploading(false);
        event.target.value = "";
      }
    }

    const options = sessionsData?.options || {
      mentees: [],
      subjects: [],
      topics: [],
    };
    const topicsBySubject = useMemo(() => {
      const map = {};
      (options.topics || []).forEach((topic) => {
        if (!map[topic.subject_id]) map[topic.subject_id] = [];
        map[topic.subject_id].push(topic);
      });
      return map;
    }, [options.topics]);

    const isAuthenticated = !authRequired && user;
    const isPendingApproval = getIsPendingApproval(user);
    const showSignInPrompt = !authCheckDone
      ? false
      : !isAuthenticated && !["signin", "signup"].includes(activeTab);

    useEffect(() => {
      const unapproved =
        user && getIsPendingApproval(user);
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
      if (!(window.Swal && typeof window.Swal.fire === "function")) return;
      window.Swal.fire("Success", authMessage, "success");
    }, [authMessage]);

    useEffect(() => {
      if (!error) return;
      if (isPendingApprovalMessage(error)) return;
      if (["signin", "signup"].includes(activeTab)) return;
      if (!(window.Swal && typeof window.Swal.fire === "function")) return;
      window.Swal.fire("Action failed", error, "error");
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
      activeTab,
      setActiveTab,
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
      sessionsLoading,
      sessionsData,
      loadSessions,
      createForm,
      setCreateForm,
      createSessionLoading,
      rescheduleId,
      setRescheduleId,
      rescheduleForm,
      setRescheduleForm,
      handleCreateSession,
      handleReschedule,
      handleStatusUpdate,
      handleUpdateMeetingNotes,
      options,
      topicsBySubject,
      sessionsPairMenteeId,
      setSessionsPairMenteeId,
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
      subjectsLoading,
      subjectsData,
      subjectForm,
      setSubjectForm,
      subjectEditId,
      setSubjectEditId,
      handleUpdateSubject,
      loadSubjects,
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
    return (
      <AppContext.Provider value={contextValue}>
        <LayoutComponent />
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={"toast toast-" + (t.type || "success")}>
              {t.message}
            </div>
          ))}
        </div>
      </AppContext.Provider>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.AppProviders = AppProviders;
  if (typeof module !== "undefined" && module.exports)
    module.exports = { AppProviders };
})();
