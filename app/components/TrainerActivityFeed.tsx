import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { totalVolumeLbs } from "@/lib/workout-utils";
import { GYM_TZ } from "@/lib/time";
import { RPE_LABEL, rpeColor } from "@/lib/rpe";

const COLORS = ["#1B68B4", "#2DC4B8", "#7C3AED", "#DB2777", "#D97706", "#059669"];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

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

      {rows.map((r, i) => (
        <Link
          key={r.id}
          href={`/trainer/clients/${r.clientId}?tab=workouts`}
          style={{ display: "flex", gap: 12, padding: "14px 18px", textDecoration: "none", borderTop: i === 0 ? "none" : "1px solid #F4F7FA", alignItems: "flex-start" }}
        >
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS[r.clientName.charCodeAt(0) % COLORS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
            {initials(r.clientName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "#6B7A8D", lineHeight: 1.5 }}>
              {r.nth && (
                <span style={{ color: "#D97706", fontWeight: 700 }}>
                  🎉 {r.nth === 1 ? "First workout! " : `${r.nth}th workout! `}
                </span>
              )}
              <span style={{ fontWeight: 700, color: "#0D1827" }}>{r.clientName}</span>
              {" completed "}
              <span style={{ fontWeight: 700, color: "#0D1827" }}>{r.workoutName}</span>
              {r.sets > 0 && ` — ${r.sets} set${r.sets === 1 ? "" : "s"}`}
              {r.volume > 0 && (
                <>
                  {", "}
                  <span style={{ fontWeight: 700, color: "#1B68B4" }}>{r.volume.toLocaleString()} lbs</span>
                  {" lifted"}
                </>
              )}
              {"."}
              {r.rpe && (
                <>
                  {" Rated "}
                  <span style={{ fontWeight: 700, color: rpeColor(r.rpe) }}>RPE {r.rpe}/10</span>
                  {` (${RPE_LABEL[r.rpe]}).`}
                </>
              )}
            </div>
            {r.note && (
              <div style={{ fontSize: 13, color: "#6B7A8D", fontStyle: "italic", marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                “{r.note}”
              </div>
            )}
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>{timeAgo(r.completedAt)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
