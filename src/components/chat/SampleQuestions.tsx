interface SampleQuestionsProps {
  disabled: boolean;
  onSelect: (question: string) => void;
}

const sampleQuestions = [
  "Which team has the highest projected win total?",
  "Show games this round where the model confidence is over 70%.",
  "What is the model's tip accuracy by round this season?",
  "Which teams are currently overperforming versus preseason ladder predictions?",
];

export function SampleQuestions({ disabled, onSelect }: SampleQuestionsProps) {
  return (
    <section className="space-y-3">
      <p className="m-0 text-sm text-[var(--muted)]">Try one of these:</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {sampleQuestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onSelect(question)}
            disabled={disabled}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm text-[var(--foreground)] transition hover:border-[var(--brand)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {question}
          </button>
        ))}
      </div>
    </section>
  );
}
