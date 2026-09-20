/**
 * Theme-aware Neumorphism (Soft UI) Styling Helper
 * Dynamically computes light & dark mode surfaces, insets, borders, and shadows.
 */

export const getNeumorphicStyle = (theme, variant = "flat", isSelected = false) => {
  const isDark = theme?.palette?.mode === "dark";

  if (isDark) {
    const bg = isSelected ? "#1E293B" : "#151D2A";
    const border = isSelected ? "#3B82F6" : "rgba(255, 255, 255, 0.08)";

    if (variant === "pressed" || isSelected) {
      return {
        backgroundColor: bg,
        boxShadow: "inset 4px 4px 10px #0d121b, inset -4px -4px 10px #1d2839",
        border: `1.5px solid ${border}`,
        color: "#F8FAFC",
      };
    }
    return {
      backgroundColor: bg,
      boxShadow: "6px 6px 14px #0d121b, -6px -6px 14px #1d2839",
      border: `1.5px solid ${border}`,
      color: "#F8FAFC",
    };
  }

  // Light Mode (Default)
  const bg = isSelected ? "#E6ECF5" : "#E6ECF5";
  const border = isSelected ? "#1976D2" : "rgba(255, 255, 255, 0.7)";

  if (variant === "pressed" || isSelected) {
    return {
      backgroundColor: bg,
      boxShadow: "inset 4px 4px 8px #c5d0e0, inset -4px -4px 8px #ffffff",
      border: `2px solid ${border}`,
      color: "#1E293B",
    };
  }
  return {
    backgroundColor: bg,
    boxShadow: "6px 6px 14px #c5d0e0, -6px -6px 14px #ffffff",
    border: `1px solid ${border}`,
    color: "#1E293B",
  };
};

export const getNeuStyles = (theme) => {
  const isDark = theme?.palette?.mode === "dark";

  return {
    isDark,
    bgBase: isDark ? "#0F172A" : "#E6ECF5",
    cardBg: isDark ? "#151D2A" : "#E6ECF5",
    accentBlue: isDark ? "#60A5FA" : "#1976D2",
    accentDark: isDark ? "#93C5FD" : "#0D47A1",
    titleColor: isDark ? "#90CAF9" : "#0D47A1",
    textPrimary: isDark ? "#F8FAFC" : "#1E293B",
    textSecondary: isDark ? "#94A3B8" : "#546E7A",
    textMuted: isDark ? "#64748B" : "#78909C",
    elevatedCard: {
      backgroundColor: isDark ? "#151D2A" : "#E6ECF5",
      boxShadow: isDark
        ? "6px 6px 14px #0a0f18, -6px -6px 14px #1c2738"
        : "6px 6px 14px #c5d0e0, -6px -6px 14px #ffffff",
      borderRadius: "16px",
      border: isDark
        ? "1px solid rgba(255, 255, 255, 0.08)"
        : "1px solid rgba(255, 255, 255, 0.6)",
      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      color: isDark ? "#F8FAFC" : "#1E293B",
    },
    pressedCard: {
      backgroundColor: isDark ? "#1E293B" : "#E6ECF5",
      boxShadow: isDark
        ? "inset 4px 4px 10px #090e17, inset -4px -4px 10px #1e2b3e"
        : "inset 4px 4px 8px #c5d0e0, inset -4px -4px 8px #ffffff",
      borderRadius: "16px",
      border: isDark ? "1.5px solid #3B82F6" : "2px solid #1976D2",
      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      color: isDark ? "#93C5FD" : "#0D47A1",
    },
    sunkenPanel: {
      backgroundColor: isDark ? "#0F172A" : "#E6ECF5",
      boxShadow: isDark
        ? "inset 3px 3px 8px #080d16, inset -3px -3px 8px #182335"
        : "inset 3px 3px 8px #c5d0e0, inset -3px -3px 8px #ffffff",
      borderRadius: "16px",
      border: isDark
        ? "1px solid rgba(255, 255, 255, 0.06)"
        : "1px solid rgba(255, 255, 255, 0.5)",
    },
    counterPill: {
      backgroundColor: isDark ? "#1E293B" : "#E6ECF5",
      boxShadow: isDark
        ? "inset 2px 2px 5px #0d121b, inset -2px -2px 5px #263346"
        : "inset 2px 2px 5px #c5d0e0, inset -2px -2px 5px #ffffff",
      borderRadius: "20px",
      px: 1.5,
      py: 0.5,
      display: "inline-flex",
      alignItems: "center",
      gap: 0.8,
    },
    headerPill: {
      backgroundColor: isDark ? "#172030" : "#E6ECF5",
      boxShadow: isDark
        ? "inset 2px 2px 5px #0d121b, inset -2px -2px 5px #263346"
        : "inset 2px 2px 5px #c5d0e0, inset -2px -2px 5px #ffffff",
      borderRadius: "20px",
      px: 2,
      py: 0.8,
      display: "inline-flex",
      alignItems: "center",
    },
    stepperTrack: {
      backgroundColor: isDark ? "#151D2A" : "#E6ECF5",
      boxShadow: isDark
        ? "inset 3px 3px 8px #090e18, inset -3px -3px 8px #1d2839"
        : "inset 3px 3px 6px #c5d0e0, inset -3px -3px 6px #ffffff",
      borderRadius: "20px",
      border: isDark
        ? "1px solid rgba(255, 255, 255, 0.06)"
        : "1px solid rgba(255, 255, 255, 0.6)",
    },
    topicContainer: {
      backgroundColor: isDark ? "#172030" : "#E6ECF5",
      boxShadow: isDark
        ? "4px 4px 10px #0b111a, -4px -4px 10px #1e2b3c"
        : "4px 4px 10px #c5d0e0, -4px -4px 10px #ffffff",
      borderRadius: "14px",
      border: isDark
        ? "1px solid rgba(255, 255, 255, 0.07)"
        : "1px solid rgba(255, 255, 255, 0.8)",
    },
    stickyBar: {
      position: "sticky",
      top: 16,
      zIndex: 10,
      backgroundColor: isDark ? "rgba(21, 29, 42, 0.92)" : "rgba(230, 236, 245, 0.92)",
      backdropFilter: "blur(10px)",
      boxShadow: isDark
        ? "6px 6px 14px #0a0f18, -6px -6px 14px #1c2738"
        : "6px 6px 14px #c5d0e0, -6px -6px 14px #ffffff",
      borderRadius: "16px",
      border: isDark
        ? "1px solid rgba(255, 255, 255, 0.08)"
        : "1px solid rgba(255, 255, 255, 0.8)",
    },
    inputRoot: {
      backgroundColor: isDark ? "#101827" : "#E6ECF5",
      borderRadius: "12px",
      boxShadow: isDark
        ? "inset 2px 2px 5px #0a0f18, inset -2px -2px 5px #1c2738"
        : "inset 2px 2px 5px #c5d0e0, inset -2px -2px 5px #ffffff",
      border: isDark
        ? "1px solid rgba(255, 255, 255, 0.08)"
        : "1px solid rgba(255, 255, 255, 0.5)",
      color: isDark ? "#F8FAFC" : "#1E293B",
    },
  };
};

// Fallback static constants for backwards compatibility
export const NEU_STYLES = getNeuStyles({ palette: { mode: "light" } });
