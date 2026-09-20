import React, { useState, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Container,
  Divider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  Alert,
  TextField,
  MenuItem,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import HandshakeIcon from "@mui/icons-material/Handshake";
import SchoolIcon from "@mui/icons-material/School";
import ScheduleIcon from "@mui/icons-material/Schedule";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import PreferencesForm from "./PreferencesForm.jsx";
import { NEU_STYLES } from "./SubjectSkillPreferences.jsx";
import { getNeuStyles, getNeumorphicStyle } from "../theme/neumorphism.js";

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

export default function Onboarding({ user, onComplete }) {
  const theme = useTheme();
  const neu = useMemo(() => getNeuStyles(theme), [theme?.palette?.mode]);
  const isDark = theme?.palette?.mode === "dark";

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isMentee = user?.role === "mentee" || user?.role === "MENTEE";
  const defaultYearLevel = isMentee ? 1 : 3;

  const [personalInfo, setPersonalInfo] = useState({
    student_id_no: user?.student_id_no || "",
    contact_no: user?.contact_no || "",
    admission_type: user?.admission_type || "Regular",
    sex: user?.sex ? (user.sex.charAt(0).toUpperCase() + user.sex.slice(1).toLowerCase()) : "",
    campus: user?.campus || "Main",
    program: user?.program || "BSIT",
    year_level: user?.year_level || defaultYearLevel,
  });

  const [personalErrors, setPersonalErrors] = useState({});

  const handlePersonalChange = (field) => (e) => {
    const val = e.target.value;
    setPersonalInfo((prev) => ({ ...prev, [field]: val }));
    if (personalErrors[field]) {
      setPersonalErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleValidatePersonal = () => {
    const errors = {};
    const idNo = String(personalInfo.student_id_no || "").trim();
    if (!idNo) {
      errors.student_id_no = "Student ID No. is required (e.g., 2021-123456).";
    }

    const cleanContact = String(personalInfo.contact_no || "").replace(/[\s-]/g, "");
    if (!cleanContact) {
      errors.contact_no = "Contact No. is required (e.g., 09171234567).";
    } else if (!/^09\d{9}$/.test(cleanContact)) {
      errors.contact_no = "Enter a valid 11-digit Philippines mobile number (e.g., 09171234567).";
    }

    if (!personalInfo.admission_type) {
      errors.admission_type = "Please select an admission type.";
    }

    if (!personalInfo.sex) {
      errors.sex = "Please select your biological sex.";
    }

    setPersonalErrors(errors);
    if (Object.keys(errors).length > 0) {
      setErrorMessage("Please complete all mandatory personal and academic fields before continuing.");
      return false;
    }
    setErrorMessage("");
    return true;
  };

  const handleCompleteOnboarding = async (formData) => {
    setErrorMessage("");
    setLoading(true);

    try {
      const payload = {
        student_id_no: String(personalInfo.student_id_no || "").trim(),
        contact_no: String(personalInfo.contact_no || "").replace(/[\s-]/g, ""),
        admission_type: personalInfo.admission_type,
        sex: personalInfo.sex.toLowerCase(),
        gender: personalInfo.sex.toLowerCase(),
        campus: personalInfo.campus || "Main",
        program: personalInfo.program || "BSIT",
        year_level: personalInfo.year_level || defaultYearLevel,
        subjects: formData?.subjects || [],
        topics: formData?.topics || [],
        competencies: formData?.competencies || [],
        skills: formData?.skills || formData?.competencies || [],
        support_need: formData?.support_need !== undefined ? formData.support_need : 3,
        availability: formData?.availability || [],
        availability_slots: formData?.availability_slots || formData?.availability || [],
      };

      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(";").shift();
        return "";
      };
      const headers = { "Content-Type": "application/json" };
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
        setErrorMessage(data.error || data.detail || "Failed to save onboarding preferences.");
        setLoading(false);
        return;
      }

      if (onComplete) {
        onComplete(data);
      } else {
        window.location.hash = "#/pending-approval";
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      setErrorMessage("Failed to submit onboarding data. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: theme.palette.background?.default || neu.bgBase,
        color: theme.palette.text?.primary || neu.textPrimary,
        py: { xs: 3, md: 5 },
        px: { xs: 2, sm: 3 },
        transition: "background-color 0.3s ease, color 0.3s ease",
      }}
    >
      <Container maxWidth="lg">
        {/* Page Hero Header */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography
            variant="h4"
            fontWeight={800}
            color={theme.palette.mode === "dark" ? neu.titleColor : "#0D47A1"}
            gutterBottom
            sx={{
              letterSpacing: "-0.03em",
              fontSize: { xs: "1.75rem", sm: "2.25rem" },
            }}
          >
            BukSU IT Mentorship Onboarding
          </Typography>
          <Typography
            variant="body1"
            color={theme.palette.text?.secondary || neu.textSecondary}
            sx={{ maxWidth: 640, mx: "auto", fontWeight: 500 }}
          >
            Configure your academic preferences to empower our XGBoost matching engine with optimal feature vector sparsity.
          </Typography>
        </Box>

        {/* Neumorphic Step Stepper Bar (Header) */}
        <Box
          sx={{
            mb: 4,
            p: 1.5,
            ...neu.stepperTrack,
          }}
        >
          <Stepper
            activeStep={activeStep}
            sx={{
              "& .MuiStepConnector-line": {
                borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#c5d0e0",
                borderTopWidth: 2,
              },
              "& .MuiStepIcon-root": {
                color: isDark ? "#334155" : "#c5d0e0",
                fontSize: 28,
                "&.Mui-active": {
                  color: isDark ? "#60A5FA" : "#1976D2",
                  filter: isDark
                    ? "drop-shadow(0 0 6px rgba(96, 165, 250, 0.5))"
                    : "drop-shadow(2px 2px 4px rgba(25, 118, 210, 0.4))",
                },
                "&.Mui-completed": {
                  color: isDark ? "#38BDF8" : "#0D47A1",
                },
              },
              "& .MuiStepLabel-label": {
                color: theme.palette.text?.secondary || neu.textSecondary,
                fontWeight: 600,
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                "&.Mui-active": {
                  color: isDark ? "#60A5FA" : "#0D47A1",
                  fontWeight: 700,
                },
                "&.Mui-completed": {
                  color: isDark ? "#38BDF8" : "#0D47A1",
                  fontWeight: 600,
                },
              },
            }}
          >
            <Step>
              <StepLabel>System Orientation & Code of Conduct</StepLabel>
            </Step>
            <Step>
              <StepLabel>Personal & Academic Profile</StepLabel>
            </Step>
            <Step>
              <StepLabel>Subject, Competency & Availability</StepLabel>
            </Step>
          </Stepper>
        </Box>

        {activeStep === 0 && errorMessage && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              borderRadius: "14px",
              ...neu.sunkenPanel,
              color: isDark ? "#FCA5A5" : undefined,
              "& .MuiAlert-icon": {
                color: isDark ? "#F87171" : undefined,
              },
            }}
            onClose={() => setErrorMessage("")}
          >
            {errorMessage}
          </Alert>
        )}

        {/* ── Step 1: System Instructions & Orientation (Neumorphic) ── */}
        {activeStep === 0 && (
          <Card
            elevation={0}
            sx={{
              ...neu.elevatedCard,
              p: { xs: 1.5, sm: 3 },
            }}
          >
            <CardHeader
              avatar={
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "14px",
                    backgroundColor: isDark ? "#1E293B" : "#e6ecf5",
                    boxShadow: isDark
                      ? "4px 4px 10px #090e18, -4px -4px 10px #1f2c40"
                      : "4px 4px 10px #c5d0e0, -4px -4px 10px #ffffff",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(255, 255, 255, 0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HandshakeIcon sx={{ color: isDark ? "#60A5FA" : "#1976D2", fontSize: 28 }} />
                </Box>
              }
              title={
                <Typography variant="h5" fontWeight={800} color={neu.titleColor}>
                  BukSU Mentorship Orientation & Guidelines
                </Typography>
              }
              subheader={
                <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary} sx={{ mt: 0.5 }}>
                  Please read carefully before proceeding with your matching configuration
                </Typography>
              }
              sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}
            />
            <Divider sx={{ my: 2, borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.2)" }} />

            <CardContent sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
              <Stack spacing={3}>
                {/* Panel 1 */}
                <Box
                  sx={{
                    p: 2.5,
                    ...neu.sunkenPanel,
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} color={neu.titleColor} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
                    <SchoolIcon sx={{ color: isDark ? "#60A5FA" : "#1976D2", fontSize: 20 }} />
                    1. How the Smart Matching System Works
                  </Typography>
                  <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary} sx={{ lineHeight: 1.6 }}>
                    Our platform utilizes an intelligent XGBoost machine learning model trained specifically on BukSU IT curriculum benchmarks. The algorithm analyzes your selected subjects, specific competency needs, and overlapping time windows to calculate an optimal mentor-mentee compatibility score.
                  </Typography>
                </Box>

                {/* Panel 2 */}
                <Box
                  sx={{
                    p: 2.5,
                    ...neu.sunkenPanel,
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} color={neu.titleColor} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
                    <ScheduleIcon sx={{ color: isDark ? "#60A5FA" : "#1976D2", fontSize: 20 }} />
                    2. Mentorship Meeting Schedules
                  </Typography>
                  <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary} sx={{ lineHeight: 1.6 }}>
                    Pairs are expected to meet at least once weekly during their mutually agreed recurring time slots. Meetings can be conducted in-person on campus (IT computer laboratories or study hubs) or virtually via authorized BukSU video conferencing.
                  </Typography>
                </Box>

                {/* Panel 3 */}
                <Box
                  sx={{
                    p: 2.5,
                    ...neu.sunkenPanel,
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} color={neu.titleColor} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
                    <VerifiedUserIcon sx={{ color: isDark ? "#60A5FA" : "#1976D2", fontSize: 20 }} />
                    3. Code of Conduct & Academic Integrity
                  </Typography>
                  <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary} sx={{ lineHeight: 1.6 }}>
                    • <strong>Punctuality & Respect:</strong> Honor all scheduled sessions. Notify your mentor or mentee at least 24 hours prior to any schedule adjustments.<br />
                    • <strong>Academic Honesty:</strong> Mentorship focuses on conceptual understanding, problem-solving techniques, and code comprehension. Mentors are prohibited from completing assignments, projects, or exams for mentees.<br />
                    • <strong>Professional Communication:</strong> Keep all discussions aligned with academic growth and adhere to BukSU student conduct standards.
                  </Typography>
                </Box>

                {/* Accept Button */}
                <Box sx={{ pt: 2, display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => setActiveStep(1)}
                    sx={{
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
                    I Understand & Accept — Continue
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Personal & Academic Profile (Neumorphic) ── */}
        {activeStep === 1 && (
          <Card
            elevation={0}
            sx={{
              ...neu.elevatedCard,
              p: { xs: 1.5, sm: 3 },
            }}
          >
            <CardHeader
              avatar={
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "14px",
                    backgroundColor: isDark ? "#1E293B" : "#e6ecf5",
                    boxShadow: isDark
                      ? "4px 4px 10px #090e18, -4px -4px 10px #1f2c40"
                      : "4px 4px 10px #c5d0e0, -4px -4px 10px #ffffff",
                    border: isDark
                      ? "1px solid rgba(255, 255, 255, 0.08)"
                      : "1px solid rgba(255, 255, 255, 0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BadgeOutlinedIcon sx={{ color: isDark ? "#60A5FA" : "#1976D2", fontSize: 28 }} />
                </Box>
              }
              title={
                <Typography variant="h5" fontWeight={800} color={neu.titleColor}>
                  Personal & Academic Profile
                </Typography>
              }
              subheader={
                <Typography variant="body2" color={theme.palette.text?.secondary || neu.textSecondary} sx={{ mt: 0.5 }}>
                  Please complete all required student records and contact details before continuing
                </Typography>
              }
              sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}
            />
            <Divider sx={{ my: 2, borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(148, 163, 184, 0.2)" }} />

            <CardContent sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
              <Stack spacing={3}>
                {errorMessage && (
                  <Alert
                    severity="error"
                    sx={{
                      borderRadius: "14px",
                      ...neu.sunkenPanel,
                      color: isDark ? "#FCA5A5" : undefined,
                      "& .MuiAlert-icon": { color: isDark ? "#F87171" : undefined },
                    }}
                    onClose={() => setErrorMessage("")}
                  >
                    {errorMessage}
                  </Alert>
                )}

                {/* Personal Information Fields */}
                <Box sx={{ p: 2.5, ...neu.sunkenPanel }}>
                  <Typography variant="subtitle1" fontWeight={700} color={neu.titleColor} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <SchoolIcon sx={{ color: isDark ? "#60A5FA" : "#1976D2", fontSize: 20 }} />
                    Mandatory Student Credentials
                  </Typography>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
                    <TextField
                      label="Student ID No."
                      required
                      value={personalInfo.student_id_no}
                      onChange={handlePersonalChange("student_id_no")}
                      error={!!personalErrors.student_id_no}
                      helperText={personalErrors.student_id_no || "Institutional ID (e.g., 2021-123456)"}
                      placeholder="2021-123456"
                      size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                    />

                    <TextField
                      label="Contact No."
                      required
                      value={personalInfo.contact_no}
                      onChange={handlePersonalChange("contact_no")}
                      error={!!personalErrors.contact_no}
                      helperText={personalErrors.contact_no || "11-digit Philippine mobile number (e.g., 09171234567)"}
                      placeholder="09171234567"
                      size="small"
                      slotProps={{ inputLabel: { shrink: true } }}
                    />

                    <TextField
                      select
                      label="Admission Type"
                      required
                      value={personalInfo.admission_type}
                      onChange={handlePersonalChange("admission_type")}
                      error={!!personalErrors.admission_type}
                      helperText={personalErrors.admission_type || "Select admission category"}
                      size="small"
                      slotProps={{
                        inputLabel: { shrink: true },
                        htmlInput: { "data-testid": "admission-select-input" },
                      }}
                    >
                      <MenuItem value="Regular">Regular</MenuItem>
                      <MenuItem value="Transferee">Transferee</MenuItem>
                      <MenuItem value="Ladderized">Ladderized</MenuItem>
                      <MenuItem value="Returnee">Returnee</MenuItem>
                    </TextField>

                    <TextField
                      select
                      label="Biological Sex"
                      required
                      value={personalInfo.sex}
                      onChange={handlePersonalChange("sex")}
                      error={!!personalErrors.sex}
                      helperText={personalErrors.sex || "Used for mentor-mentee pairing preferences"}
                      size="small"
                      slotProps={{
                        inputLabel: { shrink: true },
                        htmlInput: { "data-testid": "sex-select-input" },
                      }}
                    >
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                    </TextField>
                  </Box>
                </Box>

                {/* Read-Only Institutional Affiliation */}
                <Box sx={{ p: 2.5, ...neu.sunkenPanel }}>
                  <Typography variant="subtitle1" fontWeight={700} color={neu.titleColor} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                    <LockOutlinedIcon sx={{ color: isDark ? "#94A3B8" : "#64748B", fontSize: 20 }} />
                    Institutional Record (Read-Only)
                  </Typography>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
                    <Box sx={{ p: 1.5, borderRadius: "10px", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Campus</Typography>
                      <Typography variant="body2" fontWeight={700} color={neu.titleColor}>{personalInfo.campus || "Main"}</Typography>
                    </Box>
                    <Box sx={{ p: 1.5, borderRadius: "10px", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Course / Program</Typography>
                      <Typography variant="body2" fontWeight={700} color={neu.titleColor}>{personalInfo.program || "BSIT"}</Typography>
                    </Box>
                    <Box sx={{ p: 1.5, borderRadius: "10px", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Year Level</Typography>
                      <Typography variant="body2" fontWeight={700} color={neu.titleColor}>
                        {personalInfo.year_level === 1 ? "1st Year" : personalInfo.year_level === 2 ? "2nd Year" : personalInfo.year_level === 3 ? "3rd Year" : "4th Year"}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Step 2 Action Buttons */}
                <Box sx={{ pt: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setErrorMessage("");
                      setActiveStep(0);
                    }}
                    sx={{
                      px: 3,
                      py: 1,
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: "20px",
                    }}
                  >
                    Back to Orientation
                  </Button>

                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => {
                      if (handleValidatePersonal()) {
                        setActiveStep(2);
                      }
                    }}
                    sx={{
                      px: 4,
                      py: 1.2,
                      textTransform: "none",
                      fontWeight: 700,
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
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    Continue to Preferences
                  </Button>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Subject, Competency & Availability Preferences (PreferencesForm) ── */}
        {activeStep === 2 && (
          <PreferencesForm
            user={user}
            onSubmit={handleCompleteOnboarding}
            loading={loading}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
            onBack={() => setActiveStep(1)}
          />
        )}
      </Container>
    </Box>
  );
}

