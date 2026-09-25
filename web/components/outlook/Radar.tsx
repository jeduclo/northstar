"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Country } from "@/lib/types";
import { MARKET_COLOR, MARKET_NAME } from "../rotation/shared";

export default function MacroRadar({ data, markets }: {
  data: { pillar: string; CA: number | null; US: number | null }[]; markets: Country[];
}) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--line)" />
          <PolarAngleAxis dataKey="pillar" tick={{ fill: "var(--ink)", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 10 }} tickCount={5} axisLine={false} />
          <Tooltip
            formatter={(v, n) => [`${v} / 100`, MARKET_NAME[n as Country] ?? String(n)]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 6, fontSize: 12 }}
          />
          {markets.map((m) => (
            <Radar key={m} dataKey={m} stroke={MARKET_COLOR[m]} fill={MARKET_COLOR[m]} fillOpacity={0.15}
              strokeWidth={2} isAnimationActive={false} />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
