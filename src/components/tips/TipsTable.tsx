"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { teams, type TeamKey } from "@/config/teams";
import { formatMarginPoints, formatPredictionDate, getPredictionChronologicalValue } from "@/lib/format";
import type { UpcomingPrediction } from "@/lib/types";
import { TipResultBadge } from "@/components/shared/TipResultBadge";
import { RoundFilter } from "./RoundFilter";

interface TipsTableProps {
  predictions: UpcomingPrediction[];
  season: number;
}

const AVAILABLE_YEARS = [2026];

export function TipsTable({ predictions, season }: TipsTableProps) {
  const [selectedYear, setSelectedYear] = useState<number>(season);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="year-filter"
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--muted)" }}
            >
              Year
            </label>
            <div className="relative">
              <select
                id="year-filter"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="appearance-none rounded-lg border bg-white px-3 py-2 pr-8 text-sm font-semibold shadow-sm cursor-pointer focus:outline-none focus:ring-2"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                  // @ts-expect-error CSS custom properties
                  "--tw-ring-color": "var(--brand)",
                }}
              >
                {AVAILABLE_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5" style={{ color: "var(--muted)" }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Round selector */}
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

      {/* Dynamic subtitle */}
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {selectedRound ? `Model predictions for ${selectedRound}` : "Model predictions for the upcoming round"}
      </p>

      {/* Match cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {rows.map((prediction) => (
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
  const isCompleted = prediction.actual_winner != null;

  return (
    <div className="match-card card overflow-clip">
      {/* Date / Venue header */}
      <div
        className="px-4 py-2 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider border-b"
        style={{
          background: "var(--surface-raised)",
          color: "var(--muted)",
          borderColor: "var(--border)",
        }}
      >
        <span className="shrink-0">{browserTimeZone ? formatPredictionDate(prediction, browserTimeZone) : "\u00A0"}</span>
        <span className="truncate text-right opacity-70">{prediction.venue}</span>
      </div>

      {/* Matchup — horizontal face-off layout */}
      <div className="px-4 py-3 sm:py-4">
        <div
          className="items-center gap-2"
          style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr" }}
        >
          {/* Home team — name left, logo right */}
          <TeamSide
            team={prediction.home_team}
            isTipped={isHomeTip}
            label="HOME"
            side="home"
          />

          {/* VS divider */}
          <span
            className="text-[10px] font-bold tracking-widest text-center"
            style={{ color: "var(--muted)", opacity: 0.5 }}
          >
            VS
          </span>

          {/* Away team — logo left, name right */}
          <TeamSide
            team={prediction.away_team}
            isTipped={!isHomeTip}
            label="AWAY"
            side="away"
          />
        </div>
      </div>

      {/* Tip callout */}
      <div
        className="mx-3 mb-3 rounded-lg px-3.5 py-2.5 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, var(--gold-light) 0%, rgba(201, 165, 76, 0.08) 100%)",
          borderLeft: "3px solid var(--gold)",
        }}
      >
        {/* Star icon */}
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "var(--gold)", color: "var(--nav-bg)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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
              width={16}
              height={16}
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

      {isCompleted ? (
        <div
          className="mx-3 mb-3 rounded-lg px-3.5 py-3"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "var(--muted)" }}
            >
              Match Result
            </span>
            <TipResultBadge correct={prediction.tip_correct ?? null} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <Image
                  src={teams[prediction.actual_winner!].icon}
                  alt=""
                  width={16}
                  height={16}
                  className="shrink-0"
                />
                <span className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                  {teams[prediction.actual_winner!].name}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Actual winner
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
                {prediction.actual_margin != null ? formatMarginPoints(prediction.actual_margin) : "Final margin n/a"}
              </p>
              <p className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                {prediction.margin_error != null ? `MAE ${prediction.margin_error.toFixed(1)}` : "\u00A0"}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Team Side ---------- */

function TeamSide({
  team,
  isTipped,
  label,
  side,
}: {
  team: TeamKey;
  isTipped: boolean;
  label: string;
  side: "home" | "away";
}) {
  const info = teams[team];

  const tippedStyle = isTipped
    ? {
        background: "rgba(26, 122, 138, 0.06)",
        boxShadow: "inset 0 0 0 1.5px rgba(26, 122, 138, 0.15)",
      }
    : {};

  const logoEl = (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white"
      style={{
        width: 36,
        height: 36,
        boxShadow: isTipped
          ? "0 2px 8px rgba(26, 122, 138, 0.2), 0 0 0 2px rgba(26, 122, 138, 0.1)"
          : "0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(0,0,0,0.04)",
      }}
    >
      <Image src={info.icon} alt={`${info.name} logo`} width={24} height={24} />
    </span>
  );

  const textEl = (
    <div className={`flex flex-col min-w-0 ${side === "home" ? "items-start" : "items-end"}`}>
      <span
        className="text-xs font-bold leading-tight truncate max-w-full"
        style={{ color: isTipped ? "var(--brand-dark)" : "var(--foreground)" }}
      >
        {info.short}
      </span>
      <span
        className="text-[9px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted)", opacity: 0.6 }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 min-w-0 ${
        side === "home" ? "flex-row justify-end" : "flex-row-reverse justify-end"
      }`}
      style={tippedStyle}
    >
      {textEl}
      {logoEl}
    </div>
  );
}
