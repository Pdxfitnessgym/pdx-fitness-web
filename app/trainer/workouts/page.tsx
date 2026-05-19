import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const DIFF_COLOR: Record<string, string> = {
  beginner: "#10B981",
  intermediate: "#F59E0B",
  advanced: "#EF4444",
};

export default async function StandaloneWorkoutsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile && profile.role !== "trainer") redirect("/client");

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, name, description, difficulty, est_duration_mins, category, exercises(count)")
    .eq("trainer_id", user.id)
    .eq("is_standalone", true)
    .order("created_at", { ascending: false });

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>On-Demand Workouts</div>
          </div>
          <Link href="/trainer/workouts/new" style={{ padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            + New
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, color: "#6B7A8D" }}>
          Standalone workouts your clients can browse and start anytime — no program required.
        </div>

        {(workouts ?? []).length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, padding: "48px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⚡</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No on-demand workouts yet</div>
            <div style={{ fontSize: 14, color: "#6B7A8D", marginBottom: 20 }}>Create workouts your clients can browse and start anytime</div>
            <Link href="/trainer/workouts/new" style={{ padding: "13px 28px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              + Create First Workout
            </Link>
          </div>
        ) : (
          (workouts ?? []).map((w: any) => {
            const exerciseCount = w.exercises?.[0]?.count ?? 0;
            return (
              <Link key={w.id} href={`/trainer/workouts/${w.id}`} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "1px solid #E2EAF0", textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1827" }}>{w.name}</div>
                    {w.description && <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 3, lineHeight: 1.4 }}>{w.description}</div>}
                    <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "#6B7A8D" }}>💪 {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}</span>
                      {w.est_duration_mins && <span style={{ fontSize: 12, color: "#6B7A8D" }}>⏱ {w.est_duration_mins} min</span>}
                      {w.category && <span style={{ fontSize: 12, color: "#6B7A8D" }}>📂 {w.category}</span>}
                      {w.difficulty && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: DIFF_COLOR[w.difficulty] ?? "#6B7A8D", background: (DIFF_COLOR[w.difficulty] ?? "#6B7A8D") + "18", padding: "2px 8px", borderRadius: 6, textTransform: "capitalize" }}>
                          {w.difficulty}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: 20, marginLeft: 12 }}>›</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
