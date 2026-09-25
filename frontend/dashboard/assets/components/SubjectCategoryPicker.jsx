(function () {
  "use strict";
  const React = window.React;
  const { useMemo } = React;

  function SubjectCategoryPicker({ selectedSubjects, onToggle, showError, maxSubjects = 2 }) {
    const catalog = window.DashboardApp.SUBJECT_CATALOG || [];
    const categoryOrder = window.DashboardApp.SUBJECT_CATEGORY_ORDER || ["major"];
    const categoryLabels = window.DashboardApp.SUBJECT_CATEGORY_LABELS || {};

    const normalizedCatalog = useMemo(() => {
      return (catalog || [])
        .filter((entry) => String(entry.category || "major") === "major")
        .map((entry) => {
          const key = entry.category || "major";
          const orderIdx = Math.max(0, categoryOrder.indexOf(key));
          return {
            ...entry,
            category: key,
            categoryLabel: categoryLabels[key] || key,
            orderIdx,
          };
        })
        .sort((a, b) => {
          if (a.orderIdx !== b.orderIdx) return a.orderIdx - b.orderIdx;
          return String(a.code || a.name).localeCompare(String(b.code || b.name));
        });
    }, [catalog, categoryOrder, categoryLabels]);

    const selected = Array.isArray(selectedSubjects) ? selectedSubjects : [];
    const isCapReached = selected.length >= maxSubjects;

    return (
      <div className="subject-category-picker subject-category-picker--modern">
        <div className="complete-profile-subject-grid" role="list" aria-label="Subjects by category">
          {normalizedCatalog.map((entry) => {
            const active = selected.includes(entry.name);
            const isDisabled = !active && isCapReached;
            return (
              <button
                key={entry.name}
                type="button"
                role="listitem"
                className={
                  "complete-profile-subject-card mp-subject-card" +
                  (active ? " is-active" : "") +
                  (isDisabled ? " is-disabled" : "")
                }
                style={isDisabled ? { opacity: 0.5, cursor: "not-allowed", pointerEvents: "auto" } : undefined}
                aria-pressed={active}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  onToggle(entry.name);
                }}
              >
                <div className="mp-subject-top">
                  <span className={"mp-subject-category-badge mp-cat-" + entry.category}>
                    {entry.category === "major"
                      ? "Major"
                      : entry.category === "ge"
                        ? "GE"
                        : entry.category === "nstp"
                          ? "NSTP"
                          : "PE"}
                  </span>
                  {active ? (
                    <span className="mp-subject-check" aria-hidden="true">✓</span>
                  ) : (
                    <span className="mp-subject-check-placeholder" aria-hidden="true" />
                  )}
                </div>
                {entry.code ? (
                  <span className="complete-profile-subject-code">{entry.code}</span>
                ) : null}
                <span className="complete-profile-subject-title">{entry.name}</span>
              </button>
            );
          })}
        </div>
        {showError ? (
          <p className="complete-profile-error" role="alert">
            Select at least one subject.
          </p>
        ) : null}
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.SubjectCategoryPicker = SubjectCategoryPicker;
})();
