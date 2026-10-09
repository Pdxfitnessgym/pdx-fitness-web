import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { gymDaysUntil } from "@/lib/time";

type Flag = { clientId: string; name: string; reason: string; severity: number };

// Noticing, not automating: the handful of things a coach would spot if they
// read every client's page every morning. Nothing here acts on its own.
export async function NeedsAttention({ trainerId, isAdmin }: { trainerId: string; isAdmin: boolean }) {
  const supabase = await createClient();

  const q = supabase.from("profiles").select("id, full_name, sessions_purchased").eq("role", "client");
  const { data: clients } = isAdmin ? await q : await q.eq("trainer_id", trainerId);
  if (!clients?.length) return null;
  const ids = clients.map(c => c.id);

  const [{ data: logs }, { data: programs }, { data: sessions }] = await Promise.all([
    supabase.from("workout_logs").select("client_id, completed_at").in("client_id", ids).not("completed_at", "is", null),
    supabase.from("client_programs").select("client_id, program_id").in("client_id", ids).eq("is_active", true),
    supabase.from("training_sessions").select("client_id, status").in("client_id", ids).eq("status", "completed"),
  ]);

  const lastTrained = new Map<string, string>();
  for (const l of logs ?? []) {
    const cur = lastTrained.get(l.client_id);
    if (!cur || (l.completed_at as string) > cur) lastTrained.set(l.client_id, l.completed_at as string);
  }
  const hasProgram = new Set((programs ?? []).map(p => p.client_id));

  // A program with no exercises is the same as no program, from the client's side
  const programIds = [...new Set((programs ?? []).map(p => p.program_id))];
  const { data: startable } = programIds.length
    ? await supabase.from("workouts").select("program_id, exercises(count)").in("program_id", programIds)
    : { data: [] as { program_id: string; exercises: { count: number }[] }[] };
  const usableProgram = new Set<string>();
  for (const w of startable ?? []) {
    if ((w.exercises?.[0]?.count ?? 0) > 0) usableProgram.add(w.program_id);
  }
  const programOf = new Map((programs ?? []).map(p => [p.client_id, p.program_id]));

  const sessionsDone = new Map<string, number>();
  for (const s of sessions ?? []) sessionsDone.set(s.client_id, (sessionsDone.get(s.client_id) ?? 0) + 1);

  const flags: Flag[] = [];
  for (const c of clients) {
    const name = c.full_name ?? "Client";
    const last = lastTrained.get(c.id);

    if (!hasProgram.has(c.id)) {
      flags.push({ clientId: c.id, name, reason: "No program assigned", severity: 5 });
    } else if (!usableProgram.has(programOf.get(c.id) ?? "")) {
      flags.push({ clientId: c.id, name, reason: "Program has no workouts to start", severity: 5 });
    }

    if (!last) {
      flags.push({ clientId: c.id, name, reason: "Has never logged a workout", severity: 4 });
    } else {
      const days = -gymDaysUntil(last);
      if (days >= 21) flags.push({ clientId: c.id, name, reason: `No workout in ${days} days`, severity: 4 });
      else if (days >= 10) flags.push({ clientId: c.id, name, reason: `No workout in ${days} days`, severity: 3 });
    }

    const purchased = (c as { sessions_purchased: number | null }).sessions_purchased ?? 0;
    if (purchased > 0) {
      const left = purchased - (sessionsDone.get(c.id) ?? 0);
      if (left <= 0) flags.push({ clientId: c.id, name, reason: "Out of sessions", severity: 4 });
      else if (left <= 2) flags.push({ clientId: c.id, name, reason: `${left} session${left === 1 ? "" : "s"} left`, severity: 2 });
    }
  }

  if (flags.length === 0) return null;
  flags.sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name));
  const top = flags.slice(0, 6);

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #FCD34D", overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "14px 18px 10px", background: "#FFFBEB", borderBottom: "1px solid #FDE68A" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#92400E" }}>Worth a look</div>
        <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
          {flags.length} thing{flags.length === 1 ? "" : "s"} across {isAdmin ? "the gym" : "your clients"}
        </div>
      </div>
      {top.map((f, i) => (
        <Link
          key={`${f.clientId}-${f.reason}`}
          href={`/trainer/clients/${f.clientId}`}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", textDecoration: "none", borderTop: i === 0 ? "none" : "1px solid #F4F7FA" }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: f.severity >= 4 ? "#EF4444" : f.severity === 3 ? "#F59E0B" : "#9CA3AF" }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{f.name}</span>
            <span style={{ display: "block", fontSize: 12, color: "#6B7A8D" }}>{f.reason}</span>
          </span>
          <span style={{ color: "#9CA3AF", fontSize: 18 }}>›</span>
        </Link>
      ))}
      {flags.length > top.length && (
        <Link href="/trainer/clients" style={{ display: "block", padding: "11px", textAlign: "center", borderTop: "1px solid #F4F7FA", background: "#FAFCFD", fontSize: 13, fontWeight: 700, color: "#1B68B4", textDecoration: "none" }}>
          {flags.length - top.length} more → all clients
        </Link>
      )}
    </div>
  );
}
