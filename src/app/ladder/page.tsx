import { LadderView } from "@/components/ladder/LadderView";
import { loadAccuracy, loadLadderCurrent, loadLadderPreseason } from "@/lib/data";

export default async function LadderPage() {
  const [preseasonRows, currentRows, accuracyData] = await Promise.all([
    loadLadderPreseason(),
    loadLadderCurrent(),
    loadAccuracy(),
  ]);
  const seasonStarted = accuracyData.total_tips > 0;

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Predicted Ladder</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          Model projections for final season standings
        </p>
      </header>
      <LadderView preseasonRows={preseasonRows} currentRows={currentRows} seasonStarted={seasonStarted} />
    </div>
  );
}
