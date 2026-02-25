import type { TeamKey } from "@/config/teams";

export interface Prediction {
  season: number;
  round: number;
  round_label: string;
  date: string;
  venue: string;
  home_team: TeamKey;
  away_team: TeamKey;
  predicted_winner: TeamKey;
  predicted_margin: number;
  win_probability: number;
  actual_winner: TeamKey | null;
  actual_margin: number | null;
  tip_correct: boolean | null;
  margin_error: number | null;
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

export interface AccuracyByRound {
  round: number;
  round_label: string;
  tips: number;
  correct: number;
  accuracy_pct: number;
  mae: number;
}

export interface AccuracyData {
  season: number;
  as_at_round: number;
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

export interface RoundOption {
  value: string;
  label: string;
  hasResults: boolean;
  isCurrent: boolean;
}

export type SortKey = "round" | "date" | "margin" | "winPct" | "actual" | "mae";
