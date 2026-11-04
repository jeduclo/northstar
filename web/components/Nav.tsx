"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LENS_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/household", label: "Household" },
  { href: "/investor", label: "Investor" },
  { href: "/policy", label: "Policy" },
  { href: "/student", label: "Student" },
];

const TOOL_LINKS = [
  { href: "/data", label: "Indicators" },
  { href: "/rotation", label: "Sectors" },
  { href: "/outlook", label: "Forecasts" },
  { href: "/ask", label: "Ask the data" },
];

export default function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav aria-label="Main" className="mx-auto flex max-w-6xl items-end justify-between gap-6 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex shrink-0 items-end gap-1">
        <span className="hidden pb-3 pr-2 text-xs text-muted md:inline">View as:</span>
        <ul className="flex gap-5 whitespace-nowrap text-sm">
          {LENS_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={active(l.href) ? "page" : undefined}
                className={`inline-block border-b-2 py-3 ${active(l.href) ? "border-ca font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <ul className="flex shrink-0 gap-4 whitespace-nowrap text-sm">
        {TOOL_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} aria-current={active(l.href) ? "page" : undefined}
              className={`inline-block border-b-2 py-3 ${active(l.href) ? "border-us font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
