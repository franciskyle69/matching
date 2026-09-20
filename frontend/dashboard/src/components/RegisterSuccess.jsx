import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  Typography,
  Alert,
  CircularProgress,
  useTheme,
} from "@mui/material";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function RegisterSuccess({
  email = "",
  onNavigateToLogin,
  onResendVerification,
}) {
  const theme = useTheme();
  const isDark = theme?.palette?.mode === "dark";

  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [feedbackAlert, setFeedbackAlert] = useState({
    type: "", // "success" | "error"
    message: "",
  });

  const timerRef = useRef(null);

  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;

    setResending(true);
    setFeedbackAlert({ type: "", message: "" });

    try {
      if (onResendVerification) {
        await onResendVerification(email);
        setCooldown(60);
        setFeedbackAlert({
          type: "success",
          message: "A new verification link has been sent to your inbox.",
        });
      } else {
        const response = await fetch("/api/auth/resend-verification/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), identifier: email.trim().toLowerCase() }),
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          setCooldown(60);
          setFeedbackAlert({
            type: "success",
            message: data.message || "A new verification link has been sent to your inbox.",
          });
        } else {
          setFeedbackAlert({
            type: "error",
            message: data.error || data.detail || "Unable to resend verification link. Please try again.",
          });
        }
      }
    } catch (err) {
      setFeedbackAlert({
        type: "error",
        message: "Network error while resending verification email. Please check your connection.",
      });
    } finally {
      setResending(false);
    }
  };

  const handleGoToLogin = () => {
    if (typeof onNavigateToLogin === "function") {
      onNavigateToLogin();
    } else {
      window.location.hash = "#/login";
    }
  };

  // Neumorphic tokens tailored for light (#E6ECF5) and dark (#0F172A)
  const neuCardStyle = {
    p: { xs: 3, sm: 5 },
    borderRadius: "24px",
    backgroundColor: isDark ? "#151D2A" : "#E6ECF5",
    boxShadow: isDark
      ? "8px 8px 20px #080d16, -8px -8px 20px #1e2b3c"
      : "8px 8px 20px #c5d0e0, -8px -8px 20px #ffffff",
    border: isDark
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(255, 255, 255, 0.8)",
    textAlign: "center",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  const neuIconPodStyle = {
    width: 90,
    height: 90,
    borderRadius: "50%",
    backgroundColor: isDark ? "#101827" : "#E6ECF5",
    boxShadow: isDark
      ? "inset 4px 4px 10px #090e17, inset -4px -4px 10px #1b2637"
      : "inset 4px 4px 10px #c5d0e0, inset -4px -4px 10px #ffffff",
    border: isDark
      ? "1px solid rgba(255, 255, 255, 0.06)"
      : "1px solid rgba(255, 255, 255, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px auto",
  };

  const neuSunkenStepBox = {
    p: { xs: 2, sm: 2.5 },
    my: 3,
    borderRadius: "16px",
    backgroundColor: isDark ? "#0F172A" : "#DCE4EF",
    boxShadow: isDark
      ? "inset 3px 3px 8px #080d16, inset -3px -3px 8px #182335"
      : "inset 3px 3px 8px #c5d0e0, inset -3px -3px 8px #ffffff",
    border: isDark
      ? "1px solid rgba(255, 255, 255, 0.05)"
      : "1px solid rgba(255, 255, 255, 0.5)",
    textAlign: "left",
  };

  const stepNumberStyle = (num) => ({
    width: 26,
    height: 26,
    borderRadius: "50%",
    backgroundColor: isDark ? "#1E293B" : "#E6ECF5",
    boxShadow: isDark
      ? "2px 2px 5px #0a0f18, -2px -2px 5px #1c2738"
      : "2px 2px 5px #c5d0e0, -2px -2px 5px #ffffff",
    color: isDark ? "#60A5FA" : "#002855",
    fontWeight: 700,
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  });

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={0} sx={neuCardStyle}>
        {/* Soft Neumorphic Header Icon */}
        <Box sx={neuIconPodStyle}>
          <MarkEmailReadOutlinedIcon
            color="primary"
            sx={{
              fontSize: 56,
              filter: isDark
                ? "drop-shadow(0 2px 8px rgba(59, 130, 246, 0.4))"
                : "drop-shadow(0 2px 6px rgba(0, 40, 85, 0.2))",
            }}
          />
        </Box>

        {/* Title & Subtitle */}
        <Typography
          variant="h4"
          component="h1"
          fontWeight={800}
          color="text.primary"
          gutterBottom
          sx={{
            fontSize: { xs: "1.5rem", sm: "1.75rem" },
            letterSpacing: "-0.02em",
          }}
        >
          Account Created Successfully!
        </Typography>

        <Typography
          variant="h6"
          component="h2"
          fontWeight={600}
          color="primary.main"
          sx={{
            fontSize: { xs: "1.05rem", sm: "1.15rem" },
            mb: 1,
          }}
        >
          Check Your Inbox
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, maxWidth: 440, mx: "auto" }}
        >
          Your BukSU mentorship account is created. Please verify your email before accessing the dashboard.
        </Typography>

        {/* Dynamic Email Badge */}
        {email && (
          <Box sx={{ my: 1.5 }}>
            <Chip
              label={`Sent to: ${email}`}
              variant="outlined"
              color="primary"
              sx={{
                fontWeight: 600,
                fontSize: "0.875rem",
                px: 1,
                py: 2.2,
                borderRadius: "12px",
                backgroundColor: isDark
                  ? "rgba(59, 130, 246, 0.1)"
                  : "rgba(0, 40, 85, 0.05)",
                borderColor: isDark ? "#3B82F6" : "#002855",
                color: isDark ? "#93C5FD" : "#002855",
              }}
            />
          </Box>
        )}

        {/* Feedback Alert Toast */}
        {feedbackAlert.message && (
          <Alert
            severity={feedbackAlert.type === "success" ? "success" : "error"}
            onClose={() => setFeedbackAlert({ type: "", message: "" })}
            sx={{ my: 2, textAlign: "left", borderRadius: 2 }}
          >
            {feedbackAlert.message}
          </Alert>
        )}

        {/* Guidance Stepper / Checklist */}
        <Box sx={neuSunkenStepBox}>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            color="text.primary"
            sx={{
              mb: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <CheckCircleOutlineIcon color="primary" sx={{ fontSize: 18 }} />
            Next Steps to Complete Activation:
          </Typography>

          <Stack spacing={1.5}>
            {/* Step 1 */}
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={stepNumberStyle(1)}>1</Box>
              <Typography variant="body2" color="text.secondary" sx={{ pt: 0.2 }}>
                Open your <strong style={{ color: isDark ? "#F8FAFC" : "#1E293B" }}>BukSU Institutional Email</strong> inbox (or check spam/junk folder).
              </Typography>
            </Stack>

            {/* Step 2 */}
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={stepNumberStyle(2)}>2</Box>
              <Typography variant="body2" color="text.secondary" sx={{ pt: 0.2 }}>
                Click the <strong style={{ color: isDark ? "#F8FAFC" : "#1E293B" }}>Email Verification Link</strong> sent to activate your account.
              </Typography>
            </Stack>

            {/* Step 3 */}
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={stepNumberStyle(3)}>3</Box>
              <Typography variant="body2" color="text.secondary" sx={{ pt: 0.2 }}>
                Once verified, <strong style={{ color: isDark ? "#F8FAFC" : "#1E293B" }}>log in to complete your profile onboarding</strong>.
              </Typography>
            </Stack>
          </Stack>
        </Box>

        {/* Action Controls */}
        <Stack spacing={2} sx={{ mt: 3 }}>
          {/* Primary "Go to Login" Button */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            endIcon={<ArrowForwardIcon />}
            onClick={handleGoToLogin}
            aria-label="Go to Login — Proceed to Sign In"
            sx={{
              py: 1.4,
              fontWeight: 700,
              fontSize: "0.95rem",
              borderRadius: "12px",
              textTransform: "none",
              backgroundColor: isDark ? "#3B82F6" : "#002855",
              color: "#ffffff",
              boxShadow: isDark
                ? "4px 4px 10px #0a0f18"
                : "4px 4px 10px rgba(0, 40, 85, 0.25)",
              "&:hover": {
                backgroundColor: isDark ? "#2563EB" : "#001a38",
              },
            }}
          >
            Go to Login
          </Button>

          {/* Secondary "Resend Verification Email" Button with 60s cooldown */}
          <Button
            variant="outlined"
            size="medium"
            fullWidth
            disabled={cooldown > 0 || resending}
            startIcon={resending ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
            onClick={handleResend}
            sx={{
              py: 1.2,
              fontWeight: 600,
              borderRadius: "12px",
              textTransform: "none",
              borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "#002855",
              color: isDark ? "#93C5FD" : "#002855",
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 40, 85, 0.02)",
              "&:hover": {
                borderColor: isDark ? "#3B82F6" : "#001a38",
                backgroundColor: isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(0, 40, 85, 0.06)",
              },
              "&.Mui-disabled": {
                color: isDark ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.15)",
              },
            }}
          >
            {cooldown > 0
              ? `Resend Email (${cooldown}s)`
              : resending
              ? "Sending Verification Link..."
              : "Resend Verification Email"}
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
