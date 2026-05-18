"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

type Exercise = { id: string; name: string; muscle_group: string | null; equipment: string | null; video_url: string | null; youtube_url: string | null; trainer_id: string | null };
type Selected = { exercise: Exercise; sets: number; reps: string; rest_seconds: number; notes: string };

export default function AddExercisePage() {
  const router = useRouter();
  const params = useParams();
  const programId = params.id as string;
  const workoutId = params.workoutId as string;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected[]>([]);
  const [preview, setPreview] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("exercise_library")
        .select("id, name, muscle_group, equipment, video_url, youtube_url, trainer_id")
        .or(`trainer_id.eq.${user.id},trainer_id.is.null`)
        .order("name");
      setExercises((data ?? []) as Exercise[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = exercises.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase()) ||
    ex.muscle_group?.toLowerCase().includes(search.toLowerCase()) ||
    ex.equipment?.toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelect(ex: Exercise) {
    if (selected.find(s => s.exercise.id === ex.id)) {
      setSelected(selected.filter(s => s.exercise.id !== ex.id));
    } else {
      setSelected([...selected, { exercise: ex, sets: 3, reps: "8-12", rest_seconds: 60, notes: "" }]);
    }
  }

  function updateSelected(id: string, field: string, value: string | number) {
    setSelected(selected.map(s => s.exercise.id === id ? { ...s, [field]: value } : s));
  }

  async function saveExercises() {
    if (!selected.length) return;
    setSaving(true);
    const supabase = createClient();

    const { count } = await supabase.from("exercises").select("*", { count: "exact", head: true }).eq("workout_id", workoutId);

    const rows = selected.map((s, i) => ({
      workout_id: workoutId,
      name: s.exercise.name,
      sets: s.sets,
      reps: s.reps,
      rest_seconds: s.rest_seconds,
      notes: s.notes || null,
      order: (count ?? 0) + i,
      exercise_library_id: s.exercise.id,
    }));

    await supabase.from("exercises").insert(rows);
    router.push(`/trainer/programs/${programId}/workouts/${workoutId}`);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href={`/trainer/programs/${programId}/workouts/${workoutId}`} style={{ fontSize: 14, color: "#6B7A8D", textDecoration: "none" }}>Cancel</Link>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0D1827" }}>Add Exercises</div>
          <button onClick={saveExercises} disabled={!selected.length || saving} style={{ fontSize: 14, fontWeight: 700, color: selected.length ? "#2DC4B8" : "#C0CBD6", background: "none", border: "none", cursor: selected.length ? "pointer" : "default" }}>
            {saving ? "Saving..." : `Add${selected.length ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ background: "#fff", padding: "12px 20px", borderBottom: "1px solid #E2EAF0" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises..."
            style={{ width: "100%", padding: "11px 16px", borderRadius: 12, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" }}
          />
        </div>
      </div>

      {/* Selected config */}
      {selected.length > 0 && (
        <div style={{ background: "#EBF9F8", borderBottom: "1px solid #C5EDE9", padding: "12px 20px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2DC4B8", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Selected — configure sets & reps</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selected.map(s => (
                <div key={s.exercise.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #C5EDE9" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0D1827", marginBottom: 10 }}>{s.exercise.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 4 }}>Sets</div>
                      <input type="number" min={1} value={s.sets} onChange={e => updateSelected(s.exercise.id, "sets", parseInt(e.target.value))} style={miniInput} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 4 }}>Reps</div>
                      <input value={s.reps} onChange={e => updateSelected(s.exercise.id, "reps", e.target.value)} placeholder="8-12" style={miniInput} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#6B7A8D", marginBottom: 4 }}>Rest (s)</div>
                      <input type="number" value={s.rest_seconds} onChange={e => updateSelected(s.exercise.id, "rest_seconds", parseInt(e.target.value))} style={miniInput} />
                    </div>
                  </div>
                  <input value={s.notes} onChange={e => updateSelected(s.exercise.id, "notes", e.target.value)} placeholder="Notes (optional)" style={{ ...miniInput, width: "100%", marginTop: 8 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#6B7A8D" }}>Loading exercises...</div>
        ) : !exercises.length ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 16 }}>Your library is empty</div>
            <Link href="/trainer/exercises/new" style={{ color: "#2DC4B8", fontWeight: 600, fontSize: 14 }}>+ Add exercises to your library</Link>
          </div>
        ) : !filtered.length ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#6B7A8D", fontSize: 14 }}>No exercises match "{search}"</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(ex => {
              const isSelected = !!selected.find(s => s.exercise.id === ex.id);
              return (
                <div key={ex.id} style={{ background: "#fff", borderRadius: 12, border: `1.5px solid ${isSelected ? "#2DC4B8" : "#E2EAF0"}`, display: "flex", alignItems: "center", overflow: "hidden" }}>
                  {/* Video/icon */}
                  <div onClick={() => setPreview(ex)} style={{ width: 72, height: 72, flexShrink: 0, cursor: "pointer", position: "relative" }}>
                    {ex.video_url ? (
                      <>
                        <video src={ex.video_url} style={{ width: 72, height: 72, objectFit: "cover" }} muted playsInline />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>▶</div>
                        </div>
                      </>
                    ) : ex.youtube_url && getYouTubeId(ex.youtube_url) ? (
                      <>
                        <img src={`https://img.youtube.com/vi/${getYouTubeId(ex.youtube_url)}/mqdefault.jpg`} alt={ex.name} style={{ width: 72, height: 72, objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>▶</div>
                        </div>
                      </>
                    ) : (
                      <div style={{ width: 72, height: 72, background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>💪</div>
                    )}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, padding: "0 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{ex.name}</div>
                      {ex.trainer_id === null && (
                        <div style={{ fontSize: 10, fontWeight: 700, background: "#EBF4FF", color: "#1B68B4", padding: "2px 6px", borderRadius: 6 }}>MASTER</div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                      {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {/* Checkbox */}
                  <div onClick={() => toggleSelect(ex)} style={{ padding: "0 16px", cursor: "pointer" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${isSelected ? "#2DC4B8" : "#C0CBD6"}`, background: isSelected ? "#2DC4B8" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isSelected && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: "center" }}>
          <Link href="/trainer/exercises/new" style={{ color: "#2DC4B8", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>+ Add custom exercise</Link>
        </div>
      </div>

      {/* Video preview modal */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", width: "100%", maxWidth: 400 }}>
            {preview.video_url ? (
            <video src={preview.video_url} controls autoPlay style={{ width: "100%", maxHeight: 300 }} />
          ) : preview.youtube_url && getYouTubeId(preview.youtube_url) ? (
            <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(preview.youtube_url)}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          ) : null}
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>{preview.name}</div>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>{[preview.muscle_group, preview.equipment].filter(Boolean).join(" · ")}</div>
              <button onClick={() => setPreview(null)} style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 10, background: "#F4F7FA", border: "none", cursor: "pointer", fontWeight: 600, color: "#0D1827" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const miniInput: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none", width: "100%" };
