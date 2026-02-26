"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamBadge } from "@/components/shared/TeamBadge";
import { WinProbCell } from "@/components/shared/WinProbCell";
import { formatMarginPoints, formatPredictionDate, getPredictionChronologicalValue } from "@/lib/format";
import type { SortKey, UpcomingPrediction } from "@/lib/types";
import { RoundFilter } from "./RoundFilter";

interface TipsTableProps {
  predictions: UpcomingPrediction[];
}

type SortDirection = "asc" | "desc";

export function TipsTable({ predictions }: TipsTableProps) {
  const roundOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const p of predictions) {
      if (!seen.has(p.round)) {
        seen.add(p.round);
        opts.push({ value: p.round, label: p.round });
      }
    }
    return opts;
  }, [predictions]);

  const [selectedRound, setSelectedRound] = useState<string>(() => predictions[0]?.round ?? "");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [browserTimeZone, setBrowserTimeZone] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setBrowserTimeZone(localTimeZone || "UTC");
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const rows = useMemo(() => {
    const filtered = selectedRound ? predictions.filter((p) => p.round === selectedRound) : predictions;
    return [...filtered].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "date") {
        return (getPredictionChronologicalValue(a) - getPredictionChronologicalValue(b)) * multiplier;
      }

      if (sortKey === "margin") {
        return (Math.abs(a.predicted_margin) - Math.abs(b.predicted_margin)) * multiplier;
      }

      // winPct: sort by the predicted winner's probability
      const aProb = a.predicted_winner === a.home_team ? a.home_win_probability : a.away_win_probability;
      const bProb = b.predicted_winner === b.home_team ? b.home_win_probability : b.away_win_probability;
      return (aProb - bProb) * multiplier;
    });
  }, [predictions, selectedRound, sortDirection, sortKey]);

  function setSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        {roundOptions.length > 1 ? (
          <RoundFilter options={roundOptions} selectedRound={selectedRound} onChange={setSelectedRound} />
        ) : (
          <span className="text-sm font-semibold text-slate-700">{selectedRound}</span>
        )}
        <span className="text-xs text-slate-400 font-medium">
          {rows.length} match{rows.length !== 1 ? "es" : ""}
        </span>
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader onClick={() => setSort("date")} sortKey="date" activeKey={sortKey} dir={sortDirection} className="hidden md:table-cell">
                Date
              </SortableHeader>
              <th className="hidden px-4 py-3 text-left md:table-cell">Venue</th>
              <th className="px-4 py-3 text-left">Home</th>
              <th className="px-4 py-3 text-left">Away</th>
              <th className="px-4 py-3 text-left">Tip</th>
              <SortableHeader onClick={() => setSort("margin")} sortKey="margin" activeKey={sortKey} dir={sortDirection}>
                Margin
              </SortableHeader>
              <SortableHeader onClick={() => setSort("winPct")} sortKey="winPct" activeKey={sortKey} dir={sortDirection}>
                Win%
              </SortableHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map((prediction) => {
              const winProbability =
                prediction.predicted_winner === prediction.home_team
                  ? prediction.home_win_probability
                  : prediction.away_win_probability;

              return (
                <tr key={`${prediction.round}-${prediction.home_team}-${prediction.away_team}`}>
                  <td className="hidden px-4 py-3 text-slate-500 text-sm md:table-cell">
                    {browserTimeZone ? formatPredictionDate(prediction, browserTimeZone) : "\u00A0"}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 text-sm md:table-cell">{prediction.venue}</td>
                  <td className="px-4 py-3">
                    <TeamBadge team={prediction.home_team} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <TeamBadge team={prediction.away_team} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <TeamBadge team={prediction.predicted_winner} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-slate-700">
                    {formatMarginPoints(prediction.predicted_margin)}
                  </td>
                  <WinProbCell probability={winProbability} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SortableHeader({
  children,
  onClick,
  className = "",
  sortKey,
  activeKey,
  dir,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  sortKey: string;
  activeKey: string;
  dir: "asc" | "desc";
}) {
  const active = sortKey === activeKey;
  return (
    <th className={`px-4 py-3 text-right ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 cursor-pointer transition-colors ${
          active ? "text-blue-700" : "hover:text-slate-700"
        }`}
      >
        {children}
        <span className="text-[10px] opacity-60">
          {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}
