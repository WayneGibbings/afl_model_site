"use client";

import { useEffect, useState } from "react";
import type { SiteSnapshot } from "../../functions/src/site-snapshot";

export async function fetchLatestSiteSnapshot(
  currentVersion: string,
  signal?: AbortSignal,
): Promise<SiteSnapshot | null> {
  const ifNoneMatch = `"${currentVersion}"`;
  const response = await fetch("/api/site-data/latest", {
    method: "GET",
    headers: {
      "If-None-Match": ifNoneMatch,
    },
    cache: "no-store",
    signal,
  });

  if (response.status === 304) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Live site snapshot fetch failed with status ${response.status}.`);
  }

  return (await response.json()) as SiteSnapshot;
}

export function useLiveSiteSnapshot(initialSnapshot: SiteSnapshot): SiteSnapshot {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const controller = new AbortController();

    void fetchLatestSiteSnapshot(initialSnapshot.snapshotVersion, controller.signal)
      .then((latestSnapshot) => {
        if (!latestSnapshot || latestSnapshot.snapshotVersion === initialSnapshot.snapshotVersion) {
          return;
        }
        setSnapshot(latestSnapshot);
      })
      .catch(() => {
        // Keep bootstrap data on transient runtime failures.
      });

    return () => controller.abort();
  }, [initialSnapshot]);

  return snapshot;
}
