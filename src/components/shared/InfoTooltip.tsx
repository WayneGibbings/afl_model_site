"use client";

import { useId } from "react";

interface InfoTooltipProps {
  label: string;
  text: string;
}

export function InfoTooltip({ label, text }: InfoTooltipProps) {
  const tooltipId = useId();

  return (
    <span className="info-tooltip">
      <button
        type="button"
        className="info-tooltip__button"
        aria-label={label}
        aria-describedby={tooltipId}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" />
          <path d="M12 7h.01" />
        </svg>
      </button>
      <span id={tooltipId} role="tooltip" className="info-tooltip__popup">
        {text}
      </span>
    </span>
  );
}
