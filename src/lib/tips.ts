import type { AccuracyData, SeasonSummary } from "@/lib/types";

export function getSeasonSummary(accuracy: AccuracyData): SeasonSummary {
  return {
    tipsCorrect: accuracy.tips_correct,
    totalTips: accuracy.total_tips,
    accuracyPct: accuracy.accuracy_pct,
    mae: accuracy.mae,
    bits: accuracy.bits,
  };
}
