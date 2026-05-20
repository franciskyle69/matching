/**
 * Hash → tab id. Unknown or removed tabs (e.g. legacy #sessions) fall back to home.
 */
export function getTabFromHash(hash, tabIds) {
  const h = (hash || "").replace(/^#/, "").trim();
  if (h === "sessions" || h.startsWith("sessions/")) {
    return "home";
  }
  const ids = Array.isArray(tabIds) ? tabIds : [];
  return ids.includes(h) ? h : "home";
}
