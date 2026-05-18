import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { assignProgram } from "@/app/actions/clients";
import Link from "next/link";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile && profile.role !== "trainer") redirect("/client");

  const { clientId } = await params;
  const sp = await searchParams;

  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name, email, trainer_id")
    .eq("id", clientId)
    .single();

  if (!client || client.trainer_id !== user.id) redirect("/trainer/clients");

  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, duration_weeks")
    .eq("trainer_id", user.id)
    .order("name");

  const { data: activeProgram } = await supabase
    .from("client_programs")
    .select("id, start_date, program_id, programs(name, duration_weeks)")
    .eq("client_id", clientId)
    .eq("is_active", true)
    .maybeSingle();

  const { data: recentLogs } = await supabase
    .from("workout_logs")
    .select("id, completed_at, workouts(name)")
    .eq("client_id", clientId)
    .order("completed_at", { ascending: false })
    .limit(5);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer/clients" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Clients</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>{client.full_name}</div>
          <div style={{ fontSize: 13, color: "#6B7A8D" }}>{client.email}</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {sp.assigned && (
          <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600 }}>
            Program assigned successfully!
          </div>
        )}

        {/* Active Program */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Active Program</div>
          {activeProgram ? (
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "#0D1827" }}>
                {(activeProgram.programs as { name: string; duration_weeks: number } | null)?.name}
              </div>
              <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 4 }}>
                Started {activeProgram.start_date} · {(activeProgram.programs as { name: string; duration_weeks: number } | null)?.duration_weeks} weeks
              </div>
            </div>
          ) : (
            <div style={{ color: "#9CA3AF", fontSize: 14 }}>No program assigned</div>
          )}
        </div>

        {/* Assign Program */}
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 14 }}>
            {activeProgram ? "Switch Program" : "Assign Program"}
          </div>
          {programs && programs.length > 0 ? (
            <form action={assignProgram} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input type="hidden" name="client_id" value={clientId} />
              <select name="program_id" required style={inputStyle}>
                <option value="">Select a program…</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.duration_weeks}wk)</option>
                ))}
              </select>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 6 }}>Start Date</label>
                <input type="date" name="start_date" required defaultValue={today} style={inputStyle} />
              </div>
              <button type="submit" style={btnStyle}>Assign Program →</button>
            </form>
          ) : (
            <div style={{ color: "#9CA3AF", fontSize: 14 }}>
              No programs yet. <Link href="/trainer/programs/new" style={{ color: "#2DC4B8" }}>Create one →</Link>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Recent Workouts</div>
          {recentLogs && recentLogs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentLogs.map(log => (
                <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, color: "#0D1827", fontSize: 14 }}>
                    {(log.workouts as { name: string } | null)?.name ?? "Workout"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7A8D" }}>
                    {log.completed_at ? new Date(log.completed_at).toLocaleDateString() : "—"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#9CA3AF", fontSize: 14 }}>No workouts logged yet</div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: 18,
  border: "1px solid #E2EAF0",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 10,
  border: "1px solid #E2EAF0",
  background: "#F4F7FA",
  fontSize: 15,
  color: "#0D1827",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: 12,
  background: "#2DC4B8",
  color: "#fff",
  fontWeight: 700,
  fontSize: 16,
  border: "none",
  cursor: "pointer",
};
