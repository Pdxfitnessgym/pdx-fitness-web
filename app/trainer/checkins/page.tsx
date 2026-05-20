"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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
  client: { id: string; full_name: string | null };
};

const RATING_LABELS: Record<string, string[]> = {
  energy_level:        ["Drained", "Low", "Okay", "Good", "Energized"],
  sleep_quality:       ["Terrible", "Poor", "Okay", "Good", "Great"],
  stress_level:        ["None", "Low", "Moderate", "High", "Maxed out"],
  nutrition_adherence: ["Off track", "Struggled", "Okay", "Mostly on", "Locked in"],
};

const RATING_COLOR = ["#EF4444", "#F59E0B", "#F59E0B", "#10B981", "#10B981"];

function formatWeek(iso: string) {
  const d = new Date(iso + "T12:00:00");
  const end = new Date(d); end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export default function TrainerCheckinsPage() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"unreviewed" | "all">("unreviewed");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("weekly_checkins")
      .select("*, profiles!client_id(id, full_name)")
      .eq("trainer_id", user.id)
      .order("week_start", { ascending: false })
      .order("created_at", { ascending: false });
    setCheckins((data ?? []).map((c: any) => ({
      ...c,
      client: Array.isArray(c.profiles) ? c.profiles[0] : c.profiles,
    })));
    setLoading(false);
  }

  async function saveReply(checkinId: string) {
    const text = replyText[checkinId]?.trim();
    if (!text) return;
    setSaving(checkinId);
    const supabase = createClient();
    await supabase.from("weekly_checkins").update({
      trainer_notes: text,
      trainer_reviewed_at: new Date().toISOString(),
    }).eq("id", checkinId);
    await load();
    setSaving(null);
  }

  async function markReviewed(checkinId: string) {
    const supabase = createClient();
    await supabase.from("weekly_checkins").update({ trainer_reviewed_at: new Date().toISOString() }).eq("id", checkinId);
    setCheckins(prev => prev.map(c => c.id === checkinId ? { ...c, trainer_reviewed_at: new Date().toISOString() } : c));
  }

  const unreviewed = checkins.filter(c => !c.trainer_reviewed_at);
  const displayed = tab === "unreviewed" ? unreviewed : checkins;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Check-ins</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex" }}>
          {([["unreviewed", "Needs Review"], ["all", "All"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, padding: "14px 0", background: "none", border: "none", cursor: "pointer",
              fontWeight: tab === key ? 700 : 500, fontSize: 14,
              color: tab === key ? "#1B68B4" : "#6B7A8D",
              borderBottom: tab === key ? "2.5px solid #1B68B4" : "2.5px solid transparent",
            }}>
              {label}
              {key === "unreviewed" && unreviewed.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 12, background: "#1B68B4", color: "#fff", borderRadius: 10, padding: "2px 7px" }}>{unreviewed.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
        ) : !displayed.length ? (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>
              {tab === "unreviewed" ? "All caught up!" : "No check-ins yet"}
            </div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>
              {tab === "unreviewed" ? "No pending check-ins to review" : "Clients haven't submitted check-ins yet"}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayed.map(c => {
              const isOpen = expanded === c.id;
              return (
                <div key={c.id} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${!c.trainer_reviewed_at ? "#93C5FD" : "#E2EAF0"}`, overflow: "hidden" }}>
                  {/* Header row */}
                  <div onClick={() => setExpanded(isOpen ? null : c.id)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{c.client?.full_name ?? "Client"}</div>
                      <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>{formatWeek(c.week_start)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {!c.trainer_reviewed_at
                        ? <span style={{ fontSize: 11, fontWeight: 700, background: "#DBEAFE", color: "#1B68B4", borderRadius: 20, padding: "3px 10px" }}>New</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, background: "#D1FAE5", color: "#059669", borderRadius: 20, padding: "3px 10px" }}>Reviewed</span>}
                      <span style={{ fontSize: 18, color: "#9CA3AF" }}>{isOpen ? "▾" : "›"}</span>
                    </div>
                  </div>

                  {/* Quick stats row */}
                  {!isOpen && (
                    <div style={{ padding: "0 18px 14px", display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {c.weight_lbs && <span style={{ fontSize: 12, color: "#6B7A8D" }}>⚖️ {c.weight_lbs} lbs</span>}
                      {c.energy_level && <span style={{ fontSize: 12, color: RATING_COLOR[c.energy_level - 1] }}>⚡ Energy {c.energy_level}/5</span>}
                      {c.sleep_quality && <span style={{ fontSize: 12, color: RATING_COLOR[c.sleep_quality - 1] }}>😴 Sleep {c.sleep_quality}/5</span>}
                      {c.workouts_completed != null && <span style={{ fontSize: 12, color: "#6B7A8D" }}>🏋️ {c.workouts_completed} workouts</span>}
                    </div>
                  )}

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ padding: "0 18px 18px", borderTop: "1px solid #F4F7FA" }}>
                      {/* Ratings grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, marginBottom: 14 }}>
                        {[
                          { label: "Energy", val: c.energy_level, field: "energy_level" },
                          { label: "Sleep", val: c.sleep_quality, field: "sleep_quality" },
                          { label: "Stress", val: c.stress_level, field: "stress_level" },
                          { label: "Nutrition", val: c.nutrition_adherence, field: "nutrition_adherence" },
                        ].filter(r => r.val != null).map(r => (
                          <div key={r.label} style={{ background: "#F4F7FA", borderRadius: 10, padding: "10px 14px" }}>
                            <div style={{ fontSize: 11, color: "#6B7A8D", fontWeight: 600, textTransform: "uppercase" }}>{r.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: RATING_COLOR[r.val! - 1] }}>{r.val}<span style={{ fontSize: 12, color: "#9CA3AF" }}>/5</span></div>
                            <div style={{ fontSize: 11, color: "#6B7A8D" }}>{RATING_LABELS[r.field]?.[r.val! - 1]}</div>
                          </div>
                        ))}
                      </div>

                      {c.weight_lbs && (
                        <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 8 }}>⚖️ Weight: <strong style={{ color: "#0D1827" }}>{c.weight_lbs} lbs</strong></div>
                      )}
                      {c.workouts_completed != null && (
                        <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 8 }}>🏋️ Workouts completed: <strong style={{ color: "#0D1827" }}>{c.workouts_completed}</strong></div>
                      )}
                      {c.notes && (
                        <div style={{ background: "#F4F7FA", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#0D1827", marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7A8D", marginBottom: 4 }}>CLIENT NOTE</div>
                          {c.notes}
                        </div>
                      )}
                      {c.photo_url && (
                        <img src={c.photo_url} alt="Progress" style={{ width: "100%", borderRadius: 12, maxHeight: 280, objectFit: "cover", marginBottom: 12 }} />
                      )}

                      {/* Trainer reply */}
                      {c.trainer_notes && !replyText[c.id] ? (
                        <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#1B68B4", marginBottom: 4 }}>YOUR FEEDBACK</div>
                          <div style={{ fontSize: 14, color: "#0D1827" }}>{c.trainer_notes}</div>
                          <button onClick={() => setReplyText(p => ({ ...p, [c.id]: c.trainer_notes! }))} style={{ marginTop: 8, fontSize: 12, color: "#1B68B4", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Edit</button>
                        </div>
                      ) : (
                        <div>
                          <textarea
                            value={replyText[c.id] ?? ""}
                            onChange={e => setReplyText(p => ({ ...p, [c.id]: e.target.value }))}
                            placeholder="Leave feedback for your client..."
                            rows={3}
                            style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 8 }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => saveReply(c.id)}
                              disabled={saving === c.id || !replyText[c.id]?.trim()}
                              style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: (!replyText[c.id]?.trim() || saving === c.id) ? 0.5 : 1 }}
                            >
                              {saving === c.id ? "Saving..." : "Send Feedback"}
                            </button>
                            {!c.trainer_reviewed_at && (
                              <button onClick={() => markReviewed(c.id)} style={{ padding: "11px 16px", borderRadius: 10, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 600, fontSize: 13, border: "1px solid #E2EAF0", cursor: "pointer" }}>
                                Mark Reviewed
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
