"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";

type Log = {
  id: string;
  logged_at: string;
  weight_lbs: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  photo_url: string | null;
};

type PR = {
  exercise_name: string;
  best_weight: number;
  best_reps: string | null;
  logged_at: string;
};

type Goal = {
  id: string;
  type: "weight" | "body_fat" | "strength" | "custom";
  title: string;
  start_value: number | null;
  target_value: number | null;
  exercise_name: string | null;
  target_date: string | null;
  completed: boolean;
};

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 200, h = 48, pad = 4;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ display: "block", marginTop: 8 }}>
      <polyline points={pts.join(" ")} fill="none" stroke="#2DC4B8" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {(() => {
        const [lx, ly] = pts[pts.length - 1].split(",").map(Number);
        return <circle cx={lx} cy={ly} r={3} fill="#2DC4B8" />;
      })()}
    </svg>
  );
}

function ProgressBar({ pct, color = "#2DC4B8" }: { pct: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div style={{ height: 6, background: "#E2EAF0", borderRadius: 99, overflow: "hidden", marginTop: 8 }}>
      <div style={{ height: "100%", width: `${clamped}%`, background: color, borderRadius: 99, transition: "width 0.4s" }} />
    </div>
  );
}

export default function ProgressPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"body" | "strength" | "goals">("body");

  // body state
  const [logs, setLogs] = useState<Log[]>([]);
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  // goals state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalType, setGoalType] = useState<Goal["type"]>("weight");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalExercise, setGoalExercise] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState("");

  async function fetchLogs() {
    const supabase = createClient();
    const { data } = await supabase
      .from("progress_logs")
      .select("id, logged_at, weight_lbs, body_fat_pct, notes, photo_url")
      .order("logged_at", { ascending: false })
      .limit(50);
    setLogs((data ?? []) as Log[]);
  }

  async function fetchPRs() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("set_logs")
      .select("weight_lbs, reps_completed, created_at, exercises(name)")
      .eq("client_id", user.id)
      .not("weight_lbs", "is", null)
      .order("weight_lbs", { ascending: false });
    if (!data) return;
    const best: Record<string, PR> = {};
    for (const row of data) {
      const name = (row.exercises as unknown as { name: string } | null)?.name;
      if (!name) continue;
      if (!best[name] || row.weight_lbs > best[name].best_weight) {
        best[name] = { exercise_name: name, best_weight: row.weight_lbs, best_reps: row.reps_completed, logged_at: row.created_at };
      }
    }
    setPrs(Object.values(best).sort((a, b) => b.best_weight - a.best_weight));
  }

  async function fetchGoals() {
    const supabase = createClient();
    const { data } = await supabase
      .from("goals")
      .select("id, type, title, start_value, target_value, exercise_name, target_date, completed")
      .order("created_at", { ascending: false });
    setGoals((data ?? []) as Goal[]);
  }

  useEffect(() => {
    Promise.all([fetchLogs(), fetchPRs(), fetchGoals()]).then(() => setLoading(false));
  }, []);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10485760) { setError("Photo must be under 10MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weight && !bodyFat) { setError("Enter at least weight or body fat %"); return; }
    setSaving(true); setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let photo_url: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("progress-photos").upload(path, photoFile, { contentType: photoFile.type });
        if (uploadErr) { setError("Photo upload failed"); setSaving(false); return; }
        photo_url = supabase.storage.from("progress-photos").getPublicUrl(path).data.publicUrl;
      }
      const { error: dbErr } = await supabase.from("progress_logs").insert({
        client_id: user.id, logged_at: date,
        weight_lbs: weight ? parseFloat(weight) : null,
        body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
        notes: notes.trim() || null, photo_url,
      });
      if (dbErr) { setError("Save failed: " + dbErr.message); setSaving(false); return; }
      setWeight(""); setBodyFat(""); setNotes(""); setPhotoFile(null); setPhotoPreview(null);
      setDate(new Date().toISOString().split("T")[0]);
      setShowForm(false);
      await fetchLogs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally { setSaving(false); }
  }

  async function deleteLog(id: string) {
    const supabase = createClient();
    await supabase.from("progress_logs").delete().eq("id", id);
    setLogs(logs.filter(l => l.id !== id));
  }

  async function handleGoalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (goalType !== "custom" && !goalTarget) { setGoalError("Enter a target value"); return; }
    if (goalType === "strength" && !goalExercise) { setGoalError("Enter an exercise name"); return; }
    if (goalType === "custom" && !goalTitle.trim()) { setGoalError("Enter a goal description"); return; }
    setGoalSaving(true); setGoalError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setGoalError("Session expired — please refresh"); setGoalSaving(false); return; }

    // snapshot current value as start
    let start_value: number | null = null;
    if (goalType === "weight") start_value = logs.find(l => l.weight_lbs != null)?.weight_lbs ?? null;
    if (goalType === "body_fat") start_value = logs.find(l => l.body_fat_pct != null)?.body_fat_pct ?? null;
    if (goalType === "strength") start_value = prs.find(p => p.exercise_name.toLowerCase() === goalExercise.toLowerCase())?.best_weight ?? null;

    const autoTitle = goalType === "weight" ? `Reach ${goalTarget} lbs`
      : goalType === "body_fat" ? `Reach ${goalTarget}% body fat`
      : goalType === "strength" ? `${goalExercise} — ${goalTarget} lbs`
      : goalTitle;

    const { error: dbErr } = await supabase.from("goals").insert({
      client_id: user.id,
      type: goalType,
      title: autoTitle,
      start_value,
      target_value: goalTarget ? parseFloat(goalTarget) : null,
      exercise_name: goalType === "strength" ? goalExercise : null,
      target_date: goalDate || null,
    });

    if (dbErr) { setGoalError("Save failed: " + dbErr.message); setGoalSaving(false); return; }
    setGoalType("weight"); setGoalTitle(""); setGoalTarget(""); setGoalExercise(""); setGoalDate("");
    setShowGoalForm(false);
    await fetchGoals();
    setGoalSaving(false);
  }

  async function toggleGoalComplete(goal: Goal) {
    const supabase = createClient();
    await supabase.from("goals").update({ completed: !goal.completed }).eq("id", goal.id);
    setGoals(goals.map(g => g.id === goal.id ? { ...g, completed: !g.completed } : g));
  }

  async function deleteGoal(id: string) {
    const supabase = createClient();
    await supabase.from("goals").delete().eq("id", id);
    setGoals(goals.filter(g => g.id !== id));
  }

  function goalProgress(goal: Goal): number | null {
    if (goal.type === "custom") return null;
    if (goal.target_value == null) return null;
    let current: number | null = null;
    if (goal.type === "weight") current = logs.find(l => l.weight_lbs != null)?.weight_lbs ?? null;
    if (goal.type === "body_fat") current = logs.find(l => l.body_fat_pct != null)?.body_fat_pct ?? null;
    if (goal.type === "strength") current = prs.find(p => p.exercise_name === goal.exercise_name)?.best_weight ?? null;
    if (current == null) return null;
    const start = goal.start_value ?? 0;
    const target = goal.target_value;
    if (target === start) return 100;
    return Math.min(100, Math.max(0, ((current - start) / (target - start)) * 100));
  }

  function daysLeft(targetDate: string | null) {
    if (!targetDate) return null;
    const diff = Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000);
    return diff;
  }

  const latestWeight = logs.find(l => l.weight_lbs != null)?.weight_lbs ?? null;
  const latestBf = logs.find(l => l.body_fat_pct != null)?.body_fat_pct ?? null;
  const prevWeight = logs.filter(l => l.weight_lbs != null)[1]?.weight_lbs ?? null;
  const prevBf = logs.filter(l => l.body_fat_pct != null)[1]?.body_fat_pct ?? null;
  const weightHistory = [...logs].reverse().map(l => l.weight_lbs).filter((v): v is number => v != null);

  function trend(curr: number | null, prev: number | null, lowerIsBetter = false) {
    if (curr == null || prev == null) return null;
    const diff = curr - prev;
    if (Math.abs(diff) < 0.1) return null;
    const good = lowerIsBetter ? diff < 0 : diff > 0;
    return { diff: Math.abs(diff).toFixed(1), up: diff > 0, good };
  }
  const wTrend = trend(latestWeight, prevWeight, false);
  const bTrend = trend(latestBf, prevBf, true);

  const TABS: { key: "body" | "strength" | "goals"; label: string }[] = [
    { key: "body", label: "Body" },
    { key: "strength", label: "Strength" },
    { key: "goals", label: "Goals" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Progress</div>
            </div>
            {tab === "body" && (
              <button onClick={() => setShowForm(!showForm)} style={{ padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
                {showForm ? "Cancel" : "+ Log"}
              </button>
            )}
            {tab === "goals" && (
              <button onClick={() => setShowGoalForm(!showGoalForm)} style={{ padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
                {showGoalForm ? "Cancel" : "+ Goal"}
              </button>
            )}
          </div>
          <div style={{ display: "flex" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "10px 0", border: "none", background: "none", fontWeight: 700, fontSize: 14, color: tab === t.key ? "#1B68B4" : "#6B7A8D", borderBottom: tab === t.key ? "2px solid #1B68B4" : "2px solid transparent", cursor: "pointer" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── BODY TAB ── */}
        {tab === "body" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
                <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 600, marginBottom: 6 }}>Body Weight</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1827" }}>{latestWeight != null ? `${latestWeight} lbs` : "—"}</div>
                {wTrend && <div style={{ fontSize: 12, fontWeight: 700, color: wTrend.good ? "#2DC4B8" : "#F59E0B", marginTop: 4 }}>{wTrend.up ? "↑" : "↓"} {wTrend.diff} from last</div>}
                {weightHistory.length >= 2 && <Sparkline data={weightHistory} />}
              </div>
              <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
                <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 600, marginBottom: 6 }}>Body Fat</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1827" }}>{latestBf != null ? `${latestBf}%` : "—"}</div>
                {bTrend && <div style={{ fontSize: 12, fontWeight: 700, color: bTrend.good ? "#2DC4B8" : "#F59E0B", marginTop: 4 }}>{bTrend.up ? "↑" : "↓"} {bTrend.diff} from last</div>}
              </div>
            </div>

            {showForm && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 16 }}>New Entry</div>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>{error}</div>}
                  <div><label style={labelStyle}>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div><label style={labelStyle}>Weight (lbs)</label><input type="number" step="0.1" min="0" value={weight} onChange={e => setWeight(e.target.value)} placeholder="185.0" style={inputStyle} /></div>
                    <div><label style={labelStyle}>Body Fat %</label><input type="number" step="0.1" min="0" max="100" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="18.5" style={inputStyle} /></div>
                  </div>
                  <div><label style={labelStyle}>Notes <span style={{ color: "#6B7A8D", fontWeight: 400 }}>(optional)</span></label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How are you feeling?" rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
                  <div>
                    <label style={labelStyle}>Progress Photo <span style={{ color: "#6B7A8D", fontWeight: 400 }}>(optional)</span></label>
                    {photoPreview ? (
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <img src={photoPreview} alt="preview" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10 }} />
                        <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%", background: "#DC2626", border: "none", color: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    ) : (
                      <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed #E2EAF0", borderRadius: 10, padding: "20px", textAlign: "center", cursor: "pointer", background: "#F4F7FA" }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>
                        <div style={{ fontSize: 13, color: "#6B7A8D" }}>Tap to add photo</div>
                      </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={onPhotoChange} style={{ display: "none" }} />
                  </div>
                  <button type="submit" disabled={saving} style={{ padding: "13px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Saving..." : "Save Entry"}</button>
                </form>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
            ) : logs.length === 0 ? (
              <div style={{ background: "#fff", borderRadius: 14, padding: "40px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
                <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No entries yet</div>
                <div style={{ fontSize: 14, color: "#6B7A8D" }}>Tap "+ Log" to record your first check-in</div>
              </div>
            ) : (
              <div>
                <div style={sectionLabel}>History</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {logs.map((log, i) => {
                    const prevLog = logs[i + 1];
                    const wDiff = log.weight_lbs != null && prevLog?.weight_lbs != null ? log.weight_lbs - prevLog.weight_lbs : null;
                    const bDiff = log.body_fat_pct != null && prevLog?.body_fat_pct != null ? log.body_fat_pct - prevLog.body_fat_pct : null;
                    return (
                      <div key={log.id} style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1B68B4" }}>{new Date(log.logged_at + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                          <button onClick={() => deleteLog(log.id)} style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                        </div>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          {log.weight_lbs != null && (
                            <div>
                              <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 2 }}>Weight</div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                <span style={{ fontSize: 20, fontWeight: 800, color: "#0D1827" }}>{log.weight_lbs}</span>
                                <span style={{ fontSize: 12, color: "#6B7A8D" }}>lbs</span>
                                {wDiff != null && Math.abs(wDiff) >= 0.1 && <span style={{ fontSize: 11, fontWeight: 700, color: wDiff < 0 ? "#2DC4B8" : "#F59E0B" }}>{wDiff > 0 ? "+" : ""}{wDiff.toFixed(1)}</span>}
                              </div>
                            </div>
                          )}
                          {log.body_fat_pct != null && (
                            <div>
                              <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 2 }}>Body Fat</div>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                <span style={{ fontSize: 20, fontWeight: 800, color: "#0D1827" }}>{log.body_fat_pct}</span>
                                <span style={{ fontSize: 12, color: "#6B7A8D" }}>%</span>
                                {bDiff != null && Math.abs(bDiff) >= 0.1 && <span style={{ fontSize: 11, fontWeight: 700, color: bDiff < 0 ? "#2DC4B8" : "#F59E0B" }}>{bDiff > 0 ? "+" : ""}{bDiff.toFixed(1)}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                        {log.notes && <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 8, lineHeight: 1.4 }}>{log.notes}</div>}
                        {log.photo_url && <img src={log.photo_url} alt="progress" onClick={() => setLightbox(log.photo_url)} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginTop: 10, cursor: "pointer" }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STRENGTH TAB ── */}
        {tab === "strength" && (
          loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
          ) : prs.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, padding: "40px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏆</div>
              <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No lifts logged yet</div>
              <div style={{ fontSize: 14, color: "#6B7A8D" }}>Complete a workout session to start tracking PRs</div>
            </div>
          ) : (
            <div>
              <div style={sectionLabel}>Personal Records</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prs.map(pr => (
                  <div key={pr.exercise_name} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #E2EAF0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{pr.exercise_name}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>{new Date(pr.logged_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 3, justifyContent: "flex-end" }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>{pr.best_weight}</span>
                        <span style={{ fontSize: 12, color: "#6B7A8D" }}>lbs</span>
                      </div>
                      {pr.best_reps != null && <div style={{ fontSize: 12, color: "#6B7A8D" }}>{pr.best_reps} reps</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* ── GOALS TAB ── */}
        {tab === "goals" && (
          <>
            {showGoalForm && (
              <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 16 }}>New Goal</div>
                <form onSubmit={handleGoalSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {goalError && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>{goalError}</div>}

                  <div>
                    <label style={labelStyle}>Type</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {(["weight", "body_fat", "strength", "custom"] as const).map(t => (
                        <button key={t} type="button" onClick={() => setGoalType(t)} style={{ padding: "10px", borderRadius: 10, border: `2px solid ${goalType === t ? "#1B68B4" : "#E2EAF0"}`, background: goalType === t ? "#EFF6FF" : "#F4F7FA", color: goalType === t ? "#1B68B4" : "#6B7A8D", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                          {t === "body_fat" ? "Body Fat" : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {goalType === "strength" && (
                    <div><label style={labelStyle}>Exercise</label><input type="text" value={goalExercise} onChange={e => setGoalExercise(e.target.value)} placeholder="e.g. Bench Press" style={inputStyle} /></div>
                  )}

                  {goalType === "custom" && (
                    <div><label style={labelStyle}>Goal description</label><input type="text" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="e.g. Run a 5K" style={inputStyle} /></div>
                  )}

                  {goalType !== "custom" && (
                    <div>
                      <label style={labelStyle}>
                        Target {goalType === "weight" ? "(lbs)" : goalType === "body_fat" ? "(%)" : "(lbs)"}
                      </label>
                      <input type="number" step="0.1" min="0" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder={goalType === "weight" ? "175" : goalType === "body_fat" ? "15" : "225"} style={inputStyle} />
                    </div>
                  )}

                  <div><label style={labelStyle}>Target date <span style={{ color: "#6B7A8D", fontWeight: 400 }}>(optional)</span></label><input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} style={inputStyle} /></div>

                  <button type="submit" disabled={goalSaving} style={{ padding: "13px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: goalSaving ? 0.6 : 1 }}>{goalSaving ? "Saving..." : "Save Goal"}</button>
                </form>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
            ) : goals.length === 0 && !showGoalForm ? (
              <div style={{ background: "#fff", borderRadius: 14, padding: "40px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
                <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No goals yet</div>
                <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 20 }}>Set a target and track your progress automatically</div>
                <button onClick={() => setShowGoalForm(true)} style={{ padding: "13px 28px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>
                  + Set a Goal
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {goals.map(goal => {
                  const pct = goalProgress(goal);
                  const days = daysLeft(goal.target_date);
                  return (
                    <div key={goal.id} style={{ background: "#fff", borderRadius: 14, padding: 16, border: `1px solid ${goal.completed ? "#A7F3D0" : "#E2EAF0"}`, opacity: goal.completed ? 0.75 : 1 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                          {goal.type === "custom" && (
                            <input type="checkbox" checked={goal.completed} onChange={() => toggleGoalComplete(goal)} style={{ marginTop: 3, width: 18, height: 18, accentColor: "#2DC4B8", cursor: "pointer" }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827", textDecoration: goal.completed ? "line-through" : "none" }}>{goal.title}</div>
                            {days != null && (
                              <div style={{ fontSize: 12, color: days < 0 ? "#F59E0B" : "#6B7A8D", marginTop: 2 }}>
                                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                              </div>
                            )}
                          </div>
                        </div>
                        <button onClick={() => deleteGoal(goal.id)} style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                      </div>

                      {pct != null && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7A8D", marginBottom: 2 }}>
                            <span>{goal.type === "strength" ? `Current: ${prs.find(p => p.exercise_name === goal.exercise_name)?.best_weight ?? "—"} lbs` : goal.type === "weight" ? `Current: ${latestWeight ?? "—"} lbs` : `Current: ${latestBf ?? "—"}%`}</span>
                            <span style={{ fontWeight: 700, color: pct >= 100 ? "#2DC4B8" : "#1B68B4" }}>{Math.round(pct)}%</span>
                          </div>
                          <ProgressBar pct={pct} color={pct >= 100 ? "#2DC4B8" : "#1B68B4"} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <img src={lightbox} alt="progress" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} />
        </div>
      )}

      <ClientBottomNav />
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" };
const sectionLabel: React.CSSProperties = { fontSize: 12, color: "#6B7A8D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 };
