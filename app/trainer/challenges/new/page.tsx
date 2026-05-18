"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const EMOJIS = ["🏆", "🔥", "💪", "🥗", "🧘", "🏃", "🚴", "🥊", "⚡", "🎯", "🌱", "💧"];

export default function NewChallengePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [emoji, setEmoji] = useState("🏆");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;
    if (endDate <= startDate) { setError("End date must be after start date"); return; }
    setSaving(true); setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error: dbErr } = await supabase.from("challenges").insert({
      trainer_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      goal: goal.trim() || null,
      cover_emoji: emoji,
      start_date: startDate,
      end_date: endDate,
    });

    if (dbErr) { setError("Failed to create: " + dbErr.message); setSaving(false); return; }
    router.push("/trainer/challenges");
  }

  const duration = startDate && endDate
    ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
    : null;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer/challenges" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Challenges</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>New Challenge</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 20 }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "12px 16px", borderRadius: 10, fontSize: 14 }}>{error}</div>}

          {/* Emoji picker */}
          <div style={cardStyle}>
            <label style={labelStyle}>Icon</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => setEmoji(e)}
                  style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${emoji === e ? "#2DC4B8" : "#E2EAF0"}`, background: emoji === e ? "#EBF9F8" : "#F4F7FA", fontSize: 22, cursor: "pointer" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Challenge Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. 30-Day No Sugar Challenge" style={inputStyle} />
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this challenge about? Who is it for?" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>Daily Goal / Check-in Prompt</label>
            <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. No sugar today? Log it. 100 push-ups done? Check in." style={inputStyle} />
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 6 }}>This is what clients see when they check in each day.</div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Date *</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required min={startDate} style={inputStyle} />
              </div>
            </div>
            {duration != null && duration > 0 && (
              <div style={{ fontSize: 13, color: "#2DC4B8", fontWeight: 600, marginTop: 10 }}>
                {duration}-day challenge
              </div>
            )}
          </div>

          <button type="submit" disabled={saving} style={{ padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Creating..." : "Create Challenge 🏆"}
          </button>
        </form>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 8 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" };
