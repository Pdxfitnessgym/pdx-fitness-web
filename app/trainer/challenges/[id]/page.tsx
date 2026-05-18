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

export default async function TrainerChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const { data: challenge } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", id)
    .eq("trainer_id", user.id)
    .single();

  if (!challenge) redirect("/trainer/challenges");

  const { data: participants } = await supabase
    .from("challenge_participants")
    .select("client_id, joined_at, profiles!challenge_participants_client_id_fkey(full_name, email)")
    .eq("challenge_id", id);

  const { data: checkins } = await supabase
    .from("challenge_checkins")
    .select("client_id, checked_in_date, note")
    .eq("challenge_id", id)
    .order("checked_in_date", { ascending: false });

  const today = new Date().toISOString().split("T")[0];
  const totalDays = Math.ceil((new Date(challenge.end_date).getTime() - new Date(challenge.start_date).getTime()) / 86400000);
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.end_date).getTime() - new Date(today).getTime()) / 86400000));
  const daysElapsed = totalDays - daysLeft;

  // Build leaderboard
  const leaderboard = (participants ?? []).map(p => {
    const clientCheckins = (checkins ?? []).filter(c => c.client_id === p.client_id);
    const dates = clientCheckins.map(c => c.checked_in_date);
    const streak = calcStreak(dates);
    const profile = p.profiles as unknown as { full_name: string; email: string };
    return {
      client_id: p.client_id,
      name: profile?.full_name ?? "Member",
      email: profile?.email ?? "",
      total: clientCheckins.length,
      streak,
      checkedInToday: dates.includes(today),
    };
  }).sort((a, b) => b.total - a.total || b.streak - a.streak);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer/challenges" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Challenges</Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <div style={{ fontSize: 36 }}>{challenge.cover_emoji}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1B68B4" }}>{challenge.name}</div>
              <div style={{ fontSize: 13, color: "#6B7A8D" }}>
                {challenge.start_date} → {challenge.end_date} · {totalDays} days
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Participants", value: participants?.length ?? 0 },
            { label: "Days Left", value: daysLeft },
            { label: "Total Check-ins", value: checkins?.length ?? 0 },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "14px 12px", border: "1px solid #E2EAF0", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1B68B4" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7A8D", marginBottom: 8 }}>
            <span>Day {Math.min(daysElapsed, totalDays)} of {totalDays}</span>
            <span>{Math.round((daysElapsed / totalDays) * 100)}% complete</span>
          </div>
          <div style={{ background: "#E2EAF0", borderRadius: 6, height: 8 }}>
            <div style={{ background: "#2DC4B8", height: 8, borderRadius: 6, width: `${Math.min(100, Math.round((daysElapsed / totalDays) * 100))}%`, transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Description / goal */}
        {(challenge.description || challenge.goal) && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
            {challenge.description && <div style={{ fontSize: 14, color: "#0D1827", lineHeight: 1.5, marginBottom: challenge.goal ? 10 : 0 }}>{challenge.description}</div>}
            {challenge.goal && (
              <div style={{ background: "#EBF9F8", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#2DC4B8", marginBottom: 4 }}>DAILY GOAL</div>
                <div style={{ fontSize: 14, color: "#0D1827" }}>{challenge.goal}</div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Leaderboard</div>
          {leaderboard.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 14 }}>No participants yet. Share the challenge with your clients!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leaderboard.map((p, i) => (
                <div key={p.client_id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? "#FEF3C7" : i === 1 ? "#F3F4F6" : "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: i === 0 ? "#D97706" : i === 1 ? "#6B7280" : "#B45309", flexShrink: 0 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#0D1827", display: "flex", alignItems: "center", gap: 6 }}>
                      {p.name}
                      {p.checkedInToday && <span style={{ fontSize: 10, background: "#D1FAE5", color: "#065F46", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>✓ Today</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7A8D" }}>{p.streak > 0 ? `🔥 ${p.streak} day streak` : "No streak yet"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#1B68B4" }}>{p.total}</div>
                    <div style={{ fontSize: 11, color: "#6B7A8D" }}>check-ins</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent check-ins feed */}
        {checkins && checkins.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>Recent Activity</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {checkins.slice(0, 10).map(c => {
                const p = leaderboard.find(l => l.client_id === c.client_id);
                return (
                  <div key={`${c.client_id}-${c.checked_in_date}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EBF9F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>✓</div>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "#0D1827" }}>{p?.name ?? "Member"}</span>
                      <span style={{ fontSize: 13, color: "#6B7A8D" }}> checked in on {new Date(c.checked_in_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      {c.note && <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>"{c.note}"</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
