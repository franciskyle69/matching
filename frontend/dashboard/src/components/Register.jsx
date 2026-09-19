import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";

export const CAMPUS_OPTIONS = [
  "Main Campus (Malaybalay)",
  "Alubijod Campus",
  "Baungon Campus",
  "Cabanglasan Campus",
  "Damulog Campus",
  "Kadingilan Campus",
  "Kalilangan Campus",
  "Libona Campus",
  "Malitbog Campus",
  "Maramag Campus",
  "Medina Campus",
  "San Fernando Campus",
  "Talakag Campus",
];

export default function Register({ onRegisterSuccess, onNavigateToLogin }) {
  const [role, setRole] = useState("MENTEE");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [campus, setCampus] = useState("Main Campus (Malaybalay)");
  const [program, setProgram] = useState("BSIT");
  const [yearLevel, setYearLevel] = useState(1);

  // Files for mentors
  const [letterOfIntent, setLetterOfIntent] = useState(null);
  const [studyLoad, setStudyLoad] = useState(null);
  const [grades, setGrades] = useState(null);
  const [facultyVerification, setFacultyVerification] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  // Update default year level when role changes
  useEffect(() => {
    if (role === "MENTEE") {
      setYearLevel(1);
    } else if (role === "STUDENT_MENTOR") {
      setYearLevel(3);
    } else if (role === "INSTRUCTOR_MENTOR") {
      setYearLevel(4);
    }
  }, [role]);

  const validateForm = () => {
    if (!firstName.trim() || !lastName.trim()) {
      return "Please enter your full first name and last name.";
    }
    if (!email.trim()) {
      return "Please enter your BukSU email address.";
    }

    // Domain validation
    const lowerEmail = email.trim().toLowerCase();
    if (role === "MENTEE" || role === "STUDENT_MENTOR") {
      if (!lowerEmail.endsWith("@student.buksu.edu.ph")) {
        return "Student accounts require an @student.buksu.edu.ph email address.";
      }
    } else if (role === "INSTRUCTOR_MENTOR" || role === "COORDINATOR") {
      if (!lowerEmail.endsWith("@buksu.edu.ph") || lowerEmail.endsWith("@student.buksu.edu.ph")) {
        return "Faculty & Coordinator accounts require a faculty @buksu.edu.ph email address.";
      }
    }

    if (!password) {
      return "Please enter a password.";
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters long.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    // Required files validation
    if (role === "STUDENT_MENTOR") {
      if (!letterOfIntent) {
        return "Letter of Intent is required for Student Mentors.";
      }
      if (!studyLoad) {
        return "Study Load document is required for Student Mentors.";
      }
      if (!grades) {
        return "Grades / Transcript document is required for Student Mentors.";
      }
    } else if (role === "INSTRUCTOR_MENTOR") {
      if (!facultyVerification) {
        return "Faculty Verification Document is required for Instructor Mentors.";
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("first_name", firstName.trim());
      formData.append("last_name", lastName.trim());
      formData.append("full_name", `${firstName.trim()} ${lastName.trim()}`);
      formData.append("email", email.trim().toLowerCase());
      formData.append("password", password);
      formData.append("role", role);
      formData.append("campus", campus);
      formData.append("program", program);
      formData.append("year_level", String(yearLevel));

      if (role === "STUDENT_MENTOR") {
        if (letterOfIntent) formData.append("letter_of_intent", letterOfIntent);
        if (studyLoad) formData.append("study_load", studyLoad);
        if (grades) formData.append("grades", grades);
      } else if (role === "INSTRUCTOR_MENTOR") {
        if (facultyVerification) formData.append("faculty_verification", facultyVerification);
      }

      const response = await fetch("/api/auth/register/", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorText =
          data.error ||
          (data.errors && Object.values(data.errors).flat().join(" ")) ||
          (typeof data === "string" ? data : "Registration failed. Please check your inputs.");
        setErrorMessage(errorText);
        setLoading(false);
        return;
      }

      // Store JWT tokens
      if (data.access_token) {
        localStorage.setItem("accessToken", data.access_token);
        localStorage.setItem("token", data.access_token);
      }
      if (data.refresh_token) {
        localStorage.setItem("refreshToken", data.refresh_token);
      }

      const user = data.user || {};
      const approvalStatus = user.approval_status || (role === "MENTEE" ? "ACTIVE" : "PENDING_APPROVAL");

      if (onRegisterSuccess) {
        onRegisterSuccess(data);
      }

      if (approvalStatus === "ACTIVE") {
        // Mentee active: go directly to onboarding
        window.location.hash = "#/onboarding";
      } else {
        // Mentor pending: show approval modal
        setApprovalModalOpen(true);
      }
    } catch (err) {
      console.error("Registration error:", err);
      setErrorMessage("Network error connecting to registration service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderFileUploadSlot = (id, label, file, setFile, helperText) => (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        backgroundColor: file ? "rgba(46, 125, 50, 0.04)" : "rgba(0, 0, 0, 0.02)",
        borderColor: file ? "success.main" : "divider",
        borderStyle: file ? "solid" : "dashed",
        borderWidth: 2,
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          borderColor: "primary.main",
          backgroundColor: "rgba(19, 64, 116, 0.04)",
        },
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={600} color="text.primary">
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {helperText}
          </Typography>
          {file && (
            <Chip
              icon={<DescriptionOutlinedIcon fontSize="small" />}
              label={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
              color="success"
              size="small"
              onDelete={() => setFile(null)}
              sx={{ mt: 1, maxWidth: "100%" }}
            />
          )}
        </Box>
        <Button
          component="label"
          variant={file ? "outlined" : "contained"}
          color={file ? "success" : "primary"}
          startIcon={<CloudUploadOutlinedIcon />}
          size="small"
          sx={{ textTransform: "none", flexShrink: 0 }}
        >
          {file ? "Change File" : "Upload File"}
          <input
            id={id}
            type="file"
            hidden
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
              }
            }}
          />
        </Button>
      </Stack>
    </Paper>
  );

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
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
            BukSU IT Mentorship Registration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Join the smart mentorship ecosystem. Connect, learn, and grow with faculty and peer mentors.
          </Typography>
        </Box>


        {errorMessage && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errorMessage}
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing={3.5}>
            {/* Role Selection */}
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ fontWeight: 600, color: "#002855", mb: 1 }}>
                Select Your Role in the Mentorship Program
              </FormLabel>
              <RadioGroup
                row
                value={role}
                onChange={(e) => setRole(e.target.value)}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  gap: 1.5,
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: role === "MENTEE" ? "primary.main" : "divider",
                    backgroundColor: role === "MENTEE" ? "rgba(19, 64, 116, 0.04)" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => setRole("MENTEE")}
                >
                  <FormControlLabel
                    value="MENTEE"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Mentee
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Seeking academic guidance
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, width: "100%" }}
                  />
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: role === "STUDENT_MENTOR" ? "primary.main" : "divider",
                    backgroundColor: role === "STUDENT_MENTOR" ? "rgba(19, 64, 116, 0.04)" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => setRole("STUDENT_MENTOR")}
                >
                  <FormControlLabel
                    value="STUDENT_MENTOR"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Student Mentor
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Senior IT peer tutor
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, width: "100%" }}
                  />
                </Paper>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    borderColor: role === "INSTRUCTOR_MENTOR" ? "primary.main" : "divider",
                    backgroundColor: role === "INSTRUCTOR_MENTOR" ? "rgba(19, 64, 116, 0.04)" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => setRole("INSTRUCTOR_MENTOR")}
                >
                  <FormControlLabel
                    value="INSTRUCTOR_MENTOR"
                    control={<Radio size="small" />}
                    label={
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>
                          Instructor Mentor
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          BukSU IT Faculty member
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0, width: "100%" }}
                  />
                </Paper>
              </RadioGroup>
            </FormControl>

            <Divider />

            {/* Personal & Account Information */}
            <Typography variant="h6" fontWeight={600} color="#002855">
              Personal & Account Information
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="BukSU Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  size="small"
                  helperText={
                    role === "INSTRUCTOR_MENTOR"
                      ? "Must end with @buksu.edu.ph (faculty email)"
                      : "Must end with @student.buksu.edu.ph (student email)"
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  required
                  size="small"
                  helperText="Minimum 8 characters"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
            </Grid>

            <Divider />

            {/* Academic Information */}
            <Typography variant="h6" fontWeight={600} color="#002855">
              Academic Information
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="campus-label">Campus</InputLabel>
                  <Select
                    labelId="campus-label"
                    value={campus}
                    label="Campus"
                    onChange={(e) => setCampus(e.target.value)}
                  >
                    {CAMPUS_OPTIONS.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Program"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  fullWidth
                  size="small"
                  disabled
                  helperText="Bachelor of Science in Information Technology"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="year-level-label">Year Level</InputLabel>
                  <Select
                    labelId="year-level-label"
                    value={yearLevel}
                    label="Year Level"
                    onChange={(e) => setYearLevel(Number(e.target.value))}
                  >
                    <MenuItem value={1}>1st Year</MenuItem>
                    <MenuItem value={2}>2nd Year</MenuItem>
                    <MenuItem value={3}>3rd Year</MenuItem>
                    <MenuItem value={4}>4th Year</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Conditional Document Upload Fields */}
            {role === "STUDENT_MENTOR" && (
              <>
                <Divider />
                <Box>
                  <Typography variant="h6" fontWeight={600} color="#002855">
                    Student Mentor Application Documents
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Please attach your verification credentials. Supported formats: PDF, PNG, JPG (Max 10MB per file).
                  </Typography>

                  <Stack spacing={2}>
                    {renderFileUploadSlot(
                      "letter_of_intent",
                      "1. Letter of Intent",
                      letterOfIntent,
                      setLetterOfIntent,
                      "Addressed to the BukSU IT Mentorship Coordinator"
                    )}
                    {renderFileUploadSlot(
                      "study_load",
                      "2. Current Study Load / Certificate of Registration",
                      studyLoad,
                      setStudyLoad,
                      "Proof of active senior student enrollment"
                    )}
                    {renderFileUploadSlot(
                      "grades",
                      "3. Summary of Grades / Official Transcript of Record",
                      grades,
                      setGrades,
                      "Verification of academic standing in core IT subjects"
                    )}
                  </Stack>
                </Box>
              </>
            )}

            {role === "INSTRUCTOR_MENTOR" && (
              <>
                <Divider />
                <Box>
                  <Typography variant="h6" fontWeight={600} color="#002855">
                    Faculty Verification Document
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Please attach your BukSU faculty ID or department endorsement (PDF, PNG, JPG).
                  </Typography>

                  {renderFileUploadSlot(
                    "faculty_verification",
                    "Faculty ID or Verification Letter",
                    facultyVerification,
                    setFacultyVerification,
                    "BukSU College of Technologies faculty verification"
                  )}
                </Box>
              </>
            )}

            {/* Submit Button */}
            <Box sx={{ pt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                sx={{
                  py: 1.5,
                  fontSize: "1rem",
                  fontWeight: 600,
                  backgroundColor: "#002855",
                  "&:hover": {
                    backgroundColor: "#0b2545",
                  },
                }}
              >
                {loading ? <CircularProgress size={26} color="inherit" /> : "Complete Registration"}
              </Button>
            </Box>

            <Box sx={{ textAlign: "center", pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{" "}
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    if (onNavigateToLogin) onNavigateToLogin();
                    else window.location.hash = "#/signin";
                  }}
                  sx={{ fontWeight: 600, textTransform: "none" }}
                >
                  Sign In
                </Button>
              </Typography>
            </Box>
          </Stack>
        </form>
      </Paper>

      {/* Success Modal for Pending Mentor Approval */}
      <Dialog
        open={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          window.location.hash = "#/signin";
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "#002855" }}>
          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 32 }} />
          Registration Submitted!
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.primary", fontSize: "1.05rem", mb: 2 }}>
            Your application and attached documents are pending Coordinator approval.
          </DialogContentText>
          <Typography variant="body2" color="text.secondary">
            Our Department Coordinator will review your submitted credentials. Once approved, your account will be activated, and you will receive an email confirmation to access the mentorship dashboard.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button
            variant="contained"
            onClick={() => {
              setApprovalModalOpen(false);
              window.location.hash = "#/signin";
            }}
            sx={{ textTransform: "none", backgroundColor: "#002855" }}
          >
            Back to Sign In
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
