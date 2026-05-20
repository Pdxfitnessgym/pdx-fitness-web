"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";

type Checkin = {
  id: string;
  week_start: string;
  weight_lbs: number | null;
  energy_level: number | null;
  sleep_quality: number | null;
  stress_level: number | null;
  workouts_completed: number | null;
  nutrition_adherence: number | null;
  notes: string | null;
  photo_url: string | null;
  trainer_notes: string | null;
  trainer_reviewed_at: string | null;
};

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split("T")[0];
}

function formatWeek(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

const RATING_LABELS: Record<string, string[]> = {
  energy_level:        ["Drained", "Low", "Okay", "Good", "Energized"],
  sleep_quality:       ["Terrible", "Poor", "Okay", "Good", "Great"],
  stress_level:        ["None", "Low", "Moderate", "High", "Maxed out"],
  nutrition_adherence: ["Off track", "Struggled", "Okay", "Mostly on", "Locked in"],
};

function StarRating({ field, value, onChange }: { field: string; value: number; onChange: (v: number) => void }) {
  const labels = RATING_LABELS[field] ?? [];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            background: value >= n ? "#1B68B4" : "#F4F7FA",
            border: `1.5px solid ${value >= n ? "#1B68B4" : "#E2EAF0"}`,
            color: value >= n ? "#fff" : "#9CA3AF",
            fontWeight: 700, fontSize: 16, cursor: "pointer",
          }}>{n}</button>
        ))}
      </div>
      {value > 0 && <div style={{ fontSize: 12, color: "#2DC4B8", fontWeight: 600, textAlign: "center" }}>{labels[value - 1]}</div>}
    </div>
  );
}

export default function CheckinPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [existing, setExisting] = useState<Checkin | null>(null);
  const [pastCheckins, setPastCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [trainerId, setTrainerId] = useState<string | null>(null);

  const weekStart = getWeekStart();

  const [weight, setWeight] = useState("");
  const [energy, setEnergy] = useState(0);
  const [sleep, setSleep] = useState(0);
  const [stress, setStress] = useState(0);
  const [workouts, setWorkouts] = useState("");
  const [nutrition, setNutrition] = useState(0);
  const [notes, setNotes] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("trainer_id").eq("id", user.id).single();
    setTrainerId(profile?.trainer_id ?? null);

    const [{ data: thisWeek }, { data: past }] = await Promise.all([
      supabase.from("weekly_checkins").select("*").eq("client_id", user.id).eq("week_start", weekStart).maybeSingle(),
      supabase.from("weekly_checkins").select("*").eq("client_id", user.id).neq("week_start", weekStart).order("week_start", { ascending: false }).limit(6),
    ]);

    if (thisWeek) {
      setExisting(thisWeek);
      prefillForm(thisWeek);
    }
    setPastCheckins(past ?? []);
    setLoading(false);
  }

  function prefillForm(c: Checkin) {
    setWeight(c.weight_lbs != null ? String(c.weight_lbs) : "");
    setEnergy(c.energy_level ?? 0);
    setSleep(c.sleep_quality ?? 0);
    setStress(c.stress_level ?? 0);
    setWorkouts(c.workouts_completed != null ? String(c.workouts_completed) : "");
    setNutrition(c.nutrition_adherence ?? 0);
    setNotes(c.notes ?? "");
    setPhotoPreview(c.photo_url ?? null);
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10485760) { setError("Photo must be under 10MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true); setError("");

    const supabase = createClient();
    let photo_url = existing?.photo_url ?? null;

    if (photoFile) {
      const ext = photoFile.name.split(".").pop();
      const path = `${userId}/${weekStart}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("progress-photos").upload(path, photoFile, { upsert: true, contentType: photoFile.type });
      if (uploadErr) { setError("Photo upload failed"); setSaving(false); return; }
      photo_url = supabase.storage.from("progress-photos").getPublicUrl(path).data.publicUrl;
    }

    const row = {
      client_id: userId,
      trainer_id: trainerId,
      week_start: weekStart,
      weight_lbs: weight ? parseFloat(weight) : null,
      energy_level: energy || null,
      sleep_quality: sleep || null,
      stress_level: stress || null,
      workouts_completed: workouts ? parseInt(workouts) : null,
      nutrition_adherence: nutrition || null,
      notes: notes.trim() || null,
      photo_url,
    };

    const { error: dbErr } = await supabase.from("weekly_checkins").upsert(row, { onConflict: "client_id,week_start" });
    if (dbErr) { setError("Save failed: " + dbErr.message); setSaving(false); return; }

    if (!existing && trainerId) {
      fetch("/api/push/checkin-submitted", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trainerId }) }).catch(() => {});
    }

    await load();
    setEditing(false);
    setSaving(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#6B7A8D", fontSize: 14 }}>Loading...</div>
    </div>
  );

  const showForm = !existing || editing;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Weekly Check-in</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>{formatWeek(weekStart)}</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* This week submitted — show summary */}
        {existing && !editing && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1.5px solid #2DC4B8" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2DC4B8", textTransform: "uppercase", letterSpacing: 1 }}>✓ Submitted this week</div>
                {existing.weight_lbs && <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1827", marginTop: 4 }}>{existing.weight_lbs} <span style={{ fontSize: 14, fontWeight: 400, color: "#6B7A8D" }}>lbs</span></div>}
              </div>
              <button onClick={() => setEditing(true)} style={{ padding: "8px 14px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", fontSize: 13, fontWeight: 600, color: "#6B7A8D", cursor: "pointer" }}>Edit</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[
                { label: "Energy", val: existing.energy_level, field: "energy_level" },
                { label: "Sleep", val: existing.sleep_quality, field: "sleep_quality" },
                { label: "Stress", val: existing.stress_level, field: "stress_level" },
                { label: "Nutrition", val: existing.nutrition_adherence, field: "nutrition_adherence" },
              ].filter(r => r.val != null).map(r => (
                <div key={r.label} style={{ background: "#F4F7FA", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#6B7A8D", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1827", marginTop: 2 }}>{r.val}<span style={{ fontSize: 12, color: "#9CA3AF" }}>/5</span></div>
                  <div style={{ fontSize: 11, color: "#2DC4B8" }}>{RATING_LABELS[r.field]?.[r.val! - 1]}</div>
                </div>
              ))}
            </div>

            {existing.workouts_completed != null && (
              <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 8 }}>🏋️ {existing.workouts_completed} workout{existing.workouts_completed !== 1 ? "s" : ""} completed</div>
            )}
            {existing.notes && <div style={{ fontSize: 14, color: "#0D1827", background: "#F4F7FA", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>{existing.notes}</div>}
            {existing.photo_url && <img src={existing.photo_url} alt="Check-in photo" style={{ width: "100%", borderRadius: 12, maxHeight: 240, objectFit: "cover", marginBottom: 12 }} />}

            {/* Trainer response */}
            {existing.trainer_notes && (
              <div style={{ background: "#EFF6FF", borderRadius: 12, padding: "12px 16px", border: "1px solid #BFDBFE" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1B68B4", marginBottom: 6 }}>💬 Trainer Feedback</div>
                <div style={{ fontSize: 14, color: "#0D1827" }}>{existing.trainer_notes}</div>
              </div>
            )}
            {!existing.trainer_notes && (
              <div style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>Waiting for trainer feedback...</div>
            )}
          </div>
        )}

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "12px 16px", borderRadius: 10, fontSize: 14 }}>{error}</div>}

            <div style={cardStyle}>
              <label style={labelStyle}>Weight <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span></label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="text" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 175.5" style={{ ...inputStyle, flex: 1 }} />
                <span style={{ fontSize: 14, color: "#6B7A8D", fontWeight: 600 }}>lbs</span>
              </div>
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Energy Level</label>
              <StarRating field="energy_level" value={energy} onChange={setEnergy} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Sleep Quality</label>
              <StarRating field="sleep_quality" value={sleep} onChange={setSleep} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Stress Level</label>
              <StarRating field="stress_level" value={stress} onChange={setStress} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Nutrition Adherence</label>
              <StarRating field="nutrition_adherence" value={nutrition} onChange={setNutrition} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Workouts Completed This Week</label>
              <input type="text" inputMode="numeric" value={workouts} onChange={e => setWorkouts(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 4" style={inputStyle} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Notes for your trainer <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How are you feeling? Any soreness, wins, struggles this week?" rows={3} style={{ ...inputStyle, resize: "none" }} />
            </div>

            <div style={cardStyle}>
              <label style={labelStyle}>Progress Photo <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span></label>
              {photoPreview
                ? <div style={{ position: "relative" }}>
                    <img src={photoPreview} alt="preview" style={{ width: "100%", borderRadius: 10, maxHeight: 240, objectFit: "cover" }} />
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                : <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed #E2EAF0", borderRadius: 12, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: "#F4F7FA" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                    <div style={{ fontSize: 13, color: "#6B7A8D" }}>Tap to add photo</div>
                  </div>}
              <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoChange} style={{ display: "none" }} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {editing && <button type="button" onClick={() => setEditing(false)} style={{ flex: 1, padding: "14px", borderRadius: 12, background: "#F4F7FA", border: "1px solid #E2EAF0", fontWeight: 600, fontSize: 15, cursor: "pointer", color: "#6B7A8D" }}>Cancel</button>}
              <button type="submit" disabled={saving} style={{ flex: 2, padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving..." : existing ? "Update Check-in" : "Submit Check-in →"}
              </button>
            </div>
          </form>
        )}

        {/* Past check-ins */}
        {pastCheckins.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Past Check-ins</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pastCheckins.map(c => (
                <div key={c.id} style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{formatWeek(c.week_start)}</div>
                    {c.trainer_reviewed_at
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: "#059669", background: "#D1FAE5", borderRadius: 20, padding: "2px 8px" }}>Reviewed</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", background: "#F4F7FA", borderRadius: 20, padding: "2px 8px" }}>Pending</span>}
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {c.weight_lbs && <span style={{ fontSize: 13, color: "#6B7A8D" }}>⚖️ {c.weight_lbs} lbs</span>}
                    {c.energy_level && <span style={{ fontSize: 13, color: "#6B7A8D" }}>⚡ Energy {c.energy_level}/5</span>}
                    {c.workouts_completed != null && <span style={{ fontSize: 13, color: "#6B7A8D" }}>🏋️ {c.workouts_completed} workouts</span>}
                  </div>
                  {c.trainer_notes && (
                    <div style={{ marginTop: 8, background: "#EFF6FF", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#1B68B4" }}>💬 {c.trainer_notes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ClientBottomNav />
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#0D1827", marginBottom: 10 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" };
