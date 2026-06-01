"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  notes: string | null;
  order: number;
  is_unilateral: boolean;
};

type Workout = { id: string; name: string; week_number: number; day_of_week: number };
type Program = { id: string; name: string };

type SetEntry = { reps: string; weight: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TrainerLogWorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [clientName, setClientName] = useState("");
  const [programs, setPrograms] = useState<{ program: Program; workouts: Workout[] }[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sets, setSets] = useState<Record<string, SetEntry[]>>({});
  const [workoutDate, setWorkoutDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingEx, setLoadingEx] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [{ data: profile }, { data: assignments }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", clientId).single(),
        supabase
          .from("client_programs")
          .select("program_id, programs(id, name)")
          .eq("client_id", clientId)
          .eq("is_active", true),
      ]);

      setClientName(profile?.full_name ?? "Client");

      if (!assignments || assignments.length === 0) return;

      const programIds = assignments.map((a: any) => a.program_id);
      const { data: workouts } = await supabase
        .from("workouts")
        .select("id, name, week_number, day_of_week, program_id")
        .in("program_id", programIds)
        .order("week_number")
        .order("day_of_week");

      const grouped = assignments.map((a: any) => ({
        program: a.programs as Program,
        workouts: (workouts ?? []).filter((w: any) => w.program_id === a.program_id),
      }));

      setPrograms(grouped);
    })();
  }, [clientId]);

  const loadExercises = useCallback(async (workoutId: string) => {
    setLoadingEx(true);
    setExercises([]);
    setSets({});
    const supabase = createClient();
    const { data } = await supabase
      .from("exercises")
      .select("id, name, sets, reps, notes, order, is_unilateral")
      .eq("workout_id", workoutId)
      .order("order");

    const exs = data ?? [];
    setExercises(exs);

    const initSets: Record<string, SetEntry[]> = {};
    exs.forEach((ex: Exercise) => {
      initSets[ex.id] = Array.from({ length: ex.sets }, () => ({ reps: "", weight: "" }));
    });
    setSets(initSets);
    setLoadingEx(false);
  }, []);

  function selectWorkout(id: string) {
    setSelectedWorkoutId(id);
    loadExercises(id);
    setSaved(false);
    setError("");
  }

  function updateSet(exId: string, idx: number, field: "reps" | "weight", val: string) {
    setSets(prev => {
      const next = { ...prev };
      next[exId] = [...(prev[exId] ?? [])];
      next[exId][idx] = { ...next[exId][idx], [field]: val };
      return next;
    });
  }

  async function handleSave() {
    if (!selectedWorkoutId) return;
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
          workout_id: selectedWorkoutId,
          completed_at: new Date(workoutDate + "T12:00:00").toISOString(),
          notes: notes.trim() || null,
          logged_by: user.id,
        })
        .select("id")
        .single();

      if (wErr || !wlog) throw wErr ?? new Error("Failed to create log");

      const rows: object[] = [];
      exercises.forEach(ex => {
        (sets[ex.id] ?? []).forEach((s, idx) => {
          if (s.reps !== "" || s.weight !== "") {
            rows.push({
              client_id: clientId,
              workout_log_id: wlog.id,
              exercise_id: ex.id,
              set_number: idx + 1,
              reps_completed: s.reps !== "" ? parseInt(s.reps, 10) : null,
              weight_lbs: s.weight !== "" ? parseFloat(s.weight) : null,
              side: "both",
            });
          }
        });
      });

      if (rows.length > 0) {
        const { error: sErr } = await supabase.from("set_logs").insert(rows);
        if (sErr) throw sErr;
      }

      setSaved(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>Workout Logged!</div>
        <div style={{ fontSize: 14, color: "#6B7A8D" }}>Saved for {clientName}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexDirection: "column", width: "100%", maxWidth: 300 }}>
          <button onClick={() => { setSaved(false); setSelectedWorkoutId(null); setExercises([]); setSets({}); setNotes(""); }}
            style={btnTeal}>Log Another Workout</button>
          <Link href={`/trainer/clients/${clientId}?tab=workouts`} style={{ ...btnGray, textAlign: "center", textDecoration: "none" }}>
            Back to Client
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href={`/trainer/clients/${clientId}?tab=workouts`} style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← {clientName}</Link>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Log Workout</div>
          <div style={{ fontSize: 13, color: "#6B7A8D" }}>Logging for {clientName}</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Date */}
        <div style={card}>
          <label style={labelSt}>Date</label>
          <input type="date" value={workoutDate} onChange={e => setWorkoutDate(e.target.value)} style={inputSt} />
        </div>

        {/* Workout picker */}
        <div style={card}>
          <div style={sectionLabel}>Select Workout</div>
          {programs.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 14 }}>No active program assigned to this client.</div>
          ) : (
            programs.map(({ program, workouts }) => (
              <div key={program.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", marginBottom: 6, textTransform: "uppercase" }}>{program.name}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {workouts.map(w => (
                    <button
                      key={w.id}
                      onClick={() => selectWorkout(w.id)}
                      style={{
                        padding: "12px 14px", borderRadius: 10, border: `2px solid ${selectedWorkoutId === w.id ? "#2DC4B8" : "#E2EAF0"}`,
                        background: selectedWorkoutId === w.id ? "#F0FDFC" : "#F4F7FA",
                        cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: selectedWorkoutId === w.id ? "#0D9488" : "#0D1827" }}>{w.name}</span>
                      <span style={{ fontSize: 12, color: "#6B7A8D" }}>Wk {w.week_number} · {DAYS[w.day_of_week]}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Exercises */}
        {loadingEx && <div style={{ color: "#6B7A8D", fontSize: 14, textAlign: "center" }}>Loading exercises…</div>}

        {!loadingEx && exercises.length > 0 && exercises.map(ex => (
          <div key={ex.id} style={card}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827", marginBottom: 2 }}>{ex.name}</div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginBottom: ex.notes ? 4 : 10 }}>{ex.sets} sets × {ex.reps}</div>
            {ex.notes && <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic", marginBottom: 10 }}>{ex.notes}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr", gap: 6, marginBottom: 6 }}>
              <div style={colHdr}>Set</div>
              <div style={colHdr}>Weight (lbs)</div>
              <div style={colHdr}>Reps</div>
            </div>
            {(sets[ex.id] ?? []).map((s, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", textAlign: "center" }}>{idx + 1}</div>
                <input
                  type="text" inputMode="decimal"
                  placeholder="e.g. 135"
                  value={s.weight}
                  onChange={e => updateSet(ex.id, idx, "weight", e.target.value)}
                  style={cellInput}
                />
                <input
                  type="text" inputMode="numeric"
                  placeholder={ex.reps.split(/[-x]/)[0].trim()}
                  value={s.reps}
                  onChange={e => updateSet(ex.id, idx, "reps", e.target.value)}
                  style={cellInput}
                />
              </div>
            ))}
          </div>
        ))}

        {/* Notes */}
        {selectedWorkoutId && !loadingEx && (
          <div style={card}>
            <label style={labelSt}>Session Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="How did the session go?"
              rows={3}
              style={{ ...inputSt, resize: "none", fontFamily: "inherit" }}
            />
          </div>
        )}

        {error && <div style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>{error}</div>}
      </div>

      {/* Save button */}
      {selectedWorkoutId && !loadingEx && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 16px 32px", background: "linear-gradient(transparent, #F4F7FA 30%)" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnTeal, opacity: saving ? 0.6 : 1, width: "100%", fontSize: 16 }}>
              {saving ? "Saving…" : "Save Workout Log"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" };
const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 };
const labelSt: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: "#6B7A8D", marginBottom: 8, textTransform: "uppercase" };
const inputSt: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" };
const cellInput: React.CSSProperties = { width: "100%", padding: "10px 8px", borderRadius: 8, border: "1.5px solid #E2EAF0", background: "#F8FAFB", fontSize: 15, color: "#0D1827", outline: "none", textAlign: "center", fontWeight: 600 };
const colHdr: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" };
const btnTeal: React.CSSProperties = { padding: "15px 20px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" };
const btnGray: React.CSSProperties = { padding: "15px 20px", borderRadius: 12, background: "#F4F7FA", color: "#6B7A8D", fontWeight: 600, fontSize: 15, border: "1px solid #E2EAF0", cursor: "pointer" };
