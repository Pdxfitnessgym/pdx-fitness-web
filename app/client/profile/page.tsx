"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";

type Profile = {
  full_name: string;
  email: string;
  created_at: string;
  trainer_id: string | null;
  sessions_purchased: number;
};

type TrainerInfo = { id: string; full_name: string; email: string };
type ProgramInfo = { name: string; duration_weeks: number; start_date: string };

export default function ClientProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trainer, setTrainer] = useState<TrainerInfo | null>(null);
  const [program, setProgram] = useState<ProgramInfo | null>(null);
  const [logCount, setLogCount] = useState(0);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [lastWorkout, setLastWorkout] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

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

      const [trainerRes, cpRes, logRes, sessRes, lastLogRes] = await Promise.all([
        prof?.trainer_id
          ? supabase.from("profiles").select("id, full_name, email").eq("id", prof.trainer_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("client_programs").select("start_date, programs(name, duration_weeks)").eq("client_id", user.id).eq("is_active", true).maybeSingle(),
        supabase.from("workout_logs").select("*", { count: "exact", head: true }).eq("client_id", user.id),
        supabase.from("training_sessions").select("*", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "completed"),
        supabase.from("workout_logs").select("logged_at").eq("client_id", user.id).order("logged_at", { ascending: false }).limit(1),
      ]);

      setTrainer(trainerRes.data as TrainerInfo | null);
      const cp = cpRes.data;
      if (cp) {
        const prog = cp.programs as unknown as { name: string; duration_weeks: number } | null;
        if (prog) setProgram({ name: prog.name, duration_weeks: prog.duration_weeks, start_date: cp.start_date });
      }
      setLogCount(logRes.count ?? 0);
      setCompletedSessions(sessRes.count ?? 0);

      const lastLog = (lastLogRes.data ?? [])[0] as { logged_at: string } | undefined;
      if (lastLog) {
        const diffDays = Math.floor((Date.now() - new Date(lastLog.logged_at).getTime()) / 86400000);
        setLastWorkout(diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays} days ago`);
      }

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
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D" }}>
      Loading...
    </div>
  );

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  const currentWeek = program
    ? Math.min(Math.max(Math.floor((Date.now() - new Date(program.start_date).getTime()) / 604800000) + 1, 1), program.duration_weeks)
    : null;

  const sessionsPurchased = profile?.sessions_purchased ?? 0;
  const sessionsRemaining = sessionsPurchased - completedSessions;
  const initials = (profile?.full_name ?? "A").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 90 }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0D1827" }}>Profile</div>
          <button onClick={() => setEditing(v => !v)} style={{ fontSize: 13, color: "#1B68B4", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Avatar + name hero */}
        <div style={{ background: "#fff", padding: "32px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", borderBottom: "1px solid #F0F4F8" }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", background: "linear-gradient(135deg, #2DC4B8, #1B68B4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 14, boxShadow: "0 4px 16px rgba(27,104,180,0.25)" }}>
            {initials}
          </div>

          {editing ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") saveName(); }}
                style={{ textAlign: "center", fontSize: 20, fontWeight: 700, color: "#0D1827", border: "none", borderBottom: "2px solid #1B68B4", background: "none", outline: "none", width: "100%", padding: "4px 0" }}
              />
              <button onClick={saveName} disabled={saving || !nameInput.trim()} style={{ padding: "8px 24px", borderRadius: 20, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save Name"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1827", marginBottom: 4 }}>{profile?.full_name}</div>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>{profile?.email}</div>
              <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", borderRadius: 20, padding: "5px 14px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#2DC4B8" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1B68B4" }}>
                  PDX Fitness · Member since {memberSince}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Quick action buttons */}
        <div style={{ background: "#fff", padding: "16px 24px 20px", borderBottom: "8px solid #F4F7FA" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { icon: "💬", label: "Message", href: "/client/messages" },
              { icon: "📆", label: "Book", href: "/client/book" },
              { icon: "📈", label: "Progress", href: "/client/progress" },
              { icon: "🌱", label: "Habits", href: "/client/habits" },
            ].map(item => (
              <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textDecoration: "none", padding: "12px 6px", borderRadius: 12, background: "#F4F7FA", border: "1px solid #E2EAF0" }}>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{item.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Activity section */}
        <div style={{ background: "#fff", marginBottom: 8 }}>
          <div style={{ padding: "16px 20px 4px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>Activity</div>
          </div>
          {[
            { label: "Total Workouts", value: String(logCount), icon: "🏋️" },
            { label: "Sessions Completed", value: String(completedSessions), icon: "✅" },
            { label: "Last Workout", value: lastWorkout ?? "Not yet", icon: "🕐" },
            { label: "Active Program", value: program ? `${program.name} · Wk ${currentWeek}/${program.duration_weeks}` : "None assigned", icon: "📋" },
          ].map((row, i, arr) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < arr.length - 1 ? "1px solid #F4F7FA" : "none" }}>
              <span style={{ fontSize: 18, width: 28, textAlign: "center", flexShrink: 0 }}>{row.icon}</span>
              <span style={{ flex: 1, fontSize: 14, color: "#374151" }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0D1827", textAlign: "right", maxWidth: 160 }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Session credits */}
        {sessionsPurchased > 0 && (
          <div style={{ background: "#fff", marginBottom: 8 }}>
            <div style={{ padding: "16px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>Session Credits</div>
              <Link href="/client/book" style={{ fontSize: 13, fontWeight: 700, color: "#1B68B4", textDecoration: "none" }}>+ Book</Link>
            </div>
            <div style={{ padding: "12px 20px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: "#374151" }}>
                  {sessionsRemaining > 0 ? `${sessionsRemaining} session${sessionsRemaining !== 1 ? "s" : ""} remaining` : "No sessions remaining"}
                </span>
                <span style={{ fontSize: 13, color: "#9CA3AF" }}>{sessionsRemaining} / {sessionsPurchased}</span>
              </div>
              <div style={{ height: 8, background: "#E2EAF0", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, (sessionsRemaining / sessionsPurchased) * 100)}%`, background: sessionsRemaining <= 2 ? "#EF4444" : "#2DC4B8", borderRadius: 99, transition: "width 0.4s" }} />
              </div>
              {sessionsRemaining <= 2 && (
                <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 600, marginTop: 6 }}>Contact your trainer to renew</div>
              )}
            </div>
          </div>
        )}

        {/* My Trainer */}
        <div style={{ background: "#fff", marginBottom: 8 }}>
          <div style={{ padding: "16px 20px 4px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>My Trainer</div>
          </div>
          <div style={{ padding: "12px 20px 20px" }}>
            {trainer ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#1B68B4", flexShrink: 0 }}>
                  {trainer.full_name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{trainer.full_name}</div>
                  <div style={{ fontSize: 13, color: "#6B7A8D" }}>{trainer.email}</div>
                </div>
                <a href="/client/messages" style={{ padding: "8px 16px", borderRadius: 20, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1B68B4", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  Message
                </a>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: "#9CA3AF" }}>No trainer assigned yet</div>
            )}
          </div>
        </div>

        {/* Install App */}
        <div style={{ padding: "0 20px 12px" }}>
          <a
            href="/install"
            style={{ width: "100%", padding: "15px", borderRadius: 14, background: "#0D1827", color: "#2DC4B8", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, textDecoration: "none" }}
          >
            <span style={{ fontSize: 20 }}>📲</span>
            Install App + Enable Notifications
          </a>
        </div>

        {/* Sign out */}
        <div style={{ padding: "0 20px 20px" }}>
          <button
            onClick={handleLogout}
            style={{ width: "100%", padding: "15px", borderRadius: 14, background: "#fff", color: "#DC2626", fontWeight: 700, fontSize: 15, border: "1.5px solid #FEE2E2", cursor: "pointer" }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <ClientBottomNav />
    </div>
  );
}
