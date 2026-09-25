"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TAB_SPECS } from "@/lib/tabs";

export default function Nav() {
  const path = usePathname();
  const links = [{ href: "/", label: "Overview" }, ...TAB_SPECS.map((t) => ({ href: `/${t.slug}`, label: t.label })), { href: "/rotation", label: "Sector rotation" }, { href: "/outlook", label: "Outlook & scenarios" }];
  return (
    <nav aria-label="Dashboard sections" className="mx-auto max-w-6xl overflow-x-auto px-5">
      <ul className="flex gap-6 whitespace-nowrap text-sm">
        {links.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block border-b-2 py-3 ${
                  active ? "border-ca font-medium text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
