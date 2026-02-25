export function getWinProbabilityBackground(probability: number): string {
  if (probability <= 0.55) {
    return "rgba(234, 88, 12, 0.000)";
  }

  const clamped = Math.min(1, Math.max(0.55, probability));
  const normalized = (clamped - 0.55) / 0.45;
  const alpha = normalized * 0.55;

  return `rgba(234, 88, 12, ${alpha.toFixed(3)})`;
}
