import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Core", "Glutes", "Quads", "Hamstrings", "Calves", "Full Body", "Cardio"];

export default async function ExerciseLibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercises } = await supabase
    .from("exercise_library")
    .select("*")
    .eq("trainer_id", user.id)
    .order("name");

  const grouped: Record<string, typeof exercises> = {};
  exercises?.forEach(ex => {
    const group = ex.muscle_group ?? "Other";
    if (!grouped[group]) grouped[group] = [];
    grouped[group]!.push(ex);
  });

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Exercise Library</div>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>{exercises?.length ?? 0} exercises</div>
          </div>
          <Link href="/trainer/exercises/new" style={btnStyle}>+ Add Exercise</Link>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        {!exercises?.length ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏋️</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 6 }}>No exercises yet</div>
            <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 20 }}>Build your library — add exercises with video demos</div>
            <Link href="/trainer/exercises/new" style={btnStyle}>+ Add First Exercise</Link>
          </div>
        ) : (
          Object.entries(grouped).sort().map(([group, exs]) => (
            <div key={group} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>{group}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {exs?.map(ex => (
                  <div key={ex.id} style={{ ...cardStyle, display: "flex", gap: 14, alignItems: "center" }}>
                    {ex.video_url ? (
                      <video src={ex.video_url} style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} muted playsInline />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 28 }}>💪</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{ex.name}</div>
                      <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                        {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
                      </div>
                      {ex.instructions && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4, lineHeight: 1.4 }}>{ex.instructions}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" };
const btnStyle: React.CSSProperties = { padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-block" };
