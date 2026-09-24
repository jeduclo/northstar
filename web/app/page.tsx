import manifest from "@/public/data/manifest.json";

type TabInfo = { series: number; latest: string };

const TAB_LABELS: Record<string, string> = {
  output: "National Output & Growth",
  labour: "Labour Markets & Employment",
  prices: "Prices, Inflation & Costs",
  money: "Money, Credit & Central Banks",
  sentiment: "Sentiment & Leading Indicators",
  trade: "Trade, FX & External Sector",
};

export default function Home() {
  const tabs = manifest.tabs as Record<string, TabInfo>;
  const refreshed = new Date(manifest.generated_at).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">NorthStar Macro &amp; Sector Intelligence</h1>
      <p className="mt-2 text-sm opacity-70">Pipeline status · data refreshed {refreshed} ET</p>

      <div className="mt-8 overflow-x-auto rounded-lg border border-current/15">
        <table className="w-full text-left text-sm">
          <thead className="bg-current/5">
            <tr>
              <th className="px-4 py-2">Tab</th>
              <th className="px-4 py-2 text-right">Series</th>
              <th className="px-4 py-2 text-right">Latest data</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(tabs).map(([key, t]) => (
              <tr key={key} className="border-t border-current/10">
                <td className="px-4 py-2">{TAB_LABELS[key] ?? key}</td>
                <td className="px-4 py-2 text-right tabular-nums">{t.series}</td>
                <td className="px-4 py-2 text-right tabular-nums">{t.latest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manifest.sources && "datasets" in manifest.sources && (
        <p className="mt-4 text-sm opacity-70">
          Sources: {manifest.sources.ok}/{manifest.sources.datasets} datasets healthy
        </p>
      )}
    </main>
  );
}
