import type { LadderEntry } from "@/lib/types";

export function sortCurrentProjectionRows(rows: LadderEntry[]): LadderEntry[] {
  return [...rows].sort((a, b) => {
    const projectedWinsA = a.predicted_final_wins ?? Number.NEGATIVE_INFINITY;
    const projectedWinsB = b.predicted_final_wins ?? Number.NEGATIVE_INFINITY;
    if (projectedWinsA !== projectedWinsB) {
      return projectedWinsB - projectedWinsA;
    }

    const percentageA = a.percentage ?? Number.NEGATIVE_INFINITY;
    const percentageB = b.percentage ?? Number.NEGATIVE_INFINITY;
    if (percentageA !== percentageB) {
      return percentageB - percentageA;
    }

    return a.team.localeCompare(b.team);
  });
}
