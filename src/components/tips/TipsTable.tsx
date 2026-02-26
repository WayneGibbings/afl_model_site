"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { teams, type TeamKey } from "@/config/teams";
import { formatMarginPoints, formatPredictionDate, getPredictionChronologicalValue } from "@/lib/format";
import type { UpcomingPrediction } from "@/lib/types";
import { RoundFilter } from "./RoundFilter";

interface TipsTableProps {
  predictions: UpcomingPrediction[];
}

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
  const [browserTimeZone, setBrowserTimeZone] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setBrowserTimeZone(localTimeZone || "UTC");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const rows = useMemo(() => {
    const filtered = selectedRound ? predictions.filter((p) => p.round === selectedRound) : predictions;
    return [...filtered].sort(
      (a, b) => getPredictionChronologicalValue(a) - getPredictionChronologicalValue(b),
    );
  }, [predictions, selectedRound]);

  return (
    <section className="space-y-4">
      {/* Controls bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {roundOptions.length > 1 ? (
            <RoundFilter options={roundOptions} selectedRound={selectedRound} onChange={setSelectedRound} />
          ) : (
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {selectedRound}
            </span>
          )}
        </div>
        <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          {rows.length} match{rows.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Match cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((prediction, i) => (
          <MatchCard
            key={`${prediction.round}-${prediction.home_team}-${prediction.away_team}`}
            prediction={prediction}
            browserTimeZone={browserTimeZone}
          />
        ))}
      </div>
    </section>
  );
}

/* ---------- Match Card ---------- */

function MatchCard({
  prediction,
  browserTimeZone,
}: {
  prediction: UpcomingPrediction;
  browserTimeZone: string | null;
}) {
  const isHomeTip = prediction.predicted_winner === prediction.home_team;
  const winProb = isHomeTip ? prediction.home_win_probability : prediction.away_win_probability;
  const winPct = Math.round(winProb * 100);

  return (
    <div className="match-card card overflow-clip">
      {/* Date / Venue header */}
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider border-b"
        style={{
          background: "var(--surface-raised)",
          color: "var(--muted)",
          borderColor: "var(--border)",
        }}
      >
        <span className="shrink-0">{browserTimeZone ? formatPredictionDate(prediction, browserTimeZone) : "\u00A0"}</span>
        <span className="truncate text-right opacity-70">{prediction.venue}</span>
      </div>

      {/* Matchup — CSS Grid for predictable sizing */}
      <div className="px-4 py-4 sm:py-5">
        <div
          className="items-center gap-3"
          style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr" }}
        >
          {/* Home team */}
          <TeamSide
            team={prediction.home_team}
            isTipped={isHomeTip}
            label="HOME"
          />

          {/* VS divider */}
          <span
            className="text-[10px] font-bold tracking-widest text-center"
            style={{ color: "var(--muted)", opacity: 0.5 }}
          >
            VS
          </span>

          {/* Away team */}
          <TeamSide
            team={prediction.away_team}
            isTipped={!isHomeTip}
            label="AWAY"
          />
        </div>
      </div>

      {/* Tip callout */}
      <div
        className="mx-3 mb-3 rounded-lg px-3.5 py-3 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, var(--gold-light) 0%, rgba(201, 165, 76, 0.08) 100%)",
          borderLeft: "3px solid var(--gold)",
        }}
      >
        {/* Star icon */}
        <span
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--gold)", color: "var(--nav-bg)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </span>

        {/* Tip details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--gold-dark)" }}
            >
              Predicted Winner
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Image
              src={teams[prediction.predicted_winner].icon}
              alt=""
              width={18}
              height={18}
              className="shrink-0"
            />
            <span className="font-bold text-sm" style={{ color: "var(--foreground)" }}>
              {teams[prediction.predicted_winner].name}
            </span>
          </div>
        </div>

        {/* Margin + Win% */}
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
            {formatMarginPoints(prediction.predicted_margin)}
          </p>
          <p className="text-xs font-semibold tabular-nums" style={{ color: "var(--brand)" }}>
            {winPct}% confidence
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Team Side ---------- */

function TeamSide({
  team,
  isTipped,
  label,
}: {
  team: TeamKey;
  isTipped: boolean;
  label: string;
}) {
  const info = teams[team];
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 min-w-0"
      style={
        isTipped
          ? {
              background: "rgba(26, 122, 138, 0.06)",
              boxShadow: "inset 0 0 0 1.5px rgba(26, 122, 138, 0.15)",
            }
          : {}
      }
    >
      {/* Team icon */}
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-white"
        style={{
          width: 44,
          height: 44,
          boxShadow: isTipped
            ? "0 2px 8px rgba(26, 122, 138, 0.2), 0 0 0 2px rgba(26, 122, 138, 0.1)"
            : "0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        <Image src={info.icon} alt={`${info.name} logo`} width={28} height={28} />
      </span>

      {/* Team name */}
      <span
        className="text-xs font-bold text-center leading-tight truncate max-w-full"
        style={{ color: isTipped ? "var(--brand-dark)" : "var(--foreground)" }}
      >
        {info.short}
      </span>

      {/* Home / Away label */}
      <span
        className="text-[9px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted)", opacity: 0.6 }}
      >
        {label}
      </span>
    </div>
  );
}
