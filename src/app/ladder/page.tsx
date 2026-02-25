import { LadderView } from "@/components/ladder/LadderView";
import { loadLadderCurrent, loadLadderPreseason, loadPredictions } from "@/lib/data";

export default async function LadderPage() {
  const preseasonRows = await loadLadderPreseason();
  const currentRows = await loadLadderCurrent();
  const predictionRows = await loadPredictions();
  const seasonStarted = predictionRows.some((row) => row.actual_winner !== null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Predicted Ladder</h1>
      </header>
      <LadderView preseasonRows={preseasonRows} currentRows={currentRows} seasonStarted={seasonStarted} />
    </div>
  );
}
