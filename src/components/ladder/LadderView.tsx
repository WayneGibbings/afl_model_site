"use client";

import { useMemo, useState } from "react";
import { LadderTable } from "@/components/ladder/LadderTable";
import type { LadderEntry } from "@/lib/types";

interface LadderViewProps {
  preseasonRows: LadderEntry[];
  currentRows: LadderEntry[];
  seasonStarted: boolean;
}

export function LadderView({ preseasonRows, currentRows, seasonStarted }: LadderViewProps) {
  const [mode, setMode] = useState<"preseason" | "current">(seasonStarted ? "current" : "preseason");
  const rows = useMemo(() => (mode === "preseason" ? preseasonRows : currentRows), [currentRows, mode, preseasonRows]);

  return (
    <section className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm ${mode === "preseason" ? "bg-blue-600 text-white" : "text-slate-700"}`}
          onClick={() => setMode("preseason")}
        >
          Pre-season
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm ${mode === "current" ? "bg-blue-600 text-white" : "text-slate-700"}`}
          onClick={() => setMode("current")}
        >
          Current
        </button>
      </div>
      <LadderTable rows={rows} mode={mode} />
    </section>
  );
}
