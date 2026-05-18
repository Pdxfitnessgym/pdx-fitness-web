import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type WorkoutRow = {
  id: string;
  name: string;
  day_of_week: number;
  week_number: number;
  exercises: { count: number }[];
};

function estMins(exs: { count: number }[]) {
  const count = exs?.[0]?.count ?? 0;
  return Math.round(count * 3.5);
}

export default async function ClientWorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile && profile.role !== "client") redirect("/trainer");

  const sp = await searchParams;
  const todayDow = new Date().getDay();

  const { data: cp } = await supabase
    .from("client_programs")
    .select("id, start_date, programs(id, name, duration_weeks)")
    .eq("client_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!cp) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Workouts</div>
          </div>
        </div>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
          <div style={{ fontWeight: 700, color: "#0D1827", marginBottom: 6 }}>No program assigned yet</div>
          <div style={{ fontSize: 14, color: "#6B7A8D" }}>Your trainer will assign a program soon.</div>
        </div>
      </div>
    );
  }

  const program = cp.programs as unknown as { id: string; name: string; duration_weeks: number } | null;
  const start = new Date(cp.start_date);
  const diffDays = Math.floor((new Date().getTime() - start.getTime()) / 86400000);
  const currentWeek = Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), program?.duration_weeks ?? 99);

  const viewWeek = sp.week ? parseInt(sp.week) : currentWeek;

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, name, day_of_week, week_number, exercises(count)")
    .eq("program_id", (program as { id: string })?.id)
    .eq("week_number", viewWeek)
    .order("day_of_week") as { data: WorkoutRow[] | null };

  const todayWorkout = workouts?.find(w => w.day_of_week === todayDow && viewWeek === currentWeek) ?? null;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>{program?.name}</div>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>Week {viewWeek} of {program?.duration_weeks}</div>
            </div>
            {viewWeek === currentWeek && (
              <div style={{ fontSize: 12, background: "#ECFDF5", color: "#059669", fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
                Current week
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Week selector */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", overflowX: "auto" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 4, padding: "10px 16px", whiteSpace: "nowrap" }}>
          {Array.from({ length: program?.duration_weeks ?? 1 }, (_, i) => i + 1).map(w => (
            <Link
              key={w}
              href={`/client/workouts?week=${w}`}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
                background: w === viewWeek ? "#1B68B4" : "#F4F7FA",
                color: w === viewWeek ? "#fff" : w === currentWeek ? "#1B68B4" : "#6B7A8D",
                border: w === currentWeek && w !== viewWeek ? "1.5px solid #1B68B4" : "1.5px solid transparent",
                flexShrink: 0,
              }}
            >
              Wk {w}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        {workouts && workouts.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {workouts.map(w => {
              const isToday = w.day_of_week === todayDow && viewWeek === currentWeek;
              const exCount = w.exercises?.[0]?.count ?? 0;
              const mins = estMins(w.exercises);
              return (
                <Link
                  key={w.id}
                  href={`/client/workouts/${w.id}`}
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: isToday ? "2px solid #2DC4B8" : "1px solid #E2EAF0",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 16px",
                  }}
                >
                  {/* Day badge */}
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: isToday ? "#2DC4B8" : "#F4F7FA", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? "rgba(255,255,255,0.8)" : "#9CA3AF", textTransform: "uppercase" }}>{DAY_NAMES[w.day_of_week].slice(0, 3)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "#0D1827" }}>{w.name}</div>
                    <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
                      {exCount > 0 ? `${exCount} exercises · ~${mins} min` : "No exercises yet"}
                    </div>
                  </div>
                  {isToday ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2DC4B8", flexShrink: 0 }}>Today →</div>
                  ) : (
                    <div style={{ color: "#9CA3AF", fontSize: 18 }}>›</div>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No workouts this week</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Your trainer hasn't added workouts for week {viewWeek} yet.</div>
          </div>
        )}
      </div>
    </div>
  );
}
