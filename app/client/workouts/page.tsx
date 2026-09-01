import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";
import { CalendarSyncCard } from "@/app/components/CalendarSyncCard";


const DIFF_COLOR: Record<string, string> = {
  beginner: "#10B981",
  intermediate: "#F59E0B",
  advanced: "#EF4444",
};

type WorkoutRow = {
  id: string;
  name: string;
  day_of_week: number;
  week_number: number;
  exercises: { count: number }[];
};

type StandaloneWorkout = {
  id: string;
  name: string;
  description: string | null;
  difficulty: string | null;
  est_duration_mins: number | null;
  category: string | null;
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, trainer_id")
    .eq("id", user.id)
    .single();
  if (profile && profile.role !== "client") redirect("/trainer");

  const sp = await searchParams;
  const isCalendar = sp.view === "calendar";

  if (isCalendar) {
    return <CalendarView clientId={user.id} month={sp.month} />;
  }

  // Fetch program + on-demand workouts + assigned workouts in parallel
  const [cpResult, standaloneResult, assignedResult] = await Promise.all([
    supabase
      .from("client_programs")
      .select("id, start_date, programs(id, name, duration_weeks)")
      .eq("client_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
    profile?.trainer_id
      ? supabase
          .from("workouts")
          .select("id, name, description, difficulty, est_duration_mins, category, exercises(count)")
          .eq("trainer_id", profile.trainer_id)
          .eq("is_standalone", true)
          .eq("is_private", false)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("client_workout_assignments")
      .select("workout_id, workouts(id, name, description, difficulty, est_duration_mins, category, exercises(count))")
      .eq("client_id", user.id)
      .order("assigned_at", { ascending: false }),
  ]);

  const cp = cpResult.data;
  const globalStandalone = (standaloneResult.data ?? []) as StandaloneWorkout[];
  // Merge assigned workouts — put trainer-assigned first, dedupe with global on-demand
  // Supabase returns related rows as an array, so workouts is StandaloneWorkout[]
  const assignedWorkouts = ((assignedResult.data ?? []) as unknown as { workout_id: string; workouts: StandaloneWorkout[] }[])
    .map(r => (Array.isArray(r.workouts) ? r.workouts[0] : r.workouts))
    .filter((w): w is StandaloneWorkout => Boolean(w));
  const assignedIds = new Set(assignedWorkouts.map(w => w.id));
  const standaloneWorkouts: StandaloneWorkout[] = [
    ...assignedWorkouts,
    ...globalStandalone.filter(w => !assignedIds.has(w.id)),
  ];

  // No program + no on-demand → simple message
  if (!cp && standaloneWorkouts.length === 0) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
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
        <ClientBottomNav />
      </div>
    );
  }

  // No program but has on-demand → show library
  if (!cp) {
    return (
      <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Workouts</div>
            <ViewToggle active="list" />
          </div>
        </div>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
            On-Demand Library
          </div>
          <OnDemandGrid workouts={standaloneWorkouts} />
        </div>
        <ClientBottomNav />
      </div>
    );
  }

  const program = cp.programs as unknown as { id: string; name: string; duration_weeks: number } | null;

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, name, day_of_week, week_number, exercises(count)")
    .eq("program_id", (program as { id: string })?.id)
    .order("week_number")
    .order("day_of_week") as { data: WorkoutRow[] | null };

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
            <Link href="/client/workouts/history" style={{ fontSize: 13, color: "#2DC4B8", fontWeight: 600, textDecoration: "none" }}>History →</Link>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>{program?.name}</div>
          <ViewToggle active="list" />
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Program workouts */}
        {workouts && workouts.length > 0 ? (
          workouts.map(w => {
            const exCount = w.exercises?.[0]?.count ?? 0;
            const mins = estMins(w.exercises);
            return (
              <Link
                key={w.id}
                href={`/client/workouts/${w.id}`}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #E2EAF0",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>💪</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#0D1827" }}>{w.name}</div>
                  <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
                    {exCount > 0 ? `${exCount} exercises · ~${mins} min` : "No exercises yet"}
                  </div>
                </div>
                <div style={{ color: "#9CA3AF", fontSize: 18 }}>›</div>
              </Link>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No workouts yet</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Your trainer hasn&apos;t added workouts to this program yet.</div>
          </div>
        )}

        {/* On-Demand section */}
        {standaloneWorkouts.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>
              On-Demand Library
            </div>
            <OnDemandGrid workouts={standaloneWorkouts} />
          </div>
        )}
      </div>
      <ClientBottomNav />
    </div>
  );
}

function OnDemandGrid({ workouts }: { workouts: StandaloneWorkout[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {workouts.map(w => {
        const exCount = w.exercises?.[0]?.count ?? 0;
        return (
          <Link
            key={w.id}
            href={`/client/workouts/${w.id}`}
            style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #E2EAF0", textDecoration: "none", display: "flex", alignItems: "center", gap: 14 }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>{w.name}</div>
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
            </div>
            <div style={{ color: "#9CA3AF", fontSize: 18 }}>›</div>
          </Link>
        );
      })}
    </div>
  );
}

function ViewToggle({ active }: { active: "list" | "calendar" }) {
  const base: React.CSSProperties = {
    padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700,
    textDecoration: "none", flexShrink: 0,
  };
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
      <Link href="/client/workouts" style={{ ...base, background: active === "list" ? "#1B68B4" : "#F4F7FA", color: active === "list" ? "#fff" : "#6B7A8D" }}>List</Link>
      <Link href="/client/workouts?view=calendar" style={{ ...base, background: active === "calendar" ? "#1B68B4" : "#F4F7FA", color: active === "calendar" ? "#fff" : "#6B7A8D" }}>Calendar</Link>
    </div>
  );
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

// Calendar of workouts actually completed — program workouts no longer carry a
// schedule, so logged dates are the only real dates there are.
async function CalendarView({ clientId, month }: { clientId: string; month?: string }) {
  const supabase = await createClient();

  const now = new Date();
  const parsed = month && /^\d{4}-\d{2}$/.test(month) ? month.split("-").map(Number) : null;
  const year = parsed ? parsed[0] : now.getFullYear();
  const monthIdx = parsed ? parsed[1] - 1 : now.getMonth();

  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd = new Date(year, monthIdx + 1, 1);

  const { data: logs } = await supabase
    .from("workout_logs")
    .select("id, completed_at, workouts(name)")
    .eq("client_id", clientId)
    .not("completed_at", "is", null)
    .gte("completed_at", monthStart.toISOString())
    .lt("completed_at", monthEnd.toISOString())
    .order("completed_at");

  // Group by local calendar day
  const byDay: Record<number, string[]> = {};
  for (const l of logs ?? []) {
    const d = new Date(l.completed_at as string);
    const day = d.getDate();
    const name = (l.workouts as unknown as { name: string } | null)?.name ?? "Workout";
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(name);
  }

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstDow = monthStart.getDay();
  const isThisMonth = year === now.getFullYear() && monthIdx === now.getMonth();
  const todayDate = now.getDate();

  const prev = new Date(year, monthIdx - 1, 1);
  const next = new Date(year, monthIdx + 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const totalDone = Object.values(byDay).reduce((a, b) => a + b.length, 0);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
            <Link href="/client/workouts/history" style={{ fontSize: 13, color: "#2DC4B8", fontWeight: 600, textDecoration: "none" }}>History →</Link>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Workouts</div>
          <ViewToggle active="calendar" />
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}>
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Link href={`/client/workouts?view=calendar&month=${fmt(prev)}`} style={{ padding: "6px 12px", borderRadius: 8, background: "#fff", border: "1px solid #E2EAF0", color: "#6B7A8D", textDecoration: "none", fontSize: 16 }}>‹</Link>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1827" }}>{MONTH_NAMES[monthIdx]} {year}</div>
            <div style={{ fontSize: 12, color: "#6B7A8D" }}>{totalDone} workout{totalDone !== 1 ? "s" : ""} completed</div>
          </div>
          <Link href={`/client/workouts?view=calendar&month=${fmt(next)}`} style={{ padding: "6px 12px", borderRadius: 8, background: "#fff", border: "1px solid #E2EAF0", color: "#6B7A8D", textDecoration: "none", fontSize: 16 }}>›</Link>
        </div>

        {/* Grid */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: 12, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
            {DOW.map((d, i) => (
              <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#9CA3AF" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {Array.from({ length: firstDow }, (_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const done = byDay[day];
              const isToday = isThisMonth && day === todayDate;
              return (
                <div key={day} style={{
                  aspectRatio: "1", borderRadius: 10, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 2,
                  background: done ? "#D1FAE5" : isToday ? "#EBF4FF" : "#F8FAFB",
                  border: isToday ? "2px solid #1B68B4" : "1px solid transparent",
                }}>
                  <span style={{ fontSize: 13, fontWeight: done || isToday ? 800 : 500, color: done ? "#059669" : isToday ? "#1B68B4" : "#6B7A8D" }}>{day}</span>
                  {done && (
                    <div style={{ display: "flex", gap: 2 }}>
                      {done.slice(0, 3).map((_, i) => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981" }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* This month's completed workouts */}
        {totalDone === 0 ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>Nothing logged this month</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Completed workouts will show up here.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.keys(byDay).map(Number).sort((a, b) => b - a).map(day => (
              <div key={day} style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2EAF0", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#D1FAE5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#059669" }}>{day}</span>
                </div>
                <div style={{ flex: 1 }}>
                  {byDay[day].map((name, i) => (
                    <div key={i} style={{ fontSize: 14, fontWeight: 600, color: "#0D1827" }}>✓ {name}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <CalendarSyncCard />
      </div>
      <ClientBottomNav />
    </div>
  );
}
