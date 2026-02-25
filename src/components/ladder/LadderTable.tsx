import { TeamBadge } from "@/components/shared/TeamBadge";
import { teams } from "@/config/teams";
import type { LadderEntry } from "@/lib/types";

interface LadderTableProps {
  rows: LadderEntry[];
  mode: "preseason" | "current";
}

export function LadderTable({ rows, mode }: LadderTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Pos</th>
            <th className="px-4 py-3 text-left font-semibold">Team</th>
            {mode === "preseason" ? (
              <>
                <th className="px-4 py-3 text-right font-semibold">Predicted Wins</th>
                <th className="px-4 py-3 text-right font-semibold">Predicted %</th>
              </>
            ) : (
              <>
                <th className="px-4 py-3 text-right font-semibold">Current W-L-D</th>
                <th className="px-4 py-3 text-right font-semibold">Current %</th>
                <th className="px-4 py-3 text-right font-semibold">Predicted Final Wins</th>
                <th className="px-4 py-3 text-right font-semibold">Predicted Final Pos</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${mode}-${row.team}`}
              className={`border-t border-slate-200 ${row.position <= 8 ? "bg-blue-50/40" : ""}`}
              style={{ borderLeft: `5px solid ${teams[row.team].primary}` }}
            >
              <td className="px-4 py-3">{row.position}</td>
              <td className="px-4 py-3">
                <TeamBadge team={row.team} size="md" showFullName />
              </td>
              {mode === "preseason" ? (
                <>
                  <td className="px-4 py-3 text-right">{row.wins.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right">{row.percentage.toFixed(1)}</td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3 text-right">{`${row.wins}-${row.losses}-${row.draws}`}</td>
                  <td className="px-4 py-3 text-right">{row.percentage.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right">{row.predicted_final_wins?.toFixed(1) ?? "-"}</td>
                  <td className="px-4 py-3 text-right">{row.predicted_final_position ?? "-"}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
