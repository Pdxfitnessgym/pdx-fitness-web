"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";

type SetLog = {
  id: string;
  set_number: number;
  weight_lbs: number | null;
  reps_completed: string | null;
  notes: string | null;
  exercise: { name: string } | null;
};

type WorkoutLog = {
  id: string;
  completed_at: string;
  notes: string | null;
  workout: { id: string; name: string } | null;
  sets: SetLog[];
};

export default function WorkoutHistoryPage() {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: wlogs } = await supabase
        .from("workout_logs")
        .select("id, completed_at, notes, workouts(id, name)")
        .eq("client_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(50);

      if (!wlogs?.length) { setLoading(false); return; }

      const logIds = wlogs.map(l => l.id);
      const { data: sets } = await supabase
        .from("set_logs")
        .select("id, workout_log_id, set_number, weight_lbs, reps_completed, notes, exercises(name)")
        .in("workout_log_id", logIds)
        .order("set_number");

      const setsByLog: Record<string, SetLog[]> = {};
      for (const s of sets ?? []) {
        const lid = (s as any).workout_log_id;
        if (!setsByLog[lid]) setsByLog[lid] = [];
        setsByLog[lid].push({
          id: s.id,
          set_number: s.set_number,
          weight_lbs: s.weight_lbs,
          reps_completed: s.reps_completed,
          notes: s.notes,
          exercise: Array.isArray(s.exercises) ? s.exercises[0] ?? null : s.exercises as any,
        });
      }

      setLogs(wlogs.map(l => ({
        id: l.id,
        completed_at: l.completed_at,
        notes: l.notes,
        workout: Array.isArray(l.workouts) ? l.workouts[0] ?? null : l.workouts as any,
        sets: setsByLog[l.id] ?? [],
      })));
      setLoading(false);
    }
    load();
  }, []);

  function groupByExercise(sets: SetLog[]) {
    const map: Record<string, SetLog[]> = {};
    for (const s of sets) {
      const name = s.exercise?.name ?? "Unknown";
      if (!map[name]) map[name] = [];
      map[name].push(s);
    }
    return map;
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client/workouts" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Workouts</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Workout History</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6B7A8D" }}>Loading...</div>
        ) : !logs.length ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "48px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No workouts yet</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Complete your first workout to see history here</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {logs.map(log => {
              const isOpen = expanded === log.id;
              const exerciseGroups = groupByExercise(log.sets);
              const exerciseNames = Object.keys(exerciseGroups);
              const date = new Date(log.completed_at);
              const dateStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

              return (
                <div key={log.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
                  <div onClick={() => setExpanded(isOpen ? null : log.id)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{log.workout?.name ?? "Workout"}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>{dateStr} · {timeStr}</div>
                      {!isOpen && exerciseNames.length > 0 && (
                        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                          {exerciseNames.slice(0, 3).join(", ")}{exerciseNames.length > 3 ? ` +${exerciseNames.length - 3} more` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ background: "#EBF9F8", color: "#2DC4B8", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
                        {log.sets.length} sets
                      </div>
                      <span style={{ color: "#9CA3AF", fontSize: 18 }}>{isOpen ? "▾" : "›"}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: "1px solid #F4F7FA", padding: "14px 18px" }}>
                      {log.notes && (
                        <div style={{ fontSize: 13, color: "#6B7A8D", background: "#F4F7FA", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>{log.notes}</div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {exerciseNames.map(name => (
                          <div key={name}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827", marginBottom: 8 }}>{name}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {exerciseGroups[name].map((s, i) => (
                                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: i < exerciseGroups[name].length - 1 ? "1px solid #F4F7FA" : "none" }}>
                                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#EBF9F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#2DC4B8", flexShrink: 0 }}>
                                    {s.set_number}
                                  </div>
                                  <div style={{ flex: 1, display: "flex", gap: 16 }}>
                                    {s.weight_lbs != null && (
                                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{s.weight_lbs} <span style={{ fontWeight: 400, color: "#6B7A8D", fontSize: 12 }}>lbs</span></span>
                                    )}
                                    {s.reps_completed != null && (
                                      <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{s.reps_completed} <span style={{ fontWeight: 400, color: "#6B7A8D", fontSize: 12 }}>reps</span></span>
                                    )}
                                    {s.weight_lbs == null && s.reps_completed == null && (
                                      <span style={{ fontSize: 13, color: "#9CA3AF" }}>Completed</span>
                                    )}
                                  </div>
                                  {s.notes && <span style={{ fontSize: 12, color: "#9CA3AF" }}>{s.notes}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {exerciseNames.length === 0 && (
                          <div style={{ fontSize: 13, color: "#9CA3AF" }}>No set data logged</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ClientBottomNav />
    </div>
  );
}
