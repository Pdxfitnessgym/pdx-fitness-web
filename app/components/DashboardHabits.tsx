"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { gymToday } from "@/lib/time";

type Habit = { id: string; name: string; emoji: string; doneToday: boolean; streak: number };

// Only renders for clients who actually keep habits — otherwise the dashboard
// stays as it was.
export function DashboardHabits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);
  const today = gymToday();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rows } = await supabase
        .from("habits").select("id, name, emoji")
        .eq("client_id", user.id).eq("is_active", true).order("created_at");
      if (!rows?.length) return;

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: logs } = await supabase
        .from("habit_logs").select("habit_id, logged_date")
        .eq("client_id", user.id).gte("logged_date", gymToday(since));

      const byHabit: Record<string, Set<string>> = {};
      for (const l of logs ?? []) {
        (byHabit[l.habit_id] ??= new Set()).add(l.logged_date);
      }

      setHabits(rows.map(h => {
        const dates = byHabit[h.id] ?? new Set<string>();
        const doneToday = dates.has(today);
        // Streak runs back from today, or yesterday if today isn't done yet
        let streak = 0;
        const cursor = new Date();
        if (!doneToday) cursor.setDate(cursor.getDate() - 1);
        while (dates.has(gymToday(cursor)) && streak <= 30) {
          streak++;
          cursor.setDate(cursor.getDate() - 1);
        }
        return { id: h.id, name: h.name, emoji: h.emoji, doneToday, streak };
      }));
    }
    load();
  }, [today]);

  async function toggle(h: Habit) {
    if (toggling) return;
    setToggling(h.id);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setToggling(null); return; }

    if (h.doneToday) {
      await supabase.from("habit_logs").delete()
        .eq("habit_id", h.id).eq("logged_date", today);
    } else {
      await supabase.from("habit_logs")
        .insert({ habit_id: h.id, client_id: user.id, logged_date: today });
    }

    setHabits(prev => prev.map(x => x.id === h.id ? {
      ...x,
      doneToday: !x.doneToday,
      streak: !x.doneToday ? x.streak + 1 : Math.max(0, x.streak - 1),
    } : x));
    setToggling(null);
  }

  if (habits.length === 0) return null;
  const done = habits.filter(h => h.doneToday).length;

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: "1px solid #E2EAF0", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Today&apos;s Habits
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: done === habits.length ? "#10B981" : "#9CA3AF" }}>
          {done}/{habits.length} {done === habits.length ? "✓" : ""}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {habits.map(h => (
          <button
            key={h.id}
            onClick={() => toggle(h)}
            disabled={toggling === h.id}
            style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left",
              background: h.doneToday ? "#F0FDF4" : "#F8FAFB",
              border: `1.5px solid ${h.doneToday ? "#A7F3D0" : "#E2EAF0"}`,
              opacity: toggling === h.id ? 0.6 : 1,
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>{h.emoji}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{h.name}</span>
            {h.streak > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", flexShrink: 0 }}>🔥 {h.streak}</span>
            )}
            <span style={{
              width: 24, height: 24, borderRadius: 12, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#fff",
              background: h.doneToday ? "#10B981" : "#CBD5E1",
            }}>
              {h.doneToday ? "✓" : ""}
            </span>
          </button>
        ))}
      </div>

      <Link href="/client/habits" style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: 13, fontWeight: 700, color: "#2DC4B8", textDecoration: "none" }}>
        All habits →
      </Link>
    </div>
  );
}
