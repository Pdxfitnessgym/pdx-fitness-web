"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Profile = {
  full_name: string;
  email: string;
  created_at: string;
};

type Stats = { clients: number; programs: number; exercises: number; workouts: number };

export default function TrainerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({ clients: 0, programs: 0, exercises: 0, workouts: 0 });
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

      const [{ data: p }, { count: cc }, { count: pc }, { count: ec }, { count: wc }] = await Promise.all([
        supabase.from("profiles").select("full_name, email, created_at").eq("id", user.id).single(),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("trainer_id", user.id),
        supabase.from("programs").select("*", { count: "exact", head: true }).eq("trainer_id", user.id),
        supabase.from("exercise_library").select("*", { count: "exact", head: true }).eq("trainer_id", user.id),
        supabase.from("workouts").select("*", { count: "exact", head: true }).eq("trainer_id", user.id).eq("is_standalone", true),
      ]);

      setProfile(p as Profile);
      setNameInput((p as Profile)?.full_name ?? "");
      setStats({ clients: cc ?? 0, programs: pc ?? 0, exercises: ec ?? 0, workouts: wc ?? 0 });
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

  const initial = (profile?.full_name ?? "T")[0].toUpperCase();

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 40 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Profile</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Hero card */}
        <div style={{ background: "#1B68B4", borderRadius: 16, padding: "28px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: editing ? 16 : 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {initial}
            </div>
            <div style={{ flex: 1 }}>
              {editing ? null : (
                <>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{profile?.full_name}</div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{profile?.email}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>Trainer · {memberSince}</div>
                </>
              )}
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
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
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>Email</label>
                <div style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{profile?.email}</div>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Clients", value: stats.clients, href: "/trainer/clients" },
            { label: "Programs", value: stats.programs, href: "/trainer/programs" },
            { label: "Exercises", value: stats.exercises, href: "/trainer/exercises" },
            { label: "On-Demand", value: stats.workouts, href: "/trainer/workouts" },
          ].map(s => (
            <Link key={s.label} href={s.href} style={{ background: "#fff", borderRadius: 14, padding: "14px 8px", border: "1px solid #E2EAF0", textDecoration: "none", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#1B68B4" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </Link>
          ))}
        </div>

        {/* Quick links */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
          {[
            { label: "My Clients", href: "/trainer/clients", icon: "👥" },
            { label: "My Programs", href: "/trainer/programs", icon: "📋" },
            { label: "Exercise Library", href: "/trainer/exercises", icon: "🏋️" },
            { label: "On-Demand Workouts", href: "/trainer/workouts", icon: "⚡" },
            { label: "Session Calendar", href: "/trainer/calendar", icon: "📅" },
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
    </div>
  );
}
