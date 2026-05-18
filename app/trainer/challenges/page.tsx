import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TrainerChallengesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "trainer") redirect("/client");

  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, name, description, cover_emoji, start_date, end_date, is_active, challenge_participants(count)")
    .eq("trainer_id", user.id)
    .order("created_at", { ascending: false });

  const today = new Date().toISOString().split("T")[0];
  const active = challenges?.filter(c => c.end_date >= today && c.is_active) ?? [];
  const past = challenges?.filter(c => c.end_date < today || !c.is_active) ?? [];

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Challenges</div>
          </div>
          <Link href="/trainer/challenges/new" style={btnStyle}>+ New</Link>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 24 }}>
        <Section title="Active" count={active.length} challenges={active} today={today} />
        {past.length > 0 && <Section title="Past" count={past.length} challenges={past} today={today} dim />}
        {!challenges?.length && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "48px 24px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#0D1827", marginBottom: 6 }}>No challenges yet</div>
            <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 20 }}>Create your first challenge to get your community competing.</div>
            <Link href="/trainer/challenges/new" style={btnStyle}>Create First Challenge</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, challenges, today, dim }: {
  title: string; count: number; challenges: any[]; today: string; dim?: boolean;
}) {
  if (!count) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: dim ? "#9CA3AF" : "#1B68B4", textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
        <div style={{ fontSize: 11, fontWeight: 700, background: dim ? "#F4F7FA" : "#EBF4FF", color: dim ? "#9CA3AF" : "#1B68B4", padding: "2px 8px", borderRadius: 20 }}>{count}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {challenges.map(c => {
          const totalDays = Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000);
          const daysLeft = Math.max(0, Math.ceil((new Date(c.end_date).getTime() - new Date(today).getTime()) / 86400000));
          const participants = (c.challenge_participants?.[0] as any)?.count ?? 0;
          return (
            <Link key={c.id} href={`/trainer/challenges/${c.id}`} style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0", textDecoration: "none", display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ fontSize: 36, width: 52, height: 52, background: "#F4F7FA", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {c.cover_emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: dim ? "#9CA3AF" : "#0D1827" }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 3 }}>
                  {participants} joined · {dim ? `${totalDays} days` : `${daysLeft} days left`}
                </div>
                {!dim && (
                  <div style={{ marginTop: 6, background: "#E2EAF0", borderRadius: 4, height: 4 }}>
                    <div style={{ background: "#2DC4B8", height: 4, borderRadius: 4, width: `${Math.round(((totalDays - daysLeft) / totalDays) * 100)}%` }} />
                  </div>
                )}
              </div>
              <div style={{ color: "#9CA3AF", fontSize: 18 }}>›</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = { padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-block" };
