"use client";

import { useState } from "react";

interface InfoRevealProps {
  label: string;
  text: string;
  accentColor?: string;
}

/**
 * Inline info button that toggles a smooth reveal strip below the card value.
 * Returns a tuple: [button element, reveal panel element] so they can be
 * placed in different DOM positions within the parent card.
 */
export function useInfoReveal({ label, text, accentColor }: InfoRevealProps) {
  const [open, setOpen] = useState(false);

  const button = (
    <button
      type="button"
      className="info-reveal__trigger"
      aria-label={`${label} explanation`}
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6" />
        <path d="M12 7h.01" />
      </svg>
    </button>
  );

  const panel = (
    <div
      className="info-reveal__panel"
      data-open={open || undefined}
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      <div className="info-reveal__inner">
        <p className="info-reveal__text">{text}</p>
      </div>
    </div>
  );

  return { button, panel };
}
