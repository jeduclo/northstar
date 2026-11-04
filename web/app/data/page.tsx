import Link from "next/link";
import { getTab, manifest } from "@/lib/data";
import { TAB_SPECS } from "@/lib/tabs";
import { rotationAnswer } from "@/lib/rotation";
import { rotation } from "@/lib/data";
import { outlookAnswer } from "@/lib/outlook";

export const metadata = { title: "Indicators | MacroIntelligence" };

export default function Indicators() {
  return (
    <article>
      <h1 className="max-w-3xl font-serif text-3xl leading-tight font-semibold sm:text-4xl">
        Indicator library
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        The full set of {Object.values(manifest.tabs).reduce((a, t) => a + t.series, 0)} series behind the answers, grouped by theme,
        with country and date-range controls.
      </p>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {TAB_SPECS.map((spec) => {
          const data = getTab(spec.slug);
          const answer = data ? spec.answer((n) => data.series.find((s) => s.name === n)) : "";
          const info = manifest.tabs[spec.slug];
          return (
            <li key={spec.slug}>
              <Link href={`/data/${spec.slug}`} className="group grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <span className="font-medium group-hover:text-accent">{spec.label}</span>
                <span>
                  <span className="block font-serif text-lg">{spec.question}</span>
                  <span className="mt-1 block text-sm text-muted">{answer}</span>
                  {info && <span className="mt-1 block text-xs text-muted">{info.series} series, latest data {info.latest}</span>}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/rotation" className="group grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <span className="font-medium group-hover:text-accent">Sector rotation</span>
            <span>
              <span className="block font-serif text-lg">How is capital rotating across sectors in Canada and the U.S.?</span>
              <span className="mt-1 block text-sm text-muted">{rotationAnswer(rotation)}</span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outlook" className="group grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <span className="font-medium group-hover:text-accent">Forecast &amp; scenarios</span>
            <span>
              <span className="block font-serif text-lg">What comes next, and how would a rate shock ripple through sectors?</span>
              <span className="mt-1 block text-sm text-muted">{outlookAnswer()}</span>
            </span>
          </Link>
        </li>
      </ul>
    </article>
  );
}
