import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Chip,
  Divider,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SaveIcon from "@mui/icons-material/Save";
import TuneIcon from "@mui/icons-material/Tune";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import SubjectSkillPreferences, {
  MAX_SUBJECTS,
  MAX_TOPICS_PER_SUBJECT,
  MAX_COMPETENCIES_PER_SUBJECT,
  MAX_COMPETENCIES_PER_TOPIC,
  MAX_COMPETENCIES_TOTAL,
  CANONICAL_CURRICULUM,
  NEU_STYLES,
  getRoleLimits,
  getNeuStyles,
} from "../../components/SubjectSkillPreferences.jsx";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(";").shift();
  }
  return "";
}

export default function MenteePreferencesPage({ defaultRole = "MENTEE" }) {
  const AppContext = window.DashboardApp?.AppContext;
  const ctx = AppContext ? useContext(AppContext) : null;
  const currentUser = ctx?.user;

  // Derive initial role
  const isBoth = currentUser?.role === "both" || (Boolean(currentUser?.mentor_profile) && Boolean(currentUser?.mentee_profile));
  const resolvedRole = (currentUser?.role || defaultRole).toUpperCase();
  const normalizedRole = resolvedRole.includes("MENTOR")
    ? (resolvedRole.includes("INSTRUCTOR") ? "INSTRUCTOR_MENTOR" : "STUDENT_MENTOR")
    : (resolvedRole === "BOTH" ? "STUDENT_MENTOR" : "MENTEE");

  const [role, setRole] = useState(normalizedRole);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const neu = useMemo(() => getNeuStyles(theme), [theme?.palette?.mode]);
  const isDark = theme?.palette?.mode === "dark";

  // Hierarchical preferences state
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState([]);
  const [supportNeed, setSupportNeed] = useState(3);
  const [availability, setAvailability] = useState([]);

  // Toast notification state
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const DRAFT_KEY = `peerlink.survey_draft_${currentUser?.id || "guest"}_${role}`;
  const [draftAvailable, setDraftAvailable] = useState(false);
  const isInitialLoadRef = useRef(true);

  const roleLimits = getRoleLimits(role);

  const isBoundsExceeded = useMemo(() => {
    if (selectedSubjects.length > (roleLimits.maxSubjects || MAX_SUBJECTS)) return true;
    if (selectedCompetencies.length > (roleLimits.maxGlobalCompetencies || MAX_COMPETENCIES_TOTAL)) return true;

    for (const subjCode of selectedSubjects) {
      const subjObj = CANONICAL_CURRICULUM.find((s) => s.code === subjCode);
      if (subjObj && Array.isArray(subjObj.topics)) {
        const topicsInSubj = subjObj.topics.map((t) => t.name);
        const selectedTopicsInSubj = selectedTopics.filter((t) => topicsInSubj.includes(t));
        const maxTopics = roleLimits.maxTopicsPerSubject || MAX_TOPICS_PER_SUBJECT;
        if (selectedTopicsInSubj.length > maxTopics) return true;

        for (const topicObj of subjObj.topics) {
          const compNames = typeof topicObj.competencies[0] === "string"
            ? topicObj.competencies
            : topicObj.competencies.map((c) => c.name);
          const selectedInTopic = selectedCompetencies.filter((c) => compNames.includes(c));
          const maxCompsPerTopic = roleLimits.maxCompetenciesPerTopic || MAX_COMPETENCIES_PER_TOPIC;
          if (selectedInTopic.length > maxCompsPerTopic) return true;
        }

        const allCompsInSubj = subjObj.topics.flatMap((t) =>
          typeof t.competencies[0] === "string" ? t.competencies : t.competencies.map((c) => c.name)
        );
        const selectedCompsInSubj = selectedCompetencies.filter((c) => allCompsInSubj.includes(c));
        const maxComps = roleLimits.maxCompetenciesPerSubject || MAX_COMPETENCIES_PER_SUBJECT;
        if (selectedCompsInSubj.length > maxComps) return true;
      }
    }
    return false;
  }, [selectedSubjects, selectedTopics, selectedCompetencies, roleLimits]);

  // Fetch saved preferences on mount via GET /api/user/preferences/
  const fetchPreferences = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/preferences/", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Failed to load preferences (${res.status})`);
      }
      const data = await res.json();
      if (data.role) {
        const serverRole = data.role.toUpperCase();
        setRole(serverRole.includes("MENTOR") ? (serverRole.includes("INSTRUCTOR") ? "INSTRUCTOR_MENTOR" : "STUDENT_MENTOR") : "MENTEE");
      }
      setSelectedSubjects(data.subjects || []);
      setSelectedTopics(data.topics || []);
      setSelectedCompetencies(data.competencies || []);
      if (data.support_need !== undefined) setSupportNeed(data.support_need);
      if (Array.isArray(data.availability)) setAvailability(data.availability);

      // Check if an unsubmitted localStorage draft exists
      try {
        const draftRaw = window.localStorage.getItem(DRAFT_KEY);
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          if (draft && (draft.selectedSubjects?.length || draft.selectedTopics?.length || draft.selectedCompetencies?.length || draft.availability?.length)) {
            setDraftAvailable(true);
          }
        }
      } catch {}
    } catch (err) {
      console.error("Error fetching preferences:", err);
      setError(err.message || "Failed to load preferences.");
    } finally {
      setLoading(false);
      isInitialLoadRef.current = false;
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  // Debounced auto-save of current questionnaire answers to localStorage
  useEffect(() => {
    if (loading || isInitialLoadRef.current) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
          selectedSubjects,
          selectedTopics,
          selectedCompetencies,
          supportNeed,
          availability,
          savedAt: Date.now(),
        }));
      } catch {}
    }, 750);
    return () => clearTimeout(timer);
  }, [selectedSubjects, selectedTopics, selectedCompetencies, supportNeed, availability, loading, DRAFT_KEY]);

  const handleApplyDraft = () => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (Array.isArray(draft.selectedSubjects)) setSelectedSubjects(draft.selectedSubjects);
        if (Array.isArray(draft.selectedTopics)) setSelectedTopics(draft.selectedTopics);
        if (Array.isArray(draft.selectedCompetencies)) setSelectedCompetencies(draft.selectedCompetencies);
        if (draft.supportNeed !== undefined) setSupportNeed(draft.supportNeed);
        if (Array.isArray(draft.availability)) setAvailability(draft.availability);
      }
      setDraftAvailable(false);
      if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
        window.DashboardApp.notify("info", "Draft Restored", "Your previously saved survey draft has been restored.");
      }
    } catch {}
  };

  const handleDiscardDraft = () => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setDraftAvailable(false);
  };

  // Save updates via PUT /api/user/preferences/ with explicit Save Preferences button
  const handleSavePreferences = async () => {
    setSaving(true);
    setError("");

    // Validate min limits
    if (selectedSubjects.length < roleLimits.minSubjects) {
      const msg = `Please select at least ${roleLimits.minSubjects} subject.`;
      setError(msg);
      if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
        window.DashboardApp.notify("warning", "Incomplete Preferences", msg);
      }
      setSaving(false);
      return;
    }
    if (selectedSubjects.length > roleLimits.maxSubjects) {
      const msg = `You can select a maximum of ${roleLimits.maxSubjects} subjects.`;
      setError(msg);
      if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
        window.DashboardApp.notify("warning", "Limit Exceeded", msg);
      }
      setSaving(false);
      return;
    }

    // Validate per-subject topics & competencies
    for (const subjCode of selectedSubjects) {
      const subjObj = CANONICAL_CURRICULUM.find((s) => s.code === subjCode || s.name === subjCode);
      if (subjObj) {
        const topicsInSubj = subjObj.topics.map((t) => t.name);
        const selectedTopicsInSubj = selectedTopics.filter((t) => topicsInSubj.includes(t));
        const maxTopics = roleLimits.maxTopicsPerSubject || MAX_TOPICS_PER_SUBJECT;
        if (selectedTopicsInSubj.length > maxTopics) {
          const msg = `You can select a maximum of ${maxTopics} topics for subject '${subjCode}'.`;
          setError(msg);
          if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
            window.DashboardApp.notify("warning", "Limit Exceeded", msg);
          }
          setSaving(false);
          return;
        }

        for (const topicObj of subjObj.topics) {
          const compNames = typeof topicObj.competencies[0] === "string"
            ? topicObj.competencies
            : topicObj.competencies.map((c) => c.name);
          const selectedInTopic = selectedCompetencies.filter((c) => compNames.includes(c));
          const maxCompsPerTopic = roleLimits.maxCompetenciesPerTopic || MAX_COMPETENCIES_PER_TOPIC;
          if (selectedInTopic.length > maxCompsPerTopic) {
            const msg = `You can select a maximum of ${maxCompsPerTopic} competencies for topic '${topicObj.name}'.`;
            setError(msg);
            if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
              window.DashboardApp.notify("warning", "Limit Exceeded", msg);
            }
            setSaving(false);
            return;
          }
        }

        const allCompsInSubj = subjObj.topics.flatMap((t) =>
          typeof t.competencies[0] === "string" ? t.competencies : t.competencies.map((c) => c.name)
        );
        const selectedCompsInSubj = selectedCompetencies.filter((c) => allCompsInSubj.includes(c));
        const maxComps = roleLimits.maxCompetenciesPerSubject || MAX_COMPETENCIES_PER_SUBJECT;
        if (selectedCompsInSubj.length > maxComps) {
          const msg = `You can select a maximum of ${maxComps} competencies for subject '${subjCode}'.`;
          setError(msg);
          if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
            window.DashboardApp.notify("warning", "Limit Exceeded", msg);
          }
          setSaving(false);
          return;
        }
      }
    }

    if (selectedCompetencies.length < roleLimits.minGlobalCompetencies) {
      const msg = `Please select at least ${roleLimits.minGlobalCompetencies} competency.`;
      setError(msg);
      if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
        window.DashboardApp.notify("warning", "Incomplete Preferences", msg);
      }
      setSaving(false);
      return;
    }

    const maxGlobalComps = roleLimits.maxGlobalCompetencies || MAX_COMPETENCIES_TOTAL;
    if (selectedCompetencies.length > maxGlobalComps) {
      const msg = `You can select a maximum of ${maxGlobalComps} competencies total.`;
      setError(msg);
      if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
        window.DashboardApp.notify("warning", "Limit Exceeded", msg);
      }
      setSaving(false);
      return;
    }

    try {
      const payload = {
        role: role,
        subjects: selectedSubjects,
        topics: selectedTopics,
        competencies: selectedCompetencies,
        skills: selectedCompetencies,
        support_need: supportNeed,
        availability: availability,
        availability_slots: availability,
      };

      const csrf = getCookie("csrftoken");
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (csrf) headers["X-CSRFToken"] = csrf;

      const res = await fetch("/api/user/preferences/", {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.detail || "Failed to update preferences.");
      }

      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setDraftAvailable(false);

      setToast({
        open: true,
        message: "Preferences saved successfully!",
        severity: "success",
      });
      if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
        window.DashboardApp.notify("success", "Preferences Saved", "Your matching preferences were updated successfully.");
      }
    } catch (err) {
      console.error("Error saving preferences:", err);
      const errMsg = err.message || "Failed to save preferences.";
      setError(errMsg);
      setToast({
        open: true,
        message: errMsg,
        severity: "error",
      });
      if (window.DashboardApp && typeof window.DashboardApp.notify === "function") {
        window.DashboardApp.notify("error", "Save Failed", errMsg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background?.default || neu.bgBase,
        color: theme.palette.text?.primary || neu.textPrimary,
        minHeight: "100vh",
        py: { xs: 3, md: 5 },
        px: { xs: 2, sm: 3 },
        transition: "background-color 0.3s ease, color 0.3s ease",
      }}
    >
      <Container maxWidth="lg">
        {draftAvailable && (
          <Paper
            sx={{
              ...neu.elevatedCard,
              p: 2,
              mb: 3,
              borderRadius: 3,
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: 2,
              border: `1.5px solid ${neu.accentBlue}`,
              backgroundColor: isDark ? "rgba(37, 99, 235, 0.12)" : "rgba(25, 118, 210, 0.08)",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TuneIcon sx={{ color: neu.accentBlue }} />
              <Box>
                <Typography variant="subtitle2" fontWeight={700} color={neu.titleColor}>
                  Unsaved Survey Draft Detected
                </Typography>
                <Typography variant="caption" color={theme.palette.text?.secondary || neu.textSecondary}>
                  You have draft selections saved from your previous session.
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleApplyDraft}
                sx={{
                  borderRadius: "14px",
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  px: 2,
                  backgroundColor: neu.accentBlue,
                }}
              >
                Resume Draft
              </Button>
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={handleDiscardDraft}
                sx={{
                  borderRadius: "14px",
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  px: 1.5,
                  opacity: 0.75,
                }}
              >
                Discard
              </Button>
            </Stack>
          </Paper>
        )}
        {/* Header Bar */}
        <Paper
          sx={{
            ...neu.elevatedCard,
            p: { xs: 2.5, sm: 3.5 },
            mb: 4,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
            gap: 2,
          }}
        >
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
              <TuneIcon sx={{ color: neu.accentBlue, fontSize: 28 }} />
              <Typography variant="h5" fontWeight={800} color={neu.titleColor}>
                {roleLimits.label} Matching Preferences
              </Typography>
              <Box sx={{ ...neu.counterPill, px: 1.5, py: 0.3 }}>
                <Typography variant="caption" fontWeight={700} color={neu.accentBlue}>
                  {roleLimits.label}
                </Typography>
              </Box>
            </Stack>
            <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary}>
              Configure your subjects, topics, and competencies to optimize recommendation scoring.
            </Typography>
            {isBoth && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <Chip
                  label="Peer Mentor Preferences"
                  clickable
                  color={role.includes("MENTOR") ? "primary" : "default"}
                  onClick={() => setRole("STUDENT_MENTOR")}
                  variant={role.includes("MENTOR") ? "filled" : "outlined"}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
                <Chip
                  label="Mentee Preferences"
                  clickable
                  color={role === "MENTEE" ? "primary" : "default"}
                  onClick={() => setRole("MENTEE")}
                  variant={role === "MENTEE" ? "filled" : "outlined"}
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            )}
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              onClick={fetchPreferences}
              disabled={loading || saving}
              startIcon={<RefreshIcon />}
              sx={{
                borderRadius: "20px",
                borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "#90A4AE",
                color: isDark ? "#94A3B8" : "#455A64",
                textTransform: "none",
                fontWeight: 600,
                boxShadow: isDark
                  ? "2px 2px 5px #090e18, -2px -2px 5px #1f2c40"
                  : "2px 2px 5px #c5d0e0, -2px -2px 5px #ffffff",
                backgroundColor: isDark ? "#151D2A" : "#e6ecf5",
                "&:hover": {
                  borderColor: neu.accentBlue,
                  background: isDark ? "rgba(96, 165, 250, 0.08)" : "rgba(25, 118, 210, 0.04)",
                },
              }}
            >
              Reset
            </Button>

            <Button
              variant="contained"
              onClick={handleSavePreferences}
              disabled={loading || saving || isBoundsExceeded}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              sx={{
                px: 3.5,
                py: 1,
                borderRadius: "20px",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.95rem",
                background: isDark
                  ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
                  : "linear-gradient(135deg, #1976D2, #0D47A1)",
                boxShadow: isDark
                  ? "4px 4px 10px #090e18, -4px -4px 10px #1f2c40"
                  : "4px 4px 10px #c5d0e0, -4px -4px 10px #ffffff",
                color: "#ffffff",
                "&:hover": {
                  background: isDark
                    ? "linear-gradient(135deg, #3B82F6, #1E40AF)"
                    : "linear-gradient(135deg, #1565C0, #0A387E)",
                  boxShadow: isDark
                    ? "2px 2px 6px #090e18, -2px -2px 6px #1f2c40"
                    : "2px 2px 6px #c5d0e0, -2px -2px 6px #ffffff",
                },
              }}
            >
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </Stack>
        </Paper>

        {error && (
          <Alert
            severity="error"
            onClose={() => setError("")}
            sx={{
              mb: 3,
              borderRadius: "12px",
              ...neu.sunkenPanel,
              color: isDark ? "#FCA5A5" : undefined,
              "& .MuiAlert-icon": {
                color: isDark ? "#F87171" : undefined,
              },
            }}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress sx={{ color: neu.accentBlue }} />
          </Box>
        ) : (
          <Stack spacing={4}>
            {/* Embedded Reusable SubjectSkillPreferences */}
            <SubjectSkillPreferences
              role={role}
              value={{
                selectedSubjects,
                selectedTopics,
                selectedCompetencies,
              }}
              onChange={({ selectedSubjects: nextSubs, selectedTopics: nextTops, selectedCompetencies: nextComps }) => {
                setSelectedSubjects(nextSubs);
                setSelectedTopics(nextTops);
                setSelectedCompetencies(nextComps);
              }}
              readOnly={saving}
            />

            {/* Bottom Save Action Bar */}
            <Paper
              sx={{
                ...neu.elevatedCard,
                p: 3,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary}>
                Remember to click <strong>Save Preferences</strong> to commit your subject and competency adjustments.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleSavePreferences}
                disabled={loading || saving || isBoundsExceeded}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                sx={{
                  px: 4,
                  py: 1.2,
                  borderRadius: "24px",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  background: isDark
                    ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
                    : "linear-gradient(135deg, #1976D2, #0D47A1)",
                  boxShadow: isDark
                    ? "5px 5px 12px #090e18, -5px -5px 12px #1f2c40"
                    : "5px 5px 12px #c5d0e0, -5px -5px 12px #ffffff",
                  color: "#ffffff",
                  "&:hover": {
                    background: isDark
                      ? "linear-gradient(135deg, #3B82F6, #1E40AF)"
                      : "linear-gradient(135deg, #1565C0, #0A387E)",
                    boxShadow: isDark
                      ? "2px 2px 6px #090e18, -2px -2px 6px #1f2c40"
                      : "2px 2px 6px #c5d0e0, -2px -2px 6px #ffffff",
                  },
                }}
              >
                {saving ? "Saving..." : "Save Preferences"}
              </Button>
            </Paper>
          </Stack>
        )}
      </Container>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%", borderRadius: "12px", fontWeight: 600 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Register global page mappings
if (typeof window !== "undefined") {
  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Pages = window.DashboardApp.Pages || {};
  window.DashboardApp.Pages["mentee-preferences"] = MenteePreferencesPage;
  window.DashboardApp.Pages["preferences"] = MenteePreferencesPage;
}
