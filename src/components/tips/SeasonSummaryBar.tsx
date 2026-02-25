import type { SeasonSummary } from "@/lib/types";

interface SeasonSummaryBarProps {
  summary: SeasonSummary;
}

export function SeasonSummaryBar({ summary }: SeasonSummaryBarProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard label="Tips correct" value={`${summary.tipsCorrect} / ${summary.totalTips}`} />
      <SummaryCard label="Accuracy" value={`${summary.accuracyPct.toFixed(1)}%`} />
      <SummaryCard label="MAE" value={summary.mae.toFixed(1)} />
      <SummaryCard label="Bits" value={summary.bits.toFixed(1)} />
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
