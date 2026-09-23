import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  CircularProgress,
  InputAdornment,
  IconButton,
  Paper,
} from "@mui/material";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

function useSafeNavigate() {
  try {
    return useNavigate();
  } catch (e) {
    return (to, options) => {
      if (options?.state && typeof window !== "undefined") {
        window.history.pushState({ usr: options.state }, "", to);
      }
      if (typeof window !== "undefined") {
        window.location.href = to;
      }
    };
  }
}

export default function ResetPasswordConfirm({
  uid: propUid,
  token: propToken,
  onSuccess,
}) {
  const navigate = useSafeNavigate();

  let routeUid = "";
  let routeToken = "";
  try {
    const params = useParams();
    routeUid = params?.uidb64 || params?.uid || "";
    routeToken = params?.token || "";
  } catch (e) {}

  const [uid, setUid] = useState(propUid || routeUid || "");
  const [token, setToken] = useState(propToken || routeToken || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!uid || !token) {
      try {
        const search = new URLSearchParams(window.location.search);
        const u = search.get("uid") || search.get("uidb64") || "";
        const t = search.get("token") || "";
        if (u) setUid(u);
        if (t) setToken(t);

        // Also check hash: #/reset/<uid>/<token>
        const hash = window.location.hash || "";
        const match = hash.match(/reset\/([^/?#]+)\/([^/?#]+)/);
        if (match) {
          if (!u) setUid(match[1]);
          if (!t) setToken(match[2]);
        }
      } catch (e) {}
    }
  }, [uid, token]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSuccess || loading) return;

    setErrorMessage("");

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please verify and try again.");
      return;
    }

    if (newPassword.length < 10) {
      setErrorMessage("Password must be at least 10 characters long.");
      return;
    }

    if (!/\d/.test(newPassword)) {
      setErrorMessage("Password must contain at least one number.");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      setErrorMessage("Password must contain at least one special character.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/password-reset-confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uidb64: uid,
          uid: uid,
          token: token,
          new_password1: newPassword,
          new_password2: confirmPassword,
          password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorText =
          data.error ||
          (data.errors && Object.values(data.errors).flat().join(" ")) ||
          "Failed to reset password. The link may have expired or is invalid.";
        setErrorMessage(errorText);
        return;
      }

      // Success: DO NOT redirect instantly.
      // Set state variable and display green success banner
      setIsSuccess(true);
      setSuccessMessage("Password reset successful! Redirecting to login...");

      if (onSuccess) {
        onSuccess(data);
      }

      // Wait 3 seconds using setTimeout before navigating to /login with state message
      setTimeout(() => {
        navigate("/login", {
          state: {
            message:
              "Your password has been reset successfully. Please log in with your new password.",
          },
        });
      }, 3000);
    } catch (err) {
      console.error("Password reset error:", err);
      setErrorMessage("Network error while resetting password. Please try again.");
    } finally {
      setLoading(false);
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
          boxShadow: "0 10px 30px rgba(0, 40, 85, 0.08)",
        }}
      >
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <LockResetOutlinedIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
          <Typography variant="h4" component="h1" fontWeight={700} color="#002855" gutterBottom>
            Set New Password
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Create a strong new password for your PeerLink account.
          </Typography>
        </Box>

        {isSuccess && (
          <Alert severity="success" sx={{ mb: 3 }} role="alert">
            {successMessage || "Password reset successful! Redirecting to login..."}
          </Alert>
        )}

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 3 }} role="alert">
            {errorMessage}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing={3}>
            <TextField
              label="New Password"
              type={showPassword ? "text" : "password"}
              name="newPassword"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              required
              fullWidth
              disabled={loading || isSuccess}
              placeholder="••••••••"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading || isSuccess}
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Confirm New Password"
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              required
              fullWidth
              disabled={loading || isSuccess}
              placeholder="••••••••"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || isSuccess}
              sx={{
                py: 1.5,
                fontWeight: 600,
                fontSize: "1rem",
                borderRadius: 2,
                backgroundColor: "#002855",
                "&:hover": {
                  backgroundColor: "#001b3a",
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : isSuccess ? (
                "Password Reset!"
              ) : (
                "Change Password"
              )}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
