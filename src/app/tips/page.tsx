import { SeasonSummaryBar } from "@/components/tips/SeasonSummaryBar";
import { loadAccuracy, loadUpcomingPredictions } from "@/lib/data";
import { TipsTable } from "@/components/tips/TipsTable";
import { getSeasonSummary } from "@/lib/tips";

export default async function TipsPage() {
  const [predictions, accuracyData] = await Promise.all([loadUpcomingPredictions(), loadAccuracy()]);
  const summary = getSeasonSummary(accuracyData);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Tips</h1>
      </header>
      {accuracyData.total_tips > 0 ? <SeasonSummaryBar summary={summary} /> : null}
      <TipsTable predictions={predictions} season={accuracyData.season} />
    </div>
  );
}
