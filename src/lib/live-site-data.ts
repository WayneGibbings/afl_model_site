"use client";

import { useEffect, useState } from "react";
import type { SiteSnapshot } from "../../functions/src/site-snapshot";

const SNAPSHOT_CACHE_KEY = "site-snapshot-cache";

function readCachedSnapshot(): SiteSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SiteSnapshot;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(snapshot: SiteSnapshot): void {
  try {
    sessionStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or unavailable — not critical.
  }
}

function pickNewest(a: SiteSnapshot, b: SiteSnapshot): SiteSnapshot {
  return a.snapshotVersion >= b.snapshotVersion ? a : b;
}

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
  const [snapshot, setSnapshot] = useState(() => {
    if (typeof window === "undefined") return initialSnapshot;
    const cached = readCachedSnapshot();
    return cached ? pickNewest(cached, initialSnapshot) : initialSnapshot;
  });

  useEffect(() => {
    const controller = new AbortController();

    void fetchLatestSiteSnapshot(snapshot.snapshotVersion, controller.signal)
      .then((latestSnapshot) => {
        if (!latestSnapshot || latestSnapshot.snapshotVersion === snapshot.snapshotVersion) {
          return;
        }
        writeCachedSnapshot(latestSnapshot);
        setSnapshot(latestSnapshot);
      })
      .catch(() => {
        // Keep bootstrap data on transient runtime failures.
      });

    return () => controller.abort();
  }, [snapshot.snapshotVersion]);

  useEffect(() => {
    writeCachedSnapshot(snapshot);
  }, [snapshot]);

  return snapshot;
}
