import { SeasonSummaryBar } from "@/components/tips/SeasonSummaryBar";
import { loadAccuracy, loadUpcomingPredictions } from "@/lib/data";
import { TipsTable } from "@/components/tips/TipsTable";
import { getSeasonSummary } from "@/lib/tips";

export default async function TipsPage() {
  const [predictions, accuracyData] = await Promise.all([loadUpcomingPredictions(), loadAccuracy()]);
  const summary = getSeasonSummary(accuracyData);
  const roundLabel = predictions[0]?.round ?? "";

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">{accuracyData.season} Tips</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          {roundLabel ? `Model predictions for ${roundLabel}` : "Model predictions for the upcoming round"}
        </p>
      </header>
      {accuracyData.total_tips > 0 ? <SeasonSummaryBar summary={summary} /> : null}
      <TipsTable predictions={predictions} />
    </div>
  );
}
