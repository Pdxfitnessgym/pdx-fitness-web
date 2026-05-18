import Link from "next/link";
import { createWorkout } from "@/app/actions/programs";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
            <label style={labelStyle}>Day *</label>
            <select name="day_of_week" required style={inputStyle}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
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
