/**
 * Pure routing helper used by tests. App hash→tab sync in AppProviders
 * should match this behavior: hash (without #) is valid tab id ? use it : default "home".
 */
export function getTabFromHash(hash, tabIds) {
  const h = (hash || "").replace(/^#/, "").trim();
  const ids = Array.isArray(tabIds) ? tabIds : [];
  return ids.includes(h) ? h : "home";
}
