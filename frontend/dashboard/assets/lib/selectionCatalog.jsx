(function () {
  "use strict";

  const CATALOG_TTL_MS = 10 * 60 * 1000;
  const TOPIC_IDS_PER_REQUEST = 200;

  let catalog = null;
  let catalogLoadedAt = 0;
  let inFlight = null;

  function getFetchJSON() {
    const Utils = (window.DashboardApp && window.DashboardApp.Utils) || {};
    return Utils.fetchJSON;
  }

  function normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function sortByName(items) {
    return [...items].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );
  }

  function dedupeTopicsByName(topics) {
    const byName = new Map();
    topics.forEach((topic) => {
      const key = normalizeName(topic.name);
      if (!key || byName.has(key)) return;
      byName.set(key, topic);
    });
    return sortByName(Array.from(byName.values()));
  }

  function groupCompetenciesByTopic(competencies) {
    const grouped = {};
    competencies.forEach((competency) => {
      const topicId = Number(competency.topic_id || 0);
      if (!topicId) return;
      if (!grouped[topicId]) grouped[topicId] = [];
      grouped[topicId].push(competency);
    });
    return grouped;
  }

  function chunk(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(items.slice(i, i + size));
    }
    return out;
  }

  async function fetchCompetenciesForTopics(topicIds) {
    const fetchJSON = getFetchJSON();
    if (!fetchJSON || !topicIds.length) return [];
    const batches = chunk(topicIds, TOPIC_IDS_PER_REQUEST);
    const results = await Promise.all(
      batches.map((batch) =>
        fetchJSON(`/api/competencies/?topic_ids=${batch.join(",")}`),
      ),
    );
    const items = [];
    results.forEach((result) => {
      if (result.ok && Array.isArray(result.data?.items)) {
        items.push(...result.data.items);
      }
    });
    return items;
  }

  async function buildCatalog() {
    const fetchJSON = getFetchJSON();
    if (!fetchJSON) return null;

    const subjectsResult = await fetchJSON("/api/subjects/");
    if (!subjectsResult.ok || !Array.isArray(subjectsResult.data?.items)) {
      return null;
    }

    const topicsBySubject = new Map();
    const allTopicIds = [];
    subjectsResult.data.items.forEach((subject) => {
      const key = normalizeName(subject.name);
      if (!key) return;
      const topics = (Array.isArray(subject.topics) ? subject.topics : []).filter(
        (topic) => topic && topic.id && topic.is_active !== false,
      );
      topicsBySubject.set(key, { id: subject.id, name: subject.name, topics });
      topics.forEach((topic) => allTopicIds.push(topic.id));
    });

    const competencies = await fetchCompetenciesForTopics(allTopicIds);
    return {
      topicsBySubject,
      competenciesByTopicId: groupCompetenciesByTopic(competencies),
    };
  }

  function isFresh() {
    return !!catalog && Date.now() - catalogLoadedAt < CATALOG_TTL_MS;
  }

  function prefetch() {
    if (isFresh()) return Promise.resolve(catalog);
    if (inFlight) return inFlight;
    inFlight = buildCatalog()
      .catch(() => null)
      .then((next) => {
        if (next) {
          catalog = next;
          catalogLoadedAt = Date.now();
        }
        inFlight = null;
        return next;
      });
    return inFlight;
  }

  function selectFromCatalog(subjectNames) {
    const topicGroups = [];
    const uniqueTopics = [];
    const seenTopicNames = new Set();
    (Array.isArray(subjectNames) ? subjectNames : []).forEach((name) => {
      const entry = catalog.topicsBySubject.get(normalizeName(name));
      if (!entry) return;
      const groupTopics = [];
      (Array.isArray(entry.topics) ? entry.topics : []).forEach((topic) => {
        const topicKey = normalizeName(topic.name);
        if (topicKey && seenTopicNames.has(topicKey)) return;
        if (topicKey) seenTopicNames.add(topicKey);
        groupTopics.push(topic);
        uniqueTopics.push(topic);
      });
      if (groupTopics.length) {
        topicGroups.push({
          subjectId: entry.id,
          subjectName: entry.name,
          topics: groupTopics,
        });
      }
    });
    const competencies = [];
    const competenciesByTopicId = {};
    uniqueTopics.forEach((topic) => {
      const items = catalog.competenciesByTopicId[topic.id];
      if (!items || !items.length) return;
      competenciesByTopicId[topic.id] = items;
      competencies.push(...items);
    });
    return { topics: uniqueTopics, topicGroups, competencies, competenciesByTopicId };
  }

  /** Filtered per-subject requests, used when the prefetched catalog is unavailable. */
  async function loadFiltered(subjectNames) {
    const fetchJSON = getFetchJSON();
    const empty = { topics: [], topicGroups: [], competencies: [], competenciesByTopicId: {} };
    if (!fetchJSON) return empty;

    const topicsResult = await fetchJSON(
      `/api/topics/?subject_names=${encodeURIComponent(subjectNames.join(","))}`,
    );
    const topics =
      topicsResult.ok && Array.isArray(topicsResult.data?.items)
        ? dedupeTopicsByName(topicsResult.data.items)
        : [];
    const topicIds = topics.map((topic) => topic.id).filter(Boolean);
    if (!topicIds.length) return { ...empty, topics };

    const competencies = await fetchCompetenciesForTopics(topicIds);
    return {
      topics,
      topicGroups: [],
      competencies,
      competenciesByTopicId: groupCompetenciesByTopic(competencies),
    };
  }

  /** Synchronous options when the catalog is already prefetched, otherwise null. */
  function peek(subjectNames) {
    if (!isFresh()) return null;
    if (!Array.isArray(subjectNames) || subjectNames.length === 0) return null;
    return selectFromCatalog(subjectNames);
  }

  async function load(subjectNames) {
    const names = Array.isArray(subjectNames) ? subjectNames : [];
    if (!names.length) {
      return { topics: [], topicGroups: [], competencies: [], competenciesByTopicId: {} };
    }
    const ready = peek(names);
    if (ready) return ready;
    const loaded = await prefetch();
    if (loaded) return selectFromCatalog(names);
    return loadFiltered(names);
  }

  function invalidate() {
    catalog = null;
    catalogLoadedAt = 0;
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.SelectionCatalog = {
    prefetch,
    peek,
    load,
    invalidate,
  };
})();
