"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LENSES = [
  { href: "/", label: "Overview" },
  { href: "/household", label: "Household" },
  { href: "/investor", label: "Investor" },
  { href: "/policy", label: "Policy" },
  { href: "/student", label: "Student" },
];

const TOOLS = [
  { href: "/data", label: "Indicators" },
  { href: "/rotation", label: "Sectors" },
  { href: "/outlook", label: "Forecasts" },
];

export default function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const link = (l: { href: string; label: string }) => (
    <li key={l.href}>
      <Link href={l.href} aria-current={active(l.href) ? "page" : undefined}
        className={`relative block py-4 text-[14.5px] transition-colors after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full ${
          active(l.href) ? "font-medium text-ink after:bg-accent" : "text-muted hover:text-ink after:bg-transparent"}`}>
        {l.label}
      </Link>
    </li>
  );
  return (
    <nav aria-label="Main" className="-mx-5 flex w-[calc(100%+2.5rem)] items-center justify-between gap-6 overflow-x-auto border-t border-line px-5 [scrollbar-width:none] md:mx-0 md:w-auto md:border-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex shrink-0 gap-5 whitespace-nowrap">{LENSES.map(link)}</ul>
      <span className="hidden h-5 w-px shrink-0 bg-line lg:block" aria-hidden />
      <ul className="flex shrink-0 items-center gap-5 whitespace-nowrap">
        {TOOLS.map(link)}
        <li>
          <Link href="/ask" aria-current={active("/ask") ? "page" : undefined}
            className={`block rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
              active("/ask") ? "bg-accent text-surface" : "bg-accent-soft text-accent hover:bg-accent hover:text-surface"}`}>
            Ask the data
          </Link>
        </li>
      </ul>
    </nav>
  );
}
