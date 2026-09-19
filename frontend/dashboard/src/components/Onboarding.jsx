import React, { useState, useContext } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Slider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import HandshakeIcon from "@mui/icons-material/Handshake";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TuneIcon from "@mui/icons-material/Tune";

export const CORE_BSIT_SUBJECTS = [
  { code: "IT 111", name: "IT 111 - Introduction to Computing" },
  { code: "IT 112", name: "IT 112 - Computer Programming 1" },
  { code: "IT 113", name: "IT 113 - Computer Programming 2 (Data Structures)" },
  { code: "IT 115", name: "IT 115 - Information Management (Database Systems)" },
  { code: "IT 211", name: "IT 211 - Data Structures and Algorithms" },
  { code: "IT 212", name: "IT 212 - Object-Oriented Programming" },
  { code: "IT 221", name: "IT 221 - Web Systems and Technologies" },
];

export const SUGGESTED_SKILLS = [
  "Loop Control",
  "Figma UI Design",
  "Flexbox & Grid",
  "Object-Oriented Programming",
  "SQL & Relational Databases",
  "Data Structures (Arrays & Lists)",
  "Algorithm Complexity & Big-O",
  "HTML5 & Semantic Markup",
  "Modern JavaScript (ES6+)",
  "Git & GitHub Version Control",
  "REST API Integration",
  "Debugging & Problem Solving",
];

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const NEED_SLIDER_MARKS = [
  { value: 1, label: "1 (Basic)" },
  { value: 2, label: "2 (Elementary)" },
  { value: 3, label: "3 (Intermediate)" },
  { value: 4, label: "4 (Advanced)" },
  { value: 5, label: "5 (Intensive)" },
];

export default function Onboarding({ user, onComplete }) {
  const [activeStep, setActiveStep] = useState(0);

  // Preference fields
  const [selectedSubjects, setSelectedSubjects] = useState(["IT 111", "IT 112"]);
  const [selectedSkills, setSelectedSkills] = useState(["Loop Control", "Flexbox & Grid"]);
  const [customSkillInput, setCustomSkillInput] = useState("");
  const [supportNeed, setSupportNeed] = useState(3);

  // Recurring availability slots
  const [availabilitySlots, setAvailabilitySlots] = useState([
    { day: "Monday", start_time: "09:00", end_time: "11:00" },
    { day: "Wednesday", start_time: "13:00", end_time: "15:00" },
  ]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleToggleSkill = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const handleAddCustomSkill = () => {
    const trimmed = customSkillInput.trim();
    if (trimmed && !selectedSkills.includes(trimmed)) {
      setSelectedSkills([...selectedSkills, trimmed]);
      setCustomSkillInput("");
    }
  };

  const handleAddSlot = () => {
    setAvailabilitySlots([
      ...availabilitySlots,
      { day: "Monday", start_time: "09:00", end_time: "11:00" },
    ]);
  };

  const handleRemoveSlot = (index) => {
    setAvailabilitySlots(availabilitySlots.filter((_, i) => i !== index));
  };

  const handleSlotChange = (index, field, value) => {
    const updated = [...availabilitySlots];
    updated[index] = { ...updated[index], [field]: value };
    setAvailabilitySlots(updated);
  };

  const handleCompleteOnboarding = async () => {
    setErrorMessage("");

    if (selectedSubjects.length === 0) {
      setErrorMessage("Please select at least one core BSIT subject.");
      return;
    }
    if (selectedSkills.length === 0) {
      setErrorMessage("Please select at least one skill or competency.");
      return;
    }
    if (availabilitySlots.length === 0) {
      setErrorMessage("Please add at least one recurring availability slot.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        subjects: selectedSubjects,
        skills: selectedSkills,
        support_need: supportNeed,
        availability: availabilitySlots,
      };

      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(";").shift();
        return "";
      };
      const csrf = getCookie("csrftoken");
      if (csrf) {
        headers["X-CSRFToken"] = csrf;
      }

      const response = await fetch("/api/user/complete-onboarding/", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Failed to save onboarding preferences.");
        setLoading(false);
        return;
      }

      // Update app context if available
      if (window.DashboardApp && window.DashboardApp.AppContext) {
        // AppContext handler if any
      }

      if (onComplete) {
        onComplete(data);
      } else {
        window.location.hash = "#/dashboard";
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      setErrorMessage("Failed to submit onboarding data. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <Typography variant="h4" fontWeight={700} color="#002855" gutterBottom>
          BukSU IT Mentorship Onboarding
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure your academic preferences to empower our XGBoost matching engine.
        </Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        <Step>
          <StepLabel>System Orientation & Code of Conduct</StepLabel>
        </Step>
        <Step>
          <StepLabel>Subject, Competency & Availability</StepLabel>
        </Step>
      </Stepper>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMessage("")}>
          {errorMessage}
        </Alert>
      )}

      {/* Step 1: System Instructions & Orientation */}
      {activeStep === 0 && (
        <Card
          elevation={2}
          sx={{
            borderRadius: 3,
            boxShadow: "0 8px 24px rgba(0, 40, 85, 0.08)",
          }}
        >
          <CardHeader
            avatar={<HandshakeIcon sx={{ color: "primary.main", fontSize: 32 }} />}
            title={
              <Typography variant="h5" fontWeight={700} color="#002855">
                BukSU Mentorship Orientation & Guidelines
              </Typography>
            }
            subheader="Please read carefully before proceeding with your matching configuration"
          />
          <Divider />
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="#002855" gutterBottom>
                  1. How the Smart Matching System Works
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Our platform utilizes an intelligent XGBoost machine learning model trained specifically on BukSU IT curriculum benchmarks. The algorithm analyzes your selected subjects, specific competency needs, and overlapping time windows to calculate an optimal mentor-mentee compatibility score.
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="#002855" gutterBottom>
                  2. Mentorship Meeting Schedules
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Pairs are expected to meet at least once weekly during their mutually agreed recurring time slots. Meetings can be conducted in-person on campus (IT computer laboratories or study hubs) or virtually via authorized BukSU video conferencing.
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="#002855" gutterBottom>
                  3. Code of Conduct & Academic Integrity
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  - <strong>Punctuality & Respect:</strong> Honor all scheduled sessions. Notify your mentor or mentee at least 24 hours prior to any schedule adjustments.
                  <br />
                  - <strong>Academic Honesty:</strong> Mentorship focuses on conceptual understanding, problem-solving techniques, and code comprehension. Mentors are prohibited from completing assignments, projects, or exams for mentees.
                  <br />
                  - <strong>Professional Communication:</strong> Keep all discussions aligned with academic growth and adhere to BukSU student conduct standards.
                </Typography>
              </Box>

              <Box sx={{ pt: 2, display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setActiveStep(1)}
                  sx={{
                    px: 4,
                    py: 1.2,
                    textTransform: "none",
                    fontWeight: 600,
                    backgroundColor: "#002855",
                    "&:hover": { backgroundColor: "#0b2545" },
                  }}
                >
                  I Understand & Accept — Continue
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Subject & Skill Preferences (XGBoost Matching Input) */}
      {activeStep === 1 && (
        <Card
          elevation={2}
          sx={{
            borderRadius: 3,
            boxShadow: "0 8px 24px rgba(0, 40, 85, 0.08)",
          }}
        >
          <CardHeader
            avatar={<TuneIcon sx={{ color: "primary.main", fontSize: 32 }} />}
            title={
              <Typography variant="h5" fontWeight={700} color="#002855">
                Subject & Skill Preferences
              </Typography>
            }
            subheader="Input your learning vectors for XGBoost recommendation pairing"
          />
          <Divider />
          <CardContent sx={{ p: 4 }}>
            <Stack spacing={4}>
              {/* Core BSIT Subjects Multi-Select */}
              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="#002855" gutterBottom>
                  Core BSIT Subjects
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Select the courses where you require mentorship support or specialize in:
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel id="subjects-select-label">Selected Subjects</InputLabel>
                  <Select
                    labelId="subjects-select-label"
                    multiple
                    value={selectedSubjects}
                    onChange={(e) => setSelectedSubjects(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value)}
                    input={<OutlinedInput label="Selected Subjects" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((val) => (
                          <Chip key={val} label={val} size="small" color="primary" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  >
                    {CORE_BSIT_SUBJECTS.map((sub) => (
                      <MenuItem key={sub.code} value={sub.code}>
                        {sub.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Divider />

              {/* Skill Tag Selectors */}
              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="#002855" gutterBottom>
                  Competency & Skill Tags
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Click to select specific competencies, or type a custom skill tag:
                </Typography>

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  {SUGGESTED_SKILLS.map((skill) => {
                    const isSelected = selectedSkills.includes(skill);
                    return (
                      <Chip
                        key={skill}
                        label={skill}
                        clickable
                        color={isSelected ? "primary" : "default"}
                        variant={isSelected ? "filled" : "outlined"}
                        onClick={() => handleToggleSkill(skill)}
                        sx={{
                          fontWeight: isSelected ? 600 : 400,
                          backgroundColor: isSelected ? "#002855" : "transparent",
                          borderColor: isSelected ? "#002855" : "divider",
                        }}
                      />
                    );
                  })}
                </Box>

                {/* Custom Skill Input */}
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    placeholder="Add custom skill (e.g., Recursion, React Hooks)..."
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomSkill();
                      }
                    }}
                    sx={{ maxWidth: 360 }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddCustomSkill}
                    sx={{ textTransform: "none" }}
                  >
                    Add Tag
                  </Button>
                </Stack>
              </Box>

              <Divider />

              {/* Support Need Rating Slider */}
              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="#002855" gutterBottom>
                  Support Need Rating Scale (1 to 5)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
                      color: "#002855",
                      "& .MuiSlider-thumb": {
                        width: 20,
                        height: 20,
                      },
                    }}
                  />
                </Box>
              </Box>

              <Divider />

              {/* Recurring Availability Picker */}
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600} color="#002855">
                      Recurring Availability Schedule
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Specify regular weekly time slots when you are available for sessions:
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={handleAddSlot}
                    sx={{ textTransform: "none" }}
                  >
                    Add Day Slot
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  {availabilitySlots.map((slot, index) => (
                    <Paper
                      key={index}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: "rgba(0,0,0,0.01)",
                      }}
                    >
                      <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormControl fullWidth size="small">
                            <InputLabel id={`day-select-label-${index}`}>Day of Week</InputLabel>
                            <Select
                              labelId={`day-select-label-${index}`}
                              value={slot.day}
                              label="Day of Week"
                              onChange={(e) => handleSlotChange(index, "day", e.target.value)}
                            >
                              {DAYS_OF_WEEK.map((day) => (
                                <MenuItem key={day} value={day}>
                                  {day}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3.5 }}>
                          <TextField
                            label="Start Time"
                            type="time"
                            size="small"
                            fullWidth
                            value={slot.start_time}
                            onChange={(e) => handleSlotChange(index, "start_time", e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3.5 }}>
                          <TextField
                            label="End Time"
                            type="time"
                            size="small"
                            fullWidth
                            value={slot.end_time}
                            onChange={(e) => handleSlotChange(index, "end_time", e.target.value)}
                            InputLabelProps={{ shrink: true }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 1 }} sx={{ textAlign: "right" }}>
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => handleRemoveSlot(index)}
                            disabled={availabilitySlots.length <= 1}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              </Box>

              <Divider />

              {/* Navigation & Submit Buttons */}
              <Box sx={{ display: "flex", justifyContent: "space-between", pt: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => setActiveStep(0)}
                  disabled={loading}
                  sx={{ textTransform: "none" }}
                >
                  Back to Guidelines
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleCompleteOnboarding}
                  disabled={loading}
                  sx={{
                    px: 4,
                    textTransform: "none",
                    fontWeight: 600,
                    backgroundColor: "#002855",
                    "&:hover": { backgroundColor: "#0b2545" },
                  }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : "Complete Onboarding"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
