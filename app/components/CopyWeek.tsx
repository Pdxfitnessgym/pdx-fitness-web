"use client";
import { useState } from "react";
import { copyWeekToWeeks } from "@/app/actions/programs";

// Tick the weeks to repeat this one into. Weeks that already hold workouts are
// shown but flagged — copying adds alongside, it doesn't replace.
export function CopyWeek({
  programId, fromWeek, totalWeeks, weeksWithWorkouts,
}: {
  programId: string; fromWeek: number; totalWeeks: number; weeksWithWorkouts: number[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);

  const others = Array.from({ length: totalWeeks }, (_, i) => i + 1).filter(w => w !== fromWeek);
  const occupied = new Set(weeksWithWorkouts);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#1B68B4", padding: "2px 0" }}
      >
        ⧉ Copy to other weeks
      </button>
    );
  }

  return (
    <form action={copyWeekToWeeks} style={{ background: "#fff", border: "1.5px solid #BFDBFE", borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="from_week" value={fromWeek} />

      <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827", marginBottom: 2 }}>
        Repeat week {fromWeek} into…
      </div>
      <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 10 }}>
        Copies every workout and exercise. Later edits are independent.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {others.map(w => {
          const on = picked.includes(w);
          const taken = occupied.has(w);
          return (
            <label
              key={w}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 700, border: `1.5px solid ${on ? "#1B68B4" : "#E2EAF0"}`, background: on ? "#EBF4FF" : "#F8FAFB", color: on ? "#1B68B4" : taken ? "#B45309" : "#6B7A8D" }}
            >
              <input
                type="checkbox"
                name="weeks"
                value={w}
                checked={on}
                onChange={() => setPicked(p => on ? p.filter(x => x !== w) : [...p, w])}
                style={{ display: "none" }}
              />
              {on ? "✓" : ""} Wk {w}{taken ? " •" : ""}
            </label>
          );
        })}
      </div>

      {picked.some(w => occupied.has(w)) && (
        <div style={{ fontSize: 11, color: "#B45309", marginBottom: 10 }}>
          • Weeks marked with a dot already have workouts — these get added alongside them.
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => { setOpen(false); setPicked([]); }} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "#F4F7FA", border: "1px solid #E2EAF0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6B7A8D" }}>
          Cancel
        </button>
        <button type="submit" disabled={picked.length === 0} style={{ flex: 2, padding: "9px", borderRadius: 8, background: "#1B68B4", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#fff", opacity: picked.length === 0 ? 0.5 : 1 }}>
          Copy into {picked.length || "…"} week{picked.length === 1 ? "" : "s"}
        </button>
      </div>
    </form>
  );
}
