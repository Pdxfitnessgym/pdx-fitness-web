// Small SVG chart set for the Progress area. No chart library — these are simple
// enough that a dependency would cost more than it saves.
//
// Colours are the brand blue/teal pair, checked with the palette validator:
// CVD separation ΔE 27 (deutan) / 22.9 (tritan), well clear of the floor. Teal
// sits under 3:1 against the light surface, so every chart using it carries a
// legend — identity is never colour alone.

const INK = "#0D1827";
const MUTED = "#9CA3AF";
const SECONDARY = "#6B7A8D";
const GRID = "#E2EAF0";
const PRIMARY = "#1B68B4";
const ACCENT = "#2DC4B8";

export type Point = { label: string; value: number };

function niceBounds(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return { lo: min - 1, hi: max + 1 };
  const pad = (max - min) * 0.15;
  return { lo: min - pad, hi: max + pad };
}

export function LineChart({
  title,
  series,
  overlay,
  overlayLabel,
  seriesLabel,
  unit = "",
  averageLine = false,
  height = 180,
}: {
  title: string;
  series: Point[];
  overlay?: Point[];
  overlayLabel?: string;
  seriesLabel: string;
  unit?: string;
  averageLine?: boolean;
  height?: number;
}) {
  if (series.length < 2) {
    return (
      <div style={card}>
        <div style={cardTitle}>{title}</div>
        <div style={{ color: MUTED, fontSize: 13, padding: "20px 0" }}>
          Not enough entries yet — needs at least two.
        </div>
      </div>
    );
  }

  const W = 320;
  const H = height;
  const padL = 38, padR = 10, padT = 10, padB = 22;
  const all = [...series.map(p => p.value), ...(overlay ?? []).map(p => p.value)];
  const { lo, hi } = niceBounds(all);
  const avg = series.reduce((a, p) => a + p.value, 0) / series.length;

  const x = (i: number, n: number) => padL + (i / Math.max(n - 1, 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  const path = (pts: Point[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i, pts.length).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const areaPath = `${path(series)} L${x(series.length - 1, series.length).toFixed(1)},${(H - padB).toFixed(1)} L${padL},${(H - padB).toFixed(1)} Z`;

  // three recessive gridlines
  const ticks = [lo, (lo + hi) / 2, hi];
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : Math.round(v * 10) / 10);

  return (
    <div style={card}>
      <div style={cardTitle}>{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={`${title} over time`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill={MUTED}>{fmt(t)}</text>
          </g>
        ))}

        <path d={areaPath} fill={PRIMARY} opacity={0.07} />

        {averageLine && (
          <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} stroke={ACCENT} strokeWidth={2} strokeDasharray="4 3" />
        )}

        {overlay && overlay.length > 1 && (
          <path d={path(overlay)} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}

        <path d={path(series)} fill="none" stroke={PRIMARY} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {series.map((p, i) => (
          <circle key={i} cx={x(i, series.length)} cy={y(p.value)} r={series.length > 20 ? 2.5 : 4} fill="#fff" stroke={PRIMARY} strokeWidth={2}>
            <title>{`${p.label}: ${p.value}${unit}`}</title>
          </circle>
        ))}

        <text x={padL} y={H - 6} fontSize={9} fill={MUTED}>{series[0].label}</text>
        <text x={W - padR} y={H - 6} fontSize={9} fill={MUTED} textAnchor="end">{series[series.length - 1].label}</text>
      </svg>

      {/* Legend — required wherever the teal appears, since it is low-contrast on white */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
        <LegendKey color={PRIMARY} label={seriesLabel} />
        {overlay && overlay.length > 1 && <LegendKey color={ACCENT} label={overlayLabel ?? "Average"} />}
        {averageLine && <LegendKey color={ACCENT} label={`Average ${fmt(avg)}${unit}`} dashed />}
      </div>
    </div>
  );
}

function LegendKey({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: SECONDARY }}>
      <span style={{ width: 14, height: 0, borderTop: `3px ${dashed ? "dashed" : "solid"} ${color}`, borderRadius: 2 }} />
      {label}
    </span>
  );
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function ComplianceGrid({
  title,
  rangeLabel,
  rows,
}: {
  title: string;
  rangeLabel: string;
  rows: { label: string; days: boolean[] }[];
}) {
  return (
    <div style={card}>
      <div style={cardTitle}>{title}</div>
      <div style={{ fontSize: 13, color: SECONDARY, marginBottom: 14 }}>{rangeLabel}</div>
      {rows.map((row, ri) => (
        <div key={row.label} style={{ paddingTop: ri === 0 ? 0 : 12, marginTop: ri === 0 ? 0 : 12, borderTop: ri === 0 ? "none" : `1px solid ${GRID}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 74, fontSize: 13, fontWeight: 600, color: INK, flexShrink: 0 }}>{row.label}</div>
            <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "space-between" }}>
              {row.days.map((done, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{DAYS[i]}</span>
                  <div
                    title={`${DAYS[i]}: ${done ? "done" : "not logged"}`}
                    style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: done ? "#10B981" : "#fff",
                      border: `2px solid ${done ? "#10B981" : GRID}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 12, fontWeight: 800,
                    }}
                  >
                    {done ? "✓" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: 18, border: `1px solid ${GRID}`,
};
const cardTitle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: INK, marginBottom: 6,
};
