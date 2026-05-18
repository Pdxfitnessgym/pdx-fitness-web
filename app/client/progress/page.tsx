"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Log = {
  id: string;
  logged_at: string;
  weight_lbs: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  photo_url: string | null;
};

export default function ProgressPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logs, setLogs] = useState<Log[]>([]);
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

  async function fetchLogs() {
    const supabase = createClient();
    const { data } = await supabase
      .from("progress_logs")
      .select("id, logged_at, weight_lbs, body_fat_pct, notes, photo_url")
      .order("logged_at", { ascending: false })
      .limit(50);
    setLogs((data ?? []) as Log[]);
    setLoading(false);
  }

  useEffect(() => { fetchLogs(); }, []);

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
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let photo_url: string | null = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("progress-photos")
          .upload(path, photoFile, { contentType: photoFile.type });
        if (uploadErr) { setError("Photo upload failed"); setSaving(false); return; }
        photo_url = supabase.storage.from("progress-photos").getPublicUrl(path).data.publicUrl;
      }

      const { error: dbErr } = await supabase.from("progress_logs").insert({
        client_id: user.id,
        logged_at: date,
        weight_lbs: weight ? parseFloat(weight) : null,
        body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
        notes: notes.trim() || null,
        photo_url,
      });
      if (dbErr) { setError("Save failed: " + dbErr.message); setSaving(false); return; }

      setWeight(""); setBodyFat(""); setNotes(""); setPhotoFile(null); setPhotoPreview(null);
      setDate(new Date().toISOString().split("T")[0]);
      setShowForm(false);
      await fetchLogs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(id: string) {
    const supabase = createClient();
    await supabase.from("progress_logs").delete().eq("id", id);
    setLogs(logs.filter(l => l.id !== id));
  }

  const latestWeight = logs.find(l => l.weight_lbs != null)?.weight_lbs ?? null;
  const latestBf = logs.find(l => l.body_fat_pct != null)?.body_fat_pct ?? null;
  const prevWeight = logs.filter(l => l.weight_lbs != null)[1]?.weight_lbs ?? null;
  const prevBf = logs.filter(l => l.body_fat_pct != null)[1]?.body_fat_pct ?? null;

  function trend(curr: number | null, prev: number | null, lowerIsBetter = false) {
    if (curr == null || prev == null) return null;
    const diff = curr - prev;
    if (Math.abs(diff) < 0.1) return null;
    const good = lowerIsBetter ? diff < 0 : diff > 0;
    return { diff: Math.abs(diff).toFixed(1), up: diff > 0, good };
  }

  const wTrend = trend(latestWeight, prevWeight, false);
  const bTrend = trend(latestBf, prevBf, true);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Progress</div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
          >
            {showForm ? "Cancel" : "+ Log"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Stats summary */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCard
            label="Body Weight"
            value={latestWeight != null ? `${latestWeight} lbs` : "—"}
            trend={wTrend}
          />
          <StatCard
            label="Body Fat"
            value={latestBf != null ? `${latestBf}%` : "—"}
            trend={bTrend}
          />
        </div>

        {/* Log form */}
        {showForm && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 16 }}>New Entry</div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {error && <div style={{ background: "#FEE2E2", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>{error}</div>}

              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Weight (lbs)</label>
                  <input type="number" step="0.1" min="0" value={weight} onChange={e => setWeight(e.target.value)} placeholder="185.0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Body Fat %</label>
                  <input type="number" step="0.1" min="0" max="100" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="18.5" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Notes <span style={{ color: "#6B7A8D", fontWeight: 400 }}>(optional)</span></label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How are you feeling? Any observations..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              {/* Photo */}
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

              <button type="submit" disabled={saving} style={{ padding: "13px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving..." : "Save Entry"}
              </button>
            </form>
          </div>
        )}

        {/* History */}
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
            <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>History</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {logs.map((log, i) => {
                const prevLog = logs[i + 1];
                const wDiff = log.weight_lbs != null && prevLog?.weight_lbs != null ? log.weight_lbs - prevLog.weight_lbs : null;
                const bDiff = log.body_fat_pct != null && prevLog?.body_fat_pct != null ? log.body_fat_pct - prevLog.body_fat_pct : null;
                return (
                  <div key={log.id} style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1B68B4" }}>
                        {new Date(log.logged_at + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <button onClick={() => deleteLog(log.id)} style={{ fontSize: 11, color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>Delete</button>
                    </div>

                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {log.weight_lbs != null && (
                        <div>
                          <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 2 }}>Weight</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: "#0D1827" }}>{log.weight_lbs}</span>
                            <span style={{ fontSize: 12, color: "#6B7A8D" }}>lbs</span>
                            {wDiff != null && Math.abs(wDiff) >= 0.1 && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: wDiff < 0 ? "#2DC4B8" : "#F59E0B" }}>
                                {wDiff > 0 ? "+" : ""}{wDiff.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {log.body_fat_pct != null && (
                        <div>
                          <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 2 }}>Body Fat</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: "#0D1827" }}>{log.body_fat_pct}</span>
                            <span style={{ fontSize: 12, color: "#6B7A8D" }}>%</span>
                            {bDiff != null && Math.abs(bDiff) >= 0.1 && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: bDiff < 0 ? "#2DC4B8" : "#F59E0B" }}>
                                {bDiff > 0 ? "+" : ""}{bDiff.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {log.notes && (
                      <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 8, lineHeight: 1.4 }}>{log.notes}</div>
                    )}

                    {log.photo_url && (
                      <img
                        src={log.photo_url}
                        alt="progress"
                        onClick={() => setLightbox(log.photo_url)}
                        style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginTop: 10, cursor: "pointer" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <img src={lightbox} alt="progress" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }} />
        </div>
      )}

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E2EAF0", padding: "8px 20px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { label: "Home", href: "/client", icon: "🏠" },
            { label: "Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "Progress", href: "/client/progress", icon: "📈", active: true },
            { label: "Profile", href: "/client/profile", icon: "👤" },
          ].map(item => (
            <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", padding: "6px 0" }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: item.active ? "#2DC4B8" : "#6B7A8D", marginTop: 4, fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, trend }: { label: string; value: string; trend: { diff: string; up: boolean; good: boolean } | null }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
      <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1827" }}>{value}</div>
      {trend && (
        <div style={{ fontSize: 12, fontWeight: 700, color: trend.good ? "#2DC4B8" : "#F59E0B", marginTop: 4 }}>
          {trend.up ? "↑" : "↓"} {trend.diff} from last
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" };
