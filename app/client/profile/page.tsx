"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Profile = {
  full_name: string;
  email: string;
  created_at: string;
  trainer_id: string | null;
  sessions_purchased: number;
};

type TrainerInfo = { full_name: string; email: string };
type ProgramInfo = { name: string; duration_weeks: number; start_date: string };

export default function ClientProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trainer, setTrainer] = useState<TrainerInfo | null>(null);
  const [program, setProgram] = useState<ProgramInfo | null>(null);
  const [logCount, setLogCount] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email, created_at, trainer_id, sessions_purchased")
        .eq("id", user.id)
        .single();

      const prof = p as Profile;
      setProfile(prof);
      setNameInput(prof?.full_name ?? "");

      const [trainerRes, cpRes, logRes, sessRes] = await Promise.all([
        prof?.trainer_id
          ? supabase.from("profiles").select("full_name, email").eq("id", prof.trainer_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("client_programs").select("start_date, programs(name, duration_weeks)").eq("client_id", user.id).eq("is_active", true).maybeSingle(),
        supabase.from("workout_logs").select("*", { count: "exact", head: true }).eq("client_id", user.id),
        supabase.from("training_sessions").select("*", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "completed"),
      ]);

      setTrainer(trainerRes.data as TrainerInfo | null);
      const cp = cpRes.data;
      if (cp) {
        const prog = cp.programs as unknown as { name: string; duration_weeks: number } | null;
        if (prog) setProgram({ name: prog.name, duration_weeks: prog.duration_weeks, start_date: cp.start_date });
      }
      setLogCount(logRes.count ?? 0);
      setCompletedSessions(sessRes.count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  async function saveName() {
    if (!nameInput.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("profiles").update({ full_name: nameInput.trim() }).eq("id", user.id);
    setProfile(p => p ? { ...p, full_name: nameInput.trim() } : p);
    setSaving(false);
    setEditing(false);
    setSaveMsg("Saved!");
    setTimeout(() => setSaveMsg(""), 2000);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) return <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D" }}>Loading...</div>;

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  const currentWeek = program
    ? Math.min(Math.max(Math.floor((Date.now() - new Date(program.start_date).getTime()) / 604800000) + 1, 1), program.duration_weeks)
    : null;

  const sessionsRemaining = (profile?.sessions_purchased ?? 0) - completedSessions;
  const initial = (profile?.full_name ?? "A")[0].toUpperCase();

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Profile</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Hero card */}
        <div style={{ background: "linear-gradient(135deg, #2DC4B8, #1B68B4)", borderRadius: 16, padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: editing ? 16 : 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {initial}
            </div>
            <div style={{ flex: 1 }}>
              {!editing && (
                <>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{profile?.full_name}</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{profile?.email}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>Member since {memberSince}</div>
                </>
              )}
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.35)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Edit
              </button>
            )}
          </div>

          {editing && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Display Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditing(false); }}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Email</label>
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{profile?.email}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveName} disabled={saving || !nameInput.trim()} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#fff", color: "#1B68B4", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saving ? "Saving..." : "Save"}
                </button>
                <button onClick={() => { setEditing(false); setNameInput(profile?.full_name ?? ""); }} style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 600, fontSize: 14, border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {saveMsg && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", marginTop: 8 }}>✓ {saveMsg}</div>}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "14px 8px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1B68B4" }}>{logCount}</div>
            <div style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4 }}>Workouts</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "14px 8px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: currentWeek ? "#1B68B4" : "#D1D5DB" }}>{currentWeek ?? "—"}</div>
            <div style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4 }}>Current Wk</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "14px 8px", border: `1px solid ${sessionsRemaining <= 2 && (profile?.sessions_purchased ?? 0) > 0 ? "#FEE2E2" : "#E2EAF0"}`, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: sessionsRemaining <= 2 && (profile?.sessions_purchased ?? 0) > 0 ? "#EF4444" : "#1B68B4" }}>
              {(profile?.sessions_purchased ?? 0) > 0 ? sessionsRemaining : "—"}
            </div>
            <div style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4 }}>Sessions Left</div>
          </div>
        </div>

        {/* Active program */}
        {program && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Active Program</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0D1827" }}>{program.name}</div>
            <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 4 }}>
              Week {currentWeek} of {program.duration_weeks} · started {new Date(program.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
            <Link href="/client/workouts" style={{ display: "inline-block", marginTop: 10, fontSize: 14, fontWeight: 700, color: "#2DC4B8", textDecoration: "none" }}>
              Go to workouts →
            </Link>
          </div>
        )}

        {/* Trainer */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>My Trainer</div>
          {trainer ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#1B68B4", flexShrink: 0 }}>
                {trainer.full_name[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{trainer.full_name}</div>
                <div style={{ fontSize: 13, color: "#6B7A8D" }}>{trainer.email}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#9CA3AF" }}>No trainer assigned yet</div>
          )}
        </div>

        {/* Quick links */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
          {[
            { label: "My Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "My Progress", href: "/client/progress", icon: "📈" },
            { label: "Habits", href: "/client/habits", icon: "🌱" },
            { label: "Community Feed", href: "/client/feed", icon: "🔥" },
          ].map((item, i, arr) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", textDecoration: "none", borderBottom: i < arr.length - 1 ? "1px solid #F4F7FA" : "none" }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{item.label}</span>
              <span style={{ color: "#9CA3AF", fontSize: 18 }}>›</span>
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          style={{ width: "100%", padding: "15px", borderRadius: 14, background: "#fff", color: "#DC2626", fontWeight: 700, fontSize: 16, border: "1.5px solid #FEE2E2", cursor: "pointer" }}
        >
          Sign Out
        </button>
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E2EAF0", padding: "8px 20px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
          {[
            { label: "Home", href: "/client", icon: "🏠" },
            { label: "Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "Habits", href: "/client/habits", icon: "🌱" },
            { label: "Progress", href: "/client/progress", icon: "📈" },
            { label: "Profile", href: "/client/profile", icon: "👤", active: true },
          ].map(item => (
            <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", padding: "6px 0" }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 10, color: (item as any).active ? "#2DC4B8" : "#6B7A8D", marginTop: 3, fontWeight: (item as any).active ? 700 : 400 }}>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
