"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamBadge } from "@/components/shared/TeamBadge";
import { TipResultBadge } from "@/components/shared/TipResultBadge";
import { WinProbCell } from "@/components/shared/WinProbCell";
import { formatMatchDate } from "@/lib/format";
import { getDefaultRound, getFilteredPredictions, getRoundOptions } from "@/lib/tips";
import type { Prediction, SortKey } from "@/lib/types";
import { RoundFilter } from "./RoundFilter";

interface TipsTableProps {
  predictions: Prediction[];
}

type SortDirection = "asc" | "desc";

export function TipsTable({ predictions }: TipsTableProps) {
  const [selectedRound, setSelectedRound] = useState<string>(() => getDefaultRound(predictions));
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

  const roundOptions = useMemo(() => getRoundOptions(predictions), [predictions]);

  const rows = useMemo(() => {
    const filtered = getFilteredPredictions(predictions, selectedRound);
    const sorted = [...filtered].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "round") {
        return (a.round - b.round) * multiplier;
      }

      if (sortKey === "date") {
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * multiplier;
      }

      if (sortKey === "margin") {
        return (a.predicted_margin - b.predicted_margin) * multiplier;
      }

      if (sortKey === "winPct") {
        return (a.win_probability - b.win_probability) * multiplier;
      }

      if (sortKey === "actual") {
        return ((a.actual_margin ?? -1) - (b.actual_margin ?? -1)) * multiplier;
      }

      return ((a.margin_error ?? -1) - (b.margin_error ?? -1)) * multiplier;
    });

    return sorted;
  }, [predictions, selectedRound, sortDirection, sortKey]);

  const hasResults = rows.some((row) => row.tip_correct !== null);

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
        <RoundFilter options={roundOptions} selectedRound={selectedRound} onChange={setSelectedRound} />
        <span className="text-xs text-slate-400 font-medium">
          {rows.length} match{rows.length !== 1 ? "es" : ""}
        </span>
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader onClick={() => setSort("round")} sortKey="round" activeKey={sortKey} dir={sortDirection}>
                Round
              </SortableHeader>
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
              {hasResults ? (
                <>
                  <th className="px-4 py-3 text-left">Winner</th>
                  <SortableHeader onClick={() => setSort("actual")} sortKey="actual" activeKey={sortKey} dir={sortDirection}>
                    Actual
                  </SortableHeader>
                  <th className="px-4 py-3 text-center">Result</th>
                  <SortableHeader onClick={() => setSort("mae")} sortKey="mae" activeKey={sortKey} dir={sortDirection}>
                    MAE
                  </SortableHeader>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((prediction) => (
              <tr key={`${prediction.round_label}-${prediction.home_team}-${prediction.away_team}`}>
                <td className="px-4 py-3 font-medium text-slate-600 text-sm">{prediction.round_label}</td>
                <td className="hidden px-4 py-3 text-slate-500 text-sm md:table-cell">
                  {browserTimeZone ? formatMatchDate(prediction.date, browserTimeZone) : "\u00A0"}
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
                  {prediction.predicted_margin.toFixed(1)}
                </td>
                <WinProbCell probability={prediction.win_probability} />
                {hasResults ? (
                  <>
                    <td className="px-4 py-3">
                      {prediction.actual_winner ? (
                        <TeamBadge team={prediction.actual_winner} size="sm" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-slate-700">
                      {prediction.actual_margin ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TipResultBadge correct={prediction.tip_correct} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-slate-600">
                      {prediction.margin_error === null ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        prediction.margin_error.toFixed(1)
                      )}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
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
