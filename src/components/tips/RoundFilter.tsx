import type { RoundOption } from "@/lib/types";

interface RoundFilterProps {
  options: RoundOption[];
  selectedRound: string;
  onChange: (value: string) => void;
}

export function RoundFilter({ options, selectedRound, onChange }: RoundFilterProps) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="round-filter" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Round
      </label>
      <div className="relative">
        <select
          id="round-filter"
          value={selectedRound}
          onChange={(event) => onChange(event.target.value)}
          className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-slate-800 shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
