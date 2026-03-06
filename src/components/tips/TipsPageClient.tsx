"use client";

import { SeasonSummaryBar } from "@/components/tips/SeasonSummaryBar";
import { TipsTable } from "@/components/tips/TipsTable";
import { useLiveSiteSnapshot } from "@/lib/live-site-data";
import { getSeasonSummary } from "@/lib/tips";
import type { SiteSnapshot } from "../../../functions/src/site-snapshot";

interface TipsPageClientProps {
  initialSnapshot: SiteSnapshot;
}

export function TipsPageClient({ initialSnapshot }: TipsPageClientProps) {
  const snapshot = useLiveSiteSnapshot(initialSnapshot);
  const summary = getSeasonSummary(snapshot.accuracy);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Tips</h1>
      </header>
      {snapshot.accuracy.total_tips > 0 ? <SeasonSummaryBar summary={summary} /> : null}
      <TipsTable predictions={snapshot.upcomingPredictions} season={snapshot.season} />
    </div>
  );
}
