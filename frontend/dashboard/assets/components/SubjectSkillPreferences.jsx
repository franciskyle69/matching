import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Typography,
  Grid,
  Paper,
  Checkbox,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  FormControlLabel,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";

export const ROLE_LIMITS = {
  MENTEE: {
    label: "Mentee",
    roleLabel: "Mentees",
    minSubjects: 1,
    maxSubjects: 2,
    minTopicsPerSubject: 1,
    maxTopicsPerSubject: 2,
    minCompetenciesPerTopic: 1,
    maxCompetenciesPerTopic: 2,
    minGlobalCompetencies: 1,
    maxGlobalCompetencies: 5,
    minAvailabilitySlots: 1,
    maxAvailabilitySlots: 4,
  },
  STUDENT_MENTOR: {
    label: "Student Mentor",
    roleLabel: "Student Mentors",
    minSubjects: 1,
    maxSubjects: 3,
    minTopicsPerSubject: 1,
    maxTopicsPerSubject: 3,
    minCompetenciesPerTopic: 1,
    maxCompetenciesPerTopic: 3,
    minGlobalCompetencies: 2,
    maxGlobalCompetencies: 10,
    minAvailabilitySlots: 2,
    maxAvailabilitySlots: 6,
  },
  INSTRUCTOR_MENTOR: {
    label: "Instructor Mentor",
    roleLabel: "Instructor Mentors",
    minSubjects: 1,
    maxSubjects: 4,
    minTopicsPerSubject: 1,
    maxTopicsPerSubject: 3,
    minCompetenciesPerTopic: 1,
    maxCompetenciesPerTopic: 3,
    minGlobalCompetencies: 2,
    maxGlobalCompetencies: 10,
    minAvailabilitySlots: 2,
    maxAvailabilitySlots: 6,
  },
};

export function getRoleLimits(role) {
  const norm = String(role || "").trim().toUpperCase();
  if (norm === "MENTEE") return ROLE_LIMITS.MENTEE;
  if (norm === "INSTRUCTOR_MENTOR" || norm === "INSTRUCTOR") return ROLE_LIMITS.INSTRUCTOR_MENTOR;
  if (norm === "STUDENT_MENTOR" || norm === "MENTOR") return ROLE_LIMITS.STUDENT_MENTOR;
  return ROLE_LIMITS.MENTEE;
}

export const CANONICAL_CURRICULUM = [
  {
    code: "IT 111",
    name: "IT 111 - Introduction to Computing",
    topics: [
      {
        name: "UI & Web Fundamentals",
        competencies: ["Figma UI Design", "Flexbox & Grid", "HTML5 Semantic Structure"],
      },
      {
        name: "History & Hardware Evolution",
        competencies: ["Computing Generations", "Processor Architecture", "Memory & Storage Types"],
      },
      {
        name: "Digital Logic & Data Representation",
        competencies: ["Binary/Octal/Hex Conversions", "Boolean Logic Gates", "Data Encoding (ASCII/Unicode)"],
      },
      {
        name: "Operating Systems & Architecture",
        competencies: ["OS Fundamentals", "Process Management", "File Systems & Permissions"],
      },
      {
        name: "Computer Networks Basics",
        competencies: ["Client-Server Architecture", "Network Topologies", "OSI Model Layers"],
      },
    ],
  },
  {
    code: "IT 112",
    name: "IT 112 - Computer Programming",
    topics: [
      {
        name: "Control Structures",
        competencies: ["Loop Control", "Conditional Logic", "Iteration Patterns"],
      },
      {
        name: "Data Structures",
        competencies: ["Array Creation", "1D/2D Manipulation", "Linear/Binary Searching", "Basic Sorting Algorithms"],
      },
      {
        name: "Modular Programming",
        competencies: ["Function Definitions", "Parameters & Return Values", "Variable Scope & Lifetime"],
      },
      {
        name: "Debugging & Execution",
        competencies: ["Console Debugging Techniques", "Logic Troubleshooting", "Syntax Errors"],
      },
    ],
  },
  {
    code: "IT 113",
    name: "IT 113 - IT Fundamentals",
    topics: [
      {
        name: "Web Markup",
        competencies: ["HTML5 Semantic Elements", "Forms & Inputs", "Media & Tables"],
      },
      {
        name: "Web Styling",
        competencies: ["Flexbox & Grid", "CSS Selectors", "Box Model", "Responsive Layouts"],
      },
      {
        name: "Client-Side Scripting",
        competencies: ["DOM Manipulation", "Event Listeners", "JavaScript Syntax"],
      },
      {
        name: "Command Line & Web Infra",
        competencies: ["CLI Navigation", "Domain Name System (DNS)", "HTTP Request Methods"],
      },
    ],
  },
  {
    code: "IT 115",
    name: "IT 115 - Intro to Human Computer Interaction",
    topics: [
      {
        name: "Prototyping & UI Tooling",
        competencies: ["Figma UI Design", "Wireframe Sketching", "Design System & Components"],
      },
      {
        name: "HCI Principles & Guidelines",
        competencies: ["HCI Principles & Paradigms", "Guideline Categories of HCI", "System Prototype Proposal"],
      },
      {
        name: "User Research & Behavioral Mapping",
        competencies: ["Customer Journey Mapping", "User Flow Diagrams", "User Research & Analysis"],
      },
      {
        name: "Interaction Design & Cognitive Models",
        competencies: ["Human Information Processing", "Interaction Design Frameworks"],
      },
      {
        name: "High-Fidelity Design & Documentation",
        competencies: ["High-Fidelity Prototyping", "Design Systems Documentation"],
      },
    ],
  },
  {
    code: "IT 211",
    name: "IT 211 - Data Structures and Algorithms",
    topics: [
      {
        name: "Algorithm Analysis",
        competencies: ["Big-O Asymptotic Notation", "Best/Worst Case Analysis", "Space Complexity"],
      },
      {
        name: "Non-Linear Structures",
        competencies: ["Binary Search Trees", "Tree Traversal", "Graph Representations"],
      },
    ],
  },
  {
    code: "IT 212",
    name: "IT 212 - Object-Oriented Programming",
    topics: [
      {
        name: "OOP Pillars",
        competencies: ["Inheritance & Polymorphism", "Abstract Classes & Interfaces", "Method Overriding/Overloading"],
      },
    ],
  },
];

// Neumorphic Styling Constants
export const NEU_STYLES = {
  bgBase: "#e6ecf5",
  accentBlue: "#1976D2",
  accentDark: "#0D47A1",
  elevatedCard: {
    background: "#e6ecf5",
    boxShadow: "6px 6px 14px #c5d0e0, -6px -6px 14px #ffffff",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.6)",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  pressedCard: {
    background: "#e6ecf5",
    boxShadow: "inset 4px 4px 8px #c5d0e0, inset -4px -4px 8px #ffffff",
    border: "2px solid #1976D2",
    borderRadius: "16px",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  counterPill: {
    boxShadow: "inset 2px 2px 5px #c5d0e0, inset -2px -2px 5px #ffffff",
    background: "#e6ecf5",
    borderRadius: "20px",
    px: 1.8,
    py: 0.6,
    display: "inline-flex",
    alignItems: "center",
    gap: 0.8,
  },
  headerPill: {
    boxShadow: "inset 2px 2px 5px #c5d0e0, inset -2px -2px 5px #ffffff",
    background: "#e6ecf5",
    borderRadius: "20px",
    px: 2,
    py: 0.8,
  },
  topicContainer: {
    background: "#e6ecf5",
    boxShadow: "4px 4px 10px #c5d0e0, -4px -4px 10px #ffffff",
    borderRadius: "14px",
    border: "1px solid rgba(255, 255, 255, 0.7)",
  },
  stickyBar: {
    position: "sticky",
    top: 16,
    zIndex: 10,
    background: "rgba(230, 236, 245, 0.92)",
    backdropFilter: "blur(10px)",
    boxShadow: "6px 6px 14px #c5d0e0, -6px -6px 14px #ffffff",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.8)",
  },
};

export default function SubjectSkillPreferences({
  role = "MENTEE",
  value = {},
  onChange = () => {},
  readOnly = false,
}) {
  const currentLimits = useMemo(() => getRoleLimits(role), [role]);

  const selectedSubjects = value.selectedSubjects || [];
  const selectedTopics = value.selectedTopics || [];
  const selectedCompetencies = value.selectedCompetencies || [];

  const [curriculum, setCurriculum] = useState(CANONICAL_CURRICULUM);
  const [validationError, setValidationError] = useState("");

  // Filter curriculum to only selected subjects
  const activeSubjectObjects = useMemo(() => {
    return curriculum.filter(
      (sub) => selectedSubjects.includes(sub.code) || selectedSubjects.includes(sub.name)
    );
  }, [curriculum, selectedSubjects]);

  const isGlobalCompCapReached = selectedCompetencies.length >= currentLimits.maxGlobalCompetencies;
  const isSubjectCapReached = selectedSubjects.length >= currentLimits.maxSubjects;

  // Toggle Subject
  const handleToggleSubject = (subCode) => {
    if (readOnly) return;
    setValidationError("");

    if (selectedSubjects.includes(subCode)) {
      // Prune its topics & competencies
      const subObj = curriculum.find((s) => s.code === subCode || s.name === subCode);
      const subTopicNames = subObj ? subObj.topics.map((t) => t.name) : [];
      const subCompNames = subObj
        ? subObj.topics.flatMap((t) =>
            typeof t.competencies[0] === "string" ? t.competencies : t.competencies.map((c) => c.name)
          )
        : [];

      onChange({
        ...value,
        selectedSubjects: selectedSubjects.filter((s) => s !== subCode),
        selectedTopics: selectedTopics.filter((t) => !subTopicNames.includes(t)),
        selectedCompetencies: selectedCompetencies.filter((c) => !subCompNames.includes(c)),
      });
    } else {
      if (selectedSubjects.length >= currentLimits.maxSubjects) {
        setValidationError(
          `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxSubjects} subjects.`
        );
        return;
      }
      onChange({
        ...value,
        selectedSubjects: [...selectedSubjects, subCode],
      });
    }
  };

  // Toggle Topic
  const handleToggleTopic = (topicName, subjectObj) => {
    if (readOnly) return;
    setValidationError("");
    const isSelected = selectedTopics.includes(topicName);

    if (isSelected) {
      // Prune competencies under this topic
      const topicObj = subjectObj.topics.find((t) => t.name === topicName);
      const compNames = topicObj
        ? typeof topicObj.competencies[0] === "string"
          ? topicObj.competencies
          : topicObj.competencies.map((c) => c.name)
        : [];

      onChange({
        ...value,
        selectedTopics: selectedTopics.filter((t) => t !== topicName),
        selectedCompetencies: selectedCompetencies.filter((c) => !compNames.includes(c)),
      });
    } else {
      const topicsInThisSubject = subjectObj.topics.map((t) => t.name);
      const currentSelectedInSubj = selectedTopics.filter((t) => topicsInThisSubject.includes(t));
      if (currentSelectedInSubj.length >= currentLimits.maxTopicsPerSubject) {
        setValidationError(
          `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxTopicsPerSubject} topics for ${
            subjectObj.code || subjectObj.name
          }.`
        );
        return;
      }
      onChange({
        ...value,
        selectedTopics: [...selectedTopics, topicName],
      });
    }
  };

  // Toggle Competency
  const handleToggleCompetency = (compName, topicObj) => {
    if (readOnly) return;
    setValidationError("");
    const isSelected = selectedCompetencies.includes(compName);

    if (isSelected) {
      onChange({
        ...value,
        selectedCompetencies: selectedCompetencies.filter((c) => c !== compName),
      });
    } else {
      if (selectedCompetencies.length >= currentLimits.maxGlobalCompetencies) {
        setValidationError(
          `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxGlobalCompetencies} competencies total.`
        );
        return;
      }

      const compsInThisTopic =
        typeof topicObj.competencies[0] === "string"
          ? topicObj.competencies
          : topicObj.competencies.map((c) => c.name);
      const currentSelectedInTopic = selectedCompetencies.filter((c) => compsInThisTopic.includes(c));

      if (currentSelectedInTopic.length >= currentLimits.maxCompetenciesPerTopic) {
        setValidationError(
          `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxCompetenciesPerTopic} competencies for topic '${topicObj.name}'.`
        );
        return;
      }

      onChange({
        ...value,
        selectedCompetencies: [...selectedCompetencies, compName],
      });
    }
  };

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 3.5 }}>
      {validationError && (
        <Alert
          severity="warning"
          onClose={() => setValidationError("")}
          sx={{
            borderRadius: "12px",
            boxShadow: "inset 2px 2px 5px #c5d0e0, inset -2px -2px 5px #ffffff",
            background: "#e6ecf5",
          }}
        >
          {validationError}
        </Alert>
      )}

      {/* ── 1. Core Subjects Section ── */}
      <Box sx={{ ...NEU_STYLES.elevatedCard, p: { xs: 2.5, sm: 3 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Typography variant="h6" fontWeight={700} color="#0D47A1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <MenuBookIcon sx={{ color: "#1976D2", fontSize: 24 }} />
              Core BSIT Subjects
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select academic courses to configure corresponding topics and competencies.
            </Typography>
          </Box>

          {/* Header badge showing real-time counts */}
          <Box sx={NEU_STYLES.counterPill}>
            <Typography variant="caption" fontWeight={700} color={selectedSubjects.length >= currentLimits.minSubjects ? "#0D47A1" : "#D32F2F"}>
              Subjects: {selectedSubjects.length} / {currentLimits.maxSubjects} (Min {currentLimits.minSubjects}, Max {currentLimits.maxSubjects})
            </Typography>
          </Box>
        </Stack>

        <Grid container spacing={2}>
          {curriculum.map((sub) => {
            const isSelected = selectedSubjects.includes(sub.code) || selectedSubjects.includes(sub.name);
            const isDisabled = !isSelected && isSubjectCapReached;

            return (
              <Grid item xs={12} sm={6} md={4} key={sub.code}>
                <Paper
                  onClick={() => !isDisabled && !readOnly && handleToggleSubject(sub.code)}
                  sx={{
                    ...(isSelected ? NEU_STYLES.pressedCard : NEU_STYLES.elevatedCard),
                    p: 2,
                    cursor: isDisabled || readOnly ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.45 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    userSelect: "none",
                    "&:hover": {
                      transform: isDisabled || readOnly || isSelected ? "none" : "translateY(-2px)",
                    },
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled || readOnly}
                    inputProps={{ "aria-label": sub.code }}
                    onChange={() => handleToggleSubject(sub.code)}
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                    sx={{
                      color: "#90A4AE",
                      "&.Mui-checked": { color: "#1976D2" },
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} color={isSelected ? "#0D47A1" : "#37474F"} noWrap>
                      {sub.code}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {sub.name.replace(`${sub.code} - `, "")}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* ── 2. Hierarchy & Skill Tags Section ── */}
      <Box sx={{ ...NEU_STYLES.elevatedCard, p: { xs: 2.5, sm: 3 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" fontWeight={700} color="#0D47A1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <AutoStoriesIcon sx={{ color: "#1976D2", fontSize: 24 }} />
              Competency & Skill Tags
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Expand each subject to select specific topics and granular competencies.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {/* Hierarchy Badge */}
            <Box sx={NEU_STYLES.headerPill}>
              <Typography variant="caption" fontWeight={600} color="#546E7A">
                Hierarchy: Subject → Topic → Competency
              </Typography>
            </Box>

            {/* Global Counter Pill */}
            <Box
              sx={{
                ...NEU_STYLES.counterPill,
                border: isGlobalCompCapReached ? "1px solid #FF9800" : "none",
              }}
            >
              <CheckCircleOutlineIcon sx={{ fontSize: 16, color: isGlobalCompCapReached ? "#FF9800" : "#1976D2" }} />
              <Typography variant="caption" fontWeight={700} color={isGlobalCompCapReached ? "#E65100" : "#0D47A1"}>
                Competencies: {selectedCompetencies.length} / {currentLimits.maxGlobalCompetencies} (Max {currentLimits.maxGlobalCompetencies})
              </Typography>
            </Box>
          </Box>
        </Stack>

        {/* Global cap notice */}
        {isGlobalCompCapReached && (
          <Box
            sx={{
              ...NEU_STYLES.headerPill,
              mb: 2.5,
              background: "#FFF3E0",
              boxShadow: "inset 2px 2px 5px #FFE0B2, inset -2px -2px 5px #ffffff",
            }}
          >
            <Typography variant="caption" color="#E65100" fontWeight={600}>
              ⚡ Maximum competency capacity reached ({currentLimits.maxGlobalCompetencies}/{currentLimits.maxGlobalCompetencies}). Unchecked competencies are disabled across all topics.
            </Typography>
          </Box>
        )}

        {activeSubjectObjects.length === 0 ? (
          <Box
            sx={{
              ...NEU_STYLES.counterPill,
              width: "100%",
              py: 4,
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              No subjects selected. Please select at least {currentLimits.minSubjects} subject above to view and configure topics.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {activeSubjectObjects.map((subjectObj) => {
              const topicsInThisSubject = subjectObj.topics.map((t) => t.name);
              const selectedTopicsInThisSubject = selectedTopics.filter((t) =>
                topicsInThisSubject.includes(t)
              );
              const isTopicCapReached =
                selectedTopicsInThisSubject.length >= currentLimits.maxTopicsPerSubject;

              return (
                <Accordion
                  key={subjectObj.code}
                  defaultExpanded
                  disableGutters
                  sx={{
                    ...NEU_STYLES.topicContainer,
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: "#1976D2" }} />}
                    sx={{
                      px: 2.5,
                      py: 1,
                      "& .MuiAccordionSummary-content": {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 1,
                      },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="#0D47A1">
                        {subjectObj.code}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "inline" } }}>
                        — {subjectObj.name.replace(`${subjectObj.code} - `, "")}
                      </Typography>
                    </Box>

                    {/* Topic-level badge */}
                    <Box sx={NEU_STYLES.counterPill}>
                      <Typography variant="caption" fontWeight={600} color="#0D47A1">
                        Topics: {selectedTopicsInThisSubject.length} / {currentLimits.maxTopicsPerSubject} (Max {currentLimits.maxTopicsPerSubject})
                      </Typography>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                    <Grid container spacing={2}>
                      {subjectObj.topics.map((topicObj) => {
                        const isTopicSelected = selectedTopics.includes(topicObj.name);
                        const isTopicDisabled = !isTopicSelected && isTopicCapReached;

                        const compList =
                          typeof topicObj.competencies[0] === "string"
                            ? topicObj.competencies
                            : topicObj.competencies.map((c) => c.name);

                        const selectedCompsInThisTopic = selectedCompetencies.filter((c) =>
                          compList.includes(c)
                        );
                        const isCompCapReachedInTopic =
                          selectedCompsInThisTopic.length >= currentLimits.maxCompetenciesPerTopic;

                        return (
                          <Grid item xs={12} md={6} key={topicObj.name}>
                            <Paper
                              sx={{
                                ...(isTopicSelected ? NEU_STYLES.pressedCard : NEU_STYLES.elevatedCard),
                                p: 2,
                                display: "flex",
                                flexDirection: "column",
                                gap: 1.5,
                                opacity: isTopicDisabled ? 0.45 : 1,
                              }}
                            >
                              {/* Topic Header Row */}
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={isTopicSelected}
                                      disabled={isTopicDisabled || readOnly}
                                      onChange={() => handleToggleTopic(topicObj.name, subjectObj)}
                                      size="small"
                                      inputProps={{ "aria-label": topicObj.name }}
                                      sx={{
                                        p: 0.5,
                                        mr: 0.5,
                                        color: "#90A4AE",
                                        "&.Mui-checked": { color: "#1976D2" },
                                      }}
                                    />
                                  }
                                  label={
                                    <Typography variant="body2" fontWeight={700} color={isTopicSelected ? "#0D47A1" : "#37474F"}>
                                      {topicObj.name}
                                    </Typography>
                                  }
                                  sx={{ m: 0, flex: 1, userSelect: "none", cursor: isTopicDisabled || readOnly ? "not-allowed" : "pointer" }}
                                />

                                {/* Topic Count Tag: e.g. 1/2 competencies */}
                                {isTopicSelected && (
                                  <Box sx={{ ...NEU_STYLES.counterPill, px: 1, py: 0.2 }}>
                                    <Typography variant="caption" fontWeight={600} color="#1976D2">
                                      {selectedCompsInThisTopic.length}/{currentLimits.maxCompetenciesPerTopic} competencies
                                    </Typography>
                                  </Box>
                                )}
                              </Stack>

                              {/* Competencies Checklist for Selected Topic */}
                              {isTopicSelected && (
                                <Box
                                  sx={{
                                    pl: 3.5,
                                    pt: 0.5,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 0.8,
                                  }}
                                >
                                  {compList.map((compName) => {
                                    const isCompSelected = selectedCompetencies.includes(compName);
                                    // Auto-disable remaining unchecked checkboxes once global or per-topic cap is reached
                                    const isCompDisabled =
                                      !isCompSelected && (isGlobalCompCapReached || isCompCapReachedInTopic);

                                    return (
                                      <FormControlLabel
                                        key={compName}
                                        control={
                                          <Checkbox
                                            checked={isCompSelected}
                                            disabled={isCompDisabled || readOnly}
                                            onChange={() => handleToggleCompetency(compName, topicObj)}
                                            size="small"
                                            inputProps={{ "aria-label": compName }}
                                            sx={{
                                              p: 0.4,
                                              mr: 0.5,
                                              color: "#90A4AE",
                                              "&.Mui-checked": { color: "#1976D2" },
                                            }}
                                          />
                                        }
                                        label={
                                          <Typography
                                            variant="body2"
                                            color={isCompSelected ? "#0D47A1" : "#455A64"}
                                            fontWeight={isCompSelected ? 600 : 400}
                                          >
                                            {compName}
                                          </Typography>
                                        }
                                        sx={{
                                          m: 0,
                                          opacity: isCompDisabled ? 0.45 : 1,
                                          cursor: isCompDisabled || readOnly ? "not-allowed" : "pointer",
                                          userSelect: "none",
                                        }}
                                      />
                                    );
                                  })}
                                </Box>
                              )}
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

if (typeof window !== "undefined") {
  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.SubjectSkillPreferences = SubjectSkillPreferences;
}
