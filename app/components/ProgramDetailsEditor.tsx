"use client";
import { useState } from "react";
import { updateProgram } from "@/app/actions/programs";

// Collapsed by default — the program page is mostly about its workouts.
export function ProgramDetailsEditor({
  programId, name, description, durationWeeks,
}: {
  programId: string; name: string; description: string | null; durationWeeks: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1B68B4", padding: 0, marginBottom: 16 }}
      >
        ✏️ Edit program details
      </button>
    );
  }

  return (
    <form action={updateProgram} style={{ background: "#fff", border: "1px solid #E2EAF0", borderRadius: 14, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="program_id" value={programId} />
      <div>
        <label style={label}>Program name</label>
        <input name="name" defaultValue={name} required style={input} />
      </div>
      <div>
        <label style={label}>Description</label>
        <input name="description" defaultValue={description ?? ""} placeholder="Optional" style={input} />
      </div>
      <div>
        <label style={label}>Length (weeks)</label>
        <input name="duration_weeks" type="number" min={1} max={52} defaultValue={durationWeeks} required style={input} />
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
          Shortening this hides weeks beyond the new length — the workouts in them aren&apos;t deleted.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#6B7A8D" }}>
          Cancel
        </button>
        <button type="submit" style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#1B68B4", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff" }}>
          Save
        </button>
      </div>
    </form>
  );
}

const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 };
const input: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" };
