import output from "@/public/data/tabs/output.json";
import labour from "@/public/data/tabs/labour.json";
import prices from "@/public/data/tabs/prices.json";
import money from "@/public/data/tabs/money.json";
import sentiment from "@/public/data/tabs/sentiment.json";
import trade from "@/public/data/tabs/trade.json";
import recessionsJson from "@/public/data/recessions.json";
import manifestJson from "@/public/data/manifest.json";
import type { Recession, TabData } from "./types";

const TABS: Record<string, TabData> = {
  output: output as TabData,
  labour: labour as TabData,
  prices: prices as TabData,
  money: money as TabData,
  sentiment: sentiment as TabData,
  trade: trade as TabData,
};

export const recessions = recessionsJson as Recession[];
export const manifest = manifestJson as { generated_at: string; tabs: Record<string, { series: number; latest: string }> };

export function getTab(slug: string): TabData | undefined {
  return TABS[slug];
}
