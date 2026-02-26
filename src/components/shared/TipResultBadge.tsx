interface TipResultBadgeProps {
  correct: boolean | null;
}

export function TipResultBadge({ correct }: TipResultBadgeProps) {
  if (correct === null) {
    return null;
  }

  if (correct) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-xs">
        ✓
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 font-bold text-xs">
      ✗
    </span>
  );
}
