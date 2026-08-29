(function () {
  "use strict";
  const React = window.React;
  const { useRef, useCallback } = React;

  function formatTimeLabel(hhmm) {
    const text = String(hhmm || "").trim();
    if (!text) return "";
    const parts = text.split(":");
    if (parts.length < 2) return text;
    const h24 = Number(parts[0]);
    const mins = Number(parts[1]);
    if (!Number.isFinite(h24) || !Number.isFinite(mins)) return text;
    const suffix = h24 >= 12 ? "PM" : "AM";
    const h12 = ((h24 + 11) % 12) + 1;
    return `${h12}:${String(mins).padStart(2, "0")} ${suffix}`;
  }

  function TimePickerField({
    id,
    label,
    value,
    min,
    max,
    onChange,
    placeholder = "Select time",
  }) {
    const inputRef = useRef(null);

    const openPicker = useCallback(() => {
      const node = inputRef.current;
      if (!node) return;
      node.focus({ preventScroll: true });
      if (typeof node.showPicker === "function") {
        try {
          node.showPicker();
        } catch (_) {
          // Native click/focus still opens the picker in most browsers.
        }
      }
    }, []);

    const display = value ? formatTimeLabel(value) : placeholder;

    return (
      <div className="time-field">
        <label htmlFor={id}>{label}</label>
        <div
          className="time-input-wrapper"
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          role="button"
          tabIndex={0}
          aria-labelledby={id + "-display"}
        >
          <span
            id={id + "-display"}
            className={"time-input-display" + (value ? "" : " is-placeholder")}
          >
            {display}
          </span>
          <span className="time-input-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <input
            ref={inputRef}
            id={id}
            type="time"
            className="time-input-native"
            min={min}
            max={max}
            value={value}
            step="60"
            onChange={onChange}
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
            tabIndex={-1}
            aria-label={label}
          />
        </div>
      </div>
    );
  }

  window.DashboardApp = window.DashboardApp || {};
  window.DashboardApp.TimePickerField = TimePickerField;
  window.DashboardApp.formatTimeLabel = formatTimeLabel;
})();
