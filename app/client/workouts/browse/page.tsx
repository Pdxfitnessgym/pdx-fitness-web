import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";
import { HomeLink } from "@/app/components/HomeLink";
import { createOwnWorkout, addOwnWorkout } from "@/app/actions/own-workouts";

const DIFF_COLOR: Record<string, string> = {
  beginner: "#10B981",
  intermediate: "#F59E0B",
  advanced: "#EF4444",
};

type LibWorkout = {
  id: string;
  name: string;
  description: string | null;
  difficulty: string | null;
  est_duration_mins: number | null;
  category: string | null;
  exercises: { count: number }[];
};

// Deliberately not on the dashboard — most clients follow their program. This is
// the opt-in shelf for anyone who wants extra sessions or to build their own.
export default async function BrowseWorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role, trainer_id").eq("id", user.id).single();
  if (profile && profile.role !== "client") redirect("/trainer");

  const sp = await searchParams;

  const cpRes = await supabase
    .from("client_programs").select("program_id")
    .eq("client_id", user.id).eq("is_active", true).maybeSingle();

  const [libRes, mineRes, assignedRes, progRes] = await Promise.all([
    // The gym's shared shelf — every trainer's on-demand workouts, not just
    // the one this client happens to be assigned to.
    supabase
      .from("workouts")
      .select("id, name, description, difficulty, est_duration_mins, category, exercises(count)")
      .eq("is_standalone", true)
      .eq("is_private", false)
      .order("name"),
    supabase
      .from("workouts")
      .select("id, name, description, difficulty, est_duration_mins, category, exercises(count)")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_workout_assignments")
      .select("workout_id, workouts(id, name, description, difficulty, est_duration_mins, category, created_by, exercises(count))")
      .eq("client_id", user.id),
    cpRes.data?.program_id
      ? supabase
          .from("workouts")
          .select("id, name, description, difficulty, est_duration_mins, category, exercises(count)")
          .eq("program_id", cpRes.data.program_id)
          .order("week_number").order("day_of_week")
      : Promise.resolve({ data: [] }),
  ]);

  const library = (libRes.data ?? []) as LibWorkout[];
  const mine = (mineRes.data ?? []) as LibWorkout[];
  const programWorkouts = (progRes.data ?? []) as LibWorkout[];
  const assignedRows = (assignedRes.data ?? []) as unknown as
    { workout_id: string; workouts: (LibWorkout & { created_by: string | null }) | (LibWorkout & { created_by: string | null })[] }[];
  const assignedIds = new Set(assignedRows.map(r => r.workout_id));

  // One list: from the client's side "a workout I can do" is the same thing
  // whether their trainer set it up or they built it themselves.
  const extras: LibWorkout[] = [];
  const seen = new Set<string>();
  for (const row of assignedRows) {
    const w = Array.isArray(row.workouts) ? row.workouts[0] : row.workouts;
    if (!w || seen.has(w.id)) continue;
    seen.add(w.id);
    extras.push(w);
  }
  for (const w of mine) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    extras.push(w);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 90 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/client/workouts" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← My Workouts</Link>
            <HomeLink role="client" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Start a Workout</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
            Pick one from your program, or something different
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {sp.added && (
          <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>
            ✓ Added to your workouts
          </div>
        )}

        {programWorkouts.length > 0 && (
          <div>
            <div style={sectionLabel}>Your Program</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {programWorkouts.map(w => <WorkoutRow key={w.id} w={w} icon="💪" href={`/client/workouts/${w.id}`} />)}
            </div>
          </div>
        )}

        {extras.length > 0 && (
          <div>
            <div style={sectionLabel}>Your Saved Workouts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {extras.map(w => (
                <WorkoutRow key={w.id} w={w} icon="⚡" href={`/client/workouts/${w.id}`} />
              ))}
            </div>
          </div>
        )}

        {/* Trainer's shared library */}
        <div>
          <div style={sectionLabel}>From Your Gym</div>
          {library.length === 0 ? (
            <div style={{ ...card, color: "#9CA3AF", fontSize: 14 }}>
              No extra workouts available right now.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {library.map(w => (
                <div key={w.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: "#EBF9F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>⚡</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{w.name}</div>
                    <Meta w={w} />
                  </div>
                  {assignedIds.has(w.id) ? (
                    <Link href={`/client/workouts/${w.id}`} style={{ fontSize: 13, fontWeight: 700, color: "#2DC4B8", textDecoration: "none", flexShrink: 0 }}>Start →</Link>
                  ) : (
                    <form action={addOwnWorkout}>
                      <input type="hidden" name="workout_id" value={w.id} />
                      <button type="submit" style={{ padding: "9px 14px", borderRadius: 8, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                        + Add
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Build your own */}
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>Build your own</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 12 }}>
Travelling or stuck without equipment? Put together a one-off. Only you can see it.
          </div>
          <form action={createOwnWorkout} style={{ display: "flex", gap: 8 }}>
            <input
              name="name"
              required
              placeholder="e.g. Saturday cardio"
              style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" }}
            />
            <button type="submit" style={{ padding: "12px 18px", borderRadius: 10, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
              Create
            </button>
          </form>
        </div>
      </div>
      <ClientBottomNav />
    </div>
  );
}

function Meta({ w }: { w: LibWorkout }) {
  const exCount = w.exercises?.[0]?.count ?? 0;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
      {exCount > 0 && <span style={{ fontSize: 12, color: "#6B7A8D" }}>{exCount} exercises</span>}
      {w.est_duration_mins && <span style={{ fontSize: 12, color: "#6B7A8D" }}>~{w.est_duration_mins} min</span>}
      {w.difficulty && (
        <span style={{ fontSize: 11, fontWeight: 700, color: DIFF_COLOR[w.difficulty] ?? "#6B7A8D", background: (DIFF_COLOR[w.difficulty] ?? "#6B7A8D") + "18", padding: "1px 7px", borderRadius: 5, textTransform: "capitalize" }}>
          {w.difficulty}
        </span>
      )}
      {w.category && <span style={{ fontSize: 12, color: "#9CA3AF" }}>{w.category}</span>}
    </div>
  );
}

function WorkoutRow({ w, icon, href }: { w: LibWorkout; icon: string; href: string }) {
  return (
    <Link href={href} style={{ ...card, display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{w.name}</div>
        <Meta w={w} />
      </div>
      <div style={{ color: "#9CA3AF", fontSize: 18 }}>›</div>
    </Link>
  );
}

const card: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0",
};
const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase",
  letterSpacing: 0.5, marginBottom: 10,
};
