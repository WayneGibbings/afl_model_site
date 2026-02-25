import type { AccuracyData, Prediction, RoundOption, SeasonSummary } from "@/lib/types";

function getRoundLabelsByDate(predictions: Prediction[]): string[] {
  const roundFirstDate = new Map<string, number>();
  for (const prediction of predictions) {
    const current = roundFirstDate.get(prediction.round_label);
    const value = new Date(prediction.date).getTime();
    if (current === undefined || value < current) {
      roundFirstDate.set(prediction.round_label, value);
    }
  }

  return [...roundFirstDate.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([label]) => label);
}

export function getRoundOptions(predictions: Prediction[]): RoundOption[] {
  const rounds = getRoundLabelsByDate(predictions);

  return [
    { value: "all", label: "All", hasResults: false, isCurrent: false },
    ...rounds.map((roundLabel) => {
      const rows = predictions.filter((prediction) => prediction.round_label === roundLabel);
      const hasResults = rows.some((row) => row.tip_correct !== null);
      const isCurrent = rows.some((row) => row.tip_correct === null);
      return { value: roundLabel, label: roundLabel, hasResults, isCurrent };
    }),
  ];
}

export function getDefaultRound(predictions: Prediction[]): string {
  const latestCompleted = predictions
    .filter((prediction) => prediction.tip_correct !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .at(-1)?.round_label;

  if (latestCompleted) {
    return latestCompleted;
  }

  const nextUpcoming = predictions
    .filter((prediction) => prediction.tip_correct === null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .at(0)?.round_label;

  if (nextUpcoming) {
    return nextUpcoming;
  }

  return getRoundLabelsByDate(predictions)[0] ?? "all";
}

export function getFilteredPredictions(predictions: Prediction[], round: string): Prediction[] {
  if (round === "all") {
    return predictions;
  }

  return predictions.filter((prediction) => prediction.round_label === round);
}

export function getSeasonSummary(accuracy: AccuracyData): SeasonSummary {
  return {
    tipsCorrect: accuracy.tips_correct,
    totalTips: accuracy.total_tips,
    accuracyPct: accuracy.accuracy_pct,
    mae: accuracy.mae,
    bits: accuracy.bits,
  };
}
