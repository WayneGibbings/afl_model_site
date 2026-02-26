import { loadAccuracy } from "@/lib/data";

export default async function AccuracyPage() {
  const data = await loadAccuracy();

  return (
    <div className="space-y-6">
      <header className="page-header">
        <h1 className="page-title">Accuracy</h1>
        <p className="text-slate-500 mt-1 text-sm">Season-to-date model performance metrics</p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tips Correct" value={`${data.tips_correct} / ${data.total_tips}`} accent="blue" icon="🎯" />
        <StatCard label="Accuracy" value={`${data.accuracy_pct.toFixed(1)}%`} accent="green" icon="✓" />
        <StatCard label="MAE" value={data.mae.toFixed(1)} accent="amber" icon="±" />
        <StatCard label="Bits" value={data.bits.toFixed(1)} accent="purple" icon="◈" />
      </section>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left">Round</th>
              <th className="px-4 py-3 text-right">Tips</th>
              <th className="px-4 py-3 text-right">Correct</th>
              <th className="px-4 py-3 text-right">Accuracy</th>
              <th className="px-4 py-3 text-right">MAE</th>
            </tr>
          </thead>
          <tbody>
            {data.by_round.map((round) => (
              <tr key={round.round_label}>
                <td className="px-4 py-3 font-medium">{round.round_label}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">{round.tips}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{round.correct}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                  {round.accuracy_pct.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-600">{round.mae.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const accentMap = {
  blue: { bar: "#1d4ed8", badge: "#eff6ff" },
  green: { bar: "#16a34a", badge: "#f0fdf4" },
  amber: { bar: "#d97706", badge: "#fffbeb" },
  purple: { bar: "#7c3aed", badge: "#f5f3ff" },
};

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: keyof typeof accentMap;
  icon: string;
}) {
  const colors = accentMap[accent];
  return (
    <div className="card relative overflow-hidden px-3 py-3 sm:px-5 sm:py-4" style={{ borderTop: `3px solid ${colors.bar}` }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
          <p className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
        </div>
        <span
          className="text-lg w-9 h-9 rounded-lg flex items-center justify-center font-bold"
          style={{ background: colors.badge, color: colors.bar }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
