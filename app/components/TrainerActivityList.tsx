"use client";
import { useState } from "react";
import Link from "next/link";
import { RPE_LABEL, rpeColor } from "@/lib/rpe";

const COLORS = ["#1B68B4", "#2DC4B8", "#7C3AED", "#DB2777", "#D97706", "#059669"];
const COLLAPSED = 3;

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export type ActivityRow = {
  id: string;
  clientId: string;
  clientName: string;
  workoutName: string;
  when: string;
  volume: number;
  sets: number;
  note: string | null;
  rpe: number | null;
  nth: number | null;
};

// Collapsed to a glance by default — the dashboard has plenty below it.
export function TrainerActivityList({ rows }: { rows: ActivityRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, COLLAPSED);
  const hidden = rows.length - shown.length;

  return (
    <>
      {shown.map((r, i) => (
        <Link
          key={r.id}
          href={`/trainer/clients/${r.clientId}?tab=workouts`}
          style={{ display: "flex", gap: 12, padding: "14px 18px", textDecoration: "none", borderTop: i === 0 ? "none" : "1px solid #F4F7FA", alignItems: "flex-start" }}
        >
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS[r.clientName.charCodeAt(0) % COLORS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
            {initials(r.clientName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "#6B7A8D", lineHeight: 1.5 }}>
              {r.nth && (
                <span style={{ color: "#D97706", fontWeight: 700 }}>
                  🎉 {r.nth === 1 ? "First workout! " : `${r.nth}th workout! `}
                </span>
              )}
              <span style={{ fontWeight: 700, color: "#0D1827" }}>{r.clientName}</span>
              {" completed "}
              <span style={{ fontWeight: 700, color: "#0D1827" }}>{r.workoutName}</span>
              {r.sets > 0 && ` — ${r.sets} set${r.sets === 1 ? "" : "s"}`}
              {r.volume > 0 && (
                <>
                  {", "}
                  <span style={{ fontWeight: 700, color: "#1B68B4" }}>{r.volume.toLocaleString()} lbs</span>
                  {" lifted"}
                </>
              )}
              {"."}
              {r.rpe && (
                <>
                  {" Rated "}
                  <span style={{ fontWeight: 700, color: rpeColor(r.rpe) }}>RPE {r.rpe}/10</span>
                  {` (${RPE_LABEL[r.rpe]}).`}
                </>
              )}
            </div>
            {r.note && (
              <div style={{ fontSize: 13, color: "#6B7A8D", fontStyle: "italic", marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                “{r.note}”
              </div>
            )}
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>{r.when}</div>
          </div>
        </Link>
      ))}

      {rows.length > COLLAPSED && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ width: "100%", padding: "12px", borderTop: "1px solid #F4F7FA", background: "#FAFCFD", border: "none", borderBottomLeftRadius: 14, borderBottomRightRadius: 14, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1B68B4" }}
        >
          {expanded ? "Show less ▲" : `Show ${hidden} more ▼`}
        </button>
      )}
    </>
  );
}
