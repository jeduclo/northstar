import { notFound } from "next/navigation";
import { ControlBar } from "@/components/Controls";
import KpiStrip from "@/components/KpiStrip";
import SeriesChart from "@/components/SeriesChart";
import { getTab, manifest, recessions } from "@/lib/data";
import { TAB_SPECS, getSpec } from "@/lib/tabs";
import type { Series } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return TAB_SPECS.map((t) => ({ tab: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[tab]">) {
  const { tab } = await params;
  return { title: `${getSpec(tab)?.label ?? "NorthStar"} | NorthStar` };
}

export default async function TabPage({ params }: PageProps<"/[tab]">) {
  const { tab } = await params;
  const spec = getSpec(tab);
  const data = getTab(tab);
  if (!spec || !data) notFound();

  const byName = new Map(data.series.map((s) => [s.name, s]));
  const pick = (names: string[]) => names.map((n) => byName.get(n)).filter((s): s is Series => !!s);

  return (
    <article>
      <h1 className="max-w-3xl font-serif text-3xl leading-tight font-semibold sm:text-4xl">{spec.question}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{spec.answer((n) => byName.get(n))}</p>

      <div className="mt-6"><ControlBar /></div>

      <div className="mt-6"><KpiStrip series={pick(spec.kpis)} generatedAt={manifest.generated_at} /></div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {spec.charts
          .map((c) => ({ c, series: pick(c.series) }))
          .filter(({ series }) => series.length > 0)   // optional series may be absent after a refresh
          .map(({ c, series }) => (
            <SeriesChart key={c.title} spec={c} series={series} recessions={recessions} />
          ))}
      </div>
    </article>
  );
}
