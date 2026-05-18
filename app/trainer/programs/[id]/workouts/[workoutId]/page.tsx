"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  notes: string | null;
  order: number;
  exercise_library_id: string | null;
  exercise_library: { video_url: string | null } | null;
};

type Workout = {
  name: string;
  week_number: number;
  day_of_week: number;
  programs: { name: string; trainer_id: string } | null;
};

export default function WorkoutBuilderPage() {
  const params = useParams();
  const programId = params.id as string;
  const workoutId = params.workoutId as string;
  const router = useRouter();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { sets: string; reps: string; rest_seconds: string; notes: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: w }, { data: exs }] = await Promise.all([
        supabase.from("workouts").select("name, week_number, day_of_week, programs(name, trainer_id)").eq("id", workoutId).single(),
        supabase.from("exercises")
          .select("id, name, sets, reps, rest_seconds, notes, order, exercise_library_id, exercise_library(video_url)")
          .eq("workout_id", workoutId)
          .order("order"),
      ]);
      setWorkout(w as unknown as Workout);
      setExercises(((exs ?? []) as any[]).map(e => ({
        ...e,
        exercise_library: Array.isArray(e.exercise_library) ? (e.exercise_library[0] ?? null) : e.exercise_library,
      })) as Exercise[]);
      setLoading(false);
    })();
  }, [workoutId]);

  function initEdit(ex: Exercise) {
    if (edits[ex.id]) return;
    setEdits(prev => ({
      ...prev,
      [ex.id]: {
        sets: String(ex.sets),
        reps: ex.reps,
        rest_seconds: String(ex.rest_seconds),
        notes: ex.notes ?? "",
      },
    }));
  }

  function toggleExpand(ex: Exercise) {
    if (expandedId === ex.id) {
      setExpandedId(null);
    } else {
      initEdit(ex);
      setExpandedId(ex.id);
    }
  }

  const saveExercise = useCallback(async (exId: string) => {
    const edit = edits[exId];
    if (!edit) return;
    setSaving(exId);
    const supabase = createClient();
    await supabase.from("exercises").update({
      sets: parseInt(edit.sets) || 3,
      reps: edit.reps,
      rest_seconds: parseInt(edit.rest_seconds) || 60,
      notes: edit.notes || null,
    }).eq("id", exId);
    setExercises(prev => prev.map(e => e.id === exId ? {
      ...e,
      sets: parseInt(edit.sets) || 3,
      reps: edit.reps,
      rest_seconds: parseInt(edit.rest_seconds) || 60,
      notes: edit.notes || null,
    } : e));
    setSaving(null);
    setExpandedId(null);
  }, [edits]);

  const deleteExercise = useCallback(async (exId: string) => {
    setDeleting(exId);
    const supabase = createClient();
    await supabase.from("exercises").delete().eq("id", exId);
    const remaining = exercises.filter(e => e.id !== exId).map((e, i) => ({ ...e, order: i }));
    // reorder remaining
    await Promise.all(remaining.map(e => supabase.from("exercises").update({ order: e.order }).eq("id", e.id)));
    setExercises(remaining);
    setDeleting(null);
    if (expandedId === exId) setExpandedId(null);
  }, [exercises, expandedId]);

  const moveUp = useCallback(async (idx: number) => {
    if (idx === 0 || reordering) return;
    setReordering(true);
    const updated = [...exercises];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    const reindexed = updated.map((e, i) => ({ ...e, order: i }));
    setExercises(reindexed);
    const supabase = createClient();
    await Promise.all([
      supabase.from("exercises").update({ order: idx - 1 }).eq("id", reindexed[idx - 1].id),
      supabase.from("exercises").update({ order: idx }).eq("id", reindexed[idx].id),
    ]);
    setReordering(false);
  }, [exercises, reordering]);

  const moveDown = useCallback(async (idx: number) => {
    if (idx === exercises.length - 1 || reordering) return;
    setReordering(true);
    const updated = [...exercises];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    const reindexed = updated.map((e, i) => ({ ...e, order: i }));
    setExercises(reindexed);
    const supabase = createClient();
    await Promise.all([
      supabase.from("exercises").update({ order: idx }).eq("id", reindexed[idx].id),
      supabase.from("exercises").update({ order: idx + 1 }).eq("id", reindexed[idx + 1].id),
    ]);
    setReordering(false);
  }, [exercises, reordering]);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "#6B7A8D" }}>Loading…</div>
      </div>
    );
  }

  const programName = (workout?.programs as { name: string } | null)?.name ?? "Program";

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href={`/trainer/programs/${programId}`} style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← {programName}</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>{workout?.name}</div>
          <div style={{ fontSize: 13, color: "#6B7A8D" }}>
            Week {workout?.week_number} · {workout ? DAYS[workout.day_of_week] : ""} · {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", marginBottom: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏋️</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No exercises yet</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Tap below to add exercises from your library</div>
          </div>
        )}

        {exercises.map((ex, idx) => {
          const isExpanded = expandedId === ex.id;
          const edit = edits[ex.id];
          const isDeletingThis = deleting === ex.id;
          const isSavingThis = saving === ex.id;
          const videoUrl = ex.exercise_library?.video_url ?? null;

          return (
            <div
              key={ex.id}
              style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${isExpanded ? "#1B68B4" : "#E2EAF0"}`, marginBottom: 10, overflow: "hidden", opacity: isDeletingThis ? 0.4 : 1, transition: "opacity 0.2s" }}
            >
              {/* Exercise row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                {/* Thumbnail */}
                {videoUrl ? (
                  <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#000" }}>
                    <video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline preload="metadata" />
                  </div>
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>
                    💪
                  </div>
                )}

                {/* Info — tappable to expand */}
                <div style={{ flex: 1, cursor: "pointer" }} onClick={() => toggleExpand(ex)}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>{idx + 1}. {ex.name}</div>
                  <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
                    {ex.sets} sets × {ex.reps} · {ex.rest_seconds}s rest
                  </div>
                  {ex.notes && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" }}>{ex.notes}</div>}
                </div>

                {/* Reorder + expand toggle */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0 || reordering}
                    style={{ background: "none", border: "none", fontSize: 16, cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#E2EAF0" : "#9CA3AF", padding: "2px 6px", lineHeight: 1 }}
                  >▲</button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === exercises.length - 1 || reordering}
                    style={{ background: "none", border: "none", fontSize: 16, cursor: idx === exercises.length - 1 ? "default" : "pointer", color: idx === exercises.length - 1 ? "#E2EAF0" : "#9CA3AF", padding: "2px 6px", lineHeight: 1 }}
                  >▼</button>
                </div>

                <button
                  onClick={() => toggleExpand(ex)}
                  style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: isExpanded ? "#1B68B4" : "#C0CBD6", padding: "4px 6px", flexShrink: 0, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                >
                  ›
                </button>
              </div>

              {/* Inline edit panel */}
              {isExpanded && edit && (
                <div style={{ borderTop: "1px solid #F4F7FA", padding: "14px 16px", background: "#F8FAFB" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <div style={lbl}>Sets</div>
                      <input
                        type="number"
                        min={1}
                        value={edit.sets}
                        onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], sets: e.target.value } }))}
                        style={inp}
                      />
                    </div>
                    <div>
                      <div style={lbl}>Reps</div>
                      <input
                        value={edit.reps}
                        onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], reps: e.target.value } }))}
                        placeholder="8-12"
                        style={inp}
                      />
                    </div>
                    <div>
                      <div style={lbl}>Rest (sec)</div>
                      <input
                        type="number"
                        value={edit.rest_seconds}
                        onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], rest_seconds: e.target.value } }))}
                        style={inp}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={lbl}>Notes</div>
                    <input
                      value={edit.notes}
                      onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], notes: e.target.value } }))}
                      placeholder="Coaching cues, form tips…"
                      style={{ ...inp, width: "100%" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => saveExercise(ex.id)}
                      disabled={isSavingThis}
                      style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                    >
                      {isSavingThis ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                      onClick={() => deleteExercise(ex.id)}
                      disabled={isDeletingThis}
                      style={{ padding: "11px 16px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fixed bottom CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 20px 28px", background: "linear-gradient(transparent, #F4F7FA 30%)" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link
            href={`/trainer/programs/${programId}/workouts/${workoutId}/add-exercise`}
            style={{ display: "block", width: "100%", padding: "15px", borderRadius: 14, background: "#1B68B4", color: "#fff", fontWeight: 800, fontSize: 16, textDecoration: "none", textAlign: "center", boxShadow: "0 4px 20px rgba(27,104,180,0.35)" }}
          >
            + Add Exercise
          </Link>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#6B7A8D", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5,
};
const inp: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 8, border: "1px solid #E2EAF0", background: "#fff",
  fontSize: 15, color: "#0D1827", outline: "none", width: "100%",
};
