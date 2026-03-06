"use client";

import { useMemo, useState } from "react";
import { LadderTable } from "@/components/ladder/LadderTable";
import { sortCurrentProjectionRows } from "@/lib/ladder";
import type { LadderEntry } from "@/lib/types";

interface LadderViewProps {
  preseasonRows: LadderEntry[];
  currentRows: LadderEntry[];
  seasonStarted: boolean;
}

export function LadderView({ preseasonRows, currentRows, seasonStarted }: LadderViewProps) {
  const [mode, setMode] = useState<"preseason" | "current">(seasonStarted ? "current" : "preseason");
  const rows = useMemo(
    () => (mode === "preseason" ? preseasonRows : sortCurrentProjectionRows(currentRows)),
    [currentRows, mode, preseasonRows],
  );

  return (
    <section className="space-y-5">
      {/* Segmented control */}
      <div
        className="inline-flex rounded-xl border p-1 shadow-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        {(["preseason", "current"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-lg px-3 py-2 sm:px-5 text-sm font-semibold transition-all cursor-pointer ${
              mode === m ? "shadow-sm text-white" : "hover:opacity-80"
            }`}
            style={
              mode === m
                ? { background: "var(--brand)" }
                : { color: "var(--muted)" }
            }
            onClick={() => setMode(m)}
          >
            <span className="sm:hidden">{m === "preseason" ? "Pre-season" : "Current"}</span>
            <span className="hidden sm:inline">{m === "preseason" ? "Pre-season Forecast" : "Current Projection"}</span>
          </button>
        ))}
      </div>

      <LadderTable rows={rows} mode={mode} />
    </section>
  );
}
