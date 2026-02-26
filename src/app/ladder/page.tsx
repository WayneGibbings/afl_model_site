import { LadderView } from "@/components/ladder/LadderView";
import { loadLadderCurrent, loadLadderPreseason, loadPredictions } from "@/lib/data";

export default async function LadderPage() {
  const preseasonRows = await loadLadderPreseason();
  const currentRows = await loadLadderCurrent();
  const predictionRows = await loadPredictions();
  const seasonStarted = predictionRows.some((row) => row.actual_winner !== null);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Predicted Ladder</h1>
        <p className="text-slate-500 mt-1 text-sm">Model projections for final season standings</p>
      </header>
      <LadderView preseasonRows={preseasonRows} currentRows={currentRows} seasonStarted={seasonStarted} />
    </div>
  );
}
