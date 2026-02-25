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
      <RoundFilter options={roundOptions} selectedRound={selectedRound} onChange={setSelectedRound} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <SortableHeader onClick={() => setSort("round")}>Round</SortableHeader>
              <SortableHeader onClick={() => setSort("date")} className="hidden md:table-cell">
                Date
              </SortableHeader>
              <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Venue</th>
              <th className="px-4 py-3 text-left font-semibold">Home</th>
              <th className="px-4 py-3 text-left font-semibold">Away</th>
              <th className="px-4 py-3 text-left font-semibold">Tip</th>
              <SortableHeader onClick={() => setSort("margin")}>Margin</SortableHeader>
              <SortableHeader onClick={() => setSort("winPct")}>Win%</SortableHeader>
              {hasResults ? (
                <>
                  <th className="px-4 py-3 text-left font-semibold">Winner</th>
                  <SortableHeader onClick={() => setSort("actual")}>Actual</SortableHeader>
                  <th className="px-4 py-3 text-center font-semibold">Result</th>
                  <SortableHeader onClick={() => setSort("mae")}>MAE</SortableHeader>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((prediction) => (
              <tr key={`${prediction.round_label}-${prediction.home_team}-${prediction.away_team}`} className="border-t border-slate-200">
                <td className="px-4 py-3">{prediction.round_label}</td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  {browserTimeZone ? formatMatchDate(prediction.date, browserTimeZone) : "\u00A0"}
                </td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{prediction.venue}</td>
                <td className="px-4 py-3">
                  <TeamBadge team={prediction.home_team} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <TeamBadge team={prediction.away_team} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <TeamBadge team={prediction.predicted_winner} size="sm" />
                </td>
                <td className="px-4 py-3 text-right">{prediction.predicted_margin.toFixed(1)}</td>
                <WinProbCell probability={prediction.win_probability} />
                {hasResults ? (
                  <>
                    <td className="px-4 py-3">
                      {prediction.actual_winner ? <TeamBadge team={prediction.actual_winner} size="sm" /> : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{prediction.actual_margin ?? "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <TipResultBadge correct={prediction.tip_correct} />
                    </td>
                    <td className="px-4 py-3 text-right">{prediction.margin_error === null ? "-" : prediction.margin_error.toFixed(1)}</td>
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-4 py-3 text-right font-semibold ${className}`}>
      <button type="button" onClick={onClick} className="cursor-pointer">
        {children}
      </button>
    </th>
  );
}
