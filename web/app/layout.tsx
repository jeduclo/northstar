import type { Metadata } from "next";
import { IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { ControlsProvider } from "@/components/Controls";
import Nav from "@/components/Nav";
import StaleNotice from "@/components/StaleNotice";
import manifest from "@/public/data/manifest.json";
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
  title: "NorthStar | Canada–U.S. Macro & Sector Intelligence",
  description: "Cross-border macroeconomic cycles and sector rotation for Canada and the United States.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} ${serif.variable} antialiased`}>
      <body className="min-h-screen">
        <ControlsProvider>
          <header className="border-b border-line bg-surface">
            <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 pt-5">
              <a href="/" className="text-lg font-semibold tracking-tight">
                NorthStar
                <span className="ml-2 font-normal text-muted">Canada–U.S. macro intelligence</span>
              </a>
              <p className="text-xs text-muted">Data refreshed {fmtRefreshed(manifest.generated_at)} ET</p>
            </div>
            <Nav />
          </header>
          <StaleNotice generatedAt={manifest.generated_at} />
          <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
          <footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-2 border-t border-line px-5 py-6 text-xs text-muted">
            <p>
              Sources: Bank of Canada Valet, Statistics Canada, FRED (St. Louis Fed), Yahoo Finance.
              Shaded areas mark recessions (NBER for the U.S., C.D. Howe for Canada). Not investment advice.
            </p>
            <p>
              <a href="/methodology" className="underline hover:text-ink">Methodology</a>
            </p>
          </footer>
        </ControlsProvider>
      </body>
    </html>
  );
}
