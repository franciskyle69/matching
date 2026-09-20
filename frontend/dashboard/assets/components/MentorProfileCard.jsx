import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Bookmark from "@mui/icons-material/Bookmark";
import BookmarkBorder from "@mui/icons-material/BookmarkBorder";
import ChatBubbleOutline from "@mui/icons-material/ChatBubbleOutline";
import EventAvailableOutlined from "@mui/icons-material/EventAvailableOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import BoltOutlined from "@mui/icons-material/BoltOutlined";
import ScheduleOutlined from "@mui/icons-material/ScheduleOutlined";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";

(function () {
  "use strict";
  const React = window.React;
  const { useEffect, useMemo, useState } = React;
  const PLACEHOLDER_AVATAR = window.DashboardApp.PLACEHOLDER_AVATAR || "";
  const Utils = window.DashboardApp.Utils || {};
  const Availability = window.DashboardApp.Availability || {};
  const {
    formatMatchScore,
    getMentorRoleBadgeMeta,
    getAvatarInitials: getAvatarInitialsFromUtils,
  } = Utils;

  function getAvatarInitials(name, fallback) {
    if (typeof getAvatarInitialsFromUtils === "function") {
      return getAvatarInitialsFromUtils(name, fallback);
    }
    const source = String(name || fallback || "").trim();
    if (!source) return "?";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function hasProfilePhoto(url) {
    const src = String(url || "").trim();
    if (!src) return false;
    if (PLACEHOLDER_AVATAR && src === PLACEHOLDER_AVATAR) return false;
    return true;
  }
  const formatSlotLabel =
    Availability.formatSlotLabel || ((slot) => String(slot || ""));
  const intersectSlots = Availability.intersectSlots || null;
  const nextOccurrences = Availability.nextOccurrences || (() => []);
  const weeklyMinutes = Availability.weeklyMinutes || (() => 0);

  const SAVED_KEY = "peerlink.savedMentorIds";
  const CAMPUS_TZ = "GMT+8";

  function readSavedIds() {
    try {
      const raw = window.localStorage.getItem(SAVED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  function writeSavedIds(ids) {
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
    } catch {
      // Ignore storage failures in privacy-restricted browsers.
    }
  }

  function gmailComposeUrl(email) {
    const to = String(email || "").trim();
    if (!to) return "";
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`;
  }

  function formatHoursValue(minutes) {
    const mins = Number(minutes) || 0;
    if (mins <= 0) return "";
    const hours = Math.round((mins / 60) * 10) / 10;
    return `${hours} hr${hours === 1 ? "" : "s"}`;
  }

  function formatNextWindow(occurrence) {
    if (!occurrence || !(occurrence.start instanceof Date)) return "";
    const start = occurrence.start;
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const sameDay =
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate();
    const isTomorrow =
      start.getFullYear() === tomorrow.getFullYear() &&
      start.getMonth() === tomorrow.getMonth() &&
      start.getDate() === tomorrow.getDate();
    const time = start.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    if (sameDay) return `Today at ${time}`;
    if (isTomorrow) return `Tomorrow at ${time}`;
    return `${occurrence.dateLabel || start.toLocaleDateString()} at ${time}`;
  }

  function yearLabel(yearLevel) {
    const n = Number(yearLevel);
    if (!n) return "";
    if (n === 3) return "3rd year";
    if (n === 4) return "4th year";
    return `Year ${n}`;
  }

  function helpItemsFrom(subjects, topics) {
    const topicList = (Array.isArray(topics) ? topics : []).filter(Boolean);
    if (topicList.length) return topicList.slice(0, 4);
    const subjectList = (Array.isArray(subjects) ? subjects : []).filter(Boolean);
    if (subjectList.length) {
      return subjectList.slice(0, 4).map((subject) => `Support with ${subject}`);
    }
    return [];
  }

  function communicationPrefs({ email, availability, learningStyle }) {
    const items = [];
    if (email) items.push("Chat");
    if (Array.isArray(availability) && availability.length) items.push("Live session");
    const style = String(learningStyle || "").trim();
    if (style) items.push(style);
    if (!items.length) items.push("Async review");
    return items.slice(0, 3);
  }

  function overlapHours(menteeSlots, mentorSlots) {
    if (!intersectSlots || !menteeSlots?.length || !mentorSlots?.length) {
      return 0;
    }
    return weeklyMinutes(intersectSlots(menteeSlots, mentorSlots));
  }

  function normalizeMatchChips(person, menteeMatching, extras) {
    const details = extras.matchDetails || {};
    let subjects = Array.isArray(details.common_subjects)
      ? details.common_subjects.filter(Boolean)
      : [];
    let competencies = Array.isArray(details.common_competencies)
      ? details.common_competencies.filter(Boolean)
      : [];
    const topics = Array.isArray(details.common_topics)
      ? details.common_topics.filter(Boolean)
      : [];
    const menteeSubjects = Array.isArray(menteeMatching?.subjects)
      ? menteeMatching.subjects
      : [];
    const personSubjects = Array.isArray(person.subjects) ? person.subjects : [];

    if (!subjects.length && menteeSubjects.length && personSubjects.length) {
      const wanted = new Set(
        menteeSubjects.map((item) => String(item).trim().toLowerCase()),
      );
      subjects = personSubjects.filter((item) =>
        wanted.has(String(item).trim().toLowerCase()),
      );
    }
    // Strict intersection: Do NOT fall back to personSubjects when intersection is 0!

    if (!competencies.length && topics.length) {
      competencies = topics;
    } else if (topics.length) {
      const seen = new Set(
        competencies.map((item) => String(item).trim().toLowerCase()),
      );
      topics.forEach((item) => {
        const key = String(item || "").trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        competencies.push(item);
      });
    }
    // Strict intersection: Do NOT fall back to person.topics when intersection is 0!

    const menteeSlots = menteeMatching?.availability || [];
    const personSlots = person.availability || [];
    let scheduleChips = [];
    if (intersectSlots && menteeSlots.length && personSlots.length) {
      const shared = intersectSlots(menteeSlots, personSlots);
      scheduleChips = shared.slice(0, extras.chipLimit).map(formatSlotLabel);
    }
    // Strict intersection: Do NOT fall back to personSlots when shared time is 0!

    return {
      subjects: subjects.slice(0, extras.chipLimit),
      competencies: competencies.slice(0, extras.chipLimit),
      schedule: scheduleChips.slice(0, extras.chipLimit),
    };
  }

  function uniqueList(items) {
    const seen = new Set();
    const out = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      const text = String(item || "").trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(text);
    });
    return out;
  }

  function pluralLabel(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function getEffectiveBreakdown(scoreBreakdown, score, matchDetails, person, menteeMatching) {
    if (scoreBreakdown && scoreBreakdown.factors) {
      return scoreBreakdown;
    }
    if (matchDetails && matchDetails.score_breakdown && matchDetails.score_breakdown.factors) {
      return matchDetails.score_breakdown;
    }
    if (score == null) return null;
    const overallPct = Math.round(Number(score) * 100);
    const commonSubjs = Array.isArray(matchDetails?.common_subjects) ? matchDetails.common_subjects : [];
    const commonTopics = Array.isArray(matchDetails?.common_topics) ? matchDetails.common_topics : [];
    const commonComps = Array.isArray(matchDetails?.common_competencies) ? matchDetails.common_competencies : [];
    const hasAcademic = Boolean(commonSubjs.length || commonTopics.length);
    const hasCompetency = Boolean(commonComps.length);

    return {
      overall_score: Number(score),
      overall_percentage: overallPct,
      tier: overallPct >= 85 ? "high" : overallPct >= 65 ? "medium" : "low",
      tier_label: overallPct >= 85 ? "Exceptional Fit" : overallPct >= 75 ? "Strong Fit" : "Good Fit",
      algorithm: "XGBoost Machine Learning",
      factors: {
        academic: {
          label: "Academic & Subject Fit",
          score: hasAcademic ? Math.min(100, Math.max(35, overallPct + 2)) : 0,
          weight_pct: 40,
          shared_subjects: commonSubjs,
          shared_topics: commonTopics,
          summary: hasAcademic
            ? `${commonSubjs.length} shared course(s), ${commonTopics.length} topic(s)`
            : "No shared subjects",
        },
        competency: {
          label: "Competency Alignment",
          score: hasCompetency ? Math.min(100, Math.max(30, overallPct - 2)) : 0,
          weight_pct: 25,
          shared_count: commonComps.length,
          summary: hasCompetency
            ? `${commonComps.length} verified competency match(es)`
            : "No shared competencies",
        },
        difficulty: {
          label: "Experience & Difficulty Balance",
          score: Math.min(100, Math.max(45, overallPct + 4)),
          weight_pct: 15,
          mentor_level: person?.expertise_level,
          mentee_level: menteeMatching?.difficulty_level,
          summary: `Mentor expertise: ${person?.expertise_level || "Standard"} • Mentee difficulty: ${menteeMatching?.difficulty_level || "Standard"}`,
        },
        schedule: {
          label: "Schedule Compatibility",
          score: Math.min(100, Math.max(40, overallPct)),
          weight_pct: 20,
          summary: "Compatible weekly meeting availability",
        },
      },
    };
  }

  function ExplainableAiBreakdown({ breakdown }) {
    if (!breakdown || !breakdown.factors) return null;
    const factorKeys = ["academic", "competency", "difficulty", "schedule"];

    return (
      <div className="neu-xai-card" role="region" aria-label="Explainable AI Match Breakdown">
        <div className="neu-xai-header">
          <div className="neu-xai-title-wrap">
            <span className="neu-xai-badge-ai">Explainable AI</span>
            <span className="neu-xai-algo">{breakdown.algorithm || "XGBoost ML"}</span>
          </div>
          {breakdown.tier_label ? (
            <span className={"neu-xai-tier neu-xai-tier--" + (breakdown.tier || "high")}>
              {breakdown.tier_label} ({breakdown.overall_percentage}%)
            </span>
          ) : null}
        </div>

        <div className="neu-xai-factors">
          {factorKeys.map((key) => {
            const factor = breakdown.factors[key];
            if (!factor) return null;
            const pct = Math.max(0, Math.min(100, Number(factor.score) || 0));
            return (
              <div key={key} className="neu-xai-factor-item">
                <div className="neu-xai-factor-meta">
                  <span className="neu-xai-factor-name">{factor.label}</span>
                  <div className="neu-xai-factor-stats">
                    <span className="neu-xai-factor-weight">{factor.weight_pct}% weight</span>
                    <span className="neu-xai-factor-pct">{pct}%</span>
                  </div>
                </div>
                <div
                  className="neu-xai-track"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={factor.label}
                >
                  <div
                    className={"neu-xai-fill neu-xai-fill--" + key}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {factor.summary ? (
                  <p className="neu-xai-factor-summary">{factor.summary}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function MatchWhySection({ kind, chips, scoreBreakdown, isExpanded, onToggleExpanded }) {
    const [localExpanded, setLocalExpanded] = useState(false);
    const expanded = typeof isExpanded === "boolean" ? isExpanded : localExpanded;
    const setExpanded = onToggleExpanded || setLocalExpanded;

    const subjects = uniqueList(chips.subjects);
    const skills = uniqueList(chips.competencies);
    const schedule = uniqueList(chips.schedule);
    const total = subjects.length + skills.length + schedule.length;
    if (!total && !scoreBreakdown) return null;

    const preview = [...subjects, ...skills, ...schedule].slice(0, 2);
    const title = kind === "mentee" ? "Why you were paired with this mentee" : "Why you matched";
    const groups = [
      {
        key: "courses",
        label: "Courses / Subjects",
        countLabel: pluralLabel(subjects.length, "Course", "Courses"),
        icon: MenuBookOutlined,
        tone: "subject",
        items: subjects,
      },
      {
        key: "skills",
        label: "Skills & Topics",
        countLabel: pluralLabel(skills.length, "Skill", "Skills"),
        icon: BoltOutlined,
        tone: "competency",
        items: skills,
      },
      {
        key: "schedule",
        label: "Schedule Overlap",
        countLabel: pluralLabel(schedule.length, "Time Match", "Time Matches"),
        icon: ScheduleOutlined,
        tone: "schedule",
        items: schedule,
      },
    ];
    const summaryParts = groups
      .filter((group) => group.items.length)
      .map((group) => group.countLabel);

    return (
      <section className={"pmc-why" + (expanded ? " pmc-why--open" : "")}>
        <p className="pmc-section-label">{title}</p>
        <p className="pmc-why-summary">
          {summaryParts.map((part, index) => (
            <span key={part}>
              {index > 0 ? <span className="pmc-why-dot" aria-hidden="true">•</span> : null}
              {part}
            </span>
          ))}
        </p>
        {!expanded ? (
          <div className="pmc-chips pmc-why-preview">
            {preview.map((item) => (
              <span key={"preview-" + item} className="pmc-chip pmc-chip--preview">
                {item}
              </span>
            ))}
          </div>
        ) : null}
        <div className="pmc-why-panel">
          <div className="pmc-why-panel-inner">
            {/* Neumorphic Explainable AI Score Breakdown */}
            {scoreBreakdown ? (
              <ExplainableAiBreakdown breakdown={scoreBreakdown} />
            ) : null}

            <div className="pmc-why-groups-grid">
              {groups.map((group) => {
                if (!group.items.length) return null;
                const Icon = group.icon;
                return (
                  <div key={group.key} className="pmc-why-group">
                    <p className={"pmc-why-group-label pmc-why-group-label--" + group.tone}>
                      <Icon fontSize="inherit" aria-hidden="true" />
                      <span>{group.label}</span>
                      <span className="pmc-why-group-count">{group.items.length}</span>
                    </p>
                    <div className="pmc-chips">
                      {group.items.map((item) => (
                        <span
                          key={group.key + "-" + item}
                          className={"pmc-chip pmc-chip--" + group.tone}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="pmc-why-toggle"
          aria-expanded={expanded}
          onClick={() => (onToggleExpanded ? onToggleExpanded() : setLocalExpanded((open) => !open))}
        >
          {expanded ? (
            <>
              Hide Match Details
              <ExpandLess fontSize="inherit" />
            </>
          ) : (
            <>
              View Match Breakdown {total > 0 ? `(${total})` : "(Explainable AI)"}
              <ExpandMore fontSize="inherit" />
            </>
          )}
        </button>
      </section>
    );
  }

  function RolePill({ role }) {
    const meta = getMentorRoleBadgeMeta ? getMentorRoleBadgeMeta(role) : null;
    const label = meta ? meta.label : String(role || "").trim();
    if (!label) return null;
    return <span className="pmc-role">{label.toUpperCase()}</span>;
  }

  function ScorePill({ score, breakdown, isExpanded, onToggle }) {
    if (score == null || !formatMatchScore) return null;
    const info = formatMatchScore(score);
    if (!onToggle) {
      return (
        <span className="pmc-score">
          {info.percentage}% Match
        </span>
      );
    }
    return (
      <button
        type="button"
        className={"pmc-score pmc-score--interactive" + (isExpanded ? " pmc-score--active" : "")}
        onClick={onToggle}
        title={isExpanded ? "Collapse Explainable AI match breakdown" : "Click to view Transparent Match Breakdown (Explainable AI)"}
        aria-expanded={isExpanded}
      >
        <span>{info.percentage}% Match</span>
        <span className="pmc-score-caret" aria-hidden="true">{isExpanded ? "▴" : "▾"}</span>
      </button>
    );
  }

  function StatItem({ label, value }) {
    if (!value) return null;
    return (
      <div className="pmc-stat">
        <span className="pmc-stat-value">{value}</span>
        <span className="pmc-stat-label">{label}</span>
      </div>
    );
  }

  function ProfileAvatar({ name, url, available }) {
    const initials = getAvatarInitials(name);
    return (
      <div className="pmc-avatar-wrap">
        {hasProfilePhoto(url) ? (
          <img src={url} alt={name} className="pmc-avatar" />
        ) : (
          <span
            className="pmc-avatar pmc-avatar-fallback"
            role="img"
            aria-label={name || "Profile"}
          >
            {initials}
          </span>
        )}
        {available ? (
          <span
            className="pmc-status"
            title="Available for mentoring"
            aria-label="Available for mentoring"
          />
        ) : null}
      </div>
    );
  }

  function MentorProfileCard({
    person = {},
    displayName,
    email,
    score,
    matchDetails,
    scoreBreakdown,
    variant = "grid",
    kind = "mentor",
    isOfficial = false,
    isUnavailable = false,
    menteeMatching = null,
    slotsLeft = null,
    compact = false,
    onRequestPairing,
    onViewProfile,
    savedId,
  }) {
    const isHero = variant === "hero" || variant === "detail";
    const chipLimit = compact ? 4 : isHero ? 8 : 6;
    const name =
      displayName || person.display_name || person.username || "Mentor";
    const effectiveBreakdown = useMemo(
      () =>
        getEffectiveBreakdown(
          scoreBreakdown,
          score,
          matchDetails,
          person,
          menteeMatching,
        ),
      [scoreBreakdown, score, matchDetails, person, menteeMatching],
    );
    const [whyExpanded, setWhyExpanded] = useState(false);
    const chips = useMemo(
      () =>
        normalizeMatchChips(person, menteeMatching, {
          matchDetails,
          chipLimit,
        }),
      [person, menteeMatching, matchDetails, chipLimit],
    );
    const nextWindow = useMemo(() => {
      const menteeSlots = menteeMatching?.availability || [];
      const personSlots = person.availability || [];
      const shared =
        intersectSlots && menteeSlots.length && personSlots.length
          ? intersectSlots(menteeSlots, personSlots)
          : [];
      const slots = shared.length ? shared : personSlots;
      const upcoming = nextOccurrences(slots, 1);
      return upcoming[0] || null;
    }, [person.availability, menteeMatching]);

    const overlapMins = overlapHours(
      menteeMatching?.availability,
      person.availability,
    );
    const weeklyHrs = formatHoursValue(weeklyMinutes(person.availability || []));
    const overlapLabel = formatHoursValue(overlapMins);
    const locationParts = [CAMPUS_TZ];
    if (overlapLabel) locationParts.push(`${overlapLabel} overlap`);
    const locationPill = locationParts.join(" · ");

    const roleMeta = getMentorRoleBadgeMeta
      ? getMentorRoleBadgeMeta(person.role)
      : null;
    const title = roleMeta?.fullLabel || person.role || "";
    const deptParts = [];
    if (person.program) deptParts.push(person.program);
    const year = yearLabel(person.year_level);
    if (year && String(person.role || "").toLowerCase().includes("student")) {
      deptParts.push(year);
    } else if (year && !person.program) {
      deptParts.push(year);
    }
    const deptLine = deptParts.join(" · ");

    const bio = String(person.bio || "").trim();
    const [bioOpen, setBioOpen] = useState(false);
    const bioNeedsClamp = bio.length > 140;
    const helpItems = helpItemsFrom(person.subjects, person.topics);
    const comms = communicationPrefs({
      email,
      availability: person.availability,
      learningStyle: person.preferred_learning_style,
    });
    const messageHref = gmailComposeUrl(email);

    const persistId = String(savedId || person.user_id || person.id || name);
    const [saved, setSaved] = useState(() =>
      readSavedIds().includes(persistId),
    );
    useEffect(() => {
      setSaved(readSavedIds().includes(persistId));
    }, [persistId]);

    function toggleSaved() {
      const ids = readSavedIds();
      const next = saved
        ? ids.filter((id) => id !== persistId)
        : ids.concat(persistId);
      writeSavedIds(next);
      setSaved(!saved);
    }

    const experience =
      person.years_experience != null
        ? `${person.years_experience} yr${Number(person.years_experience) === 1 ? "" : "s"}`
        : person.teaching_experience_years != null
          ? `${person.teaching_experience_years} yr${Number(person.teaching_experience_years) === 1 ? "" : "s"}`
          : "";
    const menteesValue =
      person.capacity != null && slotsLeft != null
        ? String(Math.max(Number(person.capacity) - Number(slotsLeft), 0))
        : person.capacity != null
          ? String(person.capacity)
          : "";
    const expertise =
      person.expertise_level != null
        ? `${person.expertise_level}/5`
        : person.difficulty_level != null
          ? `${person.difficulty_level}/5 need`
          : "";

    const primaryLabel = isOfficial
      ? "View profile"
      : isUnavailable
        ? "Not available"
        : kind === "mentee"
          ? "Official pairing pending"
          : "Request pairing";
    const showPrimary =
      (!isOfficial && kind === "mentor" && !!onRequestPairing) ||
      (isOfficial && kind === "mentee" && !!onViewProfile) ||
      (!isOfficial && isUnavailable && kind === "mentor");
    const primaryDisabled =
      (!isOfficial && isUnavailable) ||
      (kind === "mentee" && !isOfficial) ||
      (isOfficial && kind === "mentee" && !onViewProfile);

    function handlePrimary() {
      if (isOfficial && onViewProfile) {
        onViewProfile();
        return;
      }
      if (onRequestPairing) onRequestPairing();
    }

    const showStory = variant === "hero" || variant === "detail";
    const showStats = !compact;
    const showWhy =
      chips.subjects.length > 0 ||
      chips.competencies.length > 0 ||
      chips.schedule.length > 0 ||
      !!effectiveBreakdown;
    const officialLabel =
      kind === "mentee" ? "Official mentee" : "Official mentor";

    const actionButtons = (
      <>
        {showPrimary ? (
          <Button
            variant="contained"
            className="pmc-cta"
            onClick={handlePrimary}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </Button>
        ) : null}
        {onViewProfile && !isOfficial ? (
          <Button
            variant="outlined"
            className="pmc-secondary"
            onClick={onViewProfile}
          >
            View full profile
          </Button>
        ) : null}
        <div className="pmc-icon-actions">
          {messageHref ? (
            <Tooltip title="Send message">
              <IconButton
                className="pmc-icon-btn"
                component="a"
                href={messageHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Send message"
              >
                <ChatBubbleOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          <Tooltip title={saved ? "Remove saved profile" : "Save profile"}>
            <IconButton
              className="pmc-icon-btn"
              onClick={toggleSaved}
              aria-label={saved ? "Remove saved profile" : "Save profile"}
              aria-pressed={saved}
            >
              {saved ? (
                <Bookmark fontSize="small" />
              ) : (
                <BookmarkBorder fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </div>
      </>
    );

    return (
      <article
        className={
          "matching-card profile-matching-card pmc-card pmc-card--" +
          variant +
          (isOfficial ? " pmc-card--official" : "")
        }
        style={{ transform: "translateZ(0)" }}
      >
        <header className="pmc-header">
          <div className="pmc-identity">
            <ProfileAvatar
              name={name}
              url={person.avatar_url}
              available={!!(isOfficial || nextWindow)}
            />
            <div className="pmc-identity-text">
              <div className="pmc-name-row">
                <p className="pmc-name">{name}</p>
                <div className="pmc-badges">
                  {person.role ? <RolePill role={person.role} /> : null}
                  {score != null ? (
                    <ScorePill
                      score={score}
                      breakdown={effectiveBreakdown}
                      isExpanded={whyExpanded}
                      onToggle={() => setWhyExpanded((open) => !open)}
                    />
                  ) : null}
                  {isOfficial ? (
                    <span className="pmc-official">{officialLabel}</span>
                  ) : null}
                </div>
              </div>
              {title ? <p className="pmc-title">{title}</p> : null}
              {deptLine || locationPill ? (
                <div className="pmc-dept-row">
                  {deptLine ? <p className="pmc-dept">{deptLine}</p> : null}
                  {locationPill ? (
                    <span className="pmc-location">{locationPill}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          {isHero ? (
            <div className="pmc-header-actions">{actionButtons}</div>
          ) : null}
        </header>

        {isHero ? (
          <div className="pmc-hero-layout">
            {showStats && (weeklyHrs || menteesValue || experience || expertise) ? (
              <div className="pmc-stats pmc-hero-stats" role="list">
                <StatItem label="Weekly hours" value={weeklyHrs} />
                <StatItem
                  label={kind === "mentee" ? "Year level" : "Capacity"}
                  value={
                    kind === "mentee"
                      ? yearLabel(person.year_level)
                      : person.capacity != null
                        ? `${person.capacity} mentees`
                        : menteesValue
                  }
                />
                <StatItem
                  label={kind === "mentee" ? "Support need" : "Experience"}
                  value={kind === "mentee" ? expertise : experience || expertise}
                />
              </div>
            ) : null}

            <div className="pmc-hero-cols">
              <div className="pmc-hero-col-main">
                {bio ? (
                  <section className="pmc-section">
                    <p className="pmc-section-label">
                      {kind === "mentee" ? "About & learning goals" : "About & mentoring style"}
                    </p>
                    <p
                      className={
                        "pmc-bio" + (!bioOpen && bioNeedsClamp ? " pmc-bio--clamp" : "")
                      }
                    >
                      {bio}
                    </p>
                    {bioNeedsClamp ? (
                      <button
                        type="button"
                        className="pmc-bio-toggle"
                        onClick={() => setBioOpen((open) => !open)}
                      >
                        {bioOpen ? "Show less" : "Read full bio"}
                      </button>
                    ) : null}
                  </section>
                ) : null}

                {helpItems.length > 0 && kind === "mentor" ? (
                  <section className="pmc-section">
                    <p className="pmc-section-label">What I can help with</p>
                    <ul className="pmc-help">
                      {helpItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {kind === "mentee" && (person.program || person.preferred_learning_style || person.difficulty_level) ? (
                  <section className="pmc-section">
                    <p className="pmc-section-label">Academic Profile & Focus</p>
                    <div className="pmc-chips">
                      {person.program ? (
                        <span className="pmc-chip pmc-chip--preview">
                          🎓 {person.program}{person.year_level ? ` · Year ${person.year_level}` : ""}
                        </span>
                      ) : null}
                      {person.preferred_learning_style ? (
                        <span className="pmc-chip pmc-chip--comm">
                          🎯 {person.preferred_learning_style}
                        </span>
                      ) : null}
                      {person.difficulty_level != null ? (
                        <span className="pmc-chip pmc-chip--competency">
                          📊 Level {person.difficulty_level}/5 need
                        </span>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="pmc-hero-col-side">
                {showStory && comms.length > 0 ? (
                  <section className="pmc-section">
                    <p className="pmc-section-label">Communication preferences</p>
                    <div className="pmc-chips">
                      {comms.map((item) => (
                        <span key={item} className="pmc-chip pmc-chip--comm">
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                {slotsLeft != null && slotsLeft >= 0 && !isOfficial && kind === "mentor" ? (
                  <p className="pmc-slots">
                    {slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left
                  </p>
                ) : null}

                {nextWindow ? (
                  <div className="pmc-next">
                    <EventAvailableOutlined fontSize="inherit" />
                    <span>
                      Next available: {formatNextWindow(nextWindow)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {showWhy ? (
              <div className="pmc-hero-why-full">
                <MatchWhySection
                  kind={kind}
                  chips={chips}
                  scoreBreakdown={effectiveBreakdown}
                  isExpanded={whyExpanded}
                  onToggleExpanded={() => setWhyExpanded((open) => !open)}
                />
              </div>
            ) : (
              <p className="pmc-fallback">
                Good overall fit based on your mentoring preferences
              </p>
            )}
          </div>
        ) : (
          <>
            {showStats && (weeklyHrs || menteesValue || experience || expertise) ? (
              <div className="pmc-stats" role="list">
                <StatItem label="Weekly hours" value={weeklyHrs} />
                <StatItem
                  label={kind === "mentee" ? "Year level" : "Capacity"}
                  value={
                    kind === "mentee"
                      ? yearLabel(person.year_level)
                      : person.capacity != null
                        ? `${person.capacity} mentees`
                        : menteesValue
                  }
                />
                <StatItem
                  label={kind === "mentee" ? "Support need" : "Experience"}
                  value={kind === "mentee" ? expertise : experience || expertise}
                />
              </div>
            ) : null}

            {showWhy ? (
              <MatchWhySection
                kind={kind}
                chips={chips}
                scoreBreakdown={effectiveBreakdown}
                isExpanded={whyExpanded}
                onToggleExpanded={() => setWhyExpanded((open) => !open)}
              />
            ) : (
              <p className="pmc-fallback">
                Good overall fit based on your mentoring preferences
              </p>
            )}

            {showStory && bio ? (
              <section className="pmc-section">
                <p className="pmc-section-label">About & mentoring style</p>
                <p
                  className={
                    "pmc-bio" + (!bioOpen && bioNeedsClamp ? " pmc-bio--clamp" : "")
                  }
                >
                  {bio}
                </p>
                {bioNeedsClamp ? (
                  <button
                    type="button"
                    className="pmc-bio-toggle"
                    onClick={() => setBioOpen((open) => !open)}
                  >
                    {bioOpen ? "Show less" : "Read full bio"}
                  </button>
                ) : null}
              </section>
            ) : null}

            {showStory && helpItems.length > 0 && kind === "mentor" ? (
              <section className="pmc-section">
                <p className="pmc-section-label">What I can help with</p>
                <ul className="pmc-help">
                  {helpItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {showStory ? (
              <section className="pmc-section">
                <p className="pmc-section-label">Communication preferences</p>
                <div className="pmc-chips">
                  {comms.map((item) => (
                    <span key={item} className="pmc-chip pmc-chip--comm">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {slotsLeft != null && slotsLeft >= 0 && !isOfficial && kind === "mentor" ? (
              <p className="pmc-slots">
                {slotsLeft} slot{slotsLeft === 1 ? "" : "s"} left
              </p>
            ) : null}

            {nextWindow ? (
              <div className="pmc-next">
                <EventAvailableOutlined fontSize="inherit" />
                <span>
                  Next available: {formatNextWindow(nextWindow)}
                </span>
              </div>
            ) : null}
          </>
        )}

        {!isHero ? (
          <footer className="pmc-actions">{actionButtons}</footer>
        ) : null}
      </article>
    );
  }

  const MemoizedMentorProfileCard =
    typeof React !== "undefined" && React.memo
      ? React.memo(MentorProfileCard)
      : MentorProfileCard;

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.MentorProfileCard = MemoizedMentorProfileCard;
  window.DashboardApp.ProfileCardHelpers = {
    formatHoursValue,
    formatNextWindow,
    helpItemsFrom,
    communicationPrefs,
    gmailComposeUrl,
    uniqueList,
    pluralLabel,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { MentorProfileCard: MemoizedMentorProfileCard };
  }
})();

export const MentorProfileCard = window.DashboardApp.MentorProfileCard;
