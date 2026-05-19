"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const EMOJI_OPTIONS = ["💧", "🏃", "😴", "🥗", "🧘", "💊", "📖", "🚶", "🧴", "🍎", "🏋️", "☀️"];

type Habit = {
  id: string;
  name: string;
  emoji: string;
  streak: number;
  doneToday: boolean;
};

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✅");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  async function fetchHabits() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: habitsData } = await supabase
      .from("habits")
      .select("id, name, emoji")
      .eq("client_id", user.id)
      .eq("is_active", true)
      .order("created_at");

    if (!habitsData) { setLoading(false); return; }

    // fetch logs for past 30 days to calculate streaks + today's state
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: logs } = await supabase
      .from("habit_logs")
      .select("habit_id, logged_date")
      .eq("client_id", user.id)
      .gte("logged_date", since);

    const logMap: Record<string, Set<string>> = {};
    for (const log of logs ?? []) {
      if (!logMap[log.habit_id]) logMap[log.habit_id] = new Set();
      logMap[log.habit_id].add(log.logged_date);
    }

    const result: Habit[] = habitsData.map(h => {
      const dates = logMap[h.id] ?? new Set<string>();
      const doneToday = dates.has(today);

      // calculate streak: consecutive days ending today (or yesterday if not done today)
      let streak = 0;
      const check = new Date();
      if (!doneToday) check.setDate(check.getDate() - 1);
      while (true) {
        const d = check.toISOString().split("T")[0];
        if (!dates.has(d)) break;
        streak++;
        check.setDate(check.getDate() - 1);
        if (streak > 30) break;
      }

      return { id: h.id, name: h.name, emoji: h.emoji, streak, doneToday };
    });

    setHabits(result);
    setLoading(false);
  }

  useEffect(() => { fetchHabits(); }, []);

  async function toggleHabit(habit: Habit) {
    if (toggling) return;
    setToggling(habit.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setToggling(null); return; }

    if (habit.doneToday) {
      await supabase.from("habit_logs").delete()
        .eq("habit_id", habit.id).eq("logged_date", today);
    } else {
      await supabase.from("habit_logs").insert({
        habit_id: habit.id,
        client_id: user.id,
        logged_date: today,
      });
    }

    setHabits(prev => prev.map(h => h.id === habit.id ? {
      ...h,
      doneToday: !h.doneToday,
      streak: !h.doneToday ? h.streak + 1 : Math.max(0, h.streak - 1),
    } : h));
    setToggling(null);
  }

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("habits").insert({ client_id: user.id, name: name.trim(), emoji });
    setName(""); setEmoji("✅"); setShowForm(false);
    await fetchHabits();
    setSaving(false);
  }

  async function deleteHabit(id: string) {
    const supabase = createClient();
    await supabase.from("habits").update({ is_active: false }).eq("id", id);
    setHabits(habits.filter(h => h.id !== id));
  }

  const doneCount = habits.filter(h => h.doneToday).length;
  const allDone = habits.length > 0 && doneCount === habits.length;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Habits</div>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
            {showForm ? "Cancel" : "+ Habit"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Add form */}
        {showForm && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 16 }}>New Habit</div>
            <form onSubmit={addHabit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Drink 8 glasses of water" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Icon</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EMOJI_OPTIONS.map(em => (
                    <button key={em} type="button" onClick={() => setEmoji(em)} style={{ width: 42, height: 42, borderRadius: 10, border: `2px solid ${emoji === em ? "#1B68B4" : "#E2EAF0"}`, background: emoji === em ? "#EFF6FF" : "#F4F7FA", fontSize: 20, cursor: "pointer" }}>
                      {em}
                    </button>
                  ))}
                  <input type="text" value={EMOJI_OPTIONS.includes(emoji) ? "" : emoji} onChange={e => setEmoji(e.target.value || "✅")} placeholder="✏️" maxLength={2} style={{ width: 42, height: 42, borderRadius: 10, border: `2px solid ${!EMOJI_OPTIONS.includes(emoji) ? "#1B68B4" : "#E2EAF0"}`, background: "#F4F7FA", fontSize: 20, textAlign: "center", outline: "none" }} />
                </div>
              </div>
              <button type="submit" disabled={saving || !name.trim()} style={{ padding: "13px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", opacity: saving || !name.trim() ? 0.5 : 1 }}>
                {saving ? "Saving..." : "Add Habit"}
              </button>
            </form>
          </div>
        )}

        {/* Today's progress bar */}
        {habits.length > 0 && (
          <div style={{ background: allDone ? "linear-gradient(135deg, #2DC4B8, #1B68B4)" : "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: allDone ? "#fff" : "#0D1827" }}>
                {allDone ? "All done today! 🎉" : `Today — ${doneCount}/${habits.length} complete`}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: allDone ? "rgba(255,255,255,0.9)" : "#1B68B4" }}>
                {Math.round((doneCount / habits.length) * 100)}%
              </div>
            </div>
            <div style={{ height: 6, background: allDone ? "rgba(255,255,255,0.3)" : "#E2EAF0", borderRadius: 99 }}>
              <div style={{ height: "100%", width: `${(doneCount / habits.length) * 100}%`, background: allDone ? "#fff" : "#2DC4B8", borderRadius: 99, transition: "width 0.4s" }} />
            </div>
          </div>
        )}

        {/* Habit list */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
        ) : habits.length === 0 && !showForm ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "40px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No habits yet</div>
            <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 20 }}>Start small — add one daily habit to build momentum</div>
            <button onClick={() => setShowForm(true)} style={{ padding: "13px 28px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}>
              + Add First Habit
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {habits.map(habit => (
              <div
                key={habit.id}
                style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: `2px solid ${habit.doneToday ? "#A7F3D0" : "#E2EAF0"}`, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "border-color 0.2s" }}
                onClick={() => toggleHabit(habit)}
              >
                {/* Checkbox */}
                <div style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${habit.doneToday ? "#2DC4B8" : "#D1D5DB"}`, background: habit.doneToday ? "#2DC4B8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                  {habit.doneToday && <span style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>✓</span>}
                </div>

                {/* Emoji + name */}
                <div style={{ fontSize: 22, flexShrink: 0 }}>{habit.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: habit.doneToday ? "#6B7A8D" : "#0D1827", textDecoration: habit.doneToday ? "line-through" : "none" }}>
                    {habit.name}
                  </div>
                  {habit.streak > 0 && (
                    <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 700, marginTop: 2 }}>
                      🔥 {habit.streak} day streak
                    </div>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); deleteHabit(habit.id); }}
                  style={{ fontSize: 11, color: "#D1D5DB", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E2EAF0", padding: "8px 20px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { label: "Home", href: "/client", icon: "🏠" },
            { label: "Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "Habits", href: "/client/habits", icon: "🌱", active: true },
            { label: "Progress", href: "/client/progress", icon: "📈" },
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

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" };
