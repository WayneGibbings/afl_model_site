import type { SeasonSummary } from "@/lib/types";

interface SeasonSummaryBarProps {
  summary: SeasonSummary;
}

export function SeasonSummaryBar({ summary }: SeasonSummaryBarProps) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard
        label="Tips Correct"
        value={`${summary.tipsCorrect} / ${summary.totalTips}`}
        accent={{ bar: "var(--brand)", badge: "rgba(26, 122, 138, 0.1)", text: "var(--brand)" }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        }
      />
      <SummaryCard
        label="Accuracy"
        value={`${summary.accuracyPct.toFixed(1)}%`}
        accent={{ bar: "var(--success)", badge: "rgba(22, 163, 74, 0.1)", text: "var(--success)" }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        }
      />
      <SummaryCard
        label="MAE"
        value={summary.mae.toFixed(1)}
        accent={{ bar: "var(--gold)", badge: "var(--gold-light)", text: "var(--gold-dark)" }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <line x1="12" y1="5" x2="12" y2="19" />
          </svg>
        }
      />
      <SummaryCard
        label="Bits"
        value={summary.bits.toFixed(1)}
        accent={{ bar: "var(--brand-dark)", badge: "rgba(15, 58, 68, 0.08)", text: "var(--brand-dark)" }}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        }
      />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: { bar: string; badge: string; text: string };
  icon: React.ReactNode;
}) {
  return (
    <div
      className="card relative overflow-hidden px-3 py-3 sm:px-5 sm:py-4"
      style={{ borderTop: `3px solid ${accent.bar}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--muted)" }}
          >
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
            {value}
          </p>
        </div>
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accent.badge, color: accent.text }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
