import type { TeamKey } from "@/config/teams";

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

export interface SeasonSummary {
  tipsCorrect: number;
  totalTips: number;
  accuracyPct: number;
  mae: number;
  bits: number;
}

export type SortKey = "date" | "margin" | "winPct";
