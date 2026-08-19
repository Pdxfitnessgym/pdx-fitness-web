import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { assignProgram } from "@/app/actions/clients";
import Link from "next/link";
import { SessionsPanel } from "@/app/components/SessionsPanel";
import { ClientNotesEditor } from "@/app/components/ClientNotesEditor";
import { WorkoutLogCards } from "@/app/components/WorkoutLogCards";
import { ProgramSelect } from "@/app/components/ProgramSelect";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "workouts", label: "Workouts" },
  { key: "progress", label: "Progress" },
  { key: "goals", label: "Goals" },
  { key: "habits", label: "Habits" },
  { key: "notes", label: "Notes" },
];

const DIFF_COLORS: Record<string, string> = {
  weight: "#1B68B4",
  body_fat: "#2DC4B8",
  strength: "#F59E0B",
  custom: "#6366F1",
};

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trainerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (trainerProfile && trainerProfile.role !== "trainer") redirect("/client");

  const { clientId } = await params;
  const sp = await searchParams;
  const tab = sp.tab ?? "overview";

  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name, email, trainer_id, sessions_purchased, client_notes")
    .eq("id", clientId)
    .single();

  if (!client || client.trainer_id !== user.id) redirect("/trainer/clients");

  // Always fetch for header stats
  const [{ count: logCount }, { data: activeProgram }] = await Promise.all([
    supabase.from("workout_logs").select("*", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("client_programs").select("id, start_date, program_id, programs(name, duration_weeks)").eq("client_id", clientId).eq("is_active", true).maybeSingle(),
  ]);

  // Tab-specific data
  let programs = null, trainingSessions = null, completedCount = 0;
  let workoutLogs = null;
  let progressLogs: { id: string; logged_at: string; weight_lbs: number | null; body_fat_pct: number | null; notes: string | null; photo_url: string | null }[] | null = null;
  let prs: { exercise_name: string; best_weight: number; best_reps: string | null }[] = [];
  let goals = null;
  let habits = null;
  let habitLogs: { habit_id: string; logged_date: string }[] | null = null;

  if (tab === "overview") {
    const [p, ts] = await Promise.all([
      supabase.from("programs").select("id, name, duration_weeks").eq("trainer_id", user.id).order("name"),
      supabase.from("training_sessions").select("id, scheduled_at, status, notes").eq("client_id", clientId).order("scheduled_at", { ascending: false }).limit(20),
    ]);
    programs = p.data;
    trainingSessions = ts.data ?? [];
    completedCount = (trainingSessions ?? []).filter((s: { status: string }) => s.status === "completed").length;
  }

  if (tab === "workouts") {
    const { data } = await supabase
      .from("workout_logs")
      .select(`
        id, completed_at, created_at, notes, logged_by,
        workouts(name),
        set_logs(id, exercise_id, set_number, weight_lbs, reps_completed, side, exercises(name))
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);
    workoutLogs = data;
  }

  if (tab === "progress") {
    const [plRes, setRes] = await Promise.all([
      supabase.from("progress_logs").select("id, logged_at, weight_lbs, body_fat_pct, notes, photo_url").eq("client_id", clientId).order("logged_at", { ascending: false }).limit(50),
      supabase.from("set_logs").select("weight_lbs, reps_completed, created_at, exercises(name)").eq("client_id", clientId).not("weight_lbs", "is", null).order("weight_lbs", { ascending: false }),
    ]);
    progressLogs = plRes.data;

    const best: Record<string, typeof prs[0]> = {};
    for (const row of setRes.data ?? []) {
      const name = (row.exercises as unknown as { name: string } | null)?.name;
      if (!name) continue;
      const w = row.weight_lbs as number;
      if (!best[name] || w > best[name].best_weight) {
        best[name] = { exercise_name: name, best_weight: w, best_reps: row.reps_completed };
      }
    }
    prs = Object.values(best).sort((a, b) => b.best_weight - a.best_weight);
  }

  if (tab === "goals") {
    const [goalsRes, plRes, setRes] = await Promise.all([
      supabase.from("goals").select("id, type, title, start_value, target_value, exercise_name, target_date, completed").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("progress_logs").select("id, logged_at, weight_lbs, body_fat_pct, notes, photo_url").eq("client_id", clientId).order("logged_at", { ascending: false }).limit(50),
      supabase.from("set_logs").select("weight_lbs, reps_completed, created_at, exercises(name)").eq("client_id", clientId).not("weight_lbs", "is", null).order("weight_lbs", { ascending: false }),
    ]);
    goals = goalsRes.data;
    progressLogs = plRes.data;
    const best: Record<string, typeof prs[0]> = {};
    for (const row of setRes.data ?? []) {
      const name = (row.exercises as unknown as { name: string } | null)?.name;
      if (!name) continue;
      const w = row.weight_lbs as number;
      if (!best[name] || w > best[name].best_weight) {
        best[name] = { exercise_name: name, best_weight: w, best_reps: row.reps_completed };
      }
    }
    prs = Object.values(best).sort((a, b) => b.best_weight - a.best_weight);
  }

  if (tab === "habits") {
    const { data: hData } = await supabase.from("habits").select("id, name, emoji, is_active").eq("client_id", clientId).eq("is_active", true).order("created_at");
    habits = hData;

    if (hData && hData.length > 0) {
      const thirtyAgo = new Date();
      thirtyAgo.setDate(thirtyAgo.getDate() - 30);
      const { data: hlData } = await supabase.from("habit_logs").select("habit_id, logged_date").eq("client_id", clientId).gte("logged_date", thirtyAgo.toISOString().split("T")[0]);
      habitLogs = hlData;
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const prog = activeProgram?.programs as unknown as { name: string; duration_weeks: number } | null;
  const currentWeek = activeProgram
    ? Math.min(Math.max(Math.floor((Date.now() - new Date(activeProgram.start_date).getTime()) / 604800000) + 1, 1), prog?.duration_weeks ?? 99)
    : null;

  // Habit streak calculation
  function calcStreak(habitId: string): { streak: number; doneToday: boolean } {
    if (!habitLogs) return { streak: 0, doneToday: false };
    const dates = new Set(habitLogs.filter((l: { habit_id: string }) => l.habit_id === habitId).map((l: { logged_date: string }) => l.logged_date));
    const doneToday = dates.has(today);
    let streak = 0;
    const check = new Date();
    if (!doneToday) check.setDate(check.getDate() - 1);
    while (streak < 31) {
      const d = check.toISOString().split("T")[0];
      if (!dates.has(d)) break;
      streak++;
      check.setDate(check.getDate() - 1);
    }
    return { streak, doneToday };
  }

  // Goal progress
  function goalProgress(goal: { type: string; start_value: number | null; target_value: number | null; exercise_name: string | null }): number | null {
    if (goal.type === "custom" || goal.target_value == null) return null;
    let current: number | null = null;
    if (goal.type === "weight") current = progressLogs?.find((l: { weight_lbs: number | null }) => l.weight_lbs != null)?.weight_lbs ?? null;
    if (goal.type === "body_fat") current = progressLogs?.find((l: { body_fat_pct: number | null }) => l.body_fat_pct != null)?.body_fat_pct ?? null;
    if (goal.type === "strength") current = prs.find(p => p.exercise_name === goal.exercise_name)?.best_weight ?? null;
    if (current == null) return null;
    const start = goal.start_value ?? 0;
    return Math.min(100, Math.max(0, ((current - start) / (goal.target_value - start)) * 100));
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer/clients" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Clients</Link>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>{client.full_name}</div>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>{client.email}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0D1827" }}>{logCount ?? 0}</div>
              <div style={{ fontSize: 11, color: "#6B7A8D" }}>workouts</div>
            </div>
          </div>

          {/* Program badge */}
          {prog && currentWeek && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", borderRadius: 20, padding: "4px 12px", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1B68B4" }}>📋 {prog.name} · Wk {currentWeek}/{prog.duration_weeks}</span>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", overflowX: "auto" }}>
            {TABS.map(t => (
              <Link
                key={t.key}
                href={`/trainer/clients/${clientId}?tab=${t.key}`}
                style={{
                  padding: "10px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: tab === t.key ? "#1B68B4" : "#6B7A8D",
                  borderBottom: tab === t.key ? "2px solid #1B68B4" : "2px solid transparent",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {sp.assigned && (
          <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>
            ✓ Program assigned successfully
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <>
            {/* Active Program */}
            <div style={card}>
              <div style={sectionLabel}>Active Program</div>
              {activeProgram ? (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: "#0D1827" }}>{prog?.name}</div>
                  <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 4 }}>
                    Started {activeProgram.start_date} · {prog?.duration_weeks} weeks · Week {currentWeek}
                  </div>
                </div>
              ) : (
                <div style={{ color: "#9CA3AF", fontSize: 14 }}>No program assigned</div>
              )}
            </div>

            {/* Assign/Switch Program */}
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 14 }}>
                {activeProgram ? "Switch Program" : "Assign Program"}
              </div>
              {programs && programs.length > 0 ? (
                <form action={assignProgram} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input type="hidden" name="client_id" value={clientId} />
                  <ProgramSelect programs={programs} />
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 }}>Start Date</label>
                    <input type="date" name="start_date" required defaultValue={today} style={inputSt} />
                  </div>
                  <button type="submit" style={btnSt}>Assign Program →</button>
                </form>
              ) : (
                <div style={{ color: "#9CA3AF", fontSize: 14 }}>
                  No programs yet. <Link href="/trainer/programs/new" style={{ color: "#2DC4B8" }}>Create one →</Link>
                </div>
              )}
            </div>

            {/* Sessions */}
            <SessionsPanel
              clientId={clientId}
              sessionsPurchased={(client as unknown as { sessions_purchased: number }).sessions_purchased ?? 0}
              completedCount={completedCount}
              sessions={(trainingSessions ?? []) as { id: string; scheduled_at: string; status: "scheduled" | "completed" | "no_show" | "rescheduled"; notes: string | null }[]}
            />
          </>
        )}

        {/* ── WORKOUTS TAB ── */}
        {tab === "workouts" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>{logCount ?? 0} sessions logged</div>
              <Link
                href={`/trainer/clients/${clientId}/log-workout`}
                style={{ padding: "10px 16px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}
              >
                + Log Workout
              </Link>
            </div>
            <WorkoutLogCards logs={(workoutLogs ?? []) as any} />
          </>
        )}

        {/* ── PROGRESS TAB ── */}
        {tab === "progress" && (
          <>
            {/* Latest snapshot */}
            {progressLogs && progressLogs.length > 0 && (() => {
              const latest = progressLogs[0] as any;
              const prev = progressLogs[1] as any;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={card}>
                    <div style={{ fontSize: 12, color: "#6B7A8D", marginBottom: 6 }}>Body Weight</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1827" }}>
                      {latest.weight_lbs != null ? `${latest.weight_lbs} lbs` : "—"}
                    </div>
                    {latest.weight_lbs != null && prev?.weight_lbs != null && (
                      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, color: latest.weight_lbs < prev.weight_lbs ? "#2DC4B8" : "#F59E0B" }}>
                        {latest.weight_lbs > prev.weight_lbs ? "↑" : "↓"} {Math.abs(latest.weight_lbs - prev.weight_lbs).toFixed(1)} from last
                      </div>
                    )}
                  </div>
                  <div style={card}>
                    <div style={{ fontSize: 12, color: "#6B7A8D", marginBottom: 6 }}>Body Fat</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#0D1827" }}>
                      {latest.body_fat_pct != null ? `${latest.body_fat_pct}%` : "—"}
                    </div>
                    {latest.body_fat_pct != null && prev?.body_fat_pct != null && (
                      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, color: latest.body_fat_pct < prev.body_fat_pct ? "#2DC4B8" : "#F59E0B" }}>
                        {latest.body_fat_pct > prev.body_fat_pct ? "↑" : "↓"} {Math.abs(latest.body_fat_pct - prev.body_fat_pct).toFixed(1)} from last
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Progress photos */}
            {progressLogs && progressLogs.some((l: any) => l.photo_url) && (
              <div style={card}>
                <div style={sectionLabel}>Progress Photos</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(progressLogs as any[]).filter(l => l.photo_url).map((l: any) => (
                    <div key={l.id}>
                      <img src={l.photo_url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10 }} />
                      <div style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center", marginTop: 3 }}>
                        {new Date(l.logged_at + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {progressLogs && progressLogs.length > 0 ? (
              <div style={card}>
                <div style={sectionLabel}>History</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(progressLogs as any[]).map((log, i) => {
                    const prev = (progressLogs as any[])[i + 1];
                    const wDiff = log.weight_lbs != null && prev?.weight_lbs != null ? (log.weight_lbs - prev.weight_lbs).toFixed(1) : null;
                    const bDiff = log.body_fat_pct != null && prev?.body_fat_pct != null ? (log.body_fat_pct - prev.body_fat_pct).toFixed(1) : null;
                    return (
                      <div key={log.id} style={{ borderBottom: "1px solid #F4F7FA", paddingBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1B68B4", marginBottom: 6 }}>
                            {new Date(log.logged_at + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </div>
                          <div style={{ display: "flex", gap: 16 }}>
                            {log.weight_lbs != null && (
                              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: "#0D1827" }}>{log.weight_lbs}</span>
                                <span style={{ fontSize: 12, color: "#6B7A8D" }}>lbs</span>
                                {wDiff && Math.abs(parseFloat(wDiff)) >= 0.1 && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: parseFloat(wDiff) < 0 ? "#2DC4B8" : "#F59E0B" }}>
                                    {parseFloat(wDiff) > 0 ? "+" : ""}{wDiff}
                                  </span>
                                )}
                              </div>
                            )}
                            {log.body_fat_pct != null && (
                              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: "#0D1827" }}>{log.body_fat_pct}</span>
                                <span style={{ fontSize: 12, color: "#6B7A8D" }}>%</span>
                                {bDiff && Math.abs(parseFloat(bDiff)) >= 0.1 && (
                                  <span style={{ fontSize: 11, fontWeight: 700, color: parseFloat(bDiff) < 0 ? "#2DC4B8" : "#F59E0B" }}>
                                    {parseFloat(bDiff) > 0 ? "+" : ""}{bDiff}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {log.notes && <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 4 }}>{log.notes}</div>}
                        </div>
                        {log.photo_url && (
                          <img src={log.photo_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState icon="📊" text="No progress logged yet" />
            )}

            {/* PRs */}
            {prs.length > 0 && (
              <div style={card}>
                <div style={sectionLabel}>Personal Records</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {prs.slice(0, 10).map(pr => (
                    <div key={pr.exercise_name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0D1827" }}>{pr.exercise_name}</div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: "#1B68B4" }}>{pr.best_weight}</span>
                        <span style={{ fontSize: 12, color: "#6B7A8D" }}> lbs</span>
                        {pr.best_reps && <span style={{ fontSize: 12, color: "#9CA3AF" }}> × {pr.best_reps}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── GOALS TAB ── */}
        {tab === "goals" && (
          <>
            {goals && goals.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(goals as any[]).map(goal => {
                  const pct = goalProgress(goal);
                  const days = goal.target_date ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={goal.id} style={{ ...card, opacity: goal.completed ? 0.75 : 1, border: `1px solid ${goal.completed ? "#A7F3D0" : "#E2EAF0"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: DIFF_COLORS[goal.type] ?? "#6B7A8D", background: (DIFF_COLORS[goal.type] ?? "#6B7A8D") + "18", padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>
                              {goal.type === "body_fat" ? "Body Fat" : goal.type}
                            </span>
                            {goal.completed && <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>✓ Complete</span>}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", textDecoration: goal.completed ? "line-through" : "none" }}>{goal.title}</div>
                          {days != null && (
                            <div style={{ fontSize: 12, color: days < 0 ? "#F59E0B" : "#6B7A8D", marginTop: 4 }}>
                              {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                            </div>
                          )}
                        </div>
                        {goal.target_value != null && goal.type !== "custom" && (
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#1B68B4" }}>{goal.target_value}</div>
                            <div style={{ fontSize: 11, color: "#6B7A8D" }}>target</div>
                          </div>
                        )}
                      </div>
                      {pct != null && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6B7A8D", marginBottom: 4 }}>
                            <span>Progress</span><span>{Math.round(pct)}%</span>
                          </div>
                          <div style={{ height: 6, background: "#E2EAF0", borderRadius: 99 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "#2DC4B8", borderRadius: 99 }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon="🎯" text="Client hasn't set any goals yet" />
            )}
          </>
        )}

        {/* ── NOTES TAB ── */}
        {tab === "notes" && (
          <ClientNotesEditor clientId={clientId} initialNotes={(client as any).client_notes ?? ""} />
        )}

        {/* ── HABITS TAB ── */}
        {tab === "habits" && (
          <>
            {habits && habits.length > 0 ? (
              <>
                {(() => {
                  const done = (habits as any[]).filter(h => calcStreak(h.id).doneToday).length;
                  const all = habits.length;
                  return (
                    <div style={{ ...card, background: done === all ? "linear-gradient(135deg, #2DC4B8, #1B68B4)" : "#fff" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: done === all ? "#fff" : "#0D1827", marginBottom: 8 }}>
                        {done === all ? `All ${all} habits done today 🎉` : `Today — ${done}/${all} complete`}
                      </div>
                      <div style={{ height: 6, background: done === all ? "rgba(255,255,255,0.3)" : "#E2EAF0", borderRadius: 99 }}>
                        <div style={{ height: "100%", width: `${(done / all) * 100}%`, background: done === all ? "#fff" : "#2DC4B8", borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(habits as any[]).map(h => {
                    const { streak, doneToday } = calcStreak(h.id);
                    return (
                      <div key={h.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12, border: `1.5px solid ${doneToday ? "#A7F3D0" : "#E2EAF0"}` }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, border: `2px solid ${doneToday ? "#2DC4B8" : "#D1D5DB"}`, background: doneToday ? "#2DC4B8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {doneToday && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
                        </div>
                        <div style={{ fontSize: 22, flexShrink: 0 }}>{h.emoji}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: doneToday ? "#6B7A8D" : "#0D1827", textDecoration: doneToday ? "line-through" : "none" }}>{h.name}</div>
                          {streak > 0 && <div style={{ fontSize: 12, color: "#F59E0B", fontWeight: 700 }}>🔥 {streak} day streak</div>}
                        </div>
                        <div style={{ fontSize: 12, color: doneToday ? "#059669" : "#9CA3AF", fontWeight: 700 }}>
                          {doneToday ? "Done" : "Not yet"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState icon="🌱" text="Client hasn't added any habits yet" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "48px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 600, color: "#0D1827" }}>{text}</div>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" };
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 };
const inputSt: React.CSSProperties = { width: "100%", padding: "13px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" };
const btnSt: React.CSSProperties = { padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" };
