import React, { useState } from "react";
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
} from "@mui/material";
import HandshakeIcon from "@mui/icons-material/Handshake";
import SchoolIcon from "@mui/icons-material/School";
import ScheduleIcon from "@mui/icons-material/Schedule";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";

import PreferencesForm from "./PreferencesForm.jsx";
import { NEU_STYLES } from "./SubjectSkillPreferences.jsx";

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
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleCompleteOnboarding = async (formData) => {
    setErrorMessage("");
    setLoading(true);

    try {
      const payload = {
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
    <Box
      sx={{
        minHeight: "100vh",
        background: "#e6ecf5",
        py: { xs: 3, md: 5 },
        px: { xs: 2, sm: 3 },
      }}
    >
      <Container maxWidth="lg">
        {/* Page Hero Header */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography
            variant="h4"
            fontWeight={800}
            color="#0D47A1"
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
            color="text.secondary"
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
            background: "#e6ecf5",
            borderRadius: "30px",
            boxShadow: "inset 3px 3px 8px #c5d0e0, inset -3px -3px 8px #ffffff",
            border: "1px solid rgba(255, 255, 255, 0.6)",
          }}
        >
          <Stepper
            activeStep={activeStep}
            sx={{
              "& .MuiStepConnector-line": {
                borderColor: "#c5d0e0",
                borderTopWidth: 2,
              },
              "& .MuiStepIcon-root": {
                color: "#c5d0e0",
                fontSize: 28,
                "&.Mui-active": {
                  color: "#1976D2",
                  filter: "drop-shadow(2px 2px 4px rgba(25, 118, 210, 0.4))",
                },
                "&.Mui-completed": {
                  color: "#0D47A1",
                },
              },
              "& .MuiStepLabel-label": {
                color: "#546E7A",
                fontWeight: 600,
                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                "&.Mui-active": {
                  color: "#0D47A1",
                  fontWeight: 700,
                },
                "&.Mui-completed": {
                  color: "#0D47A1",
                  fontWeight: 600,
                },
              },
            }}
          >
            <Step>
              <StepLabel>System Orientation & Code of Conduct</StepLabel>
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
              boxShadow: "inset 2px 2px 5px #c5d0e0, inset -2px -2px 5px #ffffff",
              background: "#e6ecf5",
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
              ...NEU_STYLES.elevatedCard,
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
                    background: "#e6ecf5",
                    boxShadow: "4px 4px 10px #c5d0e0, -4px -4px 10px #ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <HandshakeIcon sx={{ color: "#1976D2", fontSize: 28 }} />
                </Box>
              }
              title={
                <Typography variant="h5" fontWeight={800} color="#0D47A1">
                  BukSU Mentorship Orientation & Guidelines
                </Typography>
              }
              subheader="Please read carefully before proceeding with your matching configuration"
              sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}
            />
            <Divider sx={{ my: 2, borderColor: "rgba(148, 163, 184, 0.2)" }} />

            <CardContent sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
              <Stack spacing={3}>
                {/* Panel 1 */}
                <Box
                  sx={{
                    p: 2.5,
                    background: "#e6ecf5",
                    boxShadow: "inset 2px 2px 6px #c5d0e0, inset -2px -2px 6px #ffffff",
                    borderRadius: "16px",
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} color="#0D47A1" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
                    <SchoolIcon sx={{ color: "#1976D2", fontSize: 20 }} />
                    1. How the Smart Matching System Works
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    Our platform utilizes an intelligent XGBoost machine learning model trained specifically on BukSU IT curriculum benchmarks. The algorithm analyzes your selected subjects, specific competency needs, and overlapping time windows to calculate an optimal mentor-mentee compatibility score.
                  </Typography>
                </Box>

                {/* Panel 2 */}
                <Box
                  sx={{
                    p: 2.5,
                    background: "#e6ecf5",
                    boxShadow: "inset 2px 2px 6px #c5d0e0, inset -2px -2px 6px #ffffff",
                    borderRadius: "16px",
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} color="#0D47A1" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
                    <ScheduleIcon sx={{ color: "#1976D2", fontSize: 20 }} />
                    2. Mentorship Meeting Schedules
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    Pairs are expected to meet at least once weekly during their mutually agreed recurring time slots. Meetings can be conducted in-person on campus (IT computer laboratories or study hubs) or virtually via authorized BukSU video conferencing.
                  </Typography>
                </Box>

                {/* Panel 3 */}
                <Box
                  sx={{
                    p: 2.5,
                    background: "#e6ecf5",
                    boxShadow: "inset 2px 2px 6px #c5d0e0, inset -2px -2px 6px #ffffff",
                    borderRadius: "16px",
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} color="#0D47A1" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.8 }}>
                    <VerifiedUserIcon sx={{ color: "#1976D2", fontSize: 20 }} />
                    3. Code of Conduct & Academic Integrity
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
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
                      background: "linear-gradient(135deg, #1976D2, #0D47A1)",
                      boxShadow: "6px 6px 14px #c5d0e0, -6px -6px 14px #ffffff",
                      color: "#ffffff",
                      "&:hover": {
                        background: "linear-gradient(135deg, #1565C0, #0A387E)",
                        boxShadow: "3px 3px 8px #c5d0e0, -3px -3px 8px #ffffff",
                        transform: "translateY(-1px)",
                      },
                      "&:active": {
                        boxShadow: "inset 3px 3px 6px rgba(0,0,0,0.3)",
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

        {/* ── Step 2: Subject, Competency & Availability Preferences (PreferencesForm) ── */}
        {activeStep === 1 && (
          <PreferencesForm
            user={user}
            onSubmit={handleCompleteOnboarding}
            loading={loading}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
            onBack={() => setActiveStep(0)}
          />
        )}
      </Container>
    </Box>
  );
}
