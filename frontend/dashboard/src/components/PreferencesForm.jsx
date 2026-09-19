import React, { useState, useEffect, useMemo, useContext } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
  Alert,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TuneIcon from "@mui/icons-material/Tune";

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
        name: "History & Hardware Evolution",
        competencies: ["Computing Generations", "Processor Architecture", "Memory & Storage Types"],
      },
      {
        name: "Digital Logic & Data Representation",
        competencies: ["Binary/Octal/Hex Conversions", "Boolean Logic Gates", "Data Encoding (ASCII/Unicode)"],
      },
      {
        name: "UI & Web Fundamentals",
        competencies: ["Figma UI Design", "Flexbox & Grid", "HTML5 Semantic Structure"],
      },
      {
        name: "Operating Systems & Architecture",
        competencies: ["OS Fundamentals", "Process Management", "File Systems & Permissions"],
      },
    ],
  },
  {
    code: "IT 112",
    name: "IT 112 - Computer Programming 1",
    topics: [
      {
        name: "Control Structures",
        competencies: ["Loop Control", "Conditional Logic", "Iteration Patterns"],
      },
      {
        name: "Data Structures",
        competencies: ["Array Creation", "1D/2D Manipulation", "Linear/Binary Searching"],
      },
      {
        name: "Functions & Methods",
        competencies: ["Parameter Passing", "Return Types", "Variable Scope & Lifetime"],
      },
    ],
  },

  {
    code: "IT 113",
    name: "IT 113 - Computer Programming 2 (Data Structures)",
    topics: [
      {
        name: "Object-Oriented Basics",
        competencies: ["Classes & Objects", "Encapsulation & Access Modifiers", "Constructors"],
      },
      {
        name: "Linear Data Structures",
        competencies: ["Singly Linked Lists", "Stack Implementation (LIFO)", "Queue Implementation (FIFO)"],
      },
    ],
  },
  {
    code: "IT 115",
    name: "IT 115 - Information Management (Database Systems)",
    topics: [
      {
        name: "Relational Modeling",
        competencies: ["Entity-Relationship Diagrams", "Primary & Foreign Keys", "Normalization (1NF-3NF)"],
      },
      {
        name: "SQL Queries",
        competencies: ["SELECT & Filtering", "Table Joins (INNER/LEFT)", "Aggregation (GROUP BY)"],
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
  {
    code: "IT 221",
    name: "IT 221 - Web Systems and Technologies",
    topics: [
      {
        name: "Frontend Fundamentals",
        competencies: ["HTML5 Semantic Structure", "Flexbox & Grid Layouts", "Figma UI Design"],
      },
      {
        name: "Client-Side Scripting",
        competencies: ["DOM Manipulation", "ES6+ Modern Syntax", "Fetch API & Async/Await"],
      },
    ],
  },
];

export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const NEED_SLIDER_MARKS = [
  { value: 1, label: "1 (Basic)" },
  { value: 2, label: "2 (Elementary)" },
  { value: 3, label: "3 (Intermediate)" },
  { value: 4, label: "4 (Advanced)" },
  { value: 5, label: "5 (Intensive)" },
];

export default function PreferencesForm({
  user,
  initialData = {},
  onSubmit,
  loading = false,
  errorMessage = "",
  setErrorMessage = () => {},
  onBack,
}) {
  const currentLimits = useMemo(() => {
    return getRoleLimits(user?.role);
  }, [user?.role]);

  // Hierarchical selection states
  const [selectedSubjects, setSelectedSubjects] = useState(() => {
    return initialData.subjects || ["IT 111", "IT 112"];
  });

  const [selectedTopics, setSelectedTopics] = useState(() => {
    return initialData.topics || ["Control Structures", "UI & Web Fundamentals"];
  });

  const [selectedCompetencies, setSelectedCompetencies] = useState(() => {
    return initialData.competencies || ["Loop Control", "Figma UI Design", "Flexbox & Grid"];
  });


  const [supportNeed, setSupportNeed] = useState(() => {
    return initialData.support_need || initialData.difficulty_level || 3;
  });

  const [availabilitySlots, setAvailabilitySlots] = useState(() => {
    if (Array.isArray(initialData.availability) && initialData.availability.length > 0) {
      return initialData.availability;
    }
    return [
      { day: "Monday", start_time: "09:00", end_time: "11:00" },
      { day: "Wednesday", start_time: "13:00", end_time: "15:00" },
    ];
  });

  // Dynamic catalog state: start with canonical curriculum and optionally merge backend SelectionCatalog
  const [curriculum, setCurriculum] = useState(CANONICAL_CURRICULUM);

  useEffect(() => {
    if (window.DashboardApp && window.DashboardApp.SelectionCatalog) {
      window.DashboardApp.SelectionCatalog.load([])
        .then((data) => {
          if (data && data.topicGroups && data.topicGroups.length > 0) {
            // merge if needed
          }
        })
        .catch(() => {});
    }
  }, []);

  // Filter curriculum to selected subjects
  const activeSubjectObjects = useMemo(() => {
    return curriculum.filter(
      (sub) => selectedSubjects.includes(sub.code) || selectedSubjects.includes(sub.name),
    );
  }, [curriculum, selectedSubjects]);

  // Handler: Toggle Subject
  const handleToggleSubject = (subCode) => {
    setErrorMessage("");
    if (selectedSubjects.includes(subCode)) {
      // Prune its topics & competencies
      const subObj = curriculum.find((s) => s.code === subCode || s.name === subCode);
      const subTopicNames = subObj ? subObj.topics.map((t) => t.name) : [];
      const subCompNames = subObj
        ? subObj.topics.flatMap((t) => (typeof t.competencies[0] === "string" ? t.competencies : t.competencies.map((c) => c.name)))
        : [];

      setSelectedSubjects(selectedSubjects.filter((s) => s !== subCode));
      setSelectedTopics(selectedTopics.filter((t) => !subTopicNames.includes(t)));
      setSelectedCompetencies(selectedCompetencies.filter((c) => !subCompNames.includes(c)));
    } else {
      if (selectedSubjects.length >= currentLimits.maxSubjects) {
        setErrorMessage(`${currentLimits.roleLabel} cannot select more than ${currentLimits.maxSubjects} subjects.`);
        return;
      }
      setSelectedSubjects([...selectedSubjects, subCode]);
    }
  };

  // Handler: Toggle Topic
  const handleToggleTopic = (topicName, subjectObj) => {
    setErrorMessage("");
    const isSelected = selectedTopics.includes(topicName);

    if (isSelected) {
      // Prune competencies under this topic
      const topicObj = subjectObj.topics.find((t) => t.name === topicName);
      const compNames = topicObj
        ? typeof topicObj.competencies[0] === "string"
          ? topicObj.competencies
          : topicObj.competencies.map((c) => c.name)
        : [];

      setSelectedTopics(selectedTopics.filter((t) => t !== topicName));
      setSelectedCompetencies(selectedCompetencies.filter((c) => !compNames.includes(c)));
    } else {
      // Check max topics for this subject
      const topicsInThisSubject = subjectObj.topics.map((t) => t.name);
      const currentSelectedInSubj = selectedTopics.filter((t) => topicsInThisSubject.includes(t));
      if (currentSelectedInSubj.length >= currentLimits.maxTopicsPerSubject) {
        setErrorMessage(
          `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxTopicsPerSubject} topics for ${subjectObj.code || subjectObj.name}.`,
        );
        return;
      }
      setSelectedTopics([...selectedTopics, topicName]);
    }
  };

  // Handler: Toggle Competency
  const handleToggleCompetency = (compName, topicObj) => {
    setErrorMessage("");
    const isSelected = selectedCompetencies.includes(compName);

    if (isSelected) {
      setSelectedCompetencies(selectedCompetencies.filter((c) => c !== compName));
    } else {
      // Check global cap
      if (selectedCompetencies.length >= currentLimits.maxGlobalCompetencies) {
        setErrorMessage(
          `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxGlobalCompetencies} competencies total.`,
        );
        return;
      }

      // Check per-topic cap
      const compsInThisTopic = typeof topicObj.competencies[0] === "string"
        ? topicObj.competencies
        : topicObj.competencies.map((c) => c.name);
      const currentSelectedInTopic = selectedCompetencies.filter((c) => compsInThisTopic.includes(c));
      if (currentSelectedInTopic.length >= currentLimits.maxCompetenciesPerTopic) {
        setErrorMessage(
          `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxCompetenciesPerTopic} competencies for topic '${topicObj.name}'.`,
        );
        return;
      }

      setSelectedCompetencies([...selectedCompetencies, compName]);
    }
  };


  // Availability handlers
  const handleAddSlot = () => {
    if (availabilitySlots.length >= currentLimits.maxAvailabilitySlots) {
      setErrorMessage(
        `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxAvailabilitySlots} availability slots.`,
      );
      return;
    }
    setErrorMessage("");
    setAvailabilitySlots([
      ...availabilitySlots,
      { day: "Monday", start_time: "09:00", end_time: "11:00" },
    ]);
  };

  const handleRemoveSlot = (index) => {
    if (availabilitySlots.length <= currentLimits.minAvailabilitySlots) {
      setErrorMessage(
        `${currentLimits.roleLabel} must select at least ${currentLimits.minAvailabilitySlots} availability slot.`,
      );
      return;
    }
    setErrorMessage("");
    setAvailabilitySlots(availabilitySlots.filter((_, i) => i !== index));
  };

  const handleSlotChange = (index, field, value) => {
    const updated = [...availabilitySlots];
    updated[index] = { ...updated[index], [field]: value };
    setAvailabilitySlots(updated);
  };

  // Pre-submit validation
  const validateAndSubmit = (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    // 1. Subjects validation
    if (selectedSubjects.length < currentLimits.minSubjects) {
      setErrorMessage(`${currentLimits.roleLabel} must select at least ${currentLimits.minSubjects} subject.`);
      return;
    }
    if (selectedSubjects.length > currentLimits.maxSubjects) {
      setErrorMessage(`${currentLimits.roleLabel} cannot select more than ${currentLimits.maxSubjects} subjects.`);
      return;
    }

    // 2. Topics per subject validation
    for (const sub of activeSubjectObjects) {
      const topicsInSub = sub.topics.map((t) => t.name);
      const selectedInSub = selectedTopics.filter((t) => topicsInSub.includes(t));
      if (selectedInSub.length < currentLimits.minTopicsPerSubject) {
        setErrorMessage(
          `${currentLimits.roleLabel} must select at least ${currentLimits.minTopicsPerSubject} topic for ${sub.code || sub.name}.`,
        );
        return;
      }
      if (selectedInSub.length > currentLimits.maxTopicsPerSubject) {
        setErrorMessage(
          `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxTopicsPerSubject} topics for ${sub.code || sub.name}.`,
        );
        return;
      }
    }

    // 3. Competencies per topic validation
    for (const sub of activeSubjectObjects) {
      for (const topic of sub.topics) {
        if (selectedTopics.includes(topic.name)) {
          const compsInTopic = typeof topic.competencies[0] === "string"
            ? topic.competencies
            : topic.competencies.map((c) => c.name);
          const selectedInTopic = selectedCompetencies.filter((c) => compsInTopic.includes(c));

          if (selectedInTopic.length < currentLimits.minCompetenciesPerTopic) {
            setErrorMessage(
              `${currentLimits.roleLabel} must select at least ${currentLimits.minCompetenciesPerTopic} competency for topic '${topic.name}'.`,
            );
            return;
          }
          if (selectedInTopic.length > currentLimits.maxCompetenciesPerTopic) {
            setErrorMessage(
              `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxCompetenciesPerTopic} competencies for topic '${topic.name}'.`,
            );
            return;
          }
        }
      }
    }

    // 4. Global competencies total validation
    if (selectedCompetencies.length < currentLimits.minGlobalCompetencies) {
      setErrorMessage(
        `${currentLimits.roleLabel} must select at least ${currentLimits.minGlobalCompetencies} competency total.`,
      );
      return;
    }
    if (selectedCompetencies.length > currentLimits.maxGlobalCompetencies) {
      setErrorMessage(
        `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxGlobalCompetencies} competencies total.`,
      );
      return;
    }

    // 5. Availability slots validation
    if (availabilitySlots.length < currentLimits.minAvailabilitySlots) {
      setErrorMessage(
        `${currentLimits.roleLabel} must select at least ${currentLimits.minAvailabilitySlots} availability slot.`,
      );
      return;
    }
    if (availabilitySlots.length > currentLimits.maxAvailabilitySlots) {
      setErrorMessage(
        `${currentLimits.roleLabel} cannot select more than ${currentLimits.maxAvailabilitySlots} availability slots.`,
      );
      return;
    }

    if (onSubmit) {
      onSubmit({
        subjects: selectedSubjects,
        topics: selectedTopics,
        competencies: selectedCompetencies,
        skills: selectedCompetencies,
        support_need: supportNeed,
        availability: availabilitySlots,
        availability_slots: availabilitySlots,
      });
    }
  };

  const isGlobalCompCapReached = selectedCompetencies.length >= currentLimits.maxGlobalCompetencies;
  const isSubjectCapReached = selectedSubjects.length >= currentLimits.maxSubjects;

  return (
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
        subheader={`Role: ${currentLimits.label} — Feature Vector Sparsity Bounds Enforced`}
      />
      <Divider />
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={4}>
          {errorMessage && (
            <Alert severity="error" onClose={() => setErrorMessage("")}>
              {errorMessage}
            </Alert>
          )}

          {/* Core BSIT Subjects Multi-Select with Tracker */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} color="#002855">
                  Core BSIT Subjects
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Select subjects to configure topics and competencies:
                </Typography>
              </Box>
              <Chip
                color={selectedSubjects.length >= currentLimits.minSubjects ? "primary" : "warning"}
                variant="outlined"
                label={`Subjects: ${selectedSubjects.length} / ${currentLimits.maxSubjects} (Min ${currentLimits.minSubjects}, Max ${currentLimits.maxSubjects})`}
              />
            </Stack>

            <Grid container spacing={1.5}>
              {curriculum.map((sub) => {
                const isSelected = selectedSubjects.includes(sub.code) || selectedSubjects.includes(sub.name);
                const isDisabled = !isSelected && isSubjectCapReached;
                return (
                  <Grid size={{ xs: 12, sm: 6 }} key={sub.code}>
                    <Paper
                      variant="outlined"
                      onClick={() => !isDisabled && handleToggleSubject(sub.code)}
                      sx={{
                        p: 1.5,
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.5 : 1,
                        borderColor: isSelected ? "#002855" : "divider",
                        backgroundColor: isSelected ? "rgba(0, 40, 85, 0.05)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        transition: "all 0.2s",
                        "&:hover": {
                          borderColor: isDisabled ? "divider" : "#002855",
                        },
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isDisabled}
                        inputProps={{ "aria-label": sub.code }}
                        onChange={() => handleToggleSubject(sub.code)}
                        onClick={(e) => e.stopPropagation()}
                        size="small"
                        sx={{ mr: 1, color: "#002855" }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={isSelected ? 600 : 400} color="#002855">
                          {sub.code}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {sub.name.replace(`${sub.code} - `, "")}
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          <Divider />

          {/* Hierarchical Topics & Competency Selection with Sticky Counter */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} color="#002855" gutterBottom>
              Competency & Skill Tags
            </Typography>
            {/* Sticky Tracker at the top of Competencies Section */}
            <Box
              sx={{
                position: "sticky",
                top: 16,
                zIndex: 10,
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(8px)",
                py: 1.5,
                px: 2,
                borderRadius: 2,
                border: "1px solid",
                borderColor: isGlobalCompCapReached ? "warning.main" : "primary.light",
                boxShadow: "0 4px 12px rgba(0, 40, 85, 0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2.5,
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} color="#002855">
                Hierarchy: Subject ➔ Topic ➔ Competency
              </Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  color={isGlobalCompCapReached ? "warning" : "primary"}
                  label={`Competencies: ${selectedCompetencies.length} / ${currentLimits.maxGlobalCompetencies} (Max ${currentLimits.maxGlobalCompetencies})`}
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select up to {currentLimits.maxTopicsPerSubject} topics per subject, and up to {currentLimits.maxCompetenciesPerTopic} competencies per topic:
            </Typography>

            <Stack spacing={2.5}>
              {activeSubjectObjects.map((subject) => {
                const topicsInThisSub = subject.topics.map((t) => t.name);
                const selectedTopicsInSub = selectedTopics.filter((t) => topicsInThisSub.includes(t));
                const isTopicCapInSubReached = selectedTopicsInSub.length >= currentLimits.maxTopicsPerSubject;

                return (
                  <Paper
                    key={subject.code}
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.01)" }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" fontWeight={700} color="#002855">
                        {subject.code} — {subject.name.replace(`${subject.code} - `, "")}
                      </Typography>
                      <Chip
                        size="small"
                        label={`Topics: ${selectedTopicsInSub.length} / ${currentLimits.maxTopicsPerSubject} (Max ${currentLimits.maxTopicsPerSubject})`}
                        color={selectedTopicsInSub.length >= currentLimits.minTopicsPerSubject ? "default" : "warning"}
                      />
                    </Stack>

                    <Stack spacing={1.5}>
                      {subject.topics.map((topic) => {
                        const isTopicSelected = selectedTopics.includes(topic.name);
                        const isTopicDisabled = !isTopicSelected && isTopicCapInSubReached;

                        const rawComps = typeof topic.competencies[0] === "string"
                          ? topic.competencies
                          : topic.competencies.map((c) => c.name);
                        const selectedCompsInTopic = selectedCompetencies.filter((c) => rawComps.includes(c));
                        const isTopicCompCapReached = selectedCompsInTopic.length >= currentLimits.maxCompetenciesPerTopic;

                        return (
                          <Accordion
                            key={topic.name}
                            expanded={isTopicSelected}
                            onChange={() => !isTopicDisabled && handleToggleTopic(topic.name, subject)}
                            disabled={isTopicDisabled}
                            sx={{
                              border: "1px solid",
                              borderColor: isTopicSelected ? "primary.main" : "divider",
                              borderRadius: "8px !important",
                              "&:before": { display: "none" },
                              opacity: isTopicDisabled ? 0.5 : 1,
                            }}
                          >
                            <AccordionSummary
                              expandIcon={isTopicSelected ? <ExpandMoreIcon /> : null}
                              sx={{
                                backgroundColor: isTopicSelected ? "rgba(0, 40, 85, 0.03)" : "transparent",
                                borderRadius: "8px",
                              }}
                            >
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={isTopicSelected}
                                    disabled={isTopicDisabled}
                                    onChange={() => handleToggleTopic(topic.name, subject)}
                                    onClick={(e) => e.stopPropagation()}
                                    size="small"
                                  />
                                }
                                label={
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Typography variant="body2" fontWeight={isTopicSelected ? 600 : 400}>
                                      {topic.name}
                                    </Typography>
                                    {isTopicSelected && (
                                      <Chip
                                        size="small"
                                        label={`${selectedCompsInTopic.length}/${currentLimits.maxCompetenciesPerTopic} competencies`}
                                        sx={{ height: 20, fontSize: "0.7rem" }}
                                      />
                                    )}
                                  </Box>
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                            </AccordionSummary>

                            <AccordionDetails sx={{ pt: 1, pb: 2, px: 3 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                                Specific Topic Competencies ({selectedCompsInTopic.length} / {currentLimits.maxCompetenciesPerTopic} max):
                              </Typography>
                              <Grid container spacing={1}>
                                {rawComps.map((compName) => {
                                  const isCompSelected = selectedCompetencies.includes(compName);
                                  // Auto-disabling logic:
                                  // 1. Global cap reached: disable all unchecked competencies
                                  // 2. Per-topic cap reached: disable all unchecked competencies in this topic
                                  const isCompDisabled =
                                    !isCompSelected && (isGlobalCompCapReached || isTopicCompCapReached);

                                  return (
                                    <Grid size={{ xs: 12, sm: 6 }} key={compName}>
                                      <FormControlLabel
                                        control={
                                          <Checkbox
                                            checked={isCompSelected}
                                            disabled={isCompDisabled}
                                            onChange={() => handleToggleCompetency(compName, topic)}
                                            size="small"
                                            sx={{
                                              color: "#002855",
                                              "&.Mui-checked": { color: "#002855" },
                                            }}
                                          />
                                        }
                                        label={
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              fontSize: "0.85rem",
                                              color: isCompDisabled ? "text.disabled" : "text.primary",
                                              fontWeight: isCompSelected ? 600 : 400,
                                            }}
                                          >
                                            {compName}
                                          </Typography>
                                        }
                                        sx={{
                                          m: 0,
                                          p: 0.5,
                                          borderRadius: 1,
                                          width: "100%",
                                          backgroundColor: isCompSelected ? "rgba(0, 40, 85, 0.05)" : "transparent",
                                        }}
                                      />
                                    </Grid>
                                  );
                                })}
                              </Grid>
                            </AccordionDetails>
                          </Accordion>
                        );
                      })}
                    </Stack>
                  </Paper>
                );
              })}
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

          {/* Recurring Availability Picker with Tracker & Cap */}
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
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  color={availabilitySlots.length >= currentLimits.minAvailabilitySlots ? "primary" : "warning"}
                  variant="outlined"
                  label={`Availability Slots: ${availabilitySlots.length} / ${currentLimits.maxAvailabilitySlots} (Min ${currentLimits.minAvailabilitySlots}, Max ${currentLimits.maxAvailabilitySlots})`}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={handleAddSlot}
                  disabled={availabilitySlots.length >= currentLimits.maxAvailabilitySlots}
                  sx={{ textTransform: "none" }}
                >
                  Add Day Slot
                </Button>
              </Stack>
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
                        disabled={availabilitySlots.length <= currentLimits.minAvailabilitySlots}
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
            {onBack && (
              <Button
                variant="outlined"
                onClick={onBack}
                disabled={loading}
                sx={{ textTransform: "none" }}
              >
                Back to Guidelines
              </Button>
            )}
            <Button
              variant="contained"
              size="large"
              onClick={validateAndSubmit}
              disabled={loading}
              sx={{
                ml: "auto",
                px: 4,
                textTransform: "none",
                fontWeight: 600,
                backgroundColor: "#002855",
                "&:hover": { backgroundColor: "#0b2545" },
              }}
            >
              Complete Onboarding
            </Button>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
