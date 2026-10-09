import { createClient } from "@/lib/supabase/server";
import { TrainerActivityList } from "@/app/components/TrainerActivityList";
import { totalVolumeLbs } from "@/lib/workout-utils";
import { GYM_TZ } from "@/lib/time";

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { timeZone: GYM_TZ, month: "short", day: "numeric" });
}

type Row = {
  id: string;
  clientId: string;
  clientName: string;
  workoutName: string;
  completedAt: string;
  volume: number;
  sets: number;
  note: string | null;
  rpe: number | null;
  nth: number | null;
};

export async function TrainerActivityFeed({ trainerId, isAdmin }: { trainerId: string; isAdmin: boolean }) {
  const supabase = await createClient();

  const clientQuery = supabase.from("profiles").select("id, full_name").eq("role", "client");
  const { data: clients } = isAdmin ? await clientQuery : await clientQuery.eq("trainer_id", trainerId);
  const nameById = new Map((clients ?? []).map(c => [c.id, c.full_name ?? "Client"]));
  const clientIds = [...nameById.keys()];
  if (clientIds.length === 0) return null;

  // Every completed log, so the milestone count ("their 10th workout") is real
  const { data: allLogs } = await supabase
    .from("workout_logs")
    .select("id, client_id, completed_at, notes, rpe, workouts(name)")
    .in("client_id", clientIds)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: true });

  if (!allLogs?.length) return null;

  const countSoFar = new Map<string, number>();
  const ordinal = new Map<string, number>();
  for (const l of allLogs) {
    const n = (countSoFar.get(l.client_id) ?? 0) + 1;
    countSoFar.set(l.client_id, n);
    ordinal.set(l.id, n);
  }

  const recent = allLogs.slice(-12).reverse();
  const logIds = recent.map(l => l.id);

  const { data: sets } = await supabase
    .from("set_logs")
    .select("workout_log_id, reps_completed, weight_lbs")
    .in("workout_log_id", logIds);

  const setsByLog = new Map<string, { reps: string | null; weight: number | null }[]>();
  for (const s of sets ?? []) {
    const arr = setsByLog.get(s.workout_log_id) ?? [];
    arr.push({ reps: s.reps_completed, weight: s.weight_lbs });
    setsByLog.set(s.workout_log_id, arr);
  }

  const rows: Row[] = recent.map(l => {
    const logged = setsByLog.get(l.id) ?? [];
    const w = l.workouts as unknown as { name: string } | { name: string }[] | null;
    const nth = ordinal.get(l.id) ?? 0;
    return {
      id: l.id,
      clientId: l.client_id,
      clientName: nameById.get(l.client_id) ?? "Client",
      workoutName: (Array.isArray(w) ? w[0]?.name : w?.name) ?? "a workout",
      completedAt: l.completed_at as string,
      volume: totalVolumeLbs(logged),
      sets: logged.length,
      note: (l.notes as string | null)?.trim() || null,
      rpe: (l.rpe as number | null) ?? null,
      // Celebrate every 10th, and the very first
      nth: nth === 1 || nth % 10 === 0 ? nth : null,
    };
  });

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #F4F7FA" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1827" }}>Recent activity</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
          {isAdmin ? "Across the gym" : "Your clients"}
        </div>
      </div>

      <TrainerActivityList rows={rows.map(r => ({
        id: r.id, clientId: r.clientId, clientName: r.clientName, workoutName: r.workoutName,
        when: timeAgo(r.completedAt), volume: r.volume, sets: r.sets, note: r.note, rpe: r.rpe, nth: r.nth,
      }))} />

    </div>
  );
}
