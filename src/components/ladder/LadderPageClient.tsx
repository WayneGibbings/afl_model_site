"use client";

import { LadderView } from "@/components/ladder/LadderView";
import { useLiveSiteSnapshot } from "@/lib/live-site-data";
import type { SiteSnapshot } from "../../../functions/src/site-snapshot";

interface LadderPageClientProps {
  initialSnapshot: SiteSnapshot;
}

export function LadderPageClient({ initialSnapshot }: LadderPageClientProps) {
  const { snapshot } = useLiveSiteSnapshot(initialSnapshot);
  const seasonStarted = snapshot.accuracy.total_tips > 0;

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Predicted Ladder</h1>
        <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
          Model projections for final season standings
        </p>
      </header>
      <LadderView preseasonRows={snapshot.ladderPreseason} currentRows={snapshot.ladderCurrent} seasonStarted={seasonStarted} />
    </div>
  );
}
