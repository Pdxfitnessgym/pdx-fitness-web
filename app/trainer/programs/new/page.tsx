import Link from "next/link";
import { createProgram } from "@/app/actions/programs";

export default function NewProgramPage() {
  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer/programs" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Programs</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>New Program</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        <form action={createProgram} style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #E2EAF0", display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={labelStyle}>Program Name *</label>
            <input name="name" required placeholder="e.g. 12-Week Strength Builder" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea name="description" placeholder="What is this program about?" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <label style={labelStyle}>Duration (weeks) *</label>
            <select name="duration_weeks" required style={inputStyle}>
              {[4, 6, 8, 10, 12, 16, 20, 24].map(w => (
                <option key={w} value={w}>{w} weeks</option>
              ))}
            </select>
          </div>
          <button type="submit" style={btnStyle}>Create Program →</button>
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
