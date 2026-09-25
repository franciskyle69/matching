import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TuneIcon from "@mui/icons-material/Tune";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SpeedIcon from "@mui/icons-material/Speed";
import { useTheme } from "@mui/material/styles";

import SubjectSkillPreferences, {
  MAX_SUBJECTS,
  MAX_TOPICS_PER_SUBJECT,
  MAX_COMPETENCIES_PER_SUBJECT,
  MAX_COMPETENCIES_PER_TOPIC,
  MAX_COMPETENCIES_TOTAL,
  ROLE_LIMITS,
  getRoleLimits,
  CANONICAL_CURRICULUM,
  NEU_STYLES,
} from "./SubjectSkillPreferences.jsx";
import { getNeuStyles } from "../theme/neumorphism.js";

export {
  MAX_SUBJECTS,
  MAX_TOPICS_PER_SUBJECT,
  MAX_COMPETENCIES_PER_SUBJECT,
  MAX_COMPETENCIES_PER_TOPIC,
  MAX_COMPETENCIES_TOTAL,
  ROLE_LIMITS,
  getRoleLimits,
  CANONICAL_CURRICULUM,
  NEU_STYLES,
};

export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const NEED_SLIDER_MARKS = [
  { value: 1, label: "1 (Basic)" },
  { value: 2, label: "2 (Elementary)" },
  { value: 3, label: "3 (Intermediate)" },
  { value: 4, label: "4 (Advanced)" },
  { value: 5, label: "5 (Intensive)" },
];

export default function PreferencesForm({
  user,
  initialData = {},
  onSubmit,
  loading = false,
  errorMessage = "",
  setErrorMessage = () => {},
  onBack,
}) {
  const theme = useTheme();
  const neu = useMemo(() => getNeuStyles(theme), [theme?.palette?.mode]);
  const isDark = theme?.palette?.mode === "dark";

  const currentLimits = useMemo(() => {
    return getRoleLimits(user?.role);
  }, [user?.role]);

  // Hierarchical selection states
  const [selectedSubjects, setSelectedSubjects] = useState(() => {
    return initialData.subjects || ["IT 111", "IT 112"];
  });

  const [selectedTopics, setSelectedTopics] = useState(() => {
    return initialData.topics || ["UI & Web Fundamentals", "Control Structures"];
  });

  const [selectedCompetencies, setSelectedCompetencies] = useState(() => {
    return initialData.competencies || ["Loop Control", "Figma UI Design", "Flexbox & Grid"];
  });

  const [supportNeed, setSupportNeed] = useState(() => {
    return initialData.support_need || initialData.difficulty_level || 3;
  });

  const [availabilitySlots, setAvailabilitySlots] = useState(() => {
    if (Array.isArray(initialData.availability) && initialData.availability.length > 0) {
      return initialData.availability;
    }
    return [
      { day: "Monday", start_time: "09:00", end_time: "11:00" },
      { day: "Wednesday", start_time: "13:00", end_time: "15:00" },
    ];
  });

  // Availability handlers
  const handleAddSlot = () => {
    if (availabilitySlots.length >= currentLimits.maxAvailabilitySlots) {
      setErrorMessage(
        `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxAvailabilitySlots} availability slots.`
      );
      return;
    }
    setErrorMessage("");
    setAvailabilitySlots([
      ...availabilitySlots,
      { day: "Monday", start_time: "09:00", end_time: "11:00" },
    ]);
  };

  const handleRemoveSlot = (index) => {
    if (availabilitySlots.length <= currentLimits.minAvailabilitySlots) {
      setErrorMessage(
        `${currentLimits.roleLabel} must select at least ${currentLimits.minAvailabilitySlots} availability slot.`
      );
      return;
    }
    setErrorMessage("");
    setAvailabilitySlots(availabilitySlots.filter((_, i) => i !== index));
  };

  const handleSlotChange = (index, field, value) => {
    const updated = [...availabilitySlots];
    updated[index] = { ...updated[index], [field]: value };
    setAvailabilitySlots(updated);
  };

  // Pre-submit validation
  const validateAndSubmit = (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    // 1. Subjects validation
    if (selectedSubjects.length < currentLimits.minSubjects) {
      setErrorMessage(`${currentLimits.roleLabel} must select at least ${currentLimits.minSubjects} subject.`);
      return;
    }
    if (selectedSubjects.length > currentLimits.maxSubjects) {
      setErrorMessage(`You can select a maximum of ${currentLimits.maxSubjects} subjects.`);
      return;
    }

    // 2. Per-subject topics & competencies validation
    for (const subjCode of selectedSubjects) {
      const subjObj = CANONICAL_CURRICULUM.find((s) => s.code === subjCode || s.name === subjCode);
      if (subjObj) {
        const topicsInSubj = subjObj.topics.map((t) => t.name);
        const selectedTopicsInSubj = selectedTopics.filter((t) => topicsInSubj.includes(t));
        const maxTopics = currentLimits.maxTopicsPerSubject || MAX_TOPICS_PER_SUBJECT;
        if (selectedTopicsInSubj.length > maxTopics) {
          setErrorMessage(`You can select a maximum of ${maxTopics} topics for subject '${subjCode}'.`);
          return;
        }

        for (const topicObj of subjObj.topics) {
          const compNames = typeof topicObj.competencies[0] === "string"
            ? topicObj.competencies
            : topicObj.competencies.map((c) => c.name);
          const selectedInTopic = selectedCompetencies.filter((c) => compNames.includes(c));
          const maxCompsPerTopic = currentLimits.maxCompetenciesPerTopic || MAX_COMPETENCIES_PER_TOPIC;
          if (selectedInTopic.length > maxCompsPerTopic) {
            setErrorMessage(`You can select a maximum of ${maxCompsPerTopic} competencies for topic '${topicObj.name}'.`);
            return;
          }
        }

        const allCompsInSubj = subjObj.topics.flatMap((t) =>
          typeof t.competencies[0] === "string" ? t.competencies : t.competencies.map((c) => c.name)
        );
        const selectedCompsInSubj = selectedCompetencies.filter((c) => allCompsInSubj.includes(c));
        const maxComps = currentLimits.maxCompetenciesPerSubject || MAX_COMPETENCIES_PER_SUBJECT;
        if (selectedCompsInSubj.length > maxComps) {
          setErrorMessage(`You can select a maximum of ${maxComps} competencies for subject '${subjCode}'.`);
          return;
        }
      }
    }

    // 3. Global competencies total validation
    if (selectedCompetencies.length < currentLimits.minGlobalCompetencies) {
      setErrorMessage(
        `${currentLimits.roleLabel} must select at least ${currentLimits.minGlobalCompetencies} competency total.`
      );
      return;
    }
    const maxGlobalComps = currentLimits.maxGlobalCompetencies || MAX_COMPETENCIES_TOTAL;
    if (selectedCompetencies.length > maxGlobalComps) {
      setErrorMessage(
        `You can select a maximum of ${maxGlobalComps} competencies total.`
      );
      return;
    }

    // 4. Availability slots validation
    if (availabilitySlots.length < currentLimits.minAvailabilitySlots) {
      setErrorMessage(
        `${currentLimits.roleLabel} must select at least ${currentLimits.minAvailabilitySlots} availability slot.`
      );
      return;
    }
    if (availabilitySlots.length > currentLimits.maxAvailabilitySlots) {
      setErrorMessage(
        `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxAvailabilitySlots} availability slots.`
      );
      return;
    }

    if (onSubmit) {
      onSubmit({
        subjects: selectedSubjects,
        topics: selectedTopics,
        competencies: selectedCompetencies,
        skills: selectedCompetencies,
        support_need: supportNeed,
        availability: availabilitySlots,
        availability_slots: availabilitySlots,
      });
    }
  };

  const isBoundsExceeded = useMemo(() => {
    if (selectedSubjects.length > (currentLimits.maxSubjects || MAX_SUBJECTS)) return true;
    for (const subjCode of selectedSubjects) {
      const subjObj = CANONICAL_CURRICULUM.find((s) => s.code === subjCode || s.name === subjCode);
      if (subjObj) {
        const topicsInSubj = subjObj.topics.map((t) => t.name);
        const selectedTopicsInSubj = selectedTopics.filter((t) => topicsInSubj.includes(t));
        if (selectedTopicsInSubj.length > (currentLimits.maxTopicsPerSubject || MAX_TOPICS_PER_SUBJECT)) return true;
        for (const topicObj of subjObj.topics) {
          const compNames = typeof topicObj.competencies[0] === "string"
            ? topicObj.competencies
            : topicObj.competencies.map((c) => c.name);
          const selectedInTopic = selectedCompetencies.filter((c) => compNames.includes(c));
          if (selectedInTopic.length > (currentLimits.maxCompetenciesPerTopic || MAX_COMPETENCIES_PER_TOPIC)) return true;
        }
      }
    }
    const maxGlobal = currentLimits.maxGlobalCompetencies || MAX_COMPETENCIES_TOTAL;
    if (selectedCompetencies.length > maxGlobal) return true;
    return false;
  }, [selectedSubjects, selectedTopics, selectedCompetencies, currentLimits]);

  return (
    <Card
      elevation={0}
      sx={{
        ...neu.elevatedCard,
        p: { xs: 1, sm: 2 },
      }}
    >
      <CardHeader
        avatar={<TuneIcon sx={{ color: neu.accentBlue, fontSize: 32 }} />}
        title={
          <Typography variant="h5" fontWeight={700} color={neu.titleColor}>
            Subject & Skill Preferences
          </Typography>
        }
        subheader={
          <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary} sx={{ mt: 0.5 }}>
            {`Role: ${currentLimits.label} — Feature Vector Sparsity Bounds Enforced`}
          </Typography>
        }
        sx={{ px: 3, pt: 2.5 }}
      />
      <Divider sx={{ my: 1, borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.2)" }} />

      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={4}>
          {errorMessage && (
            <Alert
              severity="error"
              onClose={() => setErrorMessage("")}
              sx={{
                borderRadius: "12px",
                ...neu.sunkenPanel,
                color: isDark ? "#FCA5A5" : undefined,
                "& .MuiAlert-icon": {
                  color: isDark ? "#F87171" : undefined,
                },
              }}
            >
              {errorMessage}
            </Alert>
          )}

          {/* ── Reusable Modular Hierarchy: Subject -> Topic -> Competency ── */}
          <SubjectSkillPreferences
            role={user?.role}
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
            readOnly={loading}
          />

          <Divider sx={{ borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.2)" }} />

          {/* ── Support Need Rating Slider ── */}
          <Box sx={{ ...neu.elevatedCard, p: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <SpeedIcon sx={{ color: neu.accentBlue, fontSize: 24 }} />
              <Typography variant="subtitle1" fontWeight={700} color={neu.titleColor}>
                Support Need Rating Scale (1 to 5)
              </Typography>
            </Box>
            <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary} sx={{ mb: 2 }}>
              Indicate the intensity of mentorship guidance needed:
            </Typography>
            <Box sx={{ px: 2, pt: 1 }}>
              <Slider
                value={supportNeed}
                onChange={(_, val) => setSupportNeed(val)}
                step={1}
                marks={NEED_SLIDER_MARKS}
                min={1}
                max={5}
                valueLabelDisplay="auto"
                sx={{
                  color: neu.accentBlue,
                  "& .MuiSlider-thumb": {
                    width: 24,
                    height: 24,
                    backgroundColor: isDark ? "#1E293B" : "#e6ecf5",
                    boxShadow: isDark
                      ? "3px 3px 6px #090e18, -3px -3px 6px #1f2c40"
                      : "3px 3px 6px #c5d0e0, -3px -3px 6px #ffffff",
                    border: isDark ? "2px solid #60A5FA" : "2px solid #1976D2",
                  },
                  "& .MuiSlider-track": {
                    height: 8,
                    borderRadius: 4,
                  },
                  "& .MuiSlider-rail": {
                    height: 8,
                    borderRadius: 4,
                    boxShadow: isDark
                      ? "inset 2px 2px 4px #090e18, inset -2px -2px 4px #1f2c40"
                      : "inset 2px 2px 4px #c5d0e0, inset -2px -2px 4px #ffffff",
                    backgroundColor: isDark ? "#101827" : "#e6ecf5",
                  },
                  "& .MuiSlider-markLabel": {
                    color: theme.palette.text?.secondary || neu.textSecondary,
                  },
                }}
              />
            </Box>
          </Box>

          <Divider sx={{ borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.2)" }} />

          {/* ── Recurring Availability Picker with Neumorphic Slots ── */}
          <Box sx={{ ...neu.elevatedCard, p: { xs: 2.5, sm: 3 } }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1.5}
              sx={{ mb: 2.5 }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700} color={neu.titleColor} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AccessTimeIcon sx={{ color: neu.accentBlue, fontSize: 24 }} />
                  Recurring Availability Schedule
                </Typography>
                <Typography variant="caption" color={theme.palette.text?.secondary || neu.textSecondary}>
                  Specify regular weekly time slots when you are available for sessions:
                </Typography>
              </Box>

              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Box sx={neu.counterPill}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color={
                      availabilitySlots.length >= currentLimits.minAvailabilitySlots
                        ? (isDark ? "#60A5FA" : "#0D47A1")
                        : (isDark ? "#F87171" : "#D32F2F")
                    }
                  >
                    Availability Slots: {availabilitySlots.length} / {currentLimits.maxAvailabilitySlots} (Min {currentLimits.minAvailabilitySlots}, Max {currentLimits.maxAvailabilitySlots})
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleAddSlot}
                  disabled={availabilitySlots.length >= currentLimits.maxAvailabilitySlots}
                  sx={{
                    ...neu.elevatedCard,
                    textTransform: "none",
                    fontWeight: 600,
                    color: neu.accentDark,
                    px: 2,
                    "&:hover": { transform: "translateY(-1px)" },
                  }}
                >
                  Add Day Slot
                </Button>
              </Stack>
            </Stack>

            <Stack spacing={2}>
              {availabilitySlots.map((slot, index) => (
                <Paper
                  key={index}
                  sx={{
                    ...neu.topicContainer,
                    p: 2,
                  }}
                >
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`day-select-label-${index}`} sx={{ color: theme.palette.text?.secondary || neu.textSecondary }}>Day of Week</InputLabel>
                        <Select
                          labelId={`day-select-label-${index}`}
                          value={slot.day}
                          label="Day of Week"
                          onChange={(e) => handleSlotChange(index, "day", e.target.value)}
                          sx={{
                            ...neu.inputRoot,
                            "& .MuiSelect-select": {
                              color: neu.textPrimary,
                            },
                          }}
                        >
                          {DAYS_OF_WEEK.map((day) => (
                            <MenuItem key={day} value={day}>
                              {day}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6} sm={3.5}>
                      <TextField
                        label="Start Time"
                        type="time"
                        size="small"
                        fullWidth
                        value={slot.start_time}
                        onChange={(e) => handleSlotChange(index, "start_time", e.target.value)}
                        InputLabelProps={{ shrink: true, sx: { color: theme.palette.text?.secondary || neu.textSecondary } }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            ...neu.inputRoot,
                          },
                          "& input": {
                            color: neu.textPrimary,
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3.5}>
                      <TextField
                        label="End Time"
                        type="time"
                        size="small"
                        fullWidth
                        value={slot.end_time}
                        onChange={(e) => handleSlotChange(index, "end_time", e.target.value)}
                        InputLabelProps={{ shrink: true, sx: { color: theme.palette.text?.secondary || neu.textSecondary } }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            ...neu.inputRoot,
                          },
                          "& input": {
                            color: neu.textPrimary,
                          },
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={1} sx={{ textAlign: "right" }}>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => handleRemoveSlot(index)}
                        disabled={availabilitySlots.length <= currentLimits.minAvailabilitySlots}
                        sx={{
                          boxShadow: isDark
                            ? "3px 3px 6px #090e18, -3px -3px 6px #1f2c40"
                            : "3px 3px 6px #c5d0e0, -3px -3px 6px #ffffff",
                          backgroundColor: isDark ? "#1E293B" : "#e6ecf5",
                          color: isDark ? "#F87171" : "#D32F2F",
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Grid>
                  </Grid>
                </Paper>
              ))}
            </Stack>
          </Box>

          <Divider sx={{ borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.2)" }} />

          {/* ── Navigation & Submit Buttons ── */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1 }}>
            {onBack && (
              <Button
                variant="outlined"
                onClick={onBack}
                disabled={loading}
                sx={{
                  ...neu.elevatedCard,
                  textTransform: "none",
                  fontWeight: 600,
                  color: isDark ? "#94A3B8" : "#455A64",
                  px: 3,
                  py: 1,
                  "&:hover": { transform: "translateY(-1px)" },
                }}
              >
                Back to Guidelines
              </Button>
            )}
            <Button
              variant="contained"
              size="large"
              onClick={validateAndSubmit}
              disabled={loading || isBoundsExceeded}
              sx={{
                ml: "auto",
                px: 5,
                py: 1.4,
                textTransform: "none",
                fontWeight: 700,
                fontSize: "1rem",
                borderRadius: "24px",
                background: isDark
                  ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
                  : "linear-gradient(135deg, #1976D2, #0D47A1)",
                boxShadow: isDark
                  ? "6px 6px 14px #090e18, -6px -6px 14px #1f2c40"
                  : "6px 6px 14px #c5d0e0, -6px -6px 14px #ffffff",
                color: "#ffffff",
                "&:hover": {
                  background: isDark
                    ? "linear-gradient(135deg, #3B82F6, #1E40AF)"
                    : "linear-gradient(135deg, #1565C0, #0A387E)",
                  boxShadow: isDark
                    ? "3px 3px 8px #090e18, -3px -3px 8px #1f2c40"
                    : "3px 3px 8px #c5d0e0, -3px -3px 8px #ffffff",
                  transform: "translateY(-1px)",
                },
                "&:active": {
                  boxShadow: "inset 3px 3px 6px rgba(0,0,0,0.4)",
                },
              }}
            >
              Complete Onboarding
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
