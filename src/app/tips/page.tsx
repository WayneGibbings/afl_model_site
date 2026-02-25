import { SeasonSummaryBar } from "@/components/tips/SeasonSummaryBar";
import { loadAccuracy, loadPredictions } from "@/lib/data";
import { TipsTable } from "@/components/tips/TipsTable";
import { getSeasonSummary } from "@/lib/tips";

export default async function TipsPage() {
  const rows = await loadPredictions();
  const accuracyData = await loadAccuracy();
  const summary = getSeasonSummary(accuracyData);
  const hasResults = rows.some((row) => row.tip_correct !== null);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{rows[0]?.season ?? "Current"} Tips</h1>
      </header>
      {hasResults ? <SeasonSummaryBar summary={summary} /> : null}
      <TipsTable predictions={rows} />
    </div>
  );
}
