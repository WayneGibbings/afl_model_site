"use client";

import { useState } from "react";

interface ChatInputProps {
  disabled: boolean;
  onSubmit: (content: string) => Promise<void> | void;
}

export function ChatInput({ disabled, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState("");

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) {
      return;
    }

    setValue("");
    await onSubmit(trimmed);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="sr-only" htmlFor="genie-question-input">
        Ask a question
      </label>
      <textarea
        id="genie-question-input"
        className="min-h-[56px] w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--foreground)] shadow-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[rgba(26,122,138,0.2)] disabled:cursor-not-allowed disabled:bg-[var(--surface-raised)]"
        placeholder="Ask a question about predictions, teams, accuracy, or ladders..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        disabled={disabled}
      />
      <button
        type="button"
        className="inline-flex h-[44px] items-center justify-center rounded-lg border border-[var(--gold-dark)] bg-[var(--gold)] px-5 text-sm font-semibold text-[var(--brand-deep)] shadow-sm transition hover:bg-[var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          void handleSubmit();
        }}
        disabled={disabled || value.trim().length === 0}
      >
        Send
      </button>
    </div>
  );
}
