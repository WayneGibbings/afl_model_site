import { formatPct } from "@/lib/format";
import { getWinProbabilityBackground } from "@/lib/win-prob";

interface WinProbCellProps {
  probability: number;
}

export function WinProbCell({ probability }: WinProbCellProps) {
  return (
    <td className="px-4 py-3 text-right" style={{ backgroundColor: getWinProbabilityBackground(probability) }}>
      {formatPct(probability)}
    </td>
  );
}
