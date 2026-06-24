"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buildSetKey, parseRepsInput, parseWeightInput, repsToNumber, weightToNumber, type Side } from "@/lib/workout-utils";

type ExerciseRow = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
  order: number;
  is_unilateral: boolean;
  suggested_weight: string | null;
  weight_type: string | null;
  group_id: number | null;
  group_round_rest_seconds: number | null;
};

type SetKey = string;
type LoggedSet = { reps: number | null; weight: number | null };
type RestTimer = { key: SetKey; endTime: number; total: number };
type HistorySession = { date: string; sets: { set_number: number; reps_completed: number | null; weight_lbs: number | null; side: string | null }[] };

type Program = { id: string; name: string };
type Workout = { id: string; name: string; week_number: number; day_of_week: number };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GROUP_COLORS = ["#1B68B4", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#EC4899"];
function groupColor(id: number) { return GROUP_COLORS[(id - 1) % GROUP_COLORS.length]; }

export default function TrainerLogWorkoutPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [clientName, setClientName] = useState("");
  const [programs, setPrograms] = useState<{ program: Program; workouts: Workout[] }[]>([]);

  // Session state
  const [phase, setPhase] = useState<"pick" | "session" | "done">("pick");
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);

  const [logged, setLogged] = useState<Record<SetKey, LoggedSet>>({});
  const [prevLogged, setPrevLogged] = useState<Record<SetKey, LoggedSet>>({});
  const [inputs, setInputs] = useState<Record<SetKey, { reps: string; weight: string }>>({});

  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [restDone, setRestDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [tick, setTick] = useState(0);

  const [saving, setSaving] = useState(false);
  const [sessionNotes, setSessionNotes] = useState("");
  const [error, setError] = useState("");

  // Exercise history modal
  const [historyEx, setHistoryEx] = useState<ExerciseRow | null>(null);
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function openHistory(ex: ExerciseRow) {
    setHistoryEx(ex);
    setHistorySessions([]);
    setHistoryLoading(true);
    const supabase = createClient();
    const { data: logs } = await supabase
      .from("workout_logs")
      .select("id, completed_at")
      .eq("client_id", clientId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(20);
    if (!logs?.length) { setHistoryLoading(false); return; }
    const logIds = logs.map(l => l.id);
    const { data: sets } = await supabase
      .from("set_logs")
      .select("workout_log_id, set_number, reps_completed, weight_lbs, side")
      .eq("exercise_id", ex.id)
      .in("workout_log_id", logIds)
      .order("set_number");
    const byLog: Record<string, typeof sets> = {};
    for (const s of sets ?? []) {
      if (!byLog[s.workout_log_id]) byLog[s.workout_log_id] = [];
      byLog[s.workout_log_id]!.push(s);
    }
    const sessions: HistorySession[] = logs
      .filter(l => byLog[l.id]?.length)
      .map(l => ({
        date: l.completed_at,
        sets: byLog[l.id]!,
      }));
    setHistorySessions(sessions);
    setHistoryLoading(false);
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: profile }, { data: assignments }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", clientId).single(),
        supabase.from("client_programs").select("program_id, programs(id, name)").eq("client_id", clientId).eq("is_active", true),
      ]);
      setClientName(profile?.full_name ?? "Client");
      if (!assignments?.length) return;
      const programIds = assignments.map((a: any) => a.program_id);
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id, name, week_number, day_of_week, program_id")
        .in("program_id", programIds)
        .order("week_number").order("day_of_week");
      setPrograms(assignments.map((a: any) => ({
        program: a.programs as Program,
        workouts: (workouts ?? []).filter((w: any) => w.program_id === a.program_id),
      })));
    })();
  }, [clientId]);

  const startSession = useCallback(async (w: Workout) => {
    setLoadingEx(true);
    setSelectedWorkout(w);
    setLogged({});
    setInputs({});
    setPrevLogged({});
    const supabase = createClient();
    const [{ data: exs }, { data: recentLog }] = await Promise.all([
      supabase.from("exercises")
        .select("id, name, sets, reps, rest_seconds, notes, order, is_unilateral, suggested_weight, weight_type, group_id, group_round_rest_seconds")
        .eq("workout_id", w.id).order("order"),
      supabase.from("workout_logs")
        .select("id")
        .eq("client_id", clientId)
        .eq("workout_id", w.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(1).single(),
    ]);
    setExercises((exs ?? []) as ExerciseRow[]);

    if (recentLog) {
      const { data: sl } = await supabase
        .from("set_logs")
        .select("exercise_id, set_number, reps_completed, weight_lbs, side")
        .eq("workout_log_id", recentLog.id);
      const map: Record<SetKey, LoggedSet> = {};
      sl?.forEach(s => { map[`${s.exercise_id}-${s.set_number}-${s.side ?? "both"}`] = { reps: s.reps_completed, weight: s.weight_lbs }; });
      setPrevLogged(map);
    }
    setLoadingEx(false);
    setPhase("session");
  }, [clientId]);

  // Timer
  function startTimer(secs: number, key: SetKey) {
    if (timerRef.current) clearInterval(timerRef.current);
    setRestDone(false);
    const end = Date.now() + secs * 1000;
    setRestTimer({ key, endTime: end, total: secs });
    timerRef.current = setInterval(() => {
      setTick(t => t + 1);
      if (Date.now() >= end) {
        clearInterval(timerRef.current!);
        setRestDone(true);
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const ctx = audioCtxRef.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 880; gain.gain.value = 0.3;
          osc.start(); osc.stop(ctx.currentTime + 0.25);
        } catch {}
      }
    }, 250);
  }

  function handleLogSet(exId: string, setNum: number, side: Side) {
    const key: SetKey = buildSetKey(exId, setNum, side);
    const inp = inputs[key] ?? { reps: "", weight: "" };
    const reps = repsToNumber(inp.reps);
    const weight = weightToNumber(inp.weight);
    setLogged(prev => ({ ...prev, [key]: { reps, weight } }));
    const ex = exercises.find(e => e.id === exId);
    if (ex && ex.rest_seconds > 0) startTimer(ex.rest_seconds, key);
  }

  async function finishSession() {
    if (!selectedWorkout) return;
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: wlog, error: wErr } = await supabase
        .from("workout_logs")
        .insert({
          client_id: clientId,
          workout_id: selectedWorkout.id,
          completed_at: new Date().toISOString(),
          notes: sessionNotes.trim() || null,
          logged_by: user.id,
        })
        .select("id").single();
      if (wErr || !wlog) throw wErr ?? new Error("Failed to create log");

      const rows: object[] = [];
      Object.entries(logged).forEach(([key, val]) => {
        const parts = key.split("-");
        const side = parts[parts.length - 1];
        const setNum = parseInt(parts[parts.length - 2]);
        const exId = parts.slice(0, parts.length - 2).join("-");
        if (val.reps != null || val.weight != null) {
          rows.push({
            client_id: clientId,
            workout_log_id: wlog.id,
            exercise_id: exId,
            set_number: setNum,
            reps_completed: val.reps,
            weight_lbs: val.weight,
            side,
          });
        }
      });
      if (rows.length > 0) {
        const { error: sErr } = await supabase.from("set_logs").insert(rows);
        if (sErr) throw sErr;
      }
      setPhase("done");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const doneSetCount = Object.keys(logged).length;
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets * (ex.is_unilateral ? 2 : 1), 0);

  // Timer display
  const restSecsLeft = restTimer ? Math.max(0, Math.ceil((restTimer.endTime - Date.now()) / 1000)) : 0;
  const restPct = restTimer ? restSecsLeft / restTimer.total : 0;

  if (phase === "done") {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>Workout Logged!</div>
        <div style={{ fontSize: 14, color: "#6B7A8D" }}>{doneSetCount} sets saved for {clientName}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8, width: "100%", maxWidth: 300 }}>
          <button onClick={() => { setPhase("pick"); setSelectedWorkout(null); setExercises([]); setLogged({}); setSessionNotes(""); }}
            style={btnTeal}>Log Another Workout</button>
          <Link href={`/trainer/clients/${clientId}`} style={{ ...btnGray, textAlign: "center", textDecoration: "none" }}>
            Back to {clientName}
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "pick" || loadingEx) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 40 }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Link href={`/trainer/clients/${clientId}`} style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← {clientName}</Link>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Log Workout</div>
          </div>
        </div>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
          {loadingEx ? (
            <div style={{ textAlign: "center", padding: 60, color: "#6B7A8D" }}>Loading exercises…</div>
          ) : programs.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 14, padding: 24, border: "1px solid #E2EAF0", color: "#9CA3AF", fontSize: 14 }}>
              No active program assigned to this client.
            </div>
          ) : programs.map(({ program, workouts }) => (
            <div key={program.id} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{program.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {workouts.map(w => (
                  <button key={w.id} onClick={() => startSession(w)}
                    style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "16px 18px", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>{w.name}</span>
                    <span style={{ fontSize: 12, color: "#6B7A8D" }}>Wk {w.week_number} · {DAYS[w.day_of_week]}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Session view
  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 140 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <button onClick={() => setPhase("pick")} style={{ background: "none", border: "none", fontSize: 13, color: "#6B7A8D", cursor: "pointer", padding: 0 }}>← Pick different</button>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1B68B4", marginTop: 2 }}>{selectedWorkout?.name}</div>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>for {clientName}</div>
          </div>
          <div style={{ background: "#EBF9F8", borderRadius: 12, padding: "8px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#2DC4B8" }}>{doneSetCount}<span style={{ fontSize: 12, color: "#9CA3AF" }}>/{totalSets}</span></div>
            <div style={{ fontSize: 10, color: "#6B7A8D", fontWeight: 600 }}>SETS</div>
          </div>
        </div>
      </div>

      {/* Rest Timer */}
      {restTimer && (
        <div style={{ background: restDone ? "#ECFDF5" : "#1B68B4", color: restDone ? "#059669" : "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>{restDone ? "Rest complete!" : "Rest"}</div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.25)", borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", background: restDone ? "#059669" : "#fff", borderRadius: 4, width: `${(1 - restPct) * 100}%`, transition: "width 0.25s linear" }} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, minWidth: 60, textAlign: "right" }}>
            {restDone ? "Go!" : `${restSecsLeft}s`}
          </div>
          <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setRestTimer(null); setRestDone(false); }}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", color: restDone ? "#059669" : "#fff", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700 }}>
            ✕
          </button>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        {(() => {
          // Build grouped render items
          type RenderItem =
            | { kind: "standalone"; ex: ExerciseRow }
            | { kind: "group"; gid: number; items: ExerciseRow[] };
          const items: RenderItem[] = [];
          const seen = new Set<number>();
          for (const ex of exercises) {
            if (ex.group_id == null) { items.push({ kind: "standalone", ex }); }
            else if (!seen.has(ex.group_id)) {
              seen.add(ex.group_id);
              items.push({ kind: "group", gid: ex.group_id, items: exercises.filter(e => e.group_id === ex.group_id) });
            }
          }

          function renderExCard(ex: ExerciseRow, inGroup = false) {
            const allDone = Array.from({ length: ex.sets }, (_, i) => i + 1).every(setNum => {
              if (ex.is_unilateral) return !!logged[buildSetKey(ex.id, setNum, "left")] && !!logged[buildSetKey(ex.id, setNum, "right")];
              return !!logged[buildSetKey(ex.id, setNum, "both")];
            });
            return (
              <div style={{ background: "#fff", borderRadius: inGroup ? 0 : 16, border: inGroup ? "none" : `1.5px solid ${allDone ? "#6EE7B7" : "#E2EAF0"}`, marginBottom: inGroup ? 0 : 12, overflow: "hidden" }}>
              {/* Exercise header */}
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #F4F7FA" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <button onClick={() => openHistory(ex)} style={{ fontWeight: 800, fontSize: 15, color: "#1B68B4", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>{ex.name}</button>
                  {ex.is_unilateral && <span style={{ fontSize: 10, fontWeight: 700, color: "#2DC4B8", background: "#F0FDFC", border: "1px solid #A7F3D0", borderRadius: 4, padding: "1px 5px" }}>L/R</span>}
                  {allDone && <span style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6B7A8D" }}>
                  {ex.sets} sets × {ex.reps}
                  {ex.suggested_weight && (
                    <span> · {ex.weight_type === "dumbbell" ? "1 DB " : ex.weight_type === "dumbbells" ? "2 DB " : ex.weight_type === "barbell" ? "Barbell " : ex.weight_type === "kettlebell" ? "Kettlebell " : ex.weight_type === "plate" ? "Plate " : ""}{ex.suggested_weight}</span>
                  )}
                </div>
                {ex.notes && <div style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic", marginTop: 2 }}>{ex.notes}</div>}
              </div>

              {/* Set rows */}
              <div style={{ padding: "10px 16px 14px" }}>
                {ex.is_unilateral ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "44px 36px 1fr 1fr 64px", gap: 6, padding: "6px 0", marginBottom: 4 }}>
                      <div style={colHdr}>Set</div><div style={colHdr}>Side</div><div style={colHdr}>Reps</div><div style={colHdr}>lbs</div><div />
                    </div>
                    {Array.from({ length: ex.sets }, (_, i) => i + 1).map(setNum => {
                      const bothDone = !!logged[buildSetKey(ex.id, setNum, "left")] && !!logged[buildSetKey(ex.id, setNum, "right")];
                      return (
                        <div key={setNum} style={{ marginBottom: 10 }}>
                          {(["left", "right"] as const).map((side, sideIdx) => {
                            const key = buildSetKey(ex.id, setNum, side);
                            const isDone = !!logged[key];
                            const prev = prevLogged[key];
                            const inp = inputs[key] ?? { reps: "", weight: "" };
                            const sideLabel = side === "left" ? "L" : "R";
                            const sideColor = side === "left" ? "#1B68B4" : "#8B5CF6";
                            return (
                              <div key={side}>
                                {sideIdx === 0 && setNum === 1 && prev && (
                                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>
                                    Prev L: {prev.reps != null ? `${prev.reps} reps` : "—"}{prev.weight != null && prev.weight > 0 ? ` × ${prev.weight} lbs` : ""}
                                  </div>
                                )}
                                <div style={{ display: "grid", gridTemplateColumns: "44px 36px 1fr 1fr 64px", gap: 6, alignItems: "center", marginBottom: 4 }}>
                                  {sideIdx === 0 ? (
                                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: bothDone ? "#10B981" : "#F4F7FA", border: `2px solid ${bothDone ? "#10B981" : "#E2EAF0"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                                      {bothDone ? <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span> : <span style={{ color: "#6B7A8D", fontSize: 12, fontWeight: 700 }}>{setNum}</span>}
                                    </div>
                                  ) : <div />}
                                  <div style={{ width: 28, height: 28, borderRadius: 6, background: isDone ? sideColor + "22" : "#F4F7FA", border: `1.5px solid ${isDone ? sideColor : "#E2EAF0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: isDone ? sideColor : "#9CA3AF" }}>
                                    {sideLabel}
                                  </div>
                                  <input type="text" inputMode="numeric"
                                    placeholder={logged[key]?.reps != null ? String(logged[key].reps) : ex.reps.split(/[-x]/)[0].trim()}
                                    value={inp.reps}
                                    onChange={e => { const v = parseRepsInput(e.target.value); setInputs(p => ({ ...p, [key]: { ...p[key] ?? { reps: "", weight: "" }, reps: v } })); }}
                                    style={inputStyle(isDone)} />
                                  <input type="text" inputMode="decimal"
                                    placeholder={logged[key]?.weight != null ? String(logged[key].weight) : prev?.weight != null ? String(prev.weight) : ex.suggested_weight ?? "0"}
                                    value={inp.weight}
                                    onChange={e => { const v = parseWeightInput(e.target.value); setInputs(p => ({ ...p, [key]: { ...p[key] ?? { reps: "", weight: "" }, weight: v } })); }}
                                    style={inputStyle(isDone)} />
                                  <button onClick={() => handleLogSet(ex.id, setNum, side)}
                                    style={{ padding: "8px 0", borderRadius: 8, background: isDone ? "#ECFDF5" : sideColor, color: isDone ? "#059669" : "#fff", fontWeight: 700, fontSize: 16, border: `1.5px solid ${isDone ? "#6EE7B7" : sideColor}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {isDone ? "✓" : "⏱"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 72px", gap: 8, padding: "6px 0", marginBottom: 4 }}>
                      <div style={colHdr}>Set</div><div style={colHdr}>Reps</div><div style={colHdr}>lbs</div><div />
                    </div>
                    {Array.from({ length: ex.sets }, (_, i) => i + 1).map(setNum => {
                      const key = buildSetKey(ex.id, setNum, "both");
                      const isDone = !!logged[key];
                      const prev = prevLogged[key];
                      const inp = inputs[key] ?? { reps: "", weight: "" };
                      return (
                        <div key={setNum}>
                          {setNum === 1 && prev && (
                            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 5 }}>
                              Prev: {prev.reps != null ? `${prev.reps} reps` : ""}{prev.reps != null && prev.weight != null && prev.weight > 0 ? " × " : ""}{prev.weight != null && prev.weight > 0 ? `${prev.weight} lbs` : ""}
                            </div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 72px", gap: 8, alignItems: "center", marginBottom: 8 }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: isDone ? "#10B981" : "#F4F7FA", border: `2px solid ${isDone ? "#10B981" : "#E2EAF0"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                              {isDone ? <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span> : <span style={{ color: "#6B7A8D", fontSize: 12, fontWeight: 700 }}>{setNum}</span>}
                            </div>
                            <input type="text" inputMode="numeric"
                              placeholder={logged[key]?.reps != null ? String(logged[key].reps) : ex.reps.split(/[-x]/)[0].trim()}
                              value={inp.reps}
                              onChange={e => { const v = parseRepsInput(e.target.value); setInputs(p => ({ ...p, [key]: { ...p[key] ?? { reps: "", weight: "" }, reps: v } })); }}
                              style={inputStyle(isDone)} />
                            <input type="text" inputMode="decimal"
                              placeholder={logged[key]?.weight != null ? String(logged[key].weight) : prev?.weight != null ? String(prev.weight) : ex.suggested_weight ?? "0"}
                              value={inp.weight}
                              onChange={e => { const v = parseWeightInput(e.target.value); setInputs(p => ({ ...p, [key]: { ...p[key] ?? { reps: "", weight: "" }, weight: v } })); }}
                              style={inputStyle(isDone)} />
                            <button onClick={() => handleLogSet(ex.id, setNum, "both")}
                              style={{ padding: "10px 0", borderRadius: 8, background: isDone ? "#ECFDF5" : "#2DC4B8", color: isDone ? "#059669" : "#fff", fontWeight: 700, fontSize: 20, border: `1.5px solid ${isDone ? "#6EE7B7" : "#2DC4B8"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {isDone ? "✓" : "⏱"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          );
          } // end renderExCard

          return items.map((item, idx) => {
            if (item.kind === "standalone") return <div key={item.ex.id}>{renderExCard(item.ex)}</div>;

            const color = groupColor(item.gid);
            const letter = String.fromCharCode(64 + item.gid);
            const roundRest = item.items[0]?.group_round_rest_seconds ?? 90;
            const rounds = item.items[0]?.sets ?? 3;

            return (
              <div key={`group-${item.gid}-${idx}`} style={{ marginBottom: 16 }}>
                <div style={{ background: color, borderRadius: "14px 14px 0 0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.25)", borderRadius: 8, padding: "3px 10px" }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>SUPERSET {letter}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{item.items.length} exercises · {rounds} rounds</span>
                </div>
                <div style={{ border: `2px solid ${color}`, borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
                  {item.items.map((ex, i) => (
                    <div key={ex.id}>
                      <div style={{ display: "flex" }}>
                        <div style={{ width: 5, background: color, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>{renderExCard(ex, true)}</div>
                      </div>
                      {i < item.items.length - 1 && (
                        <div style={{ background: color + "12", padding: "7px 14px 7px 19px", borderTop: `1px solid ${color}33`, borderBottom: `1px solid ${color}33`, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, color }}>↓</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>No rest — go straight to next</span>
                          {ex.rest_seconds > 0 && <span style={{ fontSize: 11, color: "#9CA3AF" }}>({ex.rest_seconds}s if needed)</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ background: color + "10", padding: "9px 14px", borderTop: `1px solid ${color}33`, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color, background: color + "20", borderRadius: 20, padding: "4px 12px" }}>
                      🔄 {roundRest}s rest between rounds
                    </span>
                  </div>
                </div>
              </div>
            );
          });
        })()}

        {/* Session notes */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", marginBottom: 8 }}>Session Notes</div>
          <textarea
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            placeholder="How did the session go?"
            rows={3}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none", resize: "none", fontFamily: "inherit" }}
          />
        </div>

        {error && <div style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{error}</div>}
      </div>

      {/* Finish bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 16px 32px", background: "linear-gradient(transparent, #F4F7FA 30%)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <button onClick={finishSession} disabled={saving || doneSetCount === 0}
            style={{ ...btnTeal, width: "100%", fontSize: 16, opacity: saving || doneSetCount === 0 ? 0.5 : 1 }}>
            {saving ? "Saving…" : `Finish & Save (${doneSetCount} sets logged)`}
          </button>
        </div>
      </div>

      {historyEx && (
        <HistoryModal
          ex={historyEx}
          sessions={historySessions}
          loading={historyLoading}
          onClose={() => setHistoryEx(null)}
        />
      )}
    </div>
  );
}

function inputStyle(done: boolean): React.CSSProperties {
  return { width: "100%", padding: "10px 8px", borderRadius: 8, border: `1.5px solid ${done ? "#6EE7B7" : "#E2EAF0"}`, background: done ? "#F0FDF4" : "#F8FAFB", fontSize: 15, color: "#0D1827", outline: "none", textAlign: "center", fontWeight: 600 };
}

function HistoryModal({ ex, sessions, loading, onClose }: { ex: ExerciseRow; sessions: HistorySession[]; loading: boolean; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ position: "relative", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "75dvh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #F4F7FA", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0D1827" }}>{ex.name}</div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>Weight history</div>
          </div>
          <button onClick={onClose} style={{ background: "#F4F7FA", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 16, color: "#6B7A8D" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "14px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32, color: "#6B7A8D" }}>Loading…</div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "#9CA3AF", fontSize: 14 }}>No previous logs for this exercise.</div>
          ) : sessions.map((s, i) => {
            const date = new Date(s.date);
            const dateStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            const uniqueSides = [...new Set(s.sets.map(r => r.side))];
            const isUnilateral = uniqueSides.some(side => side === "left" || side === "right");
            return (
              <div key={i} style={{ background: "#F8FAFB", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", marginBottom: 10 }}>{dateStr}</div>
                {isUnilateral ? (
                  (() => {
                    const setNums = [...new Set(s.sets.map(r => r.set_number))].sort((a, b) => a - b);
                    return setNums.map(setNum => {
                      const left = s.sets.find(r => r.set_number === setNum && r.side === "left");
                      const right = s.sets.find(r => r.set_number === setNum && r.side === "right");
                      return (
                        <div key={setNum} style={{ display: "flex", alignItems: "center", gap: 12, padding: "5px 0", borderBottom: "1px solid #F0F0F0" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#1B68B4", flexShrink: 0 }}>{setNum}</div>
                          <div style={{ fontSize: 13, color: "#0D1827" }}>
                            L: {left?.reps_completed ?? "—"} reps{left?.weight_lbs ? ` × ${left.weight_lbs} lbs` : ""}
                            <span style={{ color: "#D1D5DB", marginInline: 8 }}>|</span>
                            R: {right?.reps_completed ?? "—"} reps{right?.weight_lbs ? ` × ${right.weight_lbs} lbs` : ""}
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  s.sets.map((r, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 12, padding: "5px 0", borderBottom: j < s.sets.length - 1 ? "1px solid #F0F0F0" : "none" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#EBF9F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#2DC4B8", flexShrink: 0 }}>{r.set_number}</div>
                      <div style={{ flex: 1, display: "flex", gap: 16 }}>
                        {r.weight_lbs != null && r.weight_lbs > 0 && (
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{r.weight_lbs} <span style={{ fontWeight: 400, color: "#6B7A8D", fontSize: 12 }}>lbs</span></span>
                        )}
                        {r.reps_completed != null && (
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{r.reps_completed} <span style={{ fontWeight: 400, color: "#6B7A8D", fontSize: 12 }}>reps</span></span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const colHdr: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" };
const btnTeal: React.CSSProperties = { padding: "15px 20px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" };
const btnGray: React.CSSProperties = { padding: "15px 20px", borderRadius: 12, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 600, fontSize: 15, border: "1px solid #E2EAF0", cursor: "pointer" };
