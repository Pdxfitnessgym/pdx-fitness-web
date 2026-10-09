import type { WeekGuide } from "@/lib/program-week";

// Read-only render of a week's guide page. Server component on purpose — it is
// used inside both the client and trainer page trees.
export function WeekGuideView({ guide }: { guide: WeekGuide }) {
  const glanceLines = (guide.glance ?? "").split("\n").map(l => l.trim()).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {(guide.phase || guide.title || guide.focus) && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: 18, textAlign: "center" }}>
          {guide.phase && (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 1 }}>{guide.phase}</div>
          )}
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4", marginTop: 6 }}>
            Week {guide.week_number}{guide.title ? `: ${guide.title}` : ""}
          </div>
          {guide.focus && <div style={{ fontSize: 14, color: "#6B7A8D", marginTop: 6, fontStyle: "italic" }}>{guide.focus}</div>}
        </div>
      )}

      {glanceLines.length > 0 && (
        <div style={{ background: "#EBF9F8", borderRadius: 14, border: "1px solid #A7F3D0", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F766E", marginBottom: 8 }}>This Week at a Glance</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {glanceLines.map((line, i) => (
              <div key={i} style={{ fontSize: 14, color: "#0D1827" }}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {guide.schedule.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
          {guide.schedule.map((row, i) => (
            <div
              key={row.day + i}
              style={{
                display: "grid",
                gridTemplateColumns: "84px 1fr auto",
                gap: 10,
                padding: "12px 16px",
                alignItems: "center",
                borderTop: i === 0 ? "none" : "1px solid #F1F5F9",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D" }}>{row.day}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0D1827" }}>{row.workout}</div>
              <div style={{ fontSize: 13, color: "#6B7A8D", textAlign: "right" }}>{row.details}</div>
            </div>
          ))}
        </div>
      )}

      {guide.goal && <Note tone="#1B68B4" bg="#EFF6FF" border="#BFDBFE" heading="🎯 This Week's Goal" body={guide.goal} />}
      {guide.tip && <Note tone="#92400E" bg="#FFFBEB" border="#FDE68A" heading="💡 Tip" body={guide.tip} />}
      {guide.milestone && <Note tone="#065F46" bg="#ECFDF5" border="#A7F3D0" heading="⭐ Milestone" body={guide.milestone} />}
    </div>
  );
}

function Note({ tone, bg, border, heading, body }: { tone: string; bg: string; border: string; heading: string; body: string }) {
  return (
    <div style={{ background: bg, borderRadius: 14, border: `1px solid ${border}`, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: tone, marginBottom: 5 }}>{heading}</div>
      <div style={{ fontSize: 14, color: "#0D1827", whiteSpace: "pre-wrap" }}>{body}</div>
    </div>
  );
}
