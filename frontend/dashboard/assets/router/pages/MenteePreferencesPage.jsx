import React, { useState, useEffect, useContext } from "react";
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
import SaveIcon from "@mui/icons-material/Save";
import TuneIcon from "@mui/icons-material/Tune";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import SubjectSkillPreferences, {
  NEU_STYLES,
  getRoleLimits,
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
  const resolvedRole = (currentUser?.role || defaultRole).toUpperCase();
  const normalizedRole = resolvedRole.includes("MENTOR")
    ? (resolvedRole.includes("INSTRUCTOR") ? "INSTRUCTOR_MENTOR" : "STUDENT_MENTOR")
    : "MENTEE";

  const [role, setRole] = useState(normalizedRole);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const roleLimits = getRoleLimits(role);

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
    } catch (err) {
      console.error("Error fetching preferences:", err);
      setError(err.message || "Failed to load preferences.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  // Save updates via PUT /api/user/preferences/ with explicit Save Preferences button
  const handleSavePreferences = async () => {
    setSaving(true);
    setError("");

    // Validate min limits
    if (selectedSubjects.length < roleLimits.minSubjects) {
      setError(`Please select at least ${roleLimits.minSubjects} subject.`);
      setSaving(false);
      return;
    }
    if (selectedCompetencies.length < roleLimits.minGlobalCompetencies) {
      setError(`Please select at least ${roleLimits.minGlobalCompetencies} competency.`);
      setSaving(false);
      return;
    }

    try {
      const payload = {
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

      setToast({
        open: true,
        message: "Preferences saved successfully!",
        severity: "success",
      });
    } catch (err) {
      console.error("Error saving preferences:", err);
      setError(err.message || "Failed to save preferences.");
      setToast({
        open: true,
        message: err.message || "Error saving preferences.",
        severity: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        backgroundColor: NEU_STYLES.bgBase,
        minHeight: "100vh",
        py: { xs: 3, md: 5 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="lg">
        {/* Header Bar */}
        <Paper
          sx={{
            ...NEU_STYLES.elevatedCard,
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
              <TuneIcon sx={{ color: "#1976D2", fontSize: 28 }} />
              <Typography variant="h5" fontWeight={800} color="#0D47A1">
                {roleLimits.label} Matching Preferences
              </Typography>
              <Box sx={{ ...NEU_STYLES.counterPill, px: 1.5, py: 0.3 }}>
                <Typography variant="caption" fontWeight={700} color="#1976D2">
                  {roleLimits.label}
                </Typography>
              </Box>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Configure your subjects, topics, and competencies to optimize recommendation scoring.
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              onClick={fetchPreferences}
              disabled={loading || saving}
              startIcon={<RefreshIcon />}
              sx={{
                borderRadius: "20px",
                borderColor: "#90A4AE",
                color: "#455A64",
                textTransform: "none",
                fontWeight: 600,
                boxShadow: "2px 2px 5px #c5d0e0, -2px -2px 5px #ffffff",
                "&:hover": {
                  borderColor: "#1976D2",
                  background: "rgba(25, 118, 210, 0.04)",
                },
              }}
            >
              Reset
            </Button>

            <Button
              variant="contained"
              onClick={handleSavePreferences}
              disabled={loading || saving}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
              sx={{
                px: 3.5,
                py: 1,
                borderRadius: "20px",
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.95rem",
                background: "linear-gradient(135deg, #1976D2, #0D47A1)",
                boxShadow: "4px 4px 10px #c5d0e0, -4px -4px 10px #ffffff",
                color: "#ffffff",
                "&:hover": {
                  background: "linear-gradient(135deg, #1565C0, #0A387E)",
                  boxShadow: "2px 2px 6px #c5d0e0, -2px -2px 6px #ffffff",
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
              boxShadow: "inset 2px 2px 5px #c5d0e0, inset -2px -2px 5px #ffffff",
              background: "#e6ecf5",
            }}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress sx={{ color: "#1976D2" }} />
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
                ...NEU_STYLES.elevatedCard,
                p: 3,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Remember to click <strong>Save Preferences</strong> to commit your subject and competency adjustments.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={handleSavePreferences}
                disabled={loading || saving}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                sx={{
                  px: 4,
                  py: 1.2,
                  borderRadius: "24px",
                  textTransform: "none",
                  fontWeight: 700,
                  fontSize: "1rem",
                  background: "linear-gradient(135deg, #1976D2, #0D47A1)",
                  boxShadow: "5px 5px 12px #c5d0e0, -5px -5px 12px #ffffff",
                  color: "#ffffff",
                  "&:hover": {
                    background: "linear-gradient(135deg, #1565C0, #0A387E)",
                    boxShadow: "2px 2px 6px #c5d0e0, -2px -2px 6px #ffffff",
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
