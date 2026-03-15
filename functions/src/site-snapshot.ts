import { createHash } from "node:crypto";
import { z } from "zod";
import { mapTeamKey, teamKeys, type TeamKey } from "./databricks-utils";

export interface UpcomingPrediction {
  round: string;
  date: string;
  kickoff_time_utc?: string | null;
  kickoff_time_local?: string | null;
  kickoff_tz_offset?: string | null;
  kickoff_time_utc_iso?: string | null;
  home_team: TeamKey;
  away_team: TeamKey;
  venue: string;
  predicted_winner: TeamKey;
  actual_winner?: TeamKey | null;
  actual_margin?: number | null;
  tip_correct?: boolean | null;
  margin_error?: number | null;
  home_win_probability: number;
  away_win_probability: number;
  predicted_margin: number;
  home_elo: number;
  away_elo: number;
  elo_diff: number;
}

export interface LadderEntry {
  team: TeamKey;
  position: number;
  wins: number;
  losses: number;
  draws: number;
  percentage: number;
  predicted_final_wins?: number;
  predicted_final_position?: number;
}

export interface AccuracyGame {
  date: string;
  kickoff_time_utc?: string | null;
  home_team: TeamKey;
  away_team: TeamKey;
  predicted_winner: TeamKey;
  actual_winner: TeamKey;
  correct: boolean;
}

export interface AccuracyByRound {
  round: number;
  round_label: string;
  tips: number;
  correct: number;
  accuracy_pct: number;
  mae: number;
  games: AccuracyGame[];
}

export interface AccuracyData {
  season: number;
  as_at_round: string;
  total_tips: number;
  tips_correct: number;
  accuracy_pct: number;
  mae: number;
  bits: number;
  by_round: AccuracyByRound[];
}

const teamKeySchema = z.enum(teamKeys);
const nullableBooleanishSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  if (value === 1 || value === "1") {
    return true;
  }
  if (value === 0 || value === "0") {
    return false;
  }

  return value;
}, z.boolean().nullable().optional());

const accuracyGameSchema = z.object({
  date: z.string().min(1),
  kickoff_time_utc: z.string().nullable().optional(),
  home_team: teamKeySchema,
  away_team: teamKeySchema,
  predicted_winner: teamKeySchema,
  actual_winner: teamKeySchema,
  correct: z.boolean(),
});

const accuracyRoundSchema = z.object({
  round: z.coerce.number().int().nonnegative(),
  round_label: z.string().min(1),
  tips: z.coerce.number().int().nonnegative(),
  correct: z.coerce.number().int().nonnegative(),
  accuracy_pct: z.coerce.number(),
  mae: z.coerce.number(),
  games: z.array(accuracyGameSchema).optional().default([]),
});

const accuracySchema = z.object({
  season: z.coerce.number().int(),
  as_at_round: z.coerce.string().min(1),
  total_tips: z.coerce.number().int().nonnegative(),
  tips_correct: z.coerce.number().int().nonnegative(),
  accuracy_pct: z.coerce.number(),
  mae: z.coerce.number(),
  bits: z.coerce.number(),
  by_round: z.array(accuracyRoundSchema),
});

const upcomingPredictionSchema = z.object({
  round: z.string().min(1),
  date: z.string().min(1),
  kickoff_time_utc: z.string().nullable().optional(),
  kickoff_time_local: z.string().nullable().optional(),
  kickoff_tz_offset: z.string().nullable().optional(),
  kickoff_time_utc_iso: z.string().nullable().optional(),
  home_team: teamKeySchema,
  away_team: teamKeySchema,
  venue: z.string().min(1),
  predicted_winner: teamKeySchema,
  actual_winner: teamKeySchema.nullable().optional(),
  actual_margin: z.coerce.number().nullable().optional(),
  tip_correct: nullableBooleanishSchema,
  margin_error: z.coerce.number().nullable().optional(),
  home_win_probability: z.coerce.number().min(0).max(1),
  away_win_probability: z.coerce.number().min(0).max(1),
  predicted_margin: z.coerce.number(),
  home_elo: z.coerce.number(),
  away_elo: z.coerce.number(),
  elo_diff: z.coerce.number(),
});

const ladderEntrySchema = z.object({
  team: teamKeySchema,
  position: z.coerce.number().int().positive(),
  wins: z.coerce.number(),
  losses: z.coerce.number(),
  draws: z.coerce.number(),
  percentage: z.coerce.number(),
  predicted_final_wins: z.coerce.number().optional(),
  predicted_final_position: z.coerce.number().int().positive().optional(),
});

const siteSnapshotPayloadSchema = z.object({
  season: z.coerce.number().int(),
  upcomingPredictions: z.array(upcomingPredictionSchema),
  accuracy: accuracySchema,
  ladderCurrent: z.array(ladderEntrySchema),
  ladderPreseason: z.array(ladderEntrySchema),
});

const siteSnapshotSchema = siteSnapshotPayloadSchema.extend({
  snapshotVersion: z.string().min(1),
  generatedAt: z.string().min(1),
});

export interface SiteSnapshotPayload {
  season: number;
  upcomingPredictions: UpcomingPrediction[];
  accuracy: AccuracyData;
  ladderCurrent: LadderEntry[];
  ladderPreseason: LadderEntry[];
}

export interface SiteSnapshot extends SiteSnapshotPayload {
  snapshotVersion: string;
  generatedAt: string;
}

export interface RawSiteSnapshotInput {
  season: number;
  rawUpcoming: Array<Record<string, unknown>>;
  rawLadderPreseason: Array<Record<string, unknown>>;
  rawLadderCurrent: Array<Record<string, unknown>>;
  accuracyRows: Array<Record<string, unknown>>;
}

export const siteSnapshotQueries = {
  currentSeason: `SELECT MAX(season) AS season FROM dev_afl.afl_tipping.gold_predictions LIMIT 1`,
  upcomingPredictions: (season: number) => `
    WITH season_predictions AS (
      SELECT
        p.round,
        p.date,
        p.kickoff_time_utc,
        p.kickoff_time_local,
        p.kickoff_tz_offset,
        p.home_team,
        p.away_team,
        p.venue,
        p.predicted_winner,
        m.winner                                        AS actual_winner,
        m.margin                                        AS actual_margin,
        CASE
          WHEN m.winner IS NULL THEN NULL
          ELSE CAST(p.predicted_winner = m.winner AS BOOLEAN)
        END                                             AS tip_correct,
        CASE
          WHEN m.margin IS NULL THEN NULL
          ELSE ROUND(ABS(p.predicted_margin - m.margin), 1)
        END                                             AS margin_error,
        ROUND(p.home_win_probability, 3)                AS home_win_probability,
        ROUND(1.0 - p.home_win_probability, 3)          AS away_win_probability,
        ROUND(p.predicted_margin, 1)                    AS predicted_margin,
        p.home_elo,
        p.away_elo,
        p.elo_diff,
        CASE
          WHEN p.round = 'Opening Round' THEN 0
          WHEN p.round LIKE 'Round %'    THEN CAST(SUBSTR(p.round, 7) AS INT)
          ELSE 999
        END                                             AS round_order
      FROM dev_afl.afl_tipping.gold_predictions p
      LEFT JOIN dev_afl.afl_tipping.silver_matches m
        ON  m.season = p.season
        AND m.date = p.date
        AND m.home_team = p.home_team
        AND m.away_team = p.away_team
      WHERE p.season = ${season}
    )
    SELECT
      u.round,
      u.date,
      u.kickoff_time_utc,
      u.kickoff_time_local,
      u.kickoff_tz_offset,
      CONCAT(DATE_FORMAT(u.kickoff_time_utc, "yyyy-MM-dd'T'HH:mm:ss"), 'Z') AS kickoff_time_utc_iso,
      u.home_team,
      u.away_team,
      u.venue,
      u.predicted_winner,
      u.actual_winner,
      u.actual_margin,
      u.tip_correct,
      u.margin_error,
      u.home_win_probability,
      u.away_win_probability,
      u.predicted_margin,
      u.home_elo,
      u.away_elo,
      u.elo_diff
    FROM season_predictions u
    ORDER BY
      u.round_order,
      u.date,
      u.kickoff_time_utc NULLS LAST,
      u.home_team
  `,
  ladderPreseason: (season: number) => `
    WITH all_games AS (
      SELECT
        home_team AS team,
        CASE WHEN predicted_margin > 0 THEN 1 ELSE 0 END AS won,
        CASE WHEN predicted_margin < 0 THEN 1 ELSE 0 END AS lost,
        CASE WHEN predicted_margin = 0 THEN 1 ELSE 0 END AS drew,
        predicted_margin AS team_margin
      FROM dev_afl.afl_tipping.predictions_preseason_snapshot
      WHERE season = ${season}
      UNION ALL
      SELECT
        away_team AS team,
        CASE WHEN predicted_margin < 0 THEN 1 ELSE 0 END AS won,
        CASE WHEN predicted_margin > 0 THEN 1 ELSE 0 END AS lost,
        CASE WHEN predicted_margin = 0 THEN 1 ELSE 0 END AS drew,
        -predicted_margin AS team_margin
      FROM dev_afl.afl_tipping.predictions_preseason_snapshot
      WHERE season = ${season}
    ),
    team_stats AS (
      SELECT
        team,
        CAST(SUM(won) AS INT) AS wins,
        CAST(SUM(lost) AS INT) AS losses,
        CAST(SUM(drew) AS INT) AS draws,
        CAST(SUM(won) * 4 + SUM(drew) * 2 AS INT) AS points,
        ROUND(
          (85.0 * COUNT(*) + SUM(team_margin) / 2.0) * 100.0
            / NULLIF(85.0 * COUNT(*) - SUM(team_margin) / 2.0, 0),
          1
        ) AS percentage
      FROM all_games
      GROUP BY team
    )
    SELECT
      CAST(RANK() OVER (ORDER BY points DESC, percentage DESC) AS INT) AS position,
      team,
      points,
      wins,
      losses,
      draws,
      percentage
    FROM team_stats
    ORDER BY position
  `,
  ladderCurrent: (season: number) => `
    WITH actual_results AS (
      SELECT
        home_team AS team,
        CASE WHEN margin > 0 THEN 1 ELSE 0 END AS won,
        CASE WHEN margin < 0 THEN 1 ELSE 0 END AS lost,
        CASE WHEN margin = 0 THEN 1 ELSE 0 END AS drew,
        CAST(home_score AS DOUBLE) AS pts_for,
        CAST(away_score AS DOUBLE) AS pts_against
      FROM dev_afl.afl_tipping.silver_matches
      WHERE season = ${season}
      UNION ALL
      SELECT
        away_team AS team,
        CASE WHEN margin < 0 THEN 1 ELSE 0 END AS won,
        CASE WHEN margin > 0 THEN 1 ELSE 0 END AS lost,
        CASE WHEN margin = 0 THEN 1 ELSE 0 END AS drew,
        CAST(away_score AS DOUBLE) AS pts_for,
        CAST(home_score AS DOUBLE) AS pts_against
      FROM dev_afl.afl_tipping.silver_matches
      WHERE season = ${season}
    ),
    actual_totals AS (
      SELECT
        team,
        CAST(SUM(won) AS INT) AS wins,
        CAST(SUM(lost) AS INT) AS losses,
        CAST(SUM(drew) AS INT) AS draws,
        CAST(SUM(won) * 4 + SUM(drew) * 2 AS INT) AS points,
        ROUND(SUM(pts_for) * 100.0 / NULLIF(SUM(pts_against), 0), 1) AS percentage,
        SUM(pts_for) AS total_pts_for,
        SUM(pts_against) AS total_pts_against
      FROM actual_results
      GROUP BY team
    ),
    predicted_future AS (
      SELECT
        p.home_team AS team,
        CASE WHEN p.predicted_margin > 0 THEN 1 ELSE 0 END AS predicted_win,
        CASE WHEN p.predicted_margin = 0 THEN 1 ELSE 0 END AS predicted_draw,
        p.predicted_margin AS team_margin
      FROM dev_afl.afl_tipping.gold_predictions p
      WHERE p.season = ${season}
        AND NOT EXISTS (
          SELECT 1
          FROM dev_afl.afl_tipping.silver_matches m
          WHERE m.season = p.season
            AND m.date = p.date
            AND m.home_team = p.home_team
            AND m.away_team = p.away_team
        )
      UNION ALL
      SELECT
        p.away_team AS team,
        CASE WHEN p.predicted_margin < 0 THEN 1 ELSE 0 END AS predicted_win,
        CASE WHEN p.predicted_margin = 0 THEN 1 ELSE 0 END AS predicted_draw,
        -p.predicted_margin AS team_margin
      FROM dev_afl.afl_tipping.gold_predictions p
      WHERE p.season = ${season}
        AND NOT EXISTS (
          SELECT 1
          FROM dev_afl.afl_tipping.silver_matches m
          WHERE m.season = p.season
            AND m.date = p.date
            AND m.home_team = p.home_team
            AND m.away_team = p.away_team
        )
    ),
    predicted_future_totals AS (
      SELECT
        team,
        CAST(SUM(predicted_win) AS INT) AS predicted_future_wins,
        CAST(SUM(predicted_draw) AS INT) AS predicted_future_draws,
        CAST(SUM(predicted_win) * 4 + SUM(predicted_draw) * 2 AS INT) AS predicted_future_points,
        SUM(85.0 + team_margin / 2.0) AS projected_pts_for,
        SUM(85.0 - team_margin / 2.0) AS projected_pts_against
      FROM predicted_future
      GROUP BY team
    ),
    all_teams AS (
      SELECT DISTINCT home_team AS team
      FROM dev_afl.afl_tipping.gold_predictions
      WHERE season = ${season}
      UNION
      SELECT DISTINCT away_team
      FROM dev_afl.afl_tipping.gold_predictions
      WHERE season = ${season}
    ),
    combined AS (
      SELECT
        t.team,
        COALESCE(a.wins, 0) AS wins,
        COALESCE(a.losses, 0) AS losses,
        COALESCE(a.draws, 0) AS draws,
        COALESCE(a.points, 0) AS points,
        a.percentage,
        COALESCE(a.wins, 0) + COALESCE(pf.predicted_future_wins, 0) AS predicted_final_wins,
        COALESCE(a.points, 0) + COALESCE(pf.predicted_future_points, 0) AS predicted_final_points,
        ROUND(
          (COALESCE(a.total_pts_for, 0) + COALESCE(pf.projected_pts_for, 0)) * 100.0
            / NULLIF(COALESCE(a.total_pts_against, 0) + COALESCE(pf.projected_pts_against, 0), 0),
          1
        ) AS projected_pct
      FROM all_teams t
      LEFT JOIN actual_totals a ON a.team = t.team
      LEFT JOIN predicted_future_totals pf ON pf.team = t.team
    )
    SELECT
      CAST(RANK() OVER (ORDER BY points DESC, COALESCE(percentage, 0) DESC) AS INT) AS position,
      team,
      points,
      wins,
      losses,
      draws,
      percentage,
      predicted_final_wins,
      predicted_final_points,
      CAST(RANK() OVER (ORDER BY predicted_final_points DESC, projected_pct DESC) AS INT) AS predicted_final_position
    FROM combined
    ORDER BY position
  `,
  accuracy: (season: number) => `
    WITH completed AS (
      SELECT
        p.round                                                         AS round_label,
        CASE
          WHEN p.round = 'Opening Round'     THEN 0
          WHEN p.round LIKE 'Round %'        THEN CAST(SUBSTR(p.round, 7) AS INT)
          ELSE 99
        END                                                             AS round_order,
        CAST(p.predicted_winner = m.winner AS INT)                      AS correct,
        ABS(p.predicted_margin - m.margin)                              AS margin_error,
        CASE
          WHEN m.winner = m.home_team
            THEN p.home_win_probability - 0.5
          WHEN m.winner = m.away_team
            THEN (1.0 - p.home_win_probability) - 0.5
          ELSE 0.0
        END                                                             AS bits_contribution,
        CAST(p.date AS STRING)                                          AS game_date,
        p.kickoff_time_utc,
        p.home_team,
        p.away_team,
        p.predicted_winner,
        m.winner                                                        AS actual_winner
      FROM dev_afl.afl_tipping.gold_predictions p
      JOIN dev_afl.afl_tipping.silver_matches m
        ON  p.season = m.season
        AND p.date = m.date
        AND p.home_team = m.home_team
        AND p.away_team = m.away_team
      WHERE p.season = ${season}
    ),
    by_round AS (
      SELECT
        round_order,
        round_label,
        COUNT(*)                                              AS tips,
        CAST(SUM(correct) AS INT)                            AS correct,
        ROUND(SUM(correct) * 100.0 / COUNT(*), 1)            AS accuracy_pct,
        ROUND(AVG(margin_error), 1)                          AS mae,
        COLLECT_LIST(
          STRUCT(
            game_date AS date,
            kickoff_time_utc,
            home_team,
            away_team,
            predicted_winner,
            actual_winner,
            CAST(correct AS BOOLEAN) AS correct
          )
        )                                                     AS games
      FROM completed
      GROUP BY round_order, round_label
    ),
    overall AS (
      SELECT
        COUNT(*)                                              AS total_tips,
        CAST(SUM(correct) AS INT)                            AS tips_correct,
        ROUND(SUM(correct) * 100.0 / NULLIF(COUNT(*), 0), 1) AS accuracy_pct,
        ROUND(AVG(margin_error), 1)                          AS mae,
        ROUND(AVG(bits_contribution), 3)                     AS bits
      FROM completed
    )
    SELECT
      ${season}                                                           AS season,
      (SELECT round_label FROM by_round ORDER BY round_order DESC LIMIT 1)
                                                                          AS as_at_round,
      o.total_tips,
      o.tips_correct,
      o.accuracy_pct,
      o.mae,
      o.bits,
      TO_JSON(
        COLLECT_LIST(
          STRUCT(
            r.round_order AS round,
            r.round_label,
            r.tips,
            r.correct,
            r.accuracy_pct,
            r.mae,
            r.games
          )
        )
      )                                                                   AS by_round_json
    FROM overall o
    CROSS JOIN (SELECT * FROM by_round ORDER BY round_order) r
    GROUP BY o.total_tips, o.tips_correct, o.accuracy_pct, o.mae, o.bits
    LIMIT 1
  `,
};

export function defaultAccuracyForSeason(season: number): AccuracyData {
  return accuracySchema.parse({
    season,
    as_at_round: "Pre-season",
    total_tips: 0,
    tips_correct: 0,
    accuracy_pct: 0,
    mae: 0,
    bits: 0,
    by_round: [],
  });
}

export function parseAccuracyRow(row: Record<string, unknown>): AccuracyData {
  let byRound: unknown = [];
  if (typeof row.by_round_json === "string") {
    byRound = JSON.parse(row.by_round_json);
  } else if (Array.isArray(row.by_round_json)) {
    byRound = row.by_round_json;
  }

  if (Array.isArray(byRound)) {
    byRound = byRound.map((roundObj: unknown) => {
      if (typeof roundObj !== "object" || roundObj === null) {
        return roundObj;
      }
      const roundRecord = roundObj as Record<string, unknown>;
      if (!Array.isArray(roundRecord.games)) {
        return roundRecord;
      }

      return {
        ...roundRecord,
        games: roundRecord.games.map((game: unknown) => {
          if (typeof game !== "object" || game === null) {
            return game;
          }
          const gameRecord = game as Record<string, unknown>;
          return {
            ...gameRecord,
            home_team: mapTeamKey(gameRecord.home_team, "home_team"),
            away_team: mapTeamKey(gameRecord.away_team, "away_team"),
            predicted_winner: mapTeamKey(gameRecord.predicted_winner, "predicted_winner"),
            actual_winner: mapTeamKey(gameRecord.actual_winner, "actual_winner"),
          };
        }),
      };
    });
  }

  return accuracySchema.parse({
    season: row.season,
    as_at_round: row.as_at_round,
    total_tips: row.total_tips,
    tips_correct: row.tips_correct,
    accuracy_pct: row.accuracy_pct,
    mae: row.mae,
    bits: row.bits,
    by_round: byRound,
  });
}

export function buildSiteSnapshotPayload(input: RawSiteSnapshotInput): SiteSnapshotPayload {
  const normalizedUpcoming = input.rawUpcoming.map((row) => ({
    ...row,
    home_team: mapTeamKey(row.home_team, "home_team"),
    away_team: mapTeamKey(row.away_team, "away_team"),
    predicted_winner: mapTeamKey(row.predicted_winner, "predicted_winner"),
    actual_winner: mapTeamKey(row.actual_winner, "actual_winner", true),
  }));

  const normalizedLadderPreseason = input.rawLadderPreseason.map((row) => ({
    ...row,
    team: mapTeamKey(row.team, "team"),
  }));

  const normalizedLadderCurrent = input.rawLadderCurrent.map((row) => ({
    ...row,
    team: mapTeamKey(row.team, "team"),
  }));

  const payload = siteSnapshotPayloadSchema.parse({
    season: input.season,
    upcomingPredictions: normalizedUpcoming,
    accuracy: input.accuracyRows.length > 0 ? parseAccuracyRow(input.accuracyRows[0]) : defaultAccuracyForSeason(input.season),
    ladderCurrent: normalizedLadderCurrent,
    ladderPreseason: normalizedLadderPreseason.map((row) => ({
      ...row,
      predicted_final_wins: undefined,
      predicted_final_position: undefined,
    })),
  });

  return payload;
}

export function hashSiteSnapshotPayload(payload: SiteSnapshotPayload): string {
  const normalized = siteSnapshotPayloadSchema.parse(payload);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function createSiteSnapshot(payload: SiteSnapshotPayload, generatedAt = new Date().toISOString()): SiteSnapshot {
  const normalized = siteSnapshotPayloadSchema.parse(payload);

  return {
    ...normalized,
    snapshotVersion: hashSiteSnapshotPayload(normalized),
    generatedAt,
  };
}

export function parseSiteSnapshot(input: unknown): SiteSnapshot {
  return siteSnapshotSchema.parse(input);
}

export function siteSnapshotBytes(snapshot: SiteSnapshot): number {
  return Buffer.byteLength(JSON.stringify(snapshot), "utf8");
}
