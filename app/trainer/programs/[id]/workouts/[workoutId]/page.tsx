"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GROUP_COLORS = ["#1B68B4", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#EC4899"];

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
  group_id: number | null;
  group_round_rest_seconds: number | null;
  is_unilateral: boolean;
  suggested_weight_lbs: number | null;
};

type Workout = {
  name: string;
  week_number: number;
  day_of_week: number;
  programs: { name: string; trainer_id: string } | null;
};

type EditState = { sets: string; reps: string; rest_seconds: string; notes: string; group_round_rest_seconds: string; is_unilateral: boolean; suggested_weight_lbs: string };

function groupLetter(id: number) { return String.fromCharCode(64 + id); }
function groupColor(id: number) { return GROUP_COLORS[(id - 1) % GROUP_COLORS.length]; }

export default function WorkoutBuilderPage() {
  const params = useParams();
  const programId = params.id as string;
  const workoutId = params.workoutId as string;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  // Superset creation state
  const [supersetMode, setSupersetMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [supersetRoundRest, setSupersetRoundRest] = useState("90");
  const [supersetSaving, setSupersetSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: w }, { data: exs }] = await Promise.all([
        supabase.from("workouts").select("name, week_number, day_of_week, programs(name, trainer_id)").eq("id", workoutId).single(),
        supabase.from("exercises")
          .select("id, name, sets, reps, rest_seconds, notes, order, exercise_library_id, exercise_library(video_url), group_id, group_round_rest_seconds, is_unilateral, suggested_weight_lbs")
          .eq("workout_id", workoutId)
          .order("order"),
      ]);
      setWorkout(w as unknown as Workout);
      setExercises(((exs ?? []) as unknown[]).map((e: unknown) => {
        const ex = e as Exercise & { exercise_library: unknown };
        return { ...ex, exercise_library: Array.isArray(ex.exercise_library) ? (ex.exercise_library[0] ?? null) : ex.exercise_library };
      }) as Exercise[]);
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
        group_round_rest_seconds: String(ex.group_round_rest_seconds ?? 90),
        is_unilateral: ex.is_unilateral,
        suggested_weight_lbs: ex.suggested_weight_lbs != null ? String(ex.suggested_weight_lbs) : "",
      },
    }));
  }

  function toggleExpand(ex: Exercise) {
    if (supersetMode) {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(ex.id)) next.delete(ex.id); else next.add(ex.id);
        return next;
      });
      return;
    }
    if (expandedId === ex.id) { setExpandedId(null); return; }
    initEdit(ex);
    setExpandedId(ex.id);
  }

  const saveExercise = useCallback(async (exId: string) => {
    const edit = edits[exId];
    if (!edit) return;
    setSaving(exId);
    const supabase = createClient();
    const ex = exercises.find(e => e.id === exId);
    const patch = {
      sets: parseInt(edit.sets) || 3,
      reps: edit.reps,
      rest_seconds: parseInt(edit.rest_seconds) || 45,
      notes: edit.notes || null,
      is_unilateral: edit.is_unilateral,
      suggested_weight_lbs: edit.suggested_weight_lbs !== "" ? parseFloat(edit.suggested_weight_lbs) || null : null,
      ...(ex?.group_id != null ? { group_round_rest_seconds: parseInt(edit.group_round_rest_seconds) || 90 } : {}),
    };
    await supabase.from("exercises").update(patch).eq("id", exId);
    setExercises(prev => prev.map(e => e.id === exId ? { ...e, ...patch } : e));
    setSaving(null);
    setExpandedId(null);
  }, [edits, exercises]);

  const deleteExercise = useCallback(async (exId: string) => {
    setDeleting(exId);
    const supabase = createClient();
    await supabase.from("exercises").delete().eq("id", exId);
    const remaining = exercises.filter(e => e.id !== exId).map((e, i) => ({ ...e, order: i }));
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

  function nextGroupId(): number {
    const ids = new Set(exercises.filter(e => e.group_id != null).map(e => e.group_id!));
    let n = 1;
    while (ids.has(n)) n++;
    return n;
  }

  async function createSuperset() {
    if (selected.size < 2) return;
    setSupersetSaving(true);
    const gid = nextGroupId();
    const roundRest = parseInt(supersetRoundRest) || 90;
    const supabase = createClient();
    await Promise.all([...selected].map(exId =>
      supabase.from("exercises").update({ group_id: gid, group_round_rest_seconds: roundRest }).eq("id", exId)
    ));
    setExercises(prev => prev.map(e =>
      selected.has(e.id) ? { ...e, group_id: gid, group_round_rest_seconds: roundRest } : e
    ));
    setSupersetMode(false);
    setSelected(new Set());
    setSupersetSaving(false);
  }

  async function ungroup(gid: number) {
    const supabase = createClient();
    const toUpdate = exercises.filter(e => e.group_id === gid);
    await Promise.all(toUpdate.map(e =>
      supabase.from("exercises").update({ group_id: null, group_round_rest_seconds: null }).eq("id", e.id)
    ));
    setExercises(prev => prev.map(e =>
      e.group_id === gid ? { ...e, group_id: null, group_round_rest_seconds: null } : e
    ));
  }

  // Build render list: groups + standalone
  const renderItems = useMemo(() => {
    type Item =
      | { kind: "standalone"; ex: Exercise; idx: number }
      | { kind: "group"; gid: number; items: { ex: Exercise; idx: number }[] };
    const out: Item[] = [];
    const seenGroups = new Set<number>();
    exercises.forEach((ex, idx) => {
      if (ex.group_id == null) {
        out.push({ kind: "standalone", ex, idx });
      } else if (!seenGroups.has(ex.group_id)) {
        seenGroups.add(ex.group_id);
        const members = exercises.map((e, i) => ({ ex: e, idx: i })).filter(x => x.ex.group_id === ex.group_id);
        out.push({ kind: "group", gid: ex.group_id, items: members });
      }
    });
    return out;
  }, [exercises]);

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 14, color: "#6B7A8D" }}>Loading…</div>
    </div>
  );

  const programName = (workout?.programs as { name: string } | null)?.name ?? "Program";

  // Render function (not a component) — avoids remount-on-every-render issue
  function renderExCard(ex: Exercise, idx: number, grouped?: boolean) {
    const isExpanded = expandedId === ex.id;
    const edit = edits[ex.id];
    const isDeletingThis = deleting === ex.id;
    const isSavingThis = saving === ex.id;
    const videoUrl = ex.exercise_library?.video_url ?? null;
    const isSelected = selected.has(ex.id);
    const color = ex.group_id != null ? groupColor(ex.group_id) : "#E2EAF0";

    return (
      <div
        key={ex.id}
        onClick={supersetMode ? () => {
          setSelected(prev => { const n = new Set(prev); n.has(ex.id) ? n.delete(ex.id) : n.add(ex.id); return n; });
        } : undefined}
        style={{ background: "#fff", borderRadius: grouped ? 0 : 14, border: grouped ? "none" : `1.5px solid ${isExpanded ? "#1B68B4" : isSelected ? "#2DC4B8" : "#E2EAF0"}`, marginBottom: grouped ? 0 : 10, overflow: "hidden", opacity: isDeletingThis ? 0.4 : 1, borderLeft: grouped ? `3px solid ${color}` : undefined, cursor: supersetMode ? "pointer" : "default" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: isSelected ? "#EBF9F8" : "#fff" }}>
          {supersetMode && (
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSelected ? "#2DC4B8" : "#D1D5DB"}`, background: isSelected ? "#2DC4B8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {isSelected && <span style={{ color: "#fff", fontSize: 13, fontWeight: 800 }}>✓</span>}
            </div>
          )}

          {videoUrl ? (
            <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#000" }}>
              <video src={videoUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline preload="metadata" />
            </div>
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>💪</div>
          )}

          <div style={{ flex: 1 }} onClick={!supersetMode ? () => toggleExpand(ex) : undefined}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {idx + 1}. {ex.name}
              {ex.is_unilateral && <span style={{ fontSize: 10, fontWeight: 700, color: "#2DC4B8", background: "#F0FDFC", border: "1px solid #A7F3D0", borderRadius: 4, padding: "1px 5px" }}>L/R</span>}
            </div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
              {ex.sets} sets × {ex.reps}
              {grouped ? <span style={{ color }}> · {ex.rest_seconds}s rest →</span> : <span> · {ex.rest_seconds}s rest</span>}
            </div>
            {ex.notes && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, fontStyle: "italic" }}>{ex.notes}</div>}
          </div>

          {!supersetMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
              <button onClick={e => { e.stopPropagation(); moveUp(idx); }} disabled={idx === 0 || reordering} style={{ background: "none", border: "none", fontSize: 14, cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "#E2EAF0" : "#9CA3AF", padding: "2px 6px" }}>▲</button>
              <button onClick={e => { e.stopPropagation(); moveDown(idx); }} disabled={idx === exercises.length - 1 || reordering} style={{ background: "none", border: "none", fontSize: 14, cursor: idx === exercises.length - 1 ? "default" : "pointer", color: idx === exercises.length - 1 ? "#E2EAF0" : "#9CA3AF", padding: "2px 6px" }}>▼</button>
            </div>
          )}
          {!supersetMode && (
            <button onClick={e => { e.stopPropagation(); toggleExpand(ex); }} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: isExpanded ? "#1B68B4" : "#C0CBD6", padding: "4px 6px", flexShrink: 0, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</button>
          )}
        </div>

        {isExpanded && edit && !supersetMode && (
          <div style={{ borderTop: "1px solid #F4F7FA", padding: "14px 16px", background: "#F8FAFB" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={lbl}>Sets</div>
                <input type="number" min={1} value={edit.sets} onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], sets: e.target.value } }))} style={inp} />
              </div>
              <div>
                <div style={lbl}>Reps</div>
                <input value={edit.reps} onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], reps: e.target.value } }))} placeholder="8-12" style={inp} />
              </div>
              <div>
                <div style={lbl}>{ex.group_id != null ? "Rest Between" : "Rest (sec)"}</div>
                <input type="number" value={edit.rest_seconds} onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], rest_seconds: e.target.value } }))} style={inp} />
              </div>
              <div>
                <div style={lbl}>Weight (lbs)</div>
                <input type="number" min={0} step={2.5} value={edit.suggested_weight_lbs} onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], suggested_weight_lbs: e.target.value } }))} placeholder="0" style={inp} />
              </div>
            </div>
            {ex.group_id != null && (
              <div style={{ marginBottom: 10 }}>
                <div style={lbl}>Round Rest (sec)</div>
                <input type="number" value={edit.group_round_rest_seconds} onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], group_round_rest_seconds: e.target.value } }))} style={{ ...inp, borderColor: "#BFDBFE" }} />
                <div style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4 }}>Rest after completing all exercises in the superset</div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], is_unilateral: !p[ex.id].is_unilateral } }))}
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
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={lbl}>Notes</div>
              <input value={edit.notes} onChange={e => setEdits(p => ({ ...p, [ex.id]: { ...p[ex.id], notes: e.target.value } }))} placeholder="Coaching cues, form tips…" style={{ ...inp, width: "100%" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => saveExercise(ex.id)} disabled={isSavingThis} style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
                {isSavingThis ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => deleteExercise(ex.id)} disabled={isDeletingThis} style={{ padding: "11px 16px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href={`/trainer/programs/${programId}`} style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← {programName}</Link>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>{workout?.name}</div>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>
                Week {workout?.week_number} · {workout ? DAYS[workout.day_of_week] : ""} · {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
              </div>
            </div>
            {exercises.length >= 2 && !supersetMode && (
              <button
                onClick={() => setSupersetMode(true)}
                style={{ padding: "8px 14px", borderRadius: 20, background: "#EFF6FF", border: "1px solid #BFDBFE", color: "#1B68B4", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                ⚡ Superset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Superset mode banner */}
      {supersetMode && (
        <div style={{ background: "#1B68B4", padding: "14px 20px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              ⚡ Select 2+ exercises to group as a superset
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 12 }}>
              {selected.size < 2 ? `${selected.size} selected — need at least 2` : `${selected.size} exercises selected`}
            </div>
            {selected.size >= 2 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>Round rest (sec):</div>
                <input
                  type="number"
                  value={supersetRoundRest}
                  onChange={e => setSupersetRoundRest(e.target.value)}
                  style={{ width: 80, padding: "8px 10px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 15, fontWeight: 700, outline: "none", textAlign: "center" }}
                />
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>rest after all exercises complete</div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {selected.size >= 2 && (
                <button
                  onClick={createSuperset}
                  disabled={supersetSaving}
                  style={{ flex: 1, padding: "11px", borderRadius: 10, background: "#fff", color: "#1B68B4", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                >
                  {supersetSaving ? "Saving…" : `Create Superset (${selected.size} exercises)`}
                </button>
              )}
              <button
                onClick={() => { setSupersetMode(false); setSelected(new Set()); }}
                style={{ padding: "11px 18px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 600, fontSize: 14, border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        {exercises.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", marginBottom: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏋️</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No exercises yet</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Tap below to add exercises from your library</div>
          </div>
        )}

        {renderItems.map(item => {
          if (item.kind === "standalone") {
            return <div key={item.ex.id}>{renderExCard(item.ex, item.idx, false)}</div>;
          }

          const color = groupColor(item.gid);
          const letter = groupLetter(item.gid);
          const roundRest = item.items[0]?.ex.group_round_rest_seconds ?? 90;
          const rounds = item.items[0]?.ex.sets ?? 3;

          return (
            <div key={`group-${item.gid}`} style={{ marginBottom: 12 }}>
              {/* Superset header */}
              <div style={{ background: color + "12", border: `1.5px solid ${color}44`, borderRadius: "12px 12px 0 0", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color }}>⚡ SUPERSET {letter}</span>
                  <span style={{ fontSize: 12, color: "#6B7A8D" }}>
                    {item.items.length} exercises · {rounds} sets · {roundRest}s round rest
                  </span>
                </div>
                {!supersetMode && (
                  <button
                    onClick={() => ungroup(item.gid)}
                    style={{ fontSize: 12, color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "4px 8px" }}
                  >
                    Ungroup
                  </button>
                )}
              </div>

              {/* Exercises */}
              <div style={{ border: `1.5px solid ${color}44`, borderTop: "none", borderRadius: "0 0 12px 12px", overflow: "hidden" }}>
                {item.items.map(({ ex, idx }, i) => (
                  <div key={ex.id}>
                    {renderExCard(ex, idx, true)}
                    {i < item.items.length - 1 && (
                      <div style={{ background: "#F8FAFB", padding: "6px 14px 6px 20px", borderTop: `1px solid ${color}22`, borderBottom: `1px solid ${color}22`, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 2, height: 16, background: color + "60", borderRadius: 1 }} />
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>↓ {ex.rest_seconds}s rest before next exercise</span>
                      </div>
                    )}
                  </div>
                ))}
                {/* Round rest indicator */}
                <div style={{ background: color + "08", padding: "8px 14px", borderTop: `1px solid ${color}22`, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color, background: color + "18", borderRadius: 20, padding: "3px 10px" }}>
                    🔄 {roundRest}s ROUND REST — then repeat
                  </span>
                </div>
              </div>
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

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6B7A8D", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 };
const inp: React.CSSProperties = { padding: "10px 12px", borderRadius: 8, border: "1px solid #E2EAF0", background: "#fff", fontSize: 15, color: "#0D1827", outline: "none", width: "100%", boxSizing: "border-box" };
