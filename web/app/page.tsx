import Link from "next/link";
import { getTab, manifest } from "@/lib/data";
import { TAB_SPECS } from "@/lib/tabs";
import { rotation, rotationAnswer } from "@/lib/rotation";
import { outlookAnswer } from "@/lib/outlook";

export default function Overview() {
  return (
    <article>
      <h1 className="max-w-3xl font-serif text-3xl leading-tight font-semibold sm:text-4xl">
        Where are Canada and the U.S. in the business cycle?
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Each section answers one question with live data from the Bank of Canada, Statistics Canada and the St. Louis Fed.
      </p>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {TAB_SPECS.map((spec) => {
          const data = getTab(spec.slug);
          const answer = data ? spec.answer((n) => data.series.find((s) => s.name === n)) : "";
          const info = manifest.tabs[spec.slug];
          return (
            <li key={spec.slug}>
              <Link href={`/${spec.slug}`} className="group grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
                <span className="font-medium group-hover:text-ca">{spec.label}</span>
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
            <span className="font-medium group-hover:text-ca">Sector rotation</span>
            <span>
              <span className="block font-serif text-lg">How is capital rotating across sectors in Canada and the U.S.?</span>
              <span className="mt-1 block text-sm text-muted">{rotationAnswer(rotation)}</span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outlook" className="group grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <span className="font-medium group-hover:text-ca">Outlook &amp; scenarios</span>
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
