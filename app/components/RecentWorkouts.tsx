import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { totalVolumeLbs } from "@/lib/workout-utils";
import { GYM_TZ, gymDaysUntil } from "@/lib/time";

// The last few sessions, so "what did I do last time" is on the home screen
// rather than two taps away in History.
export async function RecentWorkouts({ clientId }: { clientId: string }) {
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("workout_logs")
    .select("id, completed_at, workouts(name)")
    .eq("client_id", clientId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(3);

  if (!logs?.length) return null;

  const { data: sets } = await supabase
    .from("set_logs")
    .select("workout_log_id, reps_completed, weight_lbs")
    .in("workout_log_id", logs.map(l => l.id));

  const byLog = new Map<string, { reps: string | null; weight: number | null }[]>();
  for (const s of sets ?? []) {
    const arr = byLog.get(s.workout_log_id) ?? [];
    arr.push({ reps: s.reps_completed, weight: s.weight_lbs });
    byLog.set(s.workout_log_id, arr);
  }

  const when = (iso: string) => {
    const days = -gymDaysUntil(iso);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString("en-US", { timeZone: GYM_TZ, month: "short", day: "numeric" });
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2EAF0", padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Recent Workouts
        </div>
        <Link href="/client/workouts/history" style={{ fontSize: 12, fontWeight: 700, color: "#2DC4B8", textDecoration: "none" }}>
          All →
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {logs.map(l => {
          const logged = byLog.get(l.id) ?? [];
          const volume = totalVolumeLbs(logged);
          const name = (l.workouts as unknown as { name: string } | null)?.name ?? "Workout";
          return (
            <Link
              key={l.id}
              href={`/client/workouts/history?log=${l.id}`}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 12, background: "#F8FAFB", border: "1px solid #E2EAF0", textDecoration: "none" }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>✓</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#0D1827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                <span style={{ display: "block", fontSize: 12, color: "#6B7A8D" }}>
                  {when(l.completed_at as string)}
                  {logged.length > 0 && ` · ${logged.length} set${logged.length === 1 ? "" : "s"}`}
                  {volume > 0 && ` · ${volume.toLocaleString()} lbs`}
                </span>
              </span>
              <span style={{ color: "#9CA3AF", fontSize: 18 }}>›</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
