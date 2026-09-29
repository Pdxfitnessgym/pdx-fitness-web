"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 1–10 rating of how hard the session felt (RPE). Saves on tap; skipping is fine.
export const RPE_LABEL: Record<number, string> = {
  1: "very easy", 2: "easy", 3: "light", 4: "fairly light", 5: "moderate",
  6: "somewhat hard", 7: "hard", 8: "very hard", 9: "extremely hard", 10: "max effort",
};

export function rpeColor(v: number) {
  if (v <= 3) return "#10B981";
  if (v <= 6) return "#F59E0B";
  if (v <= 8) return "#F97316";
  return "#EF4444";
}

export function RpeScale({ workoutLogId, initial }: { workoutLogId: string | null; initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial ?? null);
  const [saving, setSaving] = useState(false);

  async function pick(v: number) {
    if (!workoutLogId || saving) return;
    const next = value === v ? null : v;
    setValue(next);
    setSaving(true);
    const supabase = createClient();
    await supabase.from("workout_logs").update({ rpe: next }).eq("id", workoutLogId);
    setSaving(false);
  }

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #E2EAF0", marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827", marginBottom: 2 }}>How hard was that? 🥵</div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>1 is easy, 10 is everything you had.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 5 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(v => {
          const on = value === v;
          return (
            <button
              key={v}
              onClick={() => pick(v)}
              aria-label={`${v} out of 10, ${RPE_LABEL[v]}`}
              style={{
                padding: "11px 0", borderRadius: 9, cursor: "pointer", fontSize: 14, fontWeight: 800,
                border: on ? `2px solid ${rpeColor(v)}` : "1px solid #E2EAF0",
                background: on ? rpeColor(v) : "#F8FAFB",
                color: on ? "#fff" : "#6B7A8D",
              }}
            >
              {v}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13, marginTop: 10, textAlign: "center", fontWeight: 700, color: value ? rpeColor(value) : "#C7CFD9" }}>
        {value ? `${value}/10 — ${RPE_LABEL[value]}` : "Tap a number (optional)"}
      </div>
    </div>
  );
}
