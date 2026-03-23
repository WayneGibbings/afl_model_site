"use client";

import { useInfoReveal } from "@/components/shared/InfoTooltip";
import { useLiveSiteSnapshot } from "@/lib/live-site-data";
import type { SiteSnapshot } from "../../../functions/src/site-snapshot";

interface AccuracyPageClientProps {
  initialSnapshot: SiteSnapshot;
}

export function AccuracyPageClient({ initialSnapshot }: AccuracyPageClientProps) {
  const { snapshot, isLoading } = useLiveSiteSnapshot(initialSnapshot);
  const data = snapshot.accuracy;

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Accuracy</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          Season-to-date model performance metrics
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Tips Correct"
          value={isLoading ? null : `${data.tips_correct} / ${data.total_tips}`}
          accent={{ bar: "var(--brand)", badge: "rgba(26, 122, 138, 0.1)", text: "var(--brand)" }}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          }
        />
        <StatCard
          label="Accuracy"
          value={isLoading ? null : `${data.accuracy_pct.toFixed(1)}%`}
          accent={{ bar: "var(--success)", badge: "rgba(22, 163, 74, 0.1)", text: "var(--success)" }}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />
        <StatCard
          label="MAE"
          value={isLoading ? null : data.mae.toFixed(1)}
          infoText="Mean Absolute Error. Lower is better. It is the average gap between the predicted margin and the actual final margin."
          accent={{ bar: "var(--gold)", badge: "var(--gold-light)", text: "var(--gold-dark)" }}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <line x1="12" y1="5" x2="12" y2="19" />
            </svg>
          }
        />
        <StatCard
          label="Bits"
          value={isLoading ? null : data.bits.toFixed(2)}
          infoText="Bits score measures how much confidence the model assigned to the actual winner. Higher is better, with stronger credit for being confidently right."
          accent={{ bar: "var(--brand-dark)", badge: "rgba(15, 58, 68, 0.08)", text: "var(--brand-dark)" }}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          }
        />
      </section>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left">Round</th>
              <th className="px-4 py-3 text-right">Tips</th>
              <th className="px-4 py-3 text-right">Correct</th>
              <th className="px-4 py-3 text-right">Accuracy</th>
              <th className="px-4 py-3 text-right">MAE</th>
            </tr>
          </thead>
          <tbody>
            {data.by_round.slice().reverse().map((round) => (
              <tr key={round.round_label}>
                <td className="px-4 py-3 font-semibold" style={{ color: "var(--foreground)" }}>
                  {round.round_label}
                </td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--muted)" }}>
                  {round.tips}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                  {round.correct}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                  {round.accuracy_pct.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--muted)" }}>
                  {round.mae.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  infoText,
  accent,
  icon,
}: {
  label: string;
  value: string | null;
  infoText?: string;
  accent: { bar: string; badge: string; text: string };
  icon: React.ReactNode;
}) {
  const info = useInfoReveal({ label, text: infoText ?? "", accentColor: accent.bar });

  return (
    <div className="card relative overflow-hidden px-3 py-3 sm:px-5 sm:py-4" style={{ borderTop: `3px solid ${accent.bar}` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest mb-1 flex items-center" style={{ color: "var(--muted)" }}>
            {label}
            {infoText ? info.button : null}
          </p>
          {value === null ? (
            <span className="mt-1 block h-7 w-20 rounded-md animate-pulse" style={{ background: "var(--border)" }} />
          ) : (
            <p className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
              {value}
            </p>
          )}
        </div>
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: accent.badge, color: accent.text }}
        >
          {icon}
        </span>
      </div>
      {infoText ? info.panel : null}
    </div>
  );
}
