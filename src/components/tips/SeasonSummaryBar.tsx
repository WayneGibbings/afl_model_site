import type { SeasonSummary } from "@/lib/types";

interface SeasonSummaryBarProps {
  summary: SeasonSummary;
}

export function SeasonSummaryBar({ summary }: SeasonSummaryBarProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        label="Tips Correct"
        value={`${summary.tipsCorrect} / ${summary.totalTips}`}
        accent="blue"
        icon="🎯"
      />
      <SummaryCard
        label="Accuracy"
        value={`${summary.accuracyPct.toFixed(1)}%`}
        accent="green"
        icon="✓"
      />
      <SummaryCard
        label="MAE"
        value={summary.mae.toFixed(1)}
        accent="amber"
        icon="±"
      />
      <SummaryCard
        label="Bits"
        value={summary.bits.toFixed(1)}
        accent="purple"
        icon="◈"
      />
    </section>
  );
}

const accentMap = {
  blue: { bar: "#1d4ed8", badge: "#eff6ff", text: "#1d40af" },
  green: { bar: "#16a34a", badge: "#f0fdf4", text: "#166534" },
  amber: { bar: "#d97706", badge: "#fffbeb", text: "#92400e" },
  purple: { bar: "#7c3aed", badge: "#f5f3ff", text: "#4c1d95" },
};

function SummaryCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: keyof typeof accentMap;
  icon: string;
}) {
  const colors = accentMap[accent];
  return (
    <div
      className="card relative overflow-hidden px-5 py-4"
      style={{ borderTop: `3px solid ${colors.bar}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
            {label}
          </p>
          <p className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
        </div>
        <span
          className="text-lg w-9 h-9 rounded-lg flex items-center justify-center font-bold"
          style={{ background: colors.badge, color: colors.bar }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
