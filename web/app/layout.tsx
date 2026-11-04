import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { ControlsProvider } from "@/components/Controls";
import Nav from "@/components/Nav";
import StaleNotice from "@/components/StaleNotice";
import { manifest } from "@/lib/data";
import { fmtRefreshed } from "@/lib/format";
import "./globals.css";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.macrointelligence.ca"),
  title: "MacroIntelligence | Canada–U.S. economic intelligence",
  description:
    "Twenty real questions about the Canadian and U.S. economies, answered from live Bank of Canada, Statistics Canada, FRED and market data, "
    + "for households, investors, policy analysts and students.",
  openGraph: {
    title: "MacroIntelligence",
    description: "Canada–U.S. economic intelligence: real questions, live data, clear answers.",
    url: "https://www.macrointelligence.ca",
    siteName: "MacroIntelligence",
    locale: "en_CA",
    type: "website",
  },
};

function Mark() {
  // Four-point north star: the project's original name, drawn as a compass rose
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="shrink-0">
      <circle cx="13" cy="13" r="12" fill="var(--accent)" />
      <path d="M13 3.5 L15 11 L22.5 13 L15 15 L13 22.5 L11 15 L3.5 13 L11 11 Z" fill="var(--surface)" />
    </svg>
  );
}

const EXPLORE = [
  { href: "/household", label: "Household" },
  { href: "/investor", label: "Investor" },
  { href: "/policy", label: "Policy analyst" },
  { href: "/student", label: "Student" },
];
const TOOLS = [
  { href: "/data", label: "Indicator library" },
  { href: "/rotation", label: "Sector rotation" },
  { href: "/outlook", label: "Forecasts" },
  { href: "/ask", label: "Ask the data" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} ${serif.variable} antialiased`}>
      <body className="min-h-screen">
        <ControlsProvider>
          <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 px-5">
              <Link href="/" className="flex items-center gap-2.5 py-3.5" aria-label="MacroIntelligence home">
                <Mark />
                <span className="text-[17px] font-semibold tracking-tight">
                  Macro<span className="text-accent">Intelligence</span>
                </span>
              </Link>
              <Nav />
            </div>
          </header>
          <StaleNotice generatedAt={manifest.generated_at} />
          <main className="mx-auto max-w-6xl px-5 pb-20 pt-10">{children}</main>
          <footer className="border-t border-line bg-panel">
            <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 text-sm md:grid-cols-[1.4fr_1fr_1fr]">
              <div>
                <div className="flex items-center gap-2.5">
                  <Mark />
                  <span className="font-semibold">Macro<span className="text-accent">Intelligence</span></span>
                </div>
                <p className="mt-3 max-w-sm text-muted">
                  Economic intelligence for Canada and the United States: real questions, answered from official data every weekday.
                </p>
                <p className="mt-5 font-medium">Site created by Jean Alegue, PhD</p>
              </div>
              <nav aria-label="Lenses">
                <h2 className="font-semibold">Explore by lens</h2>
                <ul className="mt-3 space-y-2 text-muted">
                  {EXPLORE.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-ink">{l.label}</Link></li>)}
                </ul>
              </nav>
              <nav aria-label="Data and methods">
                <h2 className="font-semibold">Data and methods</h2>
                <ul className="mt-3 space-y-2 text-muted">
                  {TOOLS.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-ink">{l.label}</Link></li>)}
                </ul>
              </nav>
            </div>
            <div className="border-t border-line">
              <div className="mx-auto max-w-6xl px-5 py-5 text-xs leading-relaxed text-muted">
                <p>
                  Data refreshed {fmtRefreshed(manifest.generated_at)} ET from the Bank of Canada, Statistics Canada, the Federal Reserve
                  Bank of St. Louis (FRED) and Yahoo Finance. AI-written summaries interpret the published figures and can be wrong, so
                  check them against the numbers shown. General information, not financial advice.
                </p>
                <p className="mt-2">© {new Date().getFullYear()} Jean Alegue. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </ControlsProvider>
      </body>
    </html>
  );
}
