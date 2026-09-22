import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
  Alert,
  useTheme,
} from "@mui/material";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";

export default function VerifyEmail({ uidb64: propUid, token: propToken, onNavigateToLogin }) {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const muiTheme = useTheme();
  const isDark =
    muiTheme?.palette?.mode === "dark" ||
    (typeof document !== "undefined" &&
      (document.documentElement.getAttribute("data-theme") === "dark" ||
        document.documentElement.classList.contains("dark")));

  const neuCardStyle = {
    p: { xs: 3.5, sm: 5 },
    borderRadius: "24px",
    backgroundColor: isDark ? "#151D2A" : "#FFFFFF",
    boxShadow: isDark
      ? "8px 8px 20px #080d16, -8px -8px 20px #1e2b3c"
      : "0 10px 30px rgba(0, 40, 85, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)",
    border: isDark
      ? "1px solid rgba(255, 255, 255, 0.08)"
      : "1px solid rgba(226, 232, 240, 0.8)",
    textAlign: "center",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  const neuIconPodStyle = (type = "neutral") => {
    let tintBg = isDark ? "#101827" : "#E6ECF5";
    if (type === "success") {
      tintBg = isDark ? "rgba(34, 197, 94, 0.16)" : "rgba(46, 125, 50, 0.12)";
    } else if (type === "error") {
      tintBg = isDark ? "rgba(239, 68, 68, 0.16)" : "rgba(211, 47, 47, 0.12)";
    }
    return {
      width: 80,
      height: 80,
      borderRadius: "50%",
      backgroundColor: tintBg,
      boxShadow: isDark
        ? "inset 3px 3px 8px #080d16, inset -3px -3px 8px #182335"
        : "inset 3px 3px 8px #c5d0e0, inset -3px -3px 8px #ffffff",
      border: isDark
        ? "1px solid rgba(255, 255, 255, 0.06)"
        : "1px solid rgba(255, 255, 255, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: "0 auto 20px auto",
    };
  };

  const primaryBtnStyle = {
    py: 1.5,
    fontWeight: 600,
    fontSize: "1rem",
    borderRadius: 2,
    backgroundColor: isDark ? "#38BDF8" : "#002855",
    color: isDark ? "#0F172A" : "#FFFFFF",
    "&:hover": {
      backgroundColor: isDark ? "#0EA5E9" : "#001a38",
    },
    boxShadow: isDark
      ? "0 4px 14px rgba(56, 189, 248, 0.3)"
      : "0 4px 14px rgba(0, 40, 85, 0.25)",
  };

  useEffect(() => {
    let uid = propUid;
    let tok = propToken;

    // Extract from path or hash if not passed as props
    if (!uid || !tok) {
      const pathname = window.location.pathname || "";
      const hash = window.location.hash || "";

      // Match path: /verify-email/<uidb64>/<token> (optional trailing slash)
      const pathMatch = pathname.match(/\/verify-email\/([^/?#]+)\/([^/?#]+)/);
      if (pathMatch) {
        uid = pathMatch[1];
        tok = pathMatch[2];
      }

      // Match hash: #/verify-email/<uidb64>/<token>
      if (!uid || !tok) {
        const hashMatch = hash.match(/verify-email\/([^/?#]+)\/([^/?#]+)/);
        if (hashMatch) {
          uid = hashMatch[1];
          tok = hashMatch[2];
        }
      }

      // Query params fallback: ?uidb64=...&token=...
      if (!uid || !tok) {
        const searchParams = new URLSearchParams(window.location.search || "");
        const hashQuery = hash.includes("?") ? new URLSearchParams(hash.split("?")[1]) : null;
        uid = uid || searchParams.get("uid") || searchParams.get("uidb64") || (hashQuery ? hashQuery.get("uid") || hashQuery.get("uidb64") : null);
        tok = tok || searchParams.get("token") || (hashQuery ? hashQuery.get("token") : null);
      }

      if (uid) uid = decodeURIComponent(uid).replace(/\/+$/, "").trim();
      if (tok) tok = decodeURIComponent(tok).replace(/\/+$/, "").trim();
    }

    if (!uid || !tok) {
      setLoading(false);
      setErrorMessage("Invalid or missing email verification parameters.");
      return;
    }

    const verifyToken = async () => {
      try {
        const payload = JSON.stringify({ uid: uid, uidb64: uid, token: tok });
        const headers = { "Content-Type": "application/json" };
        const csrfCookie = typeof document !== "undefined"
          ? (document.cookie.match(/(?:^|; )csrftoken=([^;]*)/) || [])[1]
          : null;
        if (csrfCookie) {
          headers["X-CSRFToken"] = decodeURIComponent(csrfCookie);
        }

        let response = await fetch("/api/verify-email/", {
          method: "POST",
          headers,
          body: payload,
        });

        if (response.status === 404) {
          response = await fetch("/api/auth/verify-email/", {
            method: "POST",
            headers,
            body: payload,
          });
        }

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          setSuccess(true);
          setMessage(data.message || "Email verified successfully! You can now log in.");
        } else {
          setSuccess(false);
          setErrorMessage(data.error || data.detail || "Verification token is invalid or has expired.");
        }
      } catch (err) {
        console.error("Email verification error:", err);
        setSuccess(false);
        setErrorMessage("Network error verifying email. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [propUid, propToken]);

  const handleProceedLogin = () => {
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      window.location.href = "/app/#signin";
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 6 } }}>
      <Paper elevation={0} sx={neuCardStyle}>
        <Box sx={{ mb: 3 }}>
          <SchoolOutlinedIcon sx={{ fontSize: 48, color: isDark ? "#38BDF8" : "#002855", mb: 1 }} />
          <Typography variant="h5" fontWeight={700} sx={{ color: isDark ? "#F8FAFC" : "#002855" }}>
            BukSU IT PeerLink
          </Typography>
          <Typography variant="body2" sx={{ color: isDark ? "#94A3B8" : "text.secondary" }}>
            Academic Mentoring Ecosystem
          </Typography>
        </Box>

        {loading && (
          <Box sx={{ py: 4 }}>
            <CircularProgress size={52} thickness={4} sx={{ color: isDark ? "#38BDF8" : "primary.main", mb: 2 }} />
            <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: isDark ? "#F8FAFC" : "text.primary" }}>
              Verifying your BukSU email address...
            </Typography>
            <Typography variant="body2" sx={{ color: isDark ? "#94A3B8" : "text.secondary" }}>
              Please wait while we confirm your institutional credentials.
            </Typography>
          </Box>
        )}

        {!loading && success && (
          <Box sx={{ py: 2 }}>
            <Box sx={neuIconPodStyle("success")}>
              <MarkEmailReadOutlinedIcon sx={{ fontSize: 44, color: isDark ? "#4ADE80" : "success.main" }} />
            </Box>

            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: isDark ? "#4ADE80" : "success.main" }}>
              Email Verified Successfully!
            </Typography>
            <Typography variant="body1" sx={{ mb: 4, maxWidth: 420, mx: "auto", color: isDark ? "#CBD5E1" : "text.secondary" }}>
              {message || "Your BukSU institutional email address has been verified. You can now log in to PeerLink."}
            </Typography>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleProceedLogin}
              sx={primaryBtnStyle}
            >
              Proceed to Login
            </Button>
          </Box>
        )}

        {!loading && !success && (
          <Box sx={{ py: 2 }}>
            <Box sx={neuIconPodStyle("error")}>
              <ErrorOutlineOutlinedIcon sx={{ fontSize: 44, color: isDark ? "#F87171" : "error.main" }} />
            </Box>

            <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: isDark ? "#F87171" : "error.main" }}>
              Verification Failed
            </Typography>
            <Alert
              severity="error"
              sx={{
                mb: 3,
                textAlign: "left",
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.12)" : undefined,
                color: isDark ? "#FCA5A5" : undefined,
              }}
            >
              {errorMessage || "Activation link is invalid or expired."}
            </Alert>
            <Typography variant="body2" sx={{ mb: 3, color: isDark ? "#94A3B8" : "text.secondary" }}>
              The verification link may have expired or already been used. Please log in to request a fresh verification link.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                onClick={handleProceedLogin}
                sx={primaryBtnStyle}
              >
                Go to Sign In
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Container>
  );
}
