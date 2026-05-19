"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["Full Body", "Upper Body", "Lower Body", "Core", "Cardio", "HIIT", "Mobility", "Recovery"];
const DIFFICULTIES = [
  { value: "beginner", label: "Beginner", color: "#10B981" },
  { value: "intermediate", label: "Intermediate", color: "#F59E0B" },
  { value: "advanced", label: "Advanced", color: "#EF4444" },
];

export default function NewStandaloneWorkoutPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Workout name is required"); return; }
    setSaving(true); setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setSaving(false); return; }

    const { data, error: dbErr } = await supabase.from("workouts").insert({
      trainer_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      difficulty: difficulty || null,
      est_duration_mins: duration ? parseInt(duration) : null,
      category: category || null,
      is_standalone: true,
      program_id: null,
      day_of_week: 0,
      week_number: 0,
    }).select("id").single();

    if (dbErr || !data) { setError(dbErr?.message ?? "Failed to create"); setSaving(false); return; }
    router.push(`/trainer/workouts/${data.id}`);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 40 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer/workouts" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← On-Demand Workouts</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>New Workout</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>{error}</div>}

          <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Workout Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. 20-Minute Full Body Blast"
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Description <span style={{ color: "#6B7A8D", fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's this workout good for?"
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div>
              <label style={labelStyle}>Difficulty</label>
              <div style={{ display: "flex", gap: 8 }}>
                {DIFFICULTIES.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(difficulty === d.value ? "" : d.value)}
                    style={{
                      flex: 1, padding: "10px", borderRadius: 10,
                      border: `2px solid ${difficulty === d.value ? d.color : "#E2EAF0"}`,
                      background: difficulty === d.value ? d.color + "18" : "#F4F7FA",
                      color: difficulty === d.value ? d.color : "#6B7A8D",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Est. Duration (min)</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="30"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !name.trim()}
            style={{ padding: "14px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: saving || !name.trim() ? 0.5 : 1 }}
          >
            {saving ? "Creating..." : "Create Workout →"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", boxSizing: "border-box" };
