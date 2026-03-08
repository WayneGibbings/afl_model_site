import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { AccuracyData, LadderEntry, UpcomingPrediction } from "@/lib/types";
import { createSiteSnapshot, parseSiteSnapshot, type SiteSnapshot } from "../../functions/src/site-snapshot";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadJsonWithFallback<T>(fileName: string): Promise<T> {
  const livePath = path.join(process.cwd(), "src/data", fileName);
  const mockPath = path.join(process.cwd(), "src/data-mock", fileName);
  const target = (await fileExists(livePath)) ? livePath : mockPath;

  if (!(await fileExists(target))) {
    throw new Error(`Missing data file: ${fileName}. Checked ${livePath} and ${mockPath}`);
  }

  const raw = await readFile(target, "utf-8");
  return JSON.parse(raw) as T;
}

async function loadOptionalJson(fileName: string): Promise<unknown | null> {
  const livePath = path.join(process.cwd(), "src/data", fileName);
  const mockPath = path.join(process.cwd(), "src/data-mock", fileName);
  const target = (await fileExists(livePath)) ? livePath : mockPath;

  if (!(await fileExists(target))) {
    return null;
  }

  const raw = await readFile(target, "utf-8");
  return JSON.parse(raw) as unknown;
}

export function loadUpcomingPredictions(): Promise<UpcomingPrediction[]> {
  return loadJsonWithFallback<UpcomingPrediction[]>("upcoming-predictions.json");
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumberOrFallback(value: unknown, fallback: number): number {
  const parsed = toOptionalNumber(value);
  return parsed ?? fallback;
}

function roundToThreeDp(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toRoundLabel(value: unknown, roundLabel: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof roundLabel === "string" && roundLabel.trim()) {
    return roundLabel;
  }

  const parsedRound = toOptionalNumber(value);
  if (parsedRound !== null) {
    return `Round ${parsedRound}`;
  }

  return "Unknown Round";
}

function normalizeLegacyPrediction(prediction: Record<string, unknown>): UpcomingPrediction {
  const homeTeam = String(prediction.home_team ?? "");
  const awayTeam = String(prediction.away_team ?? "");
  const predictedWinner = String(prediction.predicted_winner ?? "");
  const winProbability = toOptionalNumber(prediction.win_probability);

  const homeWinProbability =
    toOptionalNumber(prediction.home_win_probability) ??
    roundToThreeDp(winProbability === null ? 0.5 : predictedWinner === homeTeam ? winProbability : 1 - winProbability);

  const awayWinProbability =
    toOptionalNumber(prediction.away_win_probability) ??
    roundToThreeDp(winProbability === null ? 0.5 : predictedWinner === awayTeam ? winProbability : 1 - winProbability);

  const homeElo = toNumberOrFallback(prediction.home_elo, 1500);
  const awayElo = toNumberOrFallback(prediction.away_elo, 1500);

  return {
    round: toRoundLabel(prediction.round, prediction.round_label),
    date: String(prediction.date ?? ""),
    kickoff_time_utc: typeof prediction.kickoff_time_utc === "string" ? prediction.kickoff_time_utc : null,
    kickoff_time_local: typeof prediction.kickoff_time_local === "string" ? prediction.kickoff_time_local : null,
    kickoff_tz_offset: typeof prediction.kickoff_tz_offset === "string" ? prediction.kickoff_tz_offset : null,
    kickoff_time_utc_iso: typeof prediction.kickoff_time_utc_iso === "string" ? prediction.kickoff_time_utc_iso : null,
    home_team: homeTeam as UpcomingPrediction["home_team"],
    away_team: awayTeam as UpcomingPrediction["away_team"],
    venue: String(prediction.venue ?? ""),
    predicted_winner: predictedWinner as UpcomingPrediction["predicted_winner"],
    actual_winner:
      prediction.actual_winner === null || prediction.actual_winner === undefined
        ? null
        : (String(prediction.actual_winner) as UpcomingPrediction["actual_winner"]),
    actual_margin: toOptionalNumber(prediction.actual_margin),
    tip_correct: typeof prediction.tip_correct === "boolean" ? prediction.tip_correct : null,
    margin_error: toOptionalNumber(prediction.margin_error),
    home_win_probability: homeWinProbability,
    away_win_probability: awayWinProbability,
    predicted_margin: toNumberOrFallback(prediction.predicted_margin, 0),
    home_elo: homeElo,
    away_elo: awayElo,
    elo_diff: toNumberOrFallback(prediction.elo_diff, homeElo - awayElo),
  };
}

export function normalizeTipsPredictions(input: unknown): UpcomingPrediction[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  return input.map((prediction) => normalizeLegacyPrediction(prediction as Record<string, unknown>));
}

export async function loadTipsPredictions(): Promise<UpcomingPrediction[]> {
  const allPredictions = await loadOptionalJson("predictions.json");
  const normalizedPredictions = normalizeTipsPredictions(allPredictions);
  if (normalizedPredictions) {
    return normalizedPredictions;
  }

  return loadUpcomingPredictions();
}

export function loadLadderPreseason(): Promise<LadderEntry[]> {
  return loadJsonWithFallback<LadderEntry[]>("ladder-preseason.json");
}

export function loadLadderCurrent(): Promise<LadderEntry[]> {
  return loadJsonWithFallback<LadderEntry[]>("ladder-current.json");
}

export function loadAccuracy(): Promise<AccuracyData> {
  return loadJsonWithFallback<AccuracyData>("accuracy.json");
}

export async function loadSiteSnapshot(): Promise<SiteSnapshot> {
  const snapshot = await loadOptionalJson("site-snapshot.json");
  if (snapshot !== null) {
    return parseSiteSnapshot(snapshot);
  }

  const [upcomingPredictions, ladderPreseason, ladderCurrent, accuracy] = await Promise.all([
    loadTipsPredictions(),
    loadLadderPreseason(),
    loadLadderCurrent(),
    loadAccuracy(),
  ]);

  return createSiteSnapshot({
    season: accuracy.season,
    upcomingPredictions,
    accuracy,
    ladderCurrent,
    ladderPreseason,
  });
}
