"use client";
import { useState } from "react";

type SetLog = {
  id: string;
  exercise_id: string;
  set_number: number;
  weight_lbs: number | null;
  reps_completed: number | null;
  side: string | null;
  exercises: { name: string } | null;
};

type WorkoutLog = {
  id: string;
  completed_at: string | null;
  created_at: string;
  notes: string | null;
  logged_by: string | null;
  workouts: { name: string } | null;
  set_logs: SetLog[];
};

export function WorkoutLogCards({ logs }: { logs: WorkoutLog[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setExpanded(p => ({ ...p, [id]: !p[id] }));
  }

  function formatDate(log: WorkoutLog) {
    const iso = log.completed_at ?? log.created_at;
    return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  // Group set_logs by exercise name, preserving order
  function groupSets(sets: SetLog[]) {
    const order: string[] = [];
    const map: Record<string, SetLog[]> = {};
    sets.forEach(s => {
      const name = s.exercises?.name ?? "Unknown";
      if (!map[name]) { map[name] = []; order.push(name); }
      map[name].push(s);
    });
    return order.map(name => ({ name, sets: map[name].sort((a, b) => a.set_number - b.set_number) }));
  }

  if (logs.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 14, padding: "48px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🏋️</div>
        <div style={{ fontWeight: 600, color: "#0D1827" }}>No workouts logged yet</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {logs.map(log => {
        const open = expanded[log.id] ?? false;
        const groups = groupSets(log.set_logs ?? []);
        const hasData = groups.length > 0;
        const workoutName = log.workouts?.name ?? "Workout";

        return (
          <div key={log.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
            {/* Header row — always visible, tap to expand */}
            <button
              onClick={() => toggle(log.id)}
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>{workoutName}</span>
                  {log.logged_by && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#2DC4B8", background: "#F0FDFC", border: "1px solid #A7F3D0", borderRadius: 6, padding: "2px 6px" }}>Trainer</span>
                  )}
                  {!log.completed_at && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "2px 6px" }}>In Progress</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 3 }}>
                  {formatDate(log)}
                  {hasData && ` · ${groups.length} exercises · ${(log.set_logs ?? []).length} sets`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                {hasData && (
                  <span style={{ fontSize: 12, color: "#2DC4B8", fontWeight: 600 }}>
                    {open ? "Hide" : "View"} Summary
                  </span>
                )}
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{open ? "▲" : "▼"}</span>
              </div>
            </button>

            {/* Expanded summary */}
            {open && (
              <div style={{ borderTop: "1px solid #F4F7FA", padding: "12px 16px 16px" }}>
                {!hasData ? (
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>No set data recorded for this session.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {groups.map(({ name, sets }) => {
                      // Build volume summary: best weight, total reps
                      const weights = sets.map(s => s.weight_lbs).filter((w): w is number => w != null && w > 0);
                      const topWeight = weights.length > 0 ? Math.max(...weights) : null;

                      return (
                        <div key={name}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#1B68B4" }}>{name}</span>
                            {topWeight != null && (
                              <span style={{ fontSize: 12, color: "#6B7A8D" }}>Top: <strong style={{ color: "#0D1827" }}>{topWeight} lbs</strong></span>
                            )}
                          </div>

                          {/* Set table */}
                          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr", gap: 4 }}>
                            <div style={colHdr}>Set</div>
                            <div style={colHdr}>Weight</div>
                            <div style={colHdr}>Reps</div>
                            {sets.map(s => {
                              const sideLabel = s.side && s.side !== "both" ? ` (${s.side[0].toUpperCase()})` : "";
                              return (
                                <>
                                  <div key={`set-${s.id}`} style={cell}>{s.set_number}{sideLabel}</div>
                                  <div key={`w-${s.id}`} style={cell}>{s.weight_lbs != null && s.weight_lbs > 0 ? `${s.weight_lbs} lbs` : "BW"}</div>
                                  <div key={`r-${s.id}`} style={cell}>{s.reps_completed ?? "—"}</div>
                                </>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {log.notes && (
                      <div style={{ fontSize: 13, color: "#6B7A8D", fontStyle: "italic", borderTop: "1px solid #F4F7FA", paddingTop: 10 }}>
                        Notes: {log.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const colHdr: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4, paddingBottom: 4 };
const cell: React.CSSProperties = { fontSize: 14, color: "#0D1827", padding: "4px 0", borderBottom: "1px solid #F4F7FA" };
