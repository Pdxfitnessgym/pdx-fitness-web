"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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
  is_unilateral: boolean;
  suggested_weight_lbs: number | null;
};

type LibExercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  video_url: string | null;
};

type Workout = {
  id: string;
  name: string;
  description: string | null;
  difficulty: string | null;
  est_duration_mins: number | null;
  category: string | null;
};

const DIFF_COLOR: Record<string, string> = {
  beginner: "#10B981",
  intermediate: "#F59E0B",
  advanced: "#EF4444",
};

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

export default function StandaloneWorkoutEditorPage() {
  const params = useParams();
  const workoutId = params.id as string;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  // exercise editing
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { sets: string; reps: string; rest_seconds: string; notes: string; is_unilateral: boolean; suggested_weight_lbs: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add to Program modal
  const [showAddToProgram, setShowAddToProgram] = useState(false);
  const [programs, setPrograms] = useState<{ id: string; name: string; duration_weeks: number }[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("1");
  const [selectedDay, setSelectedDay] = useState("1");
  const [addingToProgram, setAddingToProgram] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Assign to Client modal
  const [showAssignClient, setShowAssignClient] = useState(false);
  const [clients, setClients] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  async function openAddToProgram() {
    setShowAddToProgram(true);
    setAddedSuccess(false);
    if (programs.length) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("programs").select("id, name, duration_weeks").eq("trainer_id", user.id).order("name");
    setPrograms(data ?? []);
    if (data?.length) setSelectedProgram(data[0].id);
  }

  async function handleAddToProgram() {
    if (!selectedProgram) return;
    setAddingToProgram(true);
    const supabase = createClient();

    // Create the workout inside the program
    const { data: newWorkout, error: insertErr } = await supabase.from("workouts").insert({
      program_id: selectedProgram,
      name: workout!.name,
      day_of_week: parseInt(selectedDay) === 7 ? 0 : parseInt(selectedDay),
      week_number: parseInt(selectedWeek),
      is_standalone: false,
    }).select("id").single();

    if (insertErr || !newWorkout) { setAddingToProgram(false); alert("Failed to add to program. Please try again."); return; }

    if (newWorkout && exercises.length) {
      await supabase.from("exercises").insert(
        exercises.map(ex => ({
          workout_id: newWorkout.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          order: ex.order,
          exercise_library_id: ex.exercise_library_id,
        }))
      );
    }

    setAddingToProgram(false);
    setAddedSuccess(true);
  }

  async function openAssignClient() {
    setShowAssignClient(true);
    setAssignSuccess(false);
    if (clients.length) return;
    setClientsLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setClientsLoading(false); return; }
    const [{ data: clientList }, { data: existing }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("trainer_id", user.id).eq("role", "client").order("full_name"),
      supabase.from("client_workout_assignments").select("client_id").eq("workout_id", workoutId),
    ]);
    setClients((clientList ?? []) as { id: string; full_name: string | null; email: string | null }[]);
    setAssignedClientIds((existing ?? []).map(r => r.client_id));
    setClientsLoading(false);
  }

  function toggleAssignClient(clientId: string) {
    setAssignedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  }

  async function handleAssignClients() {
    setAssigning(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAssigning(false); return; }

    // Get current assignments
    const { data: current } = await supabase
      .from("client_workout_assignments")
      .select("client_id")
      .eq("workout_id", workoutId);
    const currentIds = (current ?? []).map(r => r.client_id);

    // Insert new assignments
    const toAdd = assignedClientIds.filter(id => !currentIds.includes(id));
    if (toAdd.length) {
      await supabase.from("client_workout_assignments").insert(
        toAdd.map(client_id => ({ client_id, workout_id: workoutId, assigned_by: user.id }))
      );
    }

    // Remove unselected
    const toRemove = currentIds.filter(id => !assignedClientIds.includes(id));
    if (toRemove.length) {
      await supabase.from("client_workout_assignments")
        .delete()
        .eq("workout_id", workoutId)
        .in("client_id", toRemove);
    }

    setAssigning(false);
    setAssignSuccess(true);
  }

  // inline exercise picker
  const [showPicker, setShowPicker] = useState(false);
  const [libExercises, setLibExercises] = useState<LibExercise[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pickSelected, setPickSelected] = useState<{ ex: LibExercise; sets: number; reps: string; rest_seconds: number }[]>([]);
  const [addingSaved, setAddingSaved] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: w }, { data: exs }] = await Promise.all([
      supabase.from("workouts").select("id, name, description, difficulty, est_duration_mins, category").eq("id", workoutId).single(),
      supabase.from("exercises")
        .select("id, name, sets, reps, rest_seconds, notes, order, exercise_library_id, exercise_library(video_url), is_unilateral, suggested_weight_lbs")
        .eq("workout_id", workoutId).order("order"),
    ]);
    setWorkout(w as Workout);
    setExercises(((exs ?? []) as any[]).map(e => ({
      ...e,
      exercise_library: Array.isArray(e.exercise_library) ? (e.exercise_library[0] ?? null) : e.exercise_library,
    })));
    setLoading(false);
  }, [workoutId]);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id: string, ex: Exercise) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setEdits(prev => ({
      ...prev,
      [id]: { sets: String(ex.sets), reps: ex.reps, rest_seconds: String(ex.rest_seconds), notes: ex.notes ?? "", is_unilateral: ex.is_unilateral, suggested_weight_lbs: ex.suggested_weight_lbs != null ? String(ex.suggested_weight_lbs) : "" },
    }));
  }

  async function saveExercise(id: string) {
    const e = edits[id];
    if (!e) return;
    setSaving(id);
    const supabase = createClient();
    const patch = {
      sets: parseInt(e.sets) || 3,
      reps: e.reps,
      rest_seconds: parseInt(e.rest_seconds) || 60,
      notes: e.notes.trim() || null,
      is_unilateral: e.is_unilateral,
      suggested_weight_lbs: e.suggested_weight_lbs !== "" ? parseFloat(e.suggested_weight_lbs) || null : null,
    };
    await supabase.from("exercises").update(patch).eq("id", id);
    setExercises(prev => prev.map(ex => ex.id === id ? { ...ex, ...patch } : ex));
    setSaving(null);
    setExpandedId(null);
  }

  async function deleteExercise(id: string) {
    if (!confirm("Remove this exercise?")) return;
    setDeleting(id);
    const supabase = createClient();
    await supabase.from("exercises").delete().eq("id", id);
    setExercises(prev => prev.filter(ex => ex.id !== id));
    setDeleting(null);
  }

  async function moveExercise(id: string, dir: -1 | 1) {
    const idx = exercises.findIndex(e => e.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= exercises.length) return;
    const supabase = createClient();
    const a = exercises[idx], b = exercises[swapIdx];
    await Promise.all([
      supabase.from("exercises").update({ order: b.order }).eq("id", a.id),
      supabase.from("exercises").update({ order: a.order }).eq("id", b.id),
    ]);
    const next = [...exercises];
    next[idx] = { ...a, order: b.order };
    next[swapIdx] = { ...b, order: a.order };
    next.sort((x, y) => x.order - y.order);
    setExercises(next);
  }

  async function openPicker() {
    setShowPicker(true);
    setPickSelected([]);
    setSearch("");
    if (libExercises.length) return;
    setLibLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLibLoading(false); return; }
    const { data } = await supabase
      .from("exercise_library")
      .select("id, name, muscle_group, equipment, video_url")
      .or(`trainer_id.eq.${user.id},trainer_id.is.null`)
      .order("name");
    setLibExercises((data ?? []) as LibExercise[]);
    setLibLoading(false);
  }

  function togglePickExercise(ex: LibExercise) {
    const exists = pickSelected.find(s => s.ex.id === ex.id);
    if (exists) setPickSelected(pickSelected.filter(s => s.ex.id !== ex.id));
    else setPickSelected([...pickSelected, { ex, sets: 3, reps: "8-12", rest_seconds: 60 }]);
  }

  async function addPickedExercises() {
    if (!pickSelected.length) return;
    setAddingSaved(true);
    const supabase = createClient();
    const baseOrder = exercises.length;
    const rows = pickSelected.map((s, i) => ({
      workout_id: workoutId,
      name: s.ex.name,
      sets: s.sets,
      reps: s.reps,
      rest_seconds: s.rest_seconds,
      notes: null,
      order: baseOrder + i,
      exercise_library_id: s.ex.id,
    }));
    await supabase.from("exercises").insert(rows);
    setShowPicker(false);
    setAddingSaved(false);
    setPickSelected([]);
    await load();
  }

  const filteredLib = libExercises.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase()) ||
    (ex.muscle_group ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7A8D" }}>Loading...</div>;
  if (!workout) return <div style={{ padding: 40, textAlign: "center", color: "#6B7A8D" }}>Workout not found</div>;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/trainer/workouts" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← On-Demand Workouts</Link>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={openAssignClient} style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "#2DC4B8", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>👤 Assign</button>
              <button onClick={openAddToProgram} style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "#1B68B4", border: "none", borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>+ Program</button>
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>{workout.name}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            {workout.difficulty && (
              <span style={{ fontSize: 11, fontWeight: 700, color: DIFF_COLOR[workout.difficulty], background: DIFF_COLOR[workout.difficulty] + "18", padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>
                {workout.difficulty}
              </span>
            )}
            {workout.est_duration_mins && <span style={{ fontSize: 12, color: "#6B7A8D" }}>⏱ {workout.est_duration_mins} min</span>}
            {workout.category && <span style={{ fontSize: 12, color: "#6B7A8D" }}>📂 {workout.category}</span>}
          </div>
          {workout.description && <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 6, lineHeight: 1.4 }}>{workout.description}</div>}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 10 }}>

        {exercises.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "32px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏋️</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No exercises yet</div>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>Add exercises from your library</div>
          </div>
        )}

        {exercises.map((ex, idx) => {
          const isExpanded = expandedId === ex.id;
          const edit = edits[ex.id];
          const vidUrl = ex.exercise_library?.video_url;
          const ytId = vidUrl ? getYouTubeId(vidUrl) : null;

          return (
            <div key={ex.id} style={{ background: "#fff", borderRadius: 14, border: `1px solid ${isExpanded ? "#1B68B4" : "#E2EAF0"}`, overflow: "hidden", transition: "border-color 0.15s" }}>
              {/* Row */}
              <div
                onClick={() => toggleExpand(ex.id, ex)}
                style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#1B68B4", flexShrink: 0 }}>
                  {idx + 1}
                </div>

                {ytId && (
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/default.jpg`}
                    alt=""
                    style={{ width: 44, height: 33, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                  />
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {ex.name}
                    {ex.is_unilateral && <span style={{ fontSize: 10, fontWeight: 700, color: "#2DC4B8", background: "#F0FDFC", border: "1px solid #A7F3D0", borderRadius: 4, padding: "1px 5px" }}>L/R</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                    {ex.sets} sets · {ex.reps} reps · {ex.rest_seconds}s rest
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={e => { e.stopPropagation(); moveExercise(ex.id, -1); }} disabled={idx === 0} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, cursor: idx === 0 ? "not-allowed" : "pointer", color: idx === 0 ? "#D1D5DB" : "#6B7A8D" }}>↑</button>
                  <button onClick={e => { e.stopPropagation(); moveExercise(ex.id, 1); }} disabled={idx === exercises.length - 1} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, cursor: idx === exercises.length - 1 ? "not-allowed" : "pointer", color: idx === exercises.length - 1 ? "#D1D5DB" : "#6B7A8D" }}>↓</button>
                </div>
              </div>

              {/* Expanded editor */}
              {isExpanded && edit && (
                <div style={{ borderTop: "1px solid #EFF6FF", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {ytId && (
                    <div style={{ borderRadius: 10, overflow: "hidden", background: "#000", aspectRatio: "16/9" }}>
                      <iframe
                        src={`https://www.youtube.com/embed/${ytId}`}
                        style={{ width: "100%", height: "100%", border: "none" }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Sets", field: "sets", placeholder: "3" },
                      { label: "Reps", field: "reps", placeholder: "8-12" },
                      { label: "Rest (s)", field: "rest_seconds", placeholder: "60" },
                      { label: "Weight (lbs)", field: "suggested_weight_lbs", placeholder: "0" },
                    ].map(f => (
                      <div key={f.field}>
                        <label style={smallLabel}>{f.label}</label>
                        <input
                          type="text"
                          value={edit[f.field as "sets" | "reps" | "rest_seconds" | "notes" | "suggested_weight_lbs"]}
                          onChange={ev => setEdits(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], [f.field]: ev.target.value } }))}
                          placeholder={f.placeholder}
                          style={inlineInput}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label style={smallLabel}>Notes</label>
                    <input
                      type="text"
                      value={edit.notes}
                      onChange={ev => setEdits(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], notes: ev.target.value } }))}
                      placeholder="Cues, tempo, etc."
                      style={inlineInput}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setEdits(prev => ({ ...prev, [ex.id]: { ...prev[ex.id], is_unilateral: !prev[ex.id].is_unilateral } }))}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${edit.is_unilateral ? "#2DC4B8" : "#E2EAF0"}`, background: edit.is_unilateral ? "#F0FDFC" : "#fff", cursor: "pointer", textAlign: "left" }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${edit.is_unilateral ? "#2DC4B8" : "#D1D5DB"}`, background: edit.is_unilateral ? "#2DC4B8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {edit.is_unilateral && <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827" }}>Single-Side Exercise</div>
                      <div style={{ fontSize: 11, color: "#6B7A8D" }}>Clients log reps separately for Left and Right</div>
                    </div>
                  </button>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => saveExercise(ex.id)} disabled={saving === ex.id} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer", opacity: saving === ex.id ? 0.6 : 1 }}>
                      {saving === ex.id ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => deleteExercise(ex.id)} disabled={deleting === ex.id} style={{ padding: "10px 16px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
                      {deleting === ex.id ? "..." : "Remove"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add exercise button */}
        <button
          onClick={openPicker}
          style={{ padding: "14px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
        >
          + Add Exercise
        </button>
      </div>

      {/* Exercise picker modal */}
      {showPicker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#F4F7FA", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "85dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Picker header */}
            <div style={{ background: "#fff", padding: "16px 20px", borderBottom: "1px solid #E2EAF0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1827" }}>Add Exercises</div>
              <button onClick={() => setShowPicker(false)} style={{ background: "none", border: "none", fontSize: 22, color: "#6B7A8D", cursor: "pointer" }}>✕</button>
            </div>

            {/* Search */}
            <div style={{ padding: "12px 16px", background: "#fff", borderBottom: "1px solid #E2EAF0", flexShrink: 0 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search exercises..."
                autoFocus
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Selected exercises config */}
            {pickSelected.length > 0 && (
              <div style={{ background: "#EFF6FF", padding: "12px 16px", borderBottom: "1px solid #BFDBFE", flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1B68B4", marginBottom: 8 }}>
                  {pickSelected.length} selected — tap sets/reps to configure
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pickSelected.map(s => (
                    <div key={s.ex.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827", minWidth: 120, flex: 1 }}>{s.ex.name}</div>
                      {[
                        { key: "sets", placeholder: "3", label: "sets" },
                        { key: "reps", placeholder: "8-12", label: "reps" },
                        { key: "rest_seconds", placeholder: "60", label: "rest" },
                      ].map(f => (
                        <div key={f.key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <input
                            type="text"
                            value={String((s as any)[f.key])}
                            onChange={ev => setPickSelected(prev => prev.map(p => p.ex.id === s.ex.id ? { ...p, [f.key]: f.key === "reps" ? ev.target.value : parseInt(ev.target.value) || (f.key === "sets" ? 3 : 60) } : p))}
                            style={{ width: 44, padding: "4px 6px", borderRadius: 6, border: "1px solid #BFDBFE", background: "#fff", fontSize: 13, textAlign: "center", outline: "none" }}
                          />
                          <span style={{ fontSize: 10, color: "#6B7A8D", marginTop: 1 }}>{f.label}</span>
                        </div>
                      ))}
                      <button onClick={() => togglePickExercise(s.ex)} style={{ width: 24, height: 24, borderRadius: "50%", background: "#FEE2E2", border: "none", cursor: "pointer", fontSize: 12, color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exercise list */}
            <div style={{ overflow: "auto", flex: 1, padding: "8px 12px" }}>
              {libLoading ? (
                <div style={{ textAlign: "center", padding: 32, color: "#6B7A8D" }}>Loading...</div>
              ) : (
                filteredLib.map(ex => {
                  const isSel = !!pickSelected.find(s => s.ex.id === ex.id);
                  return (
                    <div
                      key={ex.id}
                      onClick={() => togglePickExercise(ex)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderRadius: 10, cursor: "pointer", background: isSel ? "#EFF6FF" : "transparent", marginBottom: 2 }}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSel ? "#1B68B4" : "#D1D5DB"}`, background: isSel ? "#1B68B4" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isSel && <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#0D1827" }}>{ex.name}</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                          {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Confirm button */}
            <div style={{ padding: "12px 16px 24px", background: "#fff", borderTop: "1px solid #E2EAF0", flexShrink: 0 }}>
              <button
                onClick={addPickedExercises}
                disabled={!pickSelected.length || addingSaved}
                style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: pickSelected.length ? "pointer" : "not-allowed", opacity: !pickSelected.length || addingSaved ? 0.5 : 1 }}
              >
                {addingSaved ? "Adding..." : pickSelected.length ? `Add ${pickSelected.length} Exercise${pickSelected.length > 1 ? "s" : ""}` : "Select exercises above"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Client modal */}
      {showAssignClient && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 640, maxHeight: "80dvh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1827" }}>Assign to Clients</div>
              <button onClick={() => { setShowAssignClient(false); setAssignSuccess(false); }} style={{ background: "none", border: "none", fontSize: 20, color: "#9CA3AF", cursor: "pointer" }}>✕</button>
            </div>

            {assignSuccess ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#0D1827", marginBottom: 6 }}>Assignments saved!</div>
                <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 20 }}>Selected clients can now see this workout in their library.</div>
                <button onClick={() => { setShowAssignClient(false); setAssignSuccess(false); }} style={{ padding: "12px 32px", borderRadius: 12, background: "#2DC4B8", border: "none", fontWeight: 700, color: "#fff", fontSize: 14, cursor: "pointer" }}>Done</button>
              </div>
            ) : clientsLoading ? (
              <div style={{ textAlign: "center", padding: 32, color: "#6B7A8D" }}>Loading clients...</div>
            ) : !clients.length ? (
              <div style={{ textAlign: "center", padding: 32, color: "#6B7A8D", fontSize: 14 }}>No clients yet. Add clients first.</div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 14, flexShrink: 0 }}>
                  Select which clients can access this workout in their library.
                </div>
                <div style={{ overflow: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {clients.map(c => {
                    const isSelected = assignedClientIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleAssignClient(c.id)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${isSelected ? "#2DC4B8" : "#E2EAF0"}`, background: isSelected ? "#F0FDFC" : "#fff", cursor: "pointer" }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isSelected ? "#2DC4B8" : "#D1D5DB"}`, background: isSelected ? "#2DC4B8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {isSelected && <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>{c.full_name ?? "Unnamed"}</div>
                          {c.email && <div style={{ fontSize: 12, color: "#9CA3AF" }}>{c.email}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleAssignClients}
                  disabled={assigning}
                  style={{ width: "100%", padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: assigning ? 0.6 : 1, flexShrink: 0 }}
                >
                  {assigning ? "Saving..." : "Save Assignments"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add to Program modal */}
      {showAddToProgram && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 640 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1827" }}>Add to Program</div>
              <button onClick={() => setShowAddToProgram(false)} style={{ background: "none", border: "none", fontSize: 20, color: "#9CA3AF", cursor: "pointer" }}>✕</button>
            </div>

            {addedSuccess ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#0D1827", marginBottom: 6 }}>Added to program!</div>
                <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 20 }}>"{workout.name}" is now in the selected program week.</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setShowAddToProgram(false); setAddedSuccess(false); }} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "#F4F7FA", border: "1px solid #E2EAF0", fontWeight: 600, color: "#6B7A8D", fontSize: 14, cursor: "pointer" }}>Done</button>
                  <button onClick={() => setAddedSuccess(false)} style={{ flex: 1, padding: "12px", borderRadius: 12, background: "#1B68B4", border: "none", fontWeight: 700, color: "#fff", fontSize: 14, cursor: "pointer" }}>Add Again</button>
                </div>
              </div>
            ) : !programs.length ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#6B7A8D", fontSize: 14 }}>No programs yet. Create a program first.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={modalLabel}>Program</label>
                  <select value={selectedProgram} onChange={e => { setSelectedProgram(e.target.value); setSelectedWeek("1"); }} style={modalInput}>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={modalLabel}>Week</label>
                    <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} style={modalInput}>
                      {Array.from({ length: programs.find(p => p.id === selectedProgram)?.duration_weeks ?? 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={modalLabel}>Day in week</label>
                    <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} style={modalInput}>
                      {[1,2,3,4,5,6,7].map(d => <option key={d} value={d}>Day {d}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleAddToProgram}
                  disabled={addingToProgram}
                  style={{ padding: "14px", borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer", opacity: addingToProgram ? 0.6 : 1, marginTop: 4 }}
                >
                  {addingToProgram ? "Adding..." : `Add to Program →`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const modalLabel: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 };
const modalInput: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" };

const smallLabel: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#6B7A8D", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.3 };
const inlineInput: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", boxSizing: "border-box" };
