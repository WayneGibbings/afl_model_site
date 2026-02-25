import { loadAccuracy } from "@/lib/data";

export default async function AccuracyPage() {
  const data = await loadAccuracy();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Accuracy</h1>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tips Correct" value={`${data.tips_correct} / ${data.total_tips}`} />
        <StatCard label="Accuracy" value={`${data.accuracy_pct.toFixed(1)}%`} />
        <StatCard label="MAE" value={data.mae.toFixed(1)} />
        <StatCard label="Bits" value={data.bits.toFixed(1)} />
      </section>
      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Round</th>
              <th className="px-4 py-3 text-right font-semibold">Tips</th>
              <th className="px-4 py-3 text-right font-semibold">Correct</th>
              <th className="px-4 py-3 text-right font-semibold">Accuracy</th>
              <th className="px-4 py-3 text-right font-semibold">MAE</th>
            </tr>
          </thead>
          <tbody>
            {data.by_round.map((round) => (
              <tr key={round.round_label} className="border-t border-slate-200">
                <td className="px-4 py-3">{round.round_label}</td>
                <td className="px-4 py-3 text-right">{round.tips}</td>
                <td className="px-4 py-3 text-right">{round.correct}</td>
                <td className="px-4 py-3 text-right">{round.accuracy_pct.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{round.mae.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
