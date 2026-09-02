(function () {
  "use strict";

  /* Availability slot wire format: "Mon/Wed|08:00-12:00".
     The day prefix is optional; a slot stored without one predates day
     selection and is treated as every day so existing profiles keep matching.
     Day tokens are joined with "/" because "," separates slots when the API
     receives availability as a single string, and "-" separates the times. */

  const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_LABELS = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };
  const DAY_INDEX = DAY_ORDER.reduce((acc, day, index) => {
    acc[day.toLowerCase()] = index;
    return acc;
  }, {});

  const MIN_AVAILABLE_TIME = "07:00";
  const MAX_AVAILABLE_TIME = "22:00";

  function toMinutes(hhmm) {
    const parts = String(hhmm || "")
      .trim()
      .split(":");
    if (parts.length < 2) return null;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }
    return hours * 60 + minutes;
  }

  function formatHhmm(hhmm) {
    const mins = toMinutes(hhmm);
    if (mins == null) return "";
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(
      mins % 60,
    ).padStart(2, "0")}`;
  }

  function formatTimeLabel(hhmm) {
    const external =
      window.DashboardApp && window.DashboardApp.formatTimeLabel;
    if (typeof external === "function") return external(hhmm);
    return String(hhmm || "");
  }

  function normaliseDays(days) {
    if (!Array.isArray(days)) return [];
    const seen = new Set();
    days.forEach((day) => {
      const index = DAY_INDEX[String(day || "").trim().toLowerCase().slice(0, 3)];
      if (index != null) seen.add(DAY_ORDER[index]);
    });
    return DAY_ORDER.filter((day) => seen.has(day));
  }

  function parseSlot(slot) {
    const text = String(slot || "").trim();
    if (!text) return null;

    const pipeIndex = text.indexOf("|");
    const dayPart = pipeIndex >= 0 ? text.slice(0, pipeIndex) : "";
    const timePart = pipeIndex >= 0 ? text.slice(pipeIndex + 1) : text;

    const times = timePart.split("-");
    if (times.length !== 2) return null;
    const startMinutes = toMinutes(times[0]);
    const endMinutes = toMinutes(times[1]);
    if (startMinutes == null || endMinutes == null) return null;
    if (startMinutes >= endMinutes) return null;

    const days = pipeIndex >= 0 ? normaliseDays(dayPart.split("/")) : [];
    return {
      days: days.length > 0 ? days : [...DAY_ORDER],
      hasExplicitDays: days.length > 0,
      start: formatHhmm(times[0]),
      end: formatHhmm(times[1]),
      startMinutes,
      endMinutes,
    };
  }

  function buildSlot(days, start, end) {
    const normalisedDays = normaliseDays(days);
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    if (startMinutes == null || endMinutes == null) return "";
    if (startMinutes >= endMinutes) return "";
    const times = `${formatHhmm(start)}-${formatHhmm(end)}`;
    if (normalisedDays.length === 0) return times;
    return `${normalisedDays.join("/")}|${times}`;
  }

  function isWithinBounds(start, end) {
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    const min = toMinutes(MIN_AVAILABLE_TIME);
    const max = toMinutes(MAX_AVAILABLE_TIME);
    if (startMinutes == null || endMinutes == null) return false;
    return startMinutes >= min && endMinutes <= max && startMinutes < endMinutes;
  }

  function sameDaySet(a, b) {
    if (a.length !== b.length) return false;
    return a.every((day, index) => day === b[index]);
  }

  function shareDay(a, b) {
    return a.some((day) => b.includes(day));
  }

  function slotsOverlap(a, b) {
    if (!a || !b) return false;
    if (!shareDay(a.days, b.days)) return false;
    return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
  }

  function formatDayLabel(days, options) {
    const normalised = normaliseDays(days);
    if (normalised.length === 0 || normalised.length === DAY_ORDER.length) {
      return "Every day";
    }
    if (
      normalised.length === 5 &&
      normalised.every((day) => day !== "Sat" && day !== "Sun")
    ) {
      return "Weekdays";
    }
    if (
      normalised.length === 2 &&
      normalised.includes("Sat") &&
      normalised.includes("Sun")
    ) {
      return "Weekends";
    }
    if (options && options.long) {
      return normalised.map((day) => DAY_LABELS[day]).join(", ");
    }
    return normalised.join(", ");
  }

  /* Renders as "Mon, Wed • 8:00 AM - 12:00 PM". */
  function formatSlotLabel(slot) {
    const parsed = parseSlot(slot);
    if (!parsed) return String(slot || "");
    const days = formatDayLabel(parsed.days);
    const times = `${formatTimeLabel(parsed.start)} - ${formatTimeLabel(parsed.end)}`;
    return `${days} • ${times}`;
  }

  function formatSlotList(slots, separator) {
    return (Array.isArray(slots) ? slots : [])
      .map((slot) => formatSlotLabel(slot))
      .filter(Boolean)
      .join(separator || ", ");
  }

  function sortSlots(slots) {
    return [...(Array.isArray(slots) ? slots : [])].sort((a, b) => {
      const one = parseSlot(a);
      const two = parseSlot(b);
      if (!one || !two) return String(a).localeCompare(String(b));
      const oneDay = DAY_ORDER.indexOf(one.days[0]);
      const twoDay = DAY_ORDER.indexOf(two.days[0]);
      if (oneDay !== twoDay) return oneDay - twoDay;
      if (one.startMinutes !== two.startMinutes) {
        return one.startMinutes - two.startMinutes;
      }
      return one.endMinutes - two.endMinutes;
    });
  }

  /* Total weekly minutes covered, counting each selected day separately. */
  function weeklyMinutes(slots) {
    return (Array.isArray(slots) ? slots : []).reduce((total, slot) => {
      const parsed = parseSlot(slot);
      if (!parsed) return total;
      return total + parsed.days.length * (parsed.endMinutes - parsed.startMinutes);
    }, 0);
  }

  /* Ranges where two people are both free, as slot strings. */
  function intersectSlots(aSlots, bSlots) {
    const left = (Array.isArray(aSlots) ? aSlots : [])
      .map(parseSlot)
      .filter(Boolean);
    const right = (Array.isArray(bSlots) ? bSlots : [])
      .map(parseSlot)
      .filter(Boolean);

    const found = new Set();
    left.forEach((a) => {
      right.forEach((b) => {
        const days = a.days.filter((day) => b.days.includes(day));
        if (days.length === 0) return;
        const start = Math.max(a.startMinutes, b.startMinutes);
        const end = Math.min(a.endMinutes, b.endMinutes);
        if (start >= end) return;
        const toHhmm = (mins) =>
          `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(
            mins % 60,
          ).padStart(2, "0")}`;
        found.add(buildSlot(days, toHhmm(start), toHhmm(end)));
      });
    });
    return sortSlots(Array.from(found));
  }

  function jsDayToToken(jsDay) {
    return DAY_ORDER[(Number(jsDay) + 6) % 7];
  }

  /* Expand weekly slots into the next concrete day/time windows.
     fromDate is injectable so tests do not depend on "now". */
  function nextOccurrences(slots, limit, fromDate) {
    const parsed = (Array.isArray(slots) ? slots : [])
      .map(parseSlot)
      .filter(Boolean);
    const cap = Number(limit);
    const max = Number.isFinite(cap) && cap > 0 ? cap : 4;
    const now = fromDate instanceof Date ? new Date(fromDate) : new Date();
    const results = [];
    if (!parsed.length) return results;

    for (let offset = 0; offset < 21 && results.length < max; offset += 1) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset,
      );
      const day = jsDayToToken(date.getDay());
      parsed
        .filter((slot) => slot.days.includes(day))
        .sort((a, b) => a.startMinutes - b.startMinutes)
        .forEach((slot) => {
          if (results.length >= max) return;
          const start = new Date(date);
          start.setHours(
            Math.floor(slot.startMinutes / 60),
            slot.startMinutes % 60,
            0,
            0,
          );
          if (start <= now) return;
          const end = new Date(date);
          end.setHours(
            Math.floor(slot.endMinutes / 60),
            slot.endMinutes % 60,
            0,
            0,
          );
          results.push({
            day,
            start,
            end,
            startHhmm: slot.start,
            endHhmm: slot.end,
            slot: buildSlot([day], slot.start, slot.end),
            timeLabel: `${formatTimeLabel(slot.start)} - ${formatTimeLabel(slot.end)}`,
            dateLabel: date.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
            label: `${day} • ${formatTimeLabel(slot.start)} - ${formatTimeLabel(slot.end)}`,
          });
        });
    }
    return results;
  }

  /* Validates a draft against the saved list and returns either an error
     message or the next sorted list. editingIndex is skipped so editing a
     range does not collide with itself. */
  function buildAvailabilityUpdate(currentAvailability, draft, editingIndex) {
    const days = normaliseDays(draft && draft.days);
    const start = draft && draft.start;
    const end = draft && draft.end;

    if (days.length === 0) {
      return { error: "Select at least one day for this timeframe.", next: null };
    }
    if (!start || !end) {
      return {
        error: "Select both start and end time before adding a timeframe.",
        next: null,
      };
    }
    if (!isWithinBounds(start, end)) {
      return {
        error:
          "Choose a valid range between 7:00 AM and 10:00 PM where the start is earlier than the end.",
        next: null,
      };
    }

    const slot = buildSlot(days, start, end);
    const parsedSlot = parseSlot(slot);
    if (!slot || !parsedSlot) {
      return { error: "Choose a valid timeframe.", next: null };
    }

    const current = Array.isArray(currentAvailability)
      ? [...currentAvailability]
      : [];

    for (let index = 0; index < current.length; index += 1) {
      if (index === editingIndex) continue;
      const existing = parseSlot(current[index]);
      if (!existing) continue;
      if (
        sameDaySet(existing.days, parsedSlot.days) &&
        existing.startMinutes === parsedSlot.startMinutes &&
        existing.endMinutes === parsedSlot.endMinutes
      ) {
        return { error: "That timeframe already exists.", next: null };
      }
      if (slotsOverlap(existing, parsedSlot)) {
        const clash = parsedSlot.days.filter((day) =>
          existing.days.includes(day),
        );
        return {
          error: `This overlaps ${formatSlotLabel(current[index])} on ${clash.join(", ")}.`,
          next: null,
        };
      }
    }

    const next = [...current];
    if (editingIndex != null && editingIndex >= 0 && editingIndex < next.length) {
      next[editingIndex] = slot;
    } else {
      next.push(slot);
    }

    return { error: "", next: sortSlots(next) };
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.Availability = {
    DAY_ORDER,
    DAY_LABELS,
    MIN_AVAILABLE_TIME,
    MAX_AVAILABLE_TIME,
    toMinutes,
    formatHhmm,
    normaliseDays,
    parseSlot,
    buildSlot,
    isWithinBounds,
    slotsOverlap,
    formatDayLabel,
    formatSlotLabel,
    formatSlotList,
    sortSlots,
    weeklyMinutes,
    intersectSlots,
    nextOccurrences,
    buildAvailabilityUpdate,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = window.DashboardApp.Availability;
  }
})();
