"use client";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";

type ExerciseRow = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
  order: number;
  exercise_library: { video_url: string | null } | null;
  group_id: number | null;
  group_round_rest_seconds: number | null;
};

type SetKey = string;
type LoggedSet = { reps: number | null; weight: number | null };
type Mode = "preview" | "session" | "done" | "share";
type RestTimer = { key: SetKey; remaining: number; total: number; kind: "exercise" | "round" };
type PendingRest = { key: SetKey; seconds: number; kind: "exercise" | "round" };

const GROUP_COLORS = ["#1B68B4", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#EC4899"];
function groupColor(id: number) { return GROUP_COLORS[(id - 1) % GROUP_COLORS.length]; }
function groupLetter(id: number) { return String.fromCharCode(64 + id); }

function estMinutes(exs: ExerciseRow[]) {
  const secs = exs.reduce((acc, ex) => acc + ex.sets * (45 + ex.rest_seconds), 0);
  return Math.round(secs / 60);
}

export default function WorkoutSessionPage() {
  const params = useParams();
  const workoutId = params.workoutId as string;

  const [mode, setMode] = useState<Mode>("preview");
  const [workout, setWorkout] = useState<{ name: string } | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [logged, setLogged] = useState<Record<SetKey, LoggedSet>>({});
  const [prevLogged, setPrevLogged] = useState<Record<SetKey, LoggedSet>>({});
  const [inputs, setInputs] = useState<Record<SetKey, { reps: string; weight: string }>>({});
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [pendingRest, setPendingRest] = useState<PendingRest | null>(null);
  const [restDone, setRestDone] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<{ url: string; name: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: w }, { data: exs }, { data: { user } }] = await Promise.all([
        supabase.from("workouts").select("name").eq("id", workoutId).single(),
        supabase.from("exercises")
          .select("id, name, sets, reps, rest_seconds, notes, order, exercise_library(video_url), group_id, group_round_rest_seconds")
          .eq("workout_id", workoutId)
          .order("order"),
        supabase.auth.getUser(),
      ]);
      setWorkout(w);
      setExercises((exs ?? []).map((e: unknown) => {
        const ex = e as ExerciseRow & { exercise_library: unknown };
        return { ...ex, exercise_library: Array.isArray(ex.exercise_library) ? (ex.exercise_library[0] ?? null) : ex.exercise_library };
      }) as ExerciseRow[]);

      if (!user) return;
      setUserId(user.id);

      const today = new Date().toISOString().split("T")[0];
      const { data: todayLog } = await supabase
        .from("workout_logs").select("id").eq("client_id", user.id).eq("workout_id", workoutId)
        .gte("created_at", today).maybeSingle();

      if (todayLog) {
        setWorkoutLogId(todayLog.id);
        const { data: sl } = await supabase.from("set_logs").select("exercise_id, set_number, reps_completed, weight_lbs").eq("workout_log_id", todayLog.id);
        const map: Record<SetKey, LoggedSet> = {};
        sl?.forEach(s => { map[`${s.exercise_id}-${s.set_number}`] = { reps: s.reps_completed, weight: s.weight_lbs }; });
        setLogged(map);
        if (Object.keys(map).length > 0) setMode("session");
      }

      const { data: prevLog } = await supabase
        .from("workout_logs").select("id").eq("client_id", user.id).eq("workout_id", workoutId)
        .lt("created_at", today).order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (prevLog) {
        const { data: sl } = await supabase.from("set_logs").select("exercise_id, set_number, reps_completed, weight_lbs").eq("workout_log_id", prevLog.id);
        const map: Record<SetKey, LoggedSet> = {};
        sl?.forEach(s => { map[`${s.exercise_id}-${s.set_number}`] = { reps: s.reps_completed, weight: s.weight_lbs }; });
        setPrevLogged(map);
      }

      setLoading(false);
    })();
  }, [workoutId]);

  function playAlarm() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      [0, 0.18, 0.36].forEach(delay => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.6, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.35);
      });
    } catch { /* audio not available */ }
  }

  useEffect(() => {
    if (!restTimer || restTimer.remaining <= 0) return;
    timerRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (!prev) return null;
        if (prev.remaining <= 1) {
          clearInterval(timerRef.current!);
          setTimeout(() => {
            playAlarm();
            setRestDone(true);
            setTimeout(() => setRestDone(false), 2500);
          }, 0);
          return null;
        }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [restTimer?.key]);

  const startWorkout = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    let logId = workoutLogId;
    if (!logId) {
      const { data } = await supabase.from("workout_logs").insert({ client_id: userId, workout_id: workoutId, completed_at: new Date().toISOString() }).select("id").single();
      logId = data?.id ?? null;
      setWorkoutLogId(logId);
    }
    setMode("session");
  }, [workoutId, workoutLogId, userId]);

  const handleLogSet = useCallback(async (exerciseId: string, setNum: number) => {
    const key: SetKey = `${exerciseId}-${setNum}`;
    const inp = inputs[key] ?? { reps: "", weight: "" };
    if (!inp.reps && !inp.weight) return;
    if (!workoutLogId || !userId) return;

    const reps = inp.reps ? parseInt(inp.reps) : null;
    const weight = inp.weight ? parseFloat(inp.weight) : null;

    setLogged(prev => ({ ...prev, [key]: { reps, weight } }));

    const supabase = createClient();
    await supabase.from("set_logs").upsert({
      client_id: userId,
      workout_log_id: workoutLogId,
      exercise_id: exerciseId,
      set_number: setNum,
      reps_completed: reps,
      weight_lbs: weight,
    }, { onConflict: "workout_log_id,exercise_id,set_number" });

    // Queue rest timer — user taps to start it
    const ex = exercises.find(e => e.id === exerciseId);
    if (ex?.group_id != null) {
      const groupExs = exercises.filter(e => e.group_id === ex.group_id);
      const posInGroup = groupExs.findIndex(e => e.id === exerciseId);
      const isLastInGroup = posInGroup === groupExs.length - 1;
      if (isLastInGroup) {
        const secs = ex.group_round_rest_seconds ?? 90;
        if (secs > 0) setPendingRest({ key, seconds: secs, kind: "round" });
      } else {
        if (ex.rest_seconds > 0) setPendingRest({ key, seconds: ex.rest_seconds, kind: "exercise" });
      }
    } else {
      if (ex && ex.rest_seconds > 0) setPendingRest({ key, seconds: ex.rest_seconds, kind: "exercise" });
    }
  }, [inputs, workoutLogId, userId, exercises]);

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    const supabase = createClient();
    if (workoutLogId) await supabase.from("workout_logs").update({ completed_at: new Date().toISOString() }).eq("id", workoutLogId);
    fetch("/api/push/workout-complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workoutId }) }).catch(() => {});
    setMode("share");
    setCompleting(false);
  }, [workoutLogId, workoutId]);

  const doneSetCount = Object.keys(logged).length;
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets, 0);

  // Group exercises for rendering
  const renderItems = useMemo(() => {
    type Item =
      | { kind: "standalone"; ex: ExerciseRow }
      | { kind: "group"; gid: number; items: ExerciseRow[] };
    const out: Item[] = [];
    const seen = new Set<number>();
    exercises.forEach(ex => {
      if (ex.group_id == null) {
        out.push({ kind: "standalone", ex });
      } else if (!seen.has(ex.group_id)) {
        seen.add(ex.group_id);
        out.push({ kind: "group", gid: ex.group_id, items: exercises.filter(e => e.group_id === ex.group_id) });
      }
    });
    return out;
  }, [exercises]);

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: "#6B7A8D" }}>Loading…</div>
    </div>
  );

  if (mode === "share" || mode === "done") {
    return <WorkoutDoneScreen workoutName={workout?.name ?? "Workout"} setsLogged={doneSetCount} workoutLogId={workoutLogId} />;
  }

  function ExerciseCard({ ex, inGroup, groupExs }: { ex: ExerciseRow; inGroup?: boolean; groupExs?: ExerciseRow[] }) {
    const exLogs = Object.fromEntries(Object.entries(logged).filter(([k]) => k.startsWith(ex.id)));
    const allSetsLogged = Object.keys(exLogs).length >= ex.sets;
    const videoUrl = ex.exercise_library?.video_url ?? null;
    const color = ex.group_id != null ? groupColor(ex.group_id) : "#2DC4B8";

    // Round progress dots for superset
    const roundDots = inGroup && ex.group_id != null
      ? Array.from({ length: ex.sets }, (_, i) => {
          const setNum = i + 1;
          const allExsDone = groupExs?.every(ge => !!logged[`${ge.id}-${setNum}`]) ?? false;
          return allExsDone;
        })
      : null;

    return (
      <div style={{ background: "#fff", border: inGroup ? "none" : `1.5px solid ${allSetsLogged ? "#A7F3D0" : "#E2EAF0"}`, borderRadius: inGroup ? 0 : 14, marginBottom: inGroup ? 0 : 12, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", borderBottom: mode === "session" ? `1px solid #F4F7FA` : "none" }}>
          {videoUrl ? (
            <div onClick={() => setVideoModal({ url: videoUrl, name: ex.name })} style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#000", cursor: "pointer", position: "relative" }}>
              <video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline preload="metadata" />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, paddingLeft: 2 }}>▶</div>
              </div>
            </div>
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>💪</div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0D1827" }}>{ex.name}</div>
              {allSetsLogged && <span style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>✓</span>}
            </div>
            <div style={{ fontSize: 12, color: "#6B7A8D" }}>{ex.sets} sets × {ex.reps}</div>
            {roundDots && (
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {roundDots.map((done, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: done ? color : "#E2EAF0", border: `1.5px solid ${done ? color : "#D1D5DB"}` }} />
                ))}
                <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 2 }}>rounds</span>
              </div>
            )}
            {ex.notes && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" }}>{ex.notes}</div>}
          </div>
        </div>

        {/* Set rows */}
        {mode === "session" && (
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 72px", gap: 8, padding: "8px 0 6px", borderBottom: "1px solid #F4F7FA", marginBottom: 4 }}>
              <div style={colHdr}>Set</div>
              <div style={colHdr}>Reps</div>
              <div style={colHdr}>lbs</div>
              <div />
            </div>

            {Array.from({ length: ex.sets }, (_, i) => i + 1).map(setNum => {
              const key: SetKey = `${ex.id}-${setNum}`;
              const isDone = !!logged[key];
              const prev = prevLogged[key];
              const inp = inputs[key] ?? { reps: "", weight: "" };
              return (
                <div key={setNum}>
                  {setNum === 1 && prev && (
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 5, marginTop: 2 }}>
                      Prev: {prev.reps != null ? `${prev.reps} reps` : ""}{prev.reps != null && prev.weight != null ? " × " : ""}{prev.weight != null && prev.weight > 0 ? `${prev.weight} lbs` : ""}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 72px", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: isDone ? color : "#F4F7FA", border: `2px solid ${isDone ? color : "#E2EAF0"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                      {isDone
                        ? <span style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>✓</span>
                        : <span style={{ color: "#6B7A8D", fontSize: 12, fontWeight: 700 }}>{setNum}</span>}
                    </div>
                    <input type="number" inputMode="numeric"
                      placeholder={logged[key]?.reps != null ? String(logged[key].reps) : ex.reps.split(/[-x]/)[0].trim()}
                      value={inp.reps} onChange={e => setInputs(p => ({ ...p, [key]: { ...inp, reps: e.target.value } }))}
                      style={inputStyle(isDone)} />
                    <input type="number" inputMode="decimal"
                      placeholder={logged[key]?.weight != null ? String(logged[key].weight) : prev?.weight != null ? String(prev.weight) : "0"}
                      value={inp.weight} onChange={e => setInputs(p => ({ ...p, [key]: { ...inp, weight: e.target.value } }))}
                      style={inputStyle(isDone)} />
                    <button onClick={() => handleLogSet(ex.id, setNum)}
                      style={{ padding: "8px 0", borderRadius: 8, background: isDone ? "#ECFDF5" : color, color: isDone ? "#059669" : "#fff", fontWeight: 700, fontSize: 13, border: `1.5px solid ${isDone ? "#6EE7B7" : color}`, cursor: "pointer" }}>
                      {isDone ? "Edit" : "Log"}
                    </button>
                  </div>

                  {/* Rest button — tap to start timer */}
                  {pendingRest?.key === key && (
                    <button
                      onClick={() => {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setRestTimer({ key: pendingRest.key, remaining: pendingRest.seconds, total: pendingRest.seconds, kind: pendingRest.kind });
                        setPendingRest(null);
                      }}
                      style={{ width: "100%", marginBottom: 8, padding: "11px 0", borderRadius: 10, background: pendingRest.kind === "round" ? "#EFF6FF" : "#EBF9F8", border: `1.5px solid ${pendingRest.kind === "round" ? "#93C5FD" : "#5EEAD4"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      <span style={{ fontSize: 18 }}>{pendingRest.kind === "round" ? "🔄" : "⏱"}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: pendingRest.kind === "round" ? "#1B68B4" : "#0D9488" }}>
                        Start {pendingRest.kind === "round" ? "Round" : ""} Rest · {pendingRest.seconds}s
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/client/workouts" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Back</Link>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1827" }}>{workout?.name}</div>
            {mode === "session" && <div style={{ fontSize: 12, color: "#2DC4B8", fontWeight: 600 }}>{doneSetCount} / {totalSets} sets done</div>}
          </div>
          {mode === "session" ? (
            <button onClick={handleComplete} disabled={completing} style={{ fontSize: 13, fontWeight: 700, color: "#1B68B4", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>Finish</button>
          ) : <div style={{ width: 48 }} />}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 0" }}>
        {mode === "preview" && (
          <div style={{ marginBottom: 16, background: "#1B68B4", borderRadius: 14, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600 }}>TODAY&apos;S WORKOUT</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginTop: 2 }}>{exercises.length} exercises</div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>~{estMinutes(exercises)} min</div>
          </div>
        )}

        {renderItems.map((item, itemIdx) => {
          if (item.kind === "standalone") {
            return <ExerciseCard key={item.ex.id} ex={item.ex} />;
          }

          const color = groupColor(item.gid);
          const letter = groupLetter(item.gid);
          const roundRest = item.items[0]?.group_round_rest_seconds ?? 90;
          const rounds = item.items[0]?.sets ?? 3;

          // Count completed rounds
          const completedRounds = Array.from({ length: rounds }, (_, i) => i + 1)
            .filter(r => item.items.every(ex => !!logged[`${ex.id}-${r}`])).length;

          return (
            <div key={`group-${item.gid}-${itemIdx}`} style={{ marginBottom: 12 }}>
              {/* Superset header */}
              <div style={{ background: color + "12", border: `1.5px solid ${color}44`, borderBottom: "none", borderRadius: "14px 14px 0 0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 800, color }}>⚡ SUPERSET {letter}</span>
                  <span style={{ fontSize: 12, color: "#6B7A8D", marginLeft: 8 }}>{item.items.length} exercises · {rounds} rounds</span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {Array.from({ length: rounds }, (_, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: i < completedRounds ? color : "#E2EAF0", border: `1.5px solid ${i < completedRounds ? color : "#D1D5DB"}`, transition: "background 0.2s" }} />
                  ))}
                  <span style={{ fontSize: 10, color: "#9CA3AF", marginLeft: 4 }}>{completedRounds}/{rounds}</span>
                </div>
              </div>

              {/* Exercises */}
              <div style={{ border: `1.5px solid ${color}44`, borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
                {item.items.map((ex, i) => (
                  <div key={ex.id}>
                    <ExerciseCard ex={ex} inGroup groupExs={item.items} />
                    {/* Connector between exercises */}
                    {i < item.items.length - 1 && (
                      <div style={{ background: "#F8FAFB", padding: "6px 16px", borderTop: `1px solid ${color}22`, borderBottom: `1px solid ${color}22`, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 2, height: 14, background: color + "50", borderRadius: 1 }} />
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>↓ {ex.rest_seconds}s rest</span>
                      </div>
                    )}
                  </div>
                ))}
                {/* Round rest footer */}
                <div style={{ background: color + "08", padding: "8px 16px", borderTop: `1px solid ${color}22`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color, background: color + "18", borderRadius: 20, padding: "4px 12px" }}>
                    🔄 {roundRest}s round rest
                  </span>
                  {completedRounds > 0 && completedRounds < rounds && (
                    <span style={{ fontSize: 11, color: "#6B7A8D" }}>then repeat round {completedRounds + 1}</span>
                  )}
                  {completedRounds === rounds && rounds > 0 && (
                    <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>✓ All rounds complete!</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating rest timer */}
      {restTimer && (
        <div style={{ position: "fixed", bottom: 100, left: 0, right: 0, zIndex: 50, display: "flex", justifyContent: "center", padding: "0 16px", pointerEvents: "none" }}>
          <div style={{
            background: restTimer.kind === "round" ? "#1B68B4" : "#0D9488",
            borderRadius: 20, padding: "16px 22px", display: "flex", alignItems: "center", gap: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)", pointerEvents: "all", minWidth: 280, maxWidth: 400, width: "100%",
          }}>
            <span style={{ fontSize: 28 }}>{restTimer.kind === "round" ? "🔄" : "⏱"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" }}>
                {restTimer.kind === "round" ? "Round Rest" : "Rest"}
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {Math.floor(restTimer.remaining / 60)}:{String(restTimer.remaining % 60).padStart(2, "0")}
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.25)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#fff", borderRadius: 2, width: `${(restTimer.remaining / restTimer.total) * 100}%`, transition: "width 1s linear" }} />
              </div>
            </div>
            <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setRestTimer(null); }}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* GO! flash when timer ends */}
      {restDone && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ background: "#1B68B4", borderRadius: 24, padding: "32px 48px", textAlign: "center", boxShadow: "0 12px 48px rgba(27,104,180,0.5)", animation: "fadeInOut 2.5s ease" }}>
            <div style={{ fontSize: 52 }}>🚀</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginTop: 8 }}>Go!</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>Next set, let&apos;s get it</div>
          </div>
        </div>
      )}

      {/* Video modal */}
      {videoModal && (
        <div onClick={() => setVideoModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", width: "100%", maxWidth: 420 }}>
            <video src={videoModal.url} controls autoPlay playsInline style={{ width: "100%", maxHeight: 320, display: "block", background: "#000" }} />
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0D1827", marginBottom: 12 }}>{videoModal.name}</div>
              <button onClick={() => setVideoModal(null)} style={{ width: "100%", padding: "13px", borderRadius: 12, background: "#F4F7FA", border: "none", cursor: "pointer", fontWeight: 700, color: "#0D1827", fontSize: 15 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 20px 28px", background: "linear-gradient(transparent, #F4F7FA 30%)", pointerEvents: "none" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", pointerEvents: "all" }}>
          {mode === "preview" ? (
            <button onClick={startWorkout} style={{ width: "100%", padding: "16px", borderRadius: 14, background: "#2DC4B8", color: "#fff", fontWeight: 800, fontSize: 18, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(45,196,184,0.4)" }}>
              Start Workout →
            </button>
          ) : (
            <button onClick={handleComplete} disabled={completing || doneSetCount === 0}
              style={{ width: "100%", padding: "16px", borderRadius: 14, background: doneSetCount === 0 ? "#E2EAF0" : "#1B68B4", color: doneSetCount === 0 ? "#9CA3AF" : "#fff", fontWeight: 800, fontSize: 17, border: "none", cursor: doneSetCount === 0 ? "default" : "pointer", boxShadow: doneSetCount > 0 ? "0 4px 20px rgba(27,104,180,0.35)" : "none" }}>
              {completing ? "Saving…" : `Complete Workout (${doneSetCount}/${totalSets} sets)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const colHdr: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 };
const inputStyle = (done: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 8px", borderRadius: 8, border: `1.5px solid ${done ? "#A7F3D0" : "#E2EAF0"}`,
  background: done ? "#F0FDF4" : "#F8FAFB", fontSize: 16, color: "#0D1827", outline: "none", textAlign: "center", fontWeight: 600,
});

function WorkoutDoneScreen({ workoutName, setsLogged, workoutLogId }: { workoutName: string; setsLogged: number; workoutLogId: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");

  function onMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 52428800) { setError("File must be under 50MB"); return; }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  }

  async function handleShare() {
    setSharing(true); setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let photo_url: string | null = null, video_url: string | null = null;
      if (mediaFile) {
        const isVideo = mediaFile.type.startsWith("video/");
        const ext = mediaFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("post-media").upload(path, mediaFile, { contentType: mediaFile.type });
        if (uploadErr) { setError("Upload failed"); setSharing(false); return; }
        const url = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
        if (isVideo) video_url = url; else photo_url = url;
      }
      await supabase.from("posts").insert({ author_id: user.id, content: caption.trim() || null, photo_url, video_url, post_type: "workout_complete", workout_name: workoutName, workout_log_id: workoutLogId });
      setShared(true);
    } catch { setError("Something went wrong"); } finally { setSharing(false); }
  }

  if (shared) return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🔥</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#1B68B4", marginBottom: 8 }}>Posted to the Feed!</div>
      <div style={{ fontSize: 15, color: "#6B7A8D", marginBottom: 32, textAlign: "center" }}>Your crew can see it now.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}>
        <a href="/client/feed" style={{ padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none", textAlign: "center" }}>See the Feed</a>
        <a href="/client/workouts" style={{ padding: "14px", borderRadius: 12, background: "#F4F7FA", border: "1px solid #E2EAF0", color: "#6B7A8D", fontWeight: 600, fontSize: 15, textDecoration: "none", textAlign: "center" }}>Back to Workouts</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", flexDirection: "column", padding: "32px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#1B68B4", marginBottom: 6 }}>Workout Complete!</div>
        <div style={{ fontSize: 15, color: "#6B7A8D" }}>{workoutName} · {setsLogged} sets logged</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: "1px solid #E2EAF0", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827", marginBottom: 12 }}>Share with the community 🔥</div>
        <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="How did it go? Any PRs? Hype it up..." rows={3}
          style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", resize: "none", fontFamily: "inherit" }} />
        {mediaPreview && (
          <div style={{ position: "relative", marginTop: 10 }}>
            {mediaFile?.type.startsWith("video/")
              ? <video src={mediaPreview} controls style={{ width: "100%", borderRadius: 10, maxHeight: 200, background: "#000" }} />
              : <img src={mediaPreview} alt="preview" style={{ width: "100%", borderRadius: 10, maxHeight: 240, objectFit: "cover" }} />}
            <button onClick={() => { setMediaFile(null); setMediaPreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>
        )}
        <button onClick={() => fileRef.current?.click()} style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6B7A8D" }}>📷 Add Photo / Video</button>
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" onChange={onMediaChange} style={{ display: "none" }} />
        {error && <div style={{ color: "#DC2626", fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button onClick={handleShare} disabled={sharing} style={{ padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: sharing ? 0.6 : 1 }}>
          {sharing ? "Sharing..." : "🔥 Share to Feed"}
        </button>
        <a href="/client/workouts" style={{ padding: "14px", borderRadius: 12, background: "#F4F7FA", border: "1px solid #E2EAF0", color: "#6B7A8D", fontWeight: 600, fontSize: 15, textDecoration: "none", textAlign: "center" }}>
          Skip, back to workouts
        </a>
      </div>
    </div>
  );
}
