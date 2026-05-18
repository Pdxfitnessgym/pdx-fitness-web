import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...dates].sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().split("T")[0];
  let streak = 0;
  let cursor = new Date(today);
  for (const d of sorted) {
    const cursorStr = cursor.toISOString().split("T")[0];
    if (d === cursorStr) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else if (d < cursorStr) break;
  }
  return streak;
}

export default async function ClientChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const today = new Date().toISOString().split("T")[0];

  const [{ data: challenge }, { data: participants }, { data: allCheckins }, { data: myMembership }] = await Promise.all([
    supabase.from("challenges").select("*").eq("id", id).single(),
    supabase.from("challenge_participants").select("client_id, profiles!challenge_participants_client_id_fkey(full_name)").eq("challenge_id", id),
    supabase.from("challenge_checkins").select("client_id, checked_in_date, note").eq("challenge_id", id).order("checked_in_date", { ascending: false }),
    supabase.from("challenge_participants").select("id").eq("challenge_id", id).eq("client_id", user.id).maybeSingle(),
  ]);

  if (!challenge) redirect("/client/challenges");

  const totalDays = Math.ceil((new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000);
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - new Date(today).getTime()) / 86400000));

  const myCheckins = (allCheckins ?? []).filter(c => c.client_id === user.id);
  const myDates = myCheckins.map(c => c.checked_in_date);
  const myStreak = calcStreak(myDates);
  const checkedInToday = myDates.includes(today);

  // Leaderboard
  const leaderboard = (participants ?? []).map(p => {
    const dates = (allCheckins ?? []).filter(c => c.client_id === p.client_id).map(c => c.checked_in_date);
    const profile = p.profiles as unknown as { full_name: string };
    return {
      client_id: p.client_id,
      name: profile?.full_name ?? "Member",
      total: dates.length,
      streak: calcStreak(dates),
      checkedInToday: dates.includes(today),
      isMe: p.client_id === user.id,
    };
  }).sort((a, b) => b.total - a.total || b.streak - a.streak);

  const myRank = leaderboard.findIndex(l => l.isMe) + 1;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client/challenges" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Challenges</Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <div style={{ fontSize: 36 }}>{challenge.cover_emoji}</div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#1B68B4" }}>{challenge.name}</div>
              <div style={{ fontSize: 12, color: "#6B7A8D" }}>{totalDays} days · {daysLeft} days left · {participants?.length ?? 0} participants</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* My stats */}
        {myMembership && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "My Check-ins", value: myCheckins.length },
              { label: "Current Streak", value: myStreak > 0 ? `🔥 ${myStreak}` : "0" },
              { label: "My Rank", value: myRank > 0 ? `#${myRank}` : "—" },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "14px 10px", border: "1px solid #E2EAF0", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 14, border: "1px solid #E2EAF0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7A8D", marginBottom: 8 }}>
            <span>Day {Math.min(totalDays - daysLeft, totalDays)} of {totalDays}</span>
            <span>{Math.round(((totalDays - daysLeft) / totalDays) * 100)}% complete</span>
          </div>
          <div style={{ background: "#E2EAF0", borderRadius: 6, height: 8 }}>
            <div style={{ background: "#2DC4B8", height: 8, borderRadius: 6, width: `${Math.min(100, Math.round(((totalDays - daysLeft) / totalDays) * 100))}%` }} />
          </div>
        </div>

        {/* Goal */}
        {challenge.goal && (
          <div style={{ background: "#EBF9F8", borderRadius: 14, padding: 14, border: "1px solid #C5EDE9" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2DC4B8", marginBottom: 4 }}>DAILY GOAL</div>
            <div style={{ fontSize: 14, color: "#0D1827" }}>{challenge.goal}</div>
          </div>
        )}

        {/* Check-in CTA */}
        {myMembership && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
            {checkedInToday ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, color: "#2DC4B8", fontSize: 15 }}>You checked in today!</div>
                <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 4 }}>Come back tomorrow to keep your streak.</div>
              </div>
            ) : (
              <form action={`/api/challenges/${id}/checkin`} method="POST">
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827", marginBottom: 10 }}>Check in for today</div>
                <Link href="/client/challenges" style={{ display: "block", padding: "13px", borderRadius: 12, background: "#1B68B4", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", textAlign: "center" }}>
                  ← Go to Challenges to Check In
                </Link>
              </form>
            )}
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Leaderboard</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {leaderboard.map((p, i) => (
              <div key={p.client_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: p.isMe ? "10px 12px" : "0", background: p.isMe ? "#EBF4FF" : "transparent", borderRadius: p.isMe ? 10 : 0 }}>
                <div style={{ width: 30, textAlign: "center", fontSize: i < 3 ? 20 : 14, fontWeight: 700, color: "#6B7A8D", flexShrink: 0 }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#0D1827", display: "flex", alignItems: "center", gap: 6 }}>
                    {p.name} {p.isMe && <span style={{ fontSize: 11, color: "#1B68B4", fontWeight: 700 }}>You</span>}
                    {p.checkedInToday && <span style={{ fontSize: 10, background: "#D1FAE5", color: "#065F46", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>✓ Today</span>}
                  </div>
                  {p.streak > 0 && <div style={{ fontSize: 12, color: "#F59E0B" }}>🔥 {p.streak} day streak</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#1B68B4" }}>{p.total}</div>
                  <div style={{ fontSize: 11, color: "#6B7A8D" }}>days</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E2EAF0", padding: "8px 16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Home", href: "/client", icon: "🏠" },
            { label: "Feed", href: "/client/feed", icon: "🔥" },
            { label: "Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "Progress", href: "/client/progress", icon: "📈" },
          ].map(item => (
            <a key={item.href} href={item.href} style={{ display: "flex", flexDirection: "column", alignItems: "center", textDecoration: "none", padding: "6px 0" }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: "#6B7A8D", marginTop: 2 }}>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
