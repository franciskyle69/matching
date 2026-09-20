import React, { useState, useEffect } from "react";
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
  Divider,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function Login({ onLoginSuccess, onNavigateRegister }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [isUnverified, setIsUnverified] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState("");

  // Check URL parameters for OAuth error responses
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.includes("?") ? window.location.hash.split("?")[1] : ""
      );
      const oauthError =
        (searchParams.get("oauth_error") || hashParams.get("oauth_error") || "").toLowerCase();

      if (oauthError === "no_account") {
        setErrorMessage(
          "No account found with this email. Please complete the manual registration first."
        );
        setShowRegisterPrompt(true);
      } else if (oauthError === "institutional_email") {
        setErrorMessage("Please use your BukSU institutional email address.");
      } else if (oauthError === "missing_email") {
        setErrorMessage("Google account email could not be read.");
      }
    } catch (e) {
      console.warn("Failed to parse query params:", e);
    }
  }, []);

  const goToRegister = () => {
    if (onNavigateRegister) {
      onNavigateRegister();
    } else {
      window.location.hash = "#signup";
    }
  };

  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setShowRegisterPrompt(false);
    setIsUnverified(false);
    setResendSuccess("");

    if (!identifier.trim() || !password) {
      setErrorMessage("Please enter both your email/username and password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorText =
          data.error ||
          (data.errors && Object.values(data.errors).flat().join(" ")) ||
          "Login failed. Please check your credentials.";

        if (
          response.status === 403 &&
          (data.code === "email_not_verified" ||
            errorText.toLowerCase().includes("verify your buksu email"))
        ) {
          setIsUnverified(true);
          setUnverifiedEmail(data.email || identifier.trim());
          setErrorMessage("Your email is not verified.");
          return;
        }

        setErrorMessage(errorText);
        if (
          errorText.toLowerCase().includes("no account found") ||
          errorText.toLowerCase().includes("complete the manual registration")
        ) {
          setShowRegisterPrompt(true);
        }
        return;
      }

      if (data.access_token) {
        localStorage.setItem("accessToken", data.access_token);
        localStorage.setItem("token", data.access_token);
      }
      if (data.refresh_token) {
        localStorage.setItem("refreshToken", data.refresh_token);
      }

      if (onLoginSuccess) {
        onLoginSuccess(data);
      } else {
        window.location.hash = "#home";
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMessage("Network error connecting to login service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendSuccess("");
    try {
      const res = await fetch("/api/auth/resend-verification/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: unverifiedEmail || identifier.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResendSuccess(data.message || "A verification email has been sent. Please check your inbox.");
      } else {
        setErrorMessage(data.error || "Failed to resend verification email. Please try again later.");
      }
    } catch (e) {
      setErrorMessage("Network error while resending verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleGoogleLogin = async (googleTokenPayload = null) => {
    setErrorMessage("");
    setShowRegisterPrompt(false);

    // If a token payload is supplied (e.g. from Google credential response)
    if (googleTokenPayload && typeof googleTokenPayload === "object") {
      setGoogleLoading(true);
      try {
        const response = await fetch("/api/auth/google/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(googleTokenPayload),
        });

        const data = await response.json();

        if (!response.ok) {
          const errorText =
            data.error ||
            "No account found with this email. Please complete the manual registration first.";
          setErrorMessage(errorText);
          if (
            response.status === 401 ||
            errorText.toLowerCase().includes("no account found") ||
            errorText.toLowerCase().includes("manual registration")
          ) {
            setShowRegisterPrompt(true);
          }
          return;
        }

        if (data.access_token) {
          localStorage.setItem("accessToken", data.access_token);
          localStorage.setItem("token", data.access_token);
        }
        if (data.refresh_token) {
          localStorage.setItem("refreshToken", data.refresh_token);
        }

        if (onLoginSuccess) {
          onLoginSuccess(data);
        } else {
          window.location.hash = "#home";
        }
      } catch (err) {
        console.error("Google login error:", err);
        setErrorMessage("Network error during Google login. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
      return;
    }

    // Default redirect to Google OAuth login endpoint
    window.location.href = "/accounts/google/start/login/";
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
          <SchoolOutlinedIcon sx={{ fontSize: 44, color: "primary.main", mb: 1 }} />
          <Typography variant="h4" component="h1" fontWeight={700} color="#002855" gutterBottom>
            BukSU IT Mentorship Login
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Welcome back! Sign in to access your smart mentorship dashboard.
          </Typography>
        </Box>

        {resendSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {resendSuccess}
          </Alert>
        )}

        {errorMessage && (
          <Alert
            severity={isUnverified ? "warning" : "error"}
            sx={{ mb: 3 }}
            action={
              isUnverified ? (
                <Button
                  color="inherit"
                  size="small"
                  disabled={resendLoading}
                  onClick={handleResendVerification}
                  sx={{ fontWeight: 600, textDecoration: "underline" }}
                >
                  {resendLoading ? <CircularProgress size={18} /> : "Resend Verification Email"}
                </Button>
              ) : showRegisterPrompt ? (
                <Button color="inherit" size="small" onClick={goToRegister}>
                  Register Now
                </Button>
              ) : undefined
            }
          >
            {errorMessage}
          </Alert>
        )}

        <form onSubmit={handlePasswordLogin} noValidate>
          <Stack spacing={3}>
            <TextField
              label="Email or Username"
              type="text"
              name="identifier"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              required
              fullWidth
              autoComplete="username"
              placeholder="you@student.buksu.edu.ph or username"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlinedIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage("");
              }}
              required
              fullWidth
              autoComplete="current-password"
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
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: -1.5 }}>
              <Button
                variant="text"
                size="small"
                href="/accounts/password_reset/"
                sx={{
                  fontWeight: 600,
                  textTransform: "none",
                  p: 0,
                  minWidth: "auto",
                  color: "#002855",
                  fontSize: "0.875rem",
                  "&:hover": { textDecoration: "underline", backgroundColor: "transparent" },
                }}
              >
                Forgot password?
              </Button>
            </Box>

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading || googleLoading}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : "Sign In"}
            </Button>
          </Stack>
        </form>

        <Divider sx={{ my: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Or continue with
          </Typography>
        </Divider>

        <Button
          type="button"
          variant="outlined"
          size="large"
          fullWidth
          disabled={loading || googleLoading}
          startIcon={googleLoading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
          onClick={() => handleGoogleLogin()}
          sx={{
            py: 1.2,
            fontWeight: 600,
            borderRadius: 2,
            borderColor: "#d1d5db",
            color: "#1f2937",
            "&:hover": {
              borderColor: "#9ca3af",
              backgroundColor: "rgba(0, 0, 0, 0.02)",
            },
          }}
        >
          {googleLoading ? "Signing in with Google..." : "Log in with Google"}
        </Button>

        <Box sx={{ textAlign: "center", mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{" "}
            <Button
              variant="text"
              size="small"
              onClick={goToRegister}
              sx={{ fontWeight: 600, textTransform: "none", p: 0, minWidth: "auto" }}
            >
              Sign up
            </Button>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
