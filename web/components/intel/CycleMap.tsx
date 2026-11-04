import type { CycleReading } from "@/lib/intel-types";

const W = 560, H = 360, M = { l: 40, r: 16, t: 16, b: 36 };
const COLOR = { CA: "var(--c-ca)", US: "var(--c-us)" };
const NAME = { CA: "Canada", US: "U.S." };

/** Business-cycle clock: OECD leading indicator level vs trend (x) and its 3-month change (y), with a 12-month trail. */
export default function CycleMap({ readings }: { readings: CycleReading[] }) {
  if (!readings.length) return <p className="text-sm text-muted">Leading-indicator data is not available.</p>;
  const all = readings.flatMap((r) => r.trail);
  const lx = Math.max(1, ...all.map((p) => Math.abs(p.level))) * 1.35;
  const ly = Math.max(0.4, ...all.map((p) => Math.abs(p.momentum))) * 1.6;
  const pw = W - M.l - M.r, ph = H - M.t - M.b;
  const x = (v: number) => M.l + ((v + lx) / (2 * lx)) * pw;
  const y = (v: number) => M.t + ((ly - v) / (2 * ly)) * ph;
  const cx = x(0), cy = y(0);
  const quad = [
    { label: "Early cycle", sub: "below trend, improving", x: M.l + 8, y: M.t + 18, anchor: "start" as const },
    { label: "Mid cycle", sub: "above trend, improving", x: W - M.r - 8, y: M.t + 18, anchor: "end" as const },
    { label: "Late cycle", sub: "above trend, slowing", x: W - M.r - 8, y: H - M.b - 22, anchor: "end" as const },
    { label: "Contraction", sub: "below trend, slowing", x: M.l + 8, y: H - M.b - 22, anchor: "start" as const },
  ];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={readings.map((r) => `${NAME[r.country]}: ${r.phase}`).join("; ")}>
        <rect x={M.l} y={M.t} width={pw} height={ph} fill="var(--surface)" stroke="var(--line)" />
        <rect x={cx} y={M.t} width={W - M.r - cx} height={cy - M.t} fill="var(--band)" />
        <rect x={M.l} y={cy} width={cx - M.l} height={H - M.b - cy} fill="var(--shade)" />
        <line x1={cx} x2={cx} y1={M.t} y2={H - M.b} stroke="var(--muted)" strokeDasharray="3 3" />
        <line x1={M.l} x2={W - M.r} y1={cy} y2={cy} stroke="var(--muted)" strokeDasharray="3 3" />
        {quad.map((q) => (
          <g key={q.label} fill="var(--muted)">
            <text x={q.x} y={q.y} textAnchor={q.anchor} fontSize="13" fontWeight="600" fill="var(--ink)">{q.label}</text>
            <text x={q.x} y={q.y + 15} textAnchor={q.anchor} fontSize="11">{q.sub}</text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
          Leading indicator vs long-term trend (← below · above →)
        </text>
        <text transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="var(--muted)">
          3-month momentum (↓ slowing · improving ↑)
        </text>
        {readings.map((r) => {
          const pts = r.trail.map((p) => `${x(p.level).toFixed(1)},${y(p.momentum).toFixed(1)}`).join(" ");
          const last = r.trail.at(-1)!;
          return (
            <g key={r.country}>
              <polyline points={pts} fill="none" stroke={COLOR[r.country]} strokeWidth="2" strokeOpacity="0.55" />
              {r.trail.slice(0, -1).map((p) => (
                <circle key={p.date} cx={x(p.level)} cy={y(p.momentum)} r="3" fill={COLOR[r.country]} fillOpacity="0.55">
                  <title>{`${NAME[r.country]}, ${p.date.slice(0, 7)}: ${p.level >= 0 ? "+" : ""}${p.level.toFixed(2)} vs trend, ${p.momentum >= 0 ? "+" : ""}${p.momentum.toFixed(2)} over 3 months`}</title>
                </circle>
              ))}
              <circle cx={x(last.level)} cy={y(last.momentum)} r="8" fill={COLOR[r.country]} stroke="var(--surface)" strokeWidth="2">
                <title>{`${NAME[r.country]}, ${last.date.slice(0, 7)}: ${r.phase}`}</title>
              </circle>
              <text x={x(last.level) + (x(last.level) > W * 0.75 ? -12 : 12)} y={y(last.momentum) + 4} textAnchor={x(last.level) > W * 0.75 ? "end" : "start"}
                fontSize="12" fontWeight="600" fill="var(--ink)" paintOrder="stroke" stroke="var(--surface)" strokeWidth="3">{NAME[r.country]}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">
        Dots trace the past 12 months; the large dot is the latest reading. OECD composite leading indicators via FRED.
      </figcaption>
    </figure>
  );
}
