"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LibExercise = { id: string; name: string; muscle_group: string | null; equipment: string | null };
type Added = { id: string; name: string; sets: number; reps: string; order: number };

// Clients can only build workouts they created themselves — the exercises RLS
// policy (owns_client_workout) enforces that server side too.
export default function BuildOwnWorkoutPage() {
  const workoutId = useParams().workoutId as string;

  const [name, setName] = useState("");
  const [owned, setOwned] = useState<boolean | null>(null);
  const [library, setLibrary] = useState<LibExercise[]>([]);
  const [added, setAdded] = useState<Added[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const [{ data: w }, { data: lib }, { data: exs }] = await Promise.all([
        supabase.from("workouts").select("name, created_by").eq("id", workoutId).single(),
        supabase.from("exercise_library").select("id, name, muscle_group, equipment").order("name"),
        supabase.from("exercises").select("id, name, sets, reps, order").eq("workout_id", workoutId).order("order"),
      ]);

      setName(w?.name ?? "");
      setOwned(w?.created_by === user.id);
      setLibrary((lib ?? []) as LibExercise[]);
      setAdded((exs ?? []) as Added[]);
    })();
  }, [workoutId]);

  async function addExercise(ex: LibExercise) {
    if (busy) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error } = await supabase.from("exercises").insert({
      workout_id: workoutId,
      name: ex.name,
      exercise_library_id: ex.id,
      sets: 3,
      reps: "8-12",
      rest_seconds: 60,
      order: added.length,
    }).select("id, name, sets, reps, order").single();

    if (error || !data) setError(error?.message ?? "Couldn't add that exercise.");
    else { setAdded(prev => [...prev, data as Added]); setSearch(""); }
    setBusy(false);
  }

  async function update(id: string, field: "sets" | "reps", value: string) {
    const patch = field === "sets" ? { sets: Math.max(1, parseInt(value) || 1) } : { reps: value };
    setAdded(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
    const supabase = createClient();
    await supabase.from("exercises").update(patch).eq("id", id);
  }

  async function remove(id: string) {
    setAdded(prev => prev.filter(a => a.id !== id));
    const supabase = createClient();
    await supabase.from("exercises").delete().eq("id", id);
  }

  const filtered = search.trim()
    ? library.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.muscle_group?.toLowerCase().includes(search.toLowerCase()) ||
        e.equipment?.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 25)
    : [];

  if (owned === false) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#6B7A8D" }}>
        <p>This workout was built by your trainer, so it can&apos;t be edited here.</p>
        <Link href={`/client/workouts/${workoutId}`} style={{ color: "#1B68B4", fontWeight: 700 }}>Open it →</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 120 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client/workouts/browse" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Back</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>{name || "Your workout"}</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
            Search for exercises and add them to your workout
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontWeight: 600 }}>{error}</div>
        )}

        <div style={card}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises — e.g. squat, push up, plank"
            style={{ width: "100%", padding: "13px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 16, color: "#0D1827", outline: "none" }}
          />
          {search.trim() && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.length === 0 && (
                <div style={{ fontSize: 14, color: "#9CA3AF", padding: "8px 2px" }}>No matches for “{search}”.</div>
              )}
              {filtered.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => addExercise(ex)}
                  disabled={busy}
                  style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#fff", cursor: "pointer" }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{ex.name}</span>
                    {(ex.muscle_group || ex.equipment) && (
                      <span style={{ display: "block", fontSize: 12, color: "#9CA3AF" }}>
                        {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span style={{ color: "#2DC4B8", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>+</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={sectionLabel}>In this workout ({added.length})</div>
          {added.length === 0 ? (
            <div style={{ ...card, color: "#9CA3AF", fontSize: 14, textAlign: "center" }}>
              Nothing yet — search above to add your first exercise.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {added.map((a, i) => (
                <div key={a.id} style={{ ...card, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#9CA3AF", width: 18, flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 6 }}>{a.name}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="number" min={1} value={a.sets}
                        onChange={e => update(a.id, "sets", e.target.value)}
                        style={miniInput}
                      />
                      <span style={{ fontSize: 12, color: "#6B7A8D" }}>sets ×</span>
                      <input
                        value={a.reps}
                        onChange={e => update(a.id, "reps", e.target.value)}
                        style={{ ...miniInput, width: 74 }}
                      />
                      <span style={{ fontSize: 12, color: "#6B7A8D" }}>reps</span>
                    </div>
                  </div>
                  <button onClick={() => remove(a.id)} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {added.length > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E2EAF0", padding: "12px 16px max(env(safe-area-inset-bottom, 0px), 12px)" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Link
              href={`/client/workouts/${workoutId}`}
              style={{ display: "block", textAlign: "center", background: "#1B68B4", color: "#fff", borderRadius: 12, padding: "15px", fontWeight: 800, fontSize: 16, textDecoration: "none" }}
            >
              ▶ Start this workout
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0",
};
const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase",
  letterSpacing: 0.5, marginBottom: 10,
};
const miniInput: React.CSSProperties = {
  width: 52, padding: "7px 8px", borderRadius: 8, border: "1px solid #E2EAF0",
  background: "#F8FAFB", fontSize: 14, color: "#0D1827", outline: "none", textAlign: "center",
};
