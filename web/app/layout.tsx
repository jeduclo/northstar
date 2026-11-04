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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} ${serif.variable} antialiased`}>
      <body className="min-h-screen">
        <ControlsProvider>
          <header className="border-b border-line bg-surface">
            <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 pt-5">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Macro<span className="text-ca">Intelligence</span>
                <span className="ml-2 hidden font-normal text-muted sm:inline">Canada–U.S. economic intelligence</span>
              </Link>
              <p className="text-xs text-muted">Data refreshed {fmtRefreshed(manifest.generated_at)} ET</p>
            </div>
            <Nav />
          </header>
          <StaleNotice generatedAt={manifest.generated_at} />
          <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
          <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-2 border-t border-line px-5 py-6 text-xs text-muted">
            <p>
              Sources: Bank of Canada Valet, Statistics Canada, FRED (St. Louis Fed), Yahoo Finance. AI summaries interpret the published
              figures and can be wrong; check the numbers shown. Shaded areas mark recessions (NBER for the U.S., C.D. Howe for Canada).
              General information, not financial advice.
            </p>
            <p>
              <Link href="/methodology" className="underline hover:text-ink">Methodology</Link>
              {" · "}
              <a href="https://github.com/jeduclo/northstar" className="underline hover:text-ink">Source code</a>
            </p>
          </footer>
        </ControlsProvider>
      </body>
    </html>
  );
}
