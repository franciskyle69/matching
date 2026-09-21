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
} from "@mui/material";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";

export default function VerifyEmail({ uidb64: propUid, token: propToken, onNavigateToLogin }) {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let uid = propUid;
    let tok = propToken;

    // Extract from path or hash if not passed as props
    if (!uid || !tok) {
      const pathname = window.location.pathname || "";
      const hash = window.location.hash || "";

      // Match path: /verify-email/<uidb64>/<token>
      const pathMatch = pathname.match(/\/verify-email\/([^/]+)\/([^/]+)/);
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
        const searchParams = new URLSearchParams(window.location.search);
        const hashQuery = hash.includes("?") ? new URLSearchParams(hash.split("?")[1]) : null;
        uid = uid || searchParams.get("uidb64") || searchParams.get("uid") || (hashQuery ? hashQuery.get("uidb64") || hashQuery.get("uid") : null);
        tok = tok || searchParams.get("token") || (hashQuery ? hashQuery.get("token") : null);
      }
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
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: 3,
          backgroundColor: "#ffffff",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0, 40, 85, 0.08)",
        }}
      >
        <Box sx={{ mb: 3 }}>
          <SchoolOutlinedIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
          <Typography variant="h5" fontWeight={700} color="#002855">
            BukSU IT PeerLink
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Academic Mentoring Ecosystem
          </Typography>
        </Box>

        {loading && (
          <Box sx={{ py: 4 }}>
            <CircularProgress size={52} thickness={4} sx={{ color: "primary.main", mb: 2 }} />
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Verifying your BukSU email address...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we confirm your institutional credentials.
            </Typography>
          </Box>
        )}

        {!loading && success && (
          <Box sx={{ py: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                backgroundColor: "rgba(46, 125, 50, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <MarkEmailReadOutlinedIcon sx={{ fontSize: 44, color: "success.main" }} />
            </Box>

            <Typography variant="h5" fontWeight={700} color="success.main" gutterBottom>
              Email Verified Successfully!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 420, mx: "auto" }}>
              {message || "Your BukSU institutional email address has been verified. You can now log in to PeerLink."}
            </Typography>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleProceedLogin}
              sx={{
                py: 1.5,
                fontWeight: 600,
                fontSize: "1rem",
                borderRadius: 2,
                backgroundColor: "#002855",
                "&:hover": {
                  backgroundColor: "#001a38",
                },
              }}
            >
              Proceed to Login
            </Button>
          </Box>
        )}

        {!loading && !success && (
          <Box sx={{ py: 2 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                backgroundColor: "rgba(211, 47, 47, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
              }}
            >
              <ErrorOutlineOutlinedIcon sx={{ fontSize: 44, color: "error.main" }} />
            </Box>

            <Typography variant="h5" fontWeight={700} color="error.main" gutterBottom>
              Verification Failed
            </Typography>
            <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
              {errorMessage || "Activation link is invalid or expired."}
            </Alert>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              The verification link may have expired or already been used. Please log in to request a fresh verification link.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                onClick={handleProceedLogin}
                sx={{
                  py: 1.25,
                  px: 3,
                  fontWeight: 600,
                  borderRadius: 2,
                  backgroundColor: "#002855",
                  "&:hover": { backgroundColor: "#001a38" },
                }}
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
