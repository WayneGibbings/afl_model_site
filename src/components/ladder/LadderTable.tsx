import { TeamBadge } from "@/components/shared/TeamBadge";
import type { LadderEntry } from "@/lib/types";

interface LadderTableProps {
  rows: LadderEntry[];
  mode: "preseason" | "current";
}

function getFinalsStatus(position: number): "top6" | "playoff" | "out" {
  if (position <= 6) return "top6";
  if (position <= 10) return "playoff";
  return "out";
}

const finalsColors = {
  top6: { border: "var(--brand)", badge: "var(--brand)", badgeText: "white" },
  playoff: { border: "var(--gold)", badge: "var(--gold)", badgeText: "var(--nav-bg)" },
  out: { border: "var(--border)", badge: "var(--surface-raised)", badgeText: "var(--muted)" },
};

export function LadderTable({ rows, mode }: LadderTableProps) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left w-12">Pos</th>
            <th className="px-4 py-3 text-left">Team</th>
            {mode === "preseason" ? (
              <>
                <th className="px-4 py-3 text-right">
                  <span className="sm:hidden">Wins</span>
                  <span className="hidden sm:inline">Forecast Wins</span>
                </th>
                <th className="px-4 py-3 text-right">%</th>
              </>
            ) : (
              <>
                <th className="px-4 py-3 text-right">W-L-D</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3 text-right">
                  <span className="sm:hidden">Wins</span>
                  <span className="hidden sm:inline">Proj. Wins</span>
                </th>
                <th className="hidden sm:table-cell px-4 py-3 text-right">Proj. Pos</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const displayPosition = index + 1;
            const status = getFinalsStatus(displayPosition);
            const colors = finalsColors[status];
            return (
              <tr
                key={`${mode}-${row.team}`}
                style={{ borderLeft: `4px solid ${colors.border}` }}
                className={status === "top6" ? "bg-[rgba(26,122,138,0.03)]" : status === "playoff" ? "bg-[rgba(201,165,76,0.03)]" : ""}
              >
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                    style={{ background: colors.badge, color: colors.badgeText }}
                  >
                    {displayPosition}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="sm:hidden">
                    <TeamBadge team={row.team} size="sm" />
                  </span>
                  <span className="hidden sm:inline-flex">
                    <TeamBadge team={row.team} size="md" showFullName />
                  </span>
                </td>
                {mode === "preseason" ? (
                  <>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                      {row.wins}
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--muted)" }}>
                      {row.percentage != null ? `${row.percentage.toFixed(1)}%` : "\u2014"}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                      {`${row.wins}-${row.losses}-${row.draws}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--muted)" }}>
                      {row.percentage != null ? `${row.percentage.toFixed(1)}%` : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: "var(--foreground)" }}>
                      {row.predicted_final_wins != null ? row.predicted_final_wins : "\u2014"}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-right font-mono" style={{ color: "var(--muted)" }}>
                      {row.predicted_final_position ?? "\u2014"}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="px-4 py-3 border-t flex flex-wrap items-center gap-4" style={{ borderColor: "var(--border)" }}>
        <LegendItem color="var(--brand)" label="Top 6 — Direct finals" />
        <LegendItem color="var(--gold)" label="7–10 — Playoff round" />
        <LegendItem color="var(--border)" label="11–18 — Eliminated" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
