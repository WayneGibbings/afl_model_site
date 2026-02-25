interface TipResultBadgeProps {
  correct: boolean | null;
}

export function TipResultBadge({ correct }: TipResultBadgeProps) {
  if (correct === null) {
    return null;
  }

  if (correct) {
    return <span className="font-bold text-green-600">✓</span>;
  }

  return <span className="font-bold text-red-600">✗</span>;
}
