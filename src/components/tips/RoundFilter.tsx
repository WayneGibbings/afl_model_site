import type { RoundOption } from "@/lib/types";

interface RoundFilterProps {
  options: RoundOption[];
  selectedRound: string;
  onChange: (value: string) => void;
}

export function RoundFilter({ options, selectedRound, onChange }: RoundFilterProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="round-filter" className="text-sm font-medium text-slate-700">
        Round
      </label>
      <select
        id="round-filter"
        value={selectedRound}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
