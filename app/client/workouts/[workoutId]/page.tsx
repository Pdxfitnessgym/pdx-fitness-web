"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useParams } from "next/navigation";
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
};

type SetKey = string; // `${exercise_id}-${set_number}`
type LoggedSet = { reps: number | null; weight: number | null };

type Mode = "preview" | "session" | "done";

function estMinutes(exs: ExerciseRow[]) {
  const secs = exs.reduce((acc, ex) => acc + ex.sets * (45 + ex.rest_seconds), 0);
  return Math.round(secs / 60);
}

export default function WorkoutSessionPage() {
  const params = useParams();
  const workoutId = params.workoutId as string;
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("preview");
  const [workout, setWorkout] = useState<{ name: string } | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [logged, setLogged] = useState<Record<SetKey, LoggedSet>>({});
  const [prevLogged, setPrevLogged] = useState<Record<SetKey, LoggedSet>>({});
  const [inputs, setInputs] = useState<Record<SetKey, { reps: string; weight: string }>>({});
  const [restTimer, setRestTimer] = useState<{ key: SetKey; remaining: number; total: number } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<{ url: string; name: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // load workout + exercises + existing logs
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: w }, { data: exs }, { data: { user } }] = await Promise.all([
        supabase.from("workouts").select("name").eq("id", workoutId).single(),
        supabase.from("exercises")
          .select("id, name, sets, reps, rest_seconds, notes, order, exercise_library(video_url)")
          .eq("workout_id", workoutId)
          .order("order"),
        supabase.auth.getUser(),
      ]);
      setWorkout(w);
      setExercises(exs ?? []);

      if (!user) return;
      setUserId(user.id);

      // today's session
      const today = new Date().toISOString().split("T")[0];
      const { data: todayLog } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("client_id", user.id)
        .eq("workout_id", workoutId)
        .gte("created_at", today)
        .maybeSingle();

      if (todayLog) {
        setWorkoutLogId(todayLog.id);
        const { data: sl } = await supabase
          .from("set_logs")
          .select("exercise_id, set_number, reps_completed, weight_lbs")
          .eq("workout_log_id", todayLog.id);
        const map: Record<SetKey, LoggedSet> = {};
        sl?.forEach(s => { map[`${s.exercise_id}-${s.set_number}`] = { reps: s.reps_completed, weight: s.weight_lbs }; });
        setLogged(map);
        if (Object.keys(map).length > 0) setMode("session");
      }

      // previous session (for "Previous" data)
      const { data: prevLog } = await supabase
        .from("workout_logs")
        .select("id")
        .eq("client_id", user.id)
        .eq("workout_id", workoutId)
        .lt("created_at", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevLog) {
        const { data: sl } = await supabase
          .from("set_logs")
          .select("exercise_id, set_number, reps_completed, weight_lbs")
          .eq("workout_log_id", prevLog.id);
        const map: Record<SetKey, LoggedSet> = {};
        sl?.forEach(s => { map[`${s.exercise_id}-${s.set_number}`] = { reps: s.reps_completed, weight: s.weight_lbs }; });
        setPrevLogged(map);
      }

      setLoading(false);
    })();
  }, [workoutId]);

  // rest timer tick
  useEffect(() => {
    if (!restTimer) return;
    if (restTimer.remaining <= 0) {
      setRestTimer(null);
      return;
    }
    timerRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (!prev) return null;
        if (prev.remaining <= 1) { clearInterval(timerRef.current!); return null; }
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
      const { data } = await supabase.from("workout_logs").insert({
        client_id: userId,
        workout_id: workoutId,
        completed_at: new Date().toISOString(),
      }).select("id").single();
      logId = data?.id ?? null;
      setWorkoutLogId(logId);
    }
    setMode("session");
  }, [workoutId, workoutLogId, userId]);

  const handleLogSet = useCallback(async (exerciseId: string, setNum: number, restSecs: number) => {
    const key: SetKey = `${exerciseId}-${setNum}`;
    const inp = inputs[key] ?? { reps: "", weight: "" };
    if (!inp.reps && !inp.weight) return;

    const logId = workoutLogId;
    if (!logId || !userId) return;

    const reps = inp.reps ? parseInt(inp.reps) : null;
    const weight = inp.weight ? parseFloat(inp.weight) : null;

    // optimistic
    setLogged(prev => ({ ...prev, [key]: { reps, weight } }));

    const supabase = createClient();
    await supabase.from("set_logs").upsert({
      client_id: userId,
      workout_log_id: logId,
      exercise_id: exerciseId,
      set_number: setNum,
      reps_completed: reps,
      weight_lbs: weight,
    }, { onConflict: "workout_log_id,exercise_id,set_number" });

    // start rest timer
    if (restSecs > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      setRestTimer({ key, remaining: restSecs, total: restSecs });
    }
  }, [inputs, workoutLogId, userId]);

  const handleComplete = useCallback(async () => {
    setCompleting(true);
    const supabase = createClient();
    if (workoutLogId) {
      await supabase.from("workout_logs").update({ completed_at: new Date().toISOString() }).eq("id", workoutLogId);
    }
    setMode("done");
    setCompleting(false);
  }, [workoutLogId]);

  const doneSetCount = Object.keys(logged).length;
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets, 0);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#6B7A8D" }}>Loading…</div>
      </div>
    );
  }

  if (mode === "done") {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#1B68B4", marginBottom: 8 }}>Workout Complete!</div>
        <div style={{ fontSize: 15, color: "#6B7A8D", marginBottom: 32, textAlign: "center" }}>
          {workout?.name} · {doneSetCount} sets logged
        </div>
        <a href="/client/workouts" style={{ padding: "14px 32px", borderRadius: 14, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none" }}>
          Back to Workouts
        </a>
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
            {mode === "session" && (
              <div style={{ fontSize: 12, color: "#2DC4B8", fontWeight: 600 }}>{doneSetCount} / {totalSets} sets done</div>
            )}
          </div>
          {mode === "session" ? (
            <button
              onClick={handleComplete}
              disabled={completing}
              style={{ fontSize: 13, fontWeight: 700, color: "#1B68B4", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
            >
              Finish
            </button>
          ) : (
            <div style={{ width: 48 }} />
          )}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 16px 0" }}>

        {/* Preview mode summary */}
        {mode === "preview" && (
          <div style={{ marginBottom: 16, background: "#1B68B4", borderRadius: 14, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: 600 }}>TODAY'S WORKOUT</div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginTop: 2 }}>{exercises.length} exercises</div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>~{estMinutes(exercises)} min</div>
          </div>
        )}

        {/* Exercise cards */}
        {exercises.map((ex, idx) => {
          const exLogs = Object.fromEntries(
            Object.entries(logged).filter(([k]) => k.startsWith(ex.id))
          );
          const exLogCount = Object.keys(exLogs).length;
          const allSetsLogged = exLogCount >= ex.sets;
          const videoUrl = ex.exercise_library?.video_url ?? null;

          return (
            <div key={ex.id} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${allSetsLogged ? "#A7F3D0" : "#E2EAF0"}`, marginBottom: 12, overflow: "hidden" }}>
              {/* Exercise header */}
              <div style={{ padding: "14px 16px", display: "flex", gap: 12, alignItems: "center", borderBottom: mode === "session" ? "1px solid #F4F7FA" : "none" }}>
                {videoUrl ? (
                  <div
                    onClick={() => setVideoModal({ url: videoUrl, name: ex.name })}
                    style={{ width: 60, height: 60, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#000", cursor: "pointer", position: "relative" }}
                  >
                    <video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline preload="metadata" />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, paddingLeft: 2 }}>▶</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ width: 60, height: 60, borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 24 }}>
                    💪
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#2DC4B8", fontWeight: 700, marginBottom: 2 }}>
                    {allSetsLogged ? "✓ " : ""}{idx + 1} of {exercises.length}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "#0D1827" }}>{ex.name}</div>
                  <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
                    {ex.sets} sets × {ex.reps} · {ex.rest_seconds}s rest
                  </div>
                  {ex.notes && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" }}>{ex.notes}</div>}
                </div>
              </div>

              {/* Session set rows */}
              {mode === "session" && (
                <div style={{ padding: "0 16px 12px" }}>
                  {/* Column headers */}
                  <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 1fr 72px", gap: 8, padding: "10px 0 6px", borderBottom: "1px solid #F4F7FA", marginBottom: 4 }}>
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
                    const isResting = restTimer?.key === key;

                    return (
                      <div key={setNum}>
                        {/* Previous performance (first set only) */}
                        {setNum === 1 && prev && (
                          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6, marginTop: 2 }}>
                            Previous: {prev.reps != null ? `${prev.reps} reps` : ""}
                            {prev.reps != null && prev.weight != null ? " × " : ""}
                            {prev.weight != null && prev.weight > 0 ? `${prev.weight} lbs` : prev.reps != null ? "" : "bodyweight"}
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 1fr 72px", gap: 8, alignItems: "center", marginBottom: 6 }}>
                          {/* Set number / checkmark */}
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: isDone ? "#2DC4B8" : "#F4F7FA", border: `2px solid ${isDone ? "#2DC4B8" : "#E2EAF0"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
                            {isDone
                              ? <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>✓</span>
                              : <span style={{ color: "#6B7A8D", fontSize: 13, fontWeight: 700 }}>{setNum}</span>
                            }
                          </div>

                          {/* Reps */}
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder={logged[key]?.reps != null ? String(logged[key].reps) : ex.reps.split(/[-x]/)[0].trim()}
                            value={inp.reps}
                            onChange={e => setInputs(p => ({ ...p, [key]: { ...inp, reps: e.target.value } }))}
                            style={inputStyle(isDone)}
                          />

                          {/* Weight */}
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder={logged[key]?.weight != null ? String(logged[key].weight) : prev?.weight != null ? String(prev.weight) : "0"}
                            value={inp.weight}
                            onChange={e => setInputs(p => ({ ...p, [key]: { ...inp, weight: e.target.value } }))}
                            style={inputStyle(isDone)}
                          />

                          {/* Log button */}
                          <button
                            onClick={() => handleLogSet(ex.id, setNum, ex.rest_seconds)}
                            style={{
                              padding: "8px 0",
                              borderRadius: 8,
                              background: isDone ? "#ECFDF5" : "#2DC4B8",
                              color: isDone ? "#059669" : "#fff",
                              fontWeight: 700,
                              fontSize: 13,
                              border: `1.5px solid ${isDone ? "#6EE7B7" : "#2DC4B8"}`,
                              cursor: "pointer",
                            }}
                          >
                            {isDone ? "Edit" : "Log"}
                          </button>
                        </div>

                        {/* Rest timer */}
                        {isResting && restTimer && (
                          <div style={{ background: "#EBF9F8", borderRadius: 10, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 18 }}>⏱</span>
                              <div>
                                <div style={{ fontSize: 11, color: "#2DC4B8", fontWeight: 700 }}>REST</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#0D1827", lineHeight: 1 }}>
                                  {Math.floor(restTimer.remaining / 60)}:{String(restTimer.remaining % 60).padStart(2, "0")}
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div style={{ width: 80, height: 4, background: "#E2EAF0", borderRadius: 2, overflow: "hidden" }}>
                                <div style={{ height: "100%", background: "#2DC4B8", borderRadius: 2, width: `${(restTimer.remaining / restTimer.total) * 100}%`, transition: "width 1s linear" }} />
                              </div>
                            </div>
                            <button
                              onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setRestTimer(null); }}
                              style={{ fontSize: 12, color: "#6B7A8D", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Video modal */}
      {videoModal && (
        <div
          onClick={() => setVideoModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", width: "100%", maxWidth: 420 }}>
            <video
              src={videoModal.url}
              controls
              autoPlay
              playsInline
              style={{ width: "100%", maxHeight: 320, display: "block", background: "#000" }}
            />
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0D1827", marginBottom: 12 }}>{videoModal.name}</div>
              <button
                onClick={() => setVideoModal(null)}
                style={{ width: "100%", padding: "13px", borderRadius: 12, background: "#F4F7FA", border: "none", cursor: "pointer", fontWeight: 700, color: "#0D1827", fontSize: 15 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 20px 28px", background: "linear-gradient(transparent, #F4F7FA 30%)", pointerEvents: "none" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", pointerEvents: "all" }}>
          {mode === "preview" ? (
            <button
              onClick={startWorkout}
              style={{ width: "100%", padding: "16px", borderRadius: 14, background: "#2DC4B8", color: "#fff", fontWeight: 800, fontSize: 18, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(45,196,184,0.4)" }}
            >
              Start Workout →
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={completing || doneSetCount === 0}
              style={{ width: "100%", padding: "16px", borderRadius: 14, background: doneSetCount === 0 ? "#E2EAF0" : "#1B68B4", color: doneSetCount === 0 ? "#9CA3AF" : "#fff", fontWeight: 800, fontSize: 17, border: "none", cursor: doneSetCount === 0 ? "default" : "pointer", boxShadow: doneSetCount > 0 ? "0 4px 20px rgba(27,104,180,0.35)" : "none" }}
            >
              {completing ? "Saving…" : `Complete Workout (${doneSetCount}/${totalSets} sets)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const colHdr: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5,
};

const inputStyle = (done: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "10px 8px",
  borderRadius: 8,
  border: `1.5px solid ${done ? "#A7F3D0" : "#E2EAF0"}`,
  background: done ? "#F0FDF4" : "#F8FAFB",
  fontSize: 16,
  color: "#0D1827",
  outline: "none",
  textAlign: "center",
  fontWeight: 600,
});
