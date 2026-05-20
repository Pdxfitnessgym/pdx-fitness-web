import Link from "next/link";
import { createWorkout } from "@/app/actions/programs";

// Day 1–7 map to Mon–Sun (Mon=1...Sat=6, Sun=0) for calendar positioning
const DAY_OPTIONS = [
  { label: "Day 1", value: 1 },
  { label: "Day 2", value: 2 },
  { label: "Day 3", value: 3 },
  { label: "Day 4", value: 4 },
  { label: "Day 5", value: 5 },
  { label: "Day 6", value: 6 },
  { label: "Day 7", value: 0 },
];

export default async function NewWorkoutPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
  const { week } = await searchParams;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href={`/trainer/programs/${id}`} style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Program</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Add Workout</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        <form action={createWorkout} style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #E2EAF0", display: "flex", flexDirection: "column", gap: 18 }}>
          <input type="hidden" name="program_id" value={id} />

          <div>
            <label style={labelStyle}>Workout Name *</label>
            <input name="name" required placeholder="e.g. Upper Body A, Leg Day, Push" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Week *</label>
            <input name="week_number" type="number" min={1} max={52} defaultValue={week ?? "1"} required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Day in week</label>
            <select name="day_of_week" required style={inputStyle}>
              {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 6 }}>Day 1 = first workout of the week. Client can start the program any day — Day 1 lands on that day.</div>
          </div>

          <button type="submit" style={btnStyle}>Add Workout →</button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 8,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "13px 14px", borderRadius: 10, border: "1px solid #E2EAF0",
  background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none",
};
const btnStyle: React.CSSProperties = {
  padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff",
  fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer",
};
