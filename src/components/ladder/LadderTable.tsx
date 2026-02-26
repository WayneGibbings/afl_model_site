import { TeamBadge } from "@/components/shared/TeamBadge";
import { teams } from "@/config/teams";
import type { LadderEntry } from "@/lib/types";

interface LadderTableProps {
  rows: LadderEntry[];
  mode: "preseason" | "current";
}

// Top 6 → direct finals, 7–10 → playoff round, 11+ → eliminated
function getFinalsStatus(position: number): "top6" | "playoff" | "out" {
  if (position <= 6) return "top6";
  if (position <= 10) return "playoff";
  return "out";
}

const finalsColors = {
  top6:   { border: "#16a34a", rowBg: "bg-green-50/40",  badge: "bg-green-600 text-white" },
  playoff: { border: "#d97706", rowBg: "bg-amber-50/40", badge: "bg-amber-500 text-white" },
  out:    { border: "#cbd5e1", rowBg: "",                 badge: "bg-slate-100 text-slate-500" },
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
          {rows.map((row) => {
            const status = getFinalsStatus(row.position);
            const colors = finalsColors[status];
            return (
              <tr
                key={`${mode}-${row.team}`}
                style={{ borderLeft: `4px solid ${colors.border}` }}
                className={colors.rowBg}
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${colors.badge}`}
                  >
                    {row.position}
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
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">
                      {row.wins}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {row.percentage != null ? `${row.percentage.toFixed(1)}%` : "—"}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">
                      {`${row.wins}-${row.losses}-${row.draws}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {row.percentage != null ? `${row.percentage.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-700">
                      {row.predicted_final_wins != null ? row.predicted_final_wins : "—"}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-right font-mono text-slate-600">
                      {row.predicted_final_position ?? "—"}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center gap-4">
        <LegendItem color="#16a34a" label="Top 6 — Direct finals" />
        <LegendItem color="#d97706" label="7–10 — Playoff round" />
        <LegendItem color="#cbd5e1" label="11–18 — Eliminated" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
