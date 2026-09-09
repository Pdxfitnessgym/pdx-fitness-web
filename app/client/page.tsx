import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { NotificationBanner } from "@/app/components/NotificationBanner";
import { LogoutButton } from "@/app/components/LogoutButton";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";


export default async function ClientDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role, sessions_purchased, trainer_id").eq("id", user.id).single();
  if (profile && profile.role !== "client") redirect("/trainer");


  const { data: recentProgress } = await supabase
    .from("progress_logs")
    .select("weight_lbs, body_fat_pct, logged_at")
    .eq("client_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(5);

  const latestWeight = recentProgress?.find(p => p.weight_lbs != null)?.weight_lbs ?? null;
  const latestBf = recentProgress?.find(p => p.body_fat_pct != null)?.body_fat_pct ?? null;

  const { data: cp } = await supabase
    .from("client_programs")
    .select("start_date, program_id, programs(id, name, duration_weeks, workouts(id, name, day_of_week, week_number))")
    .eq("client_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const trainerId = (profile as unknown as { trainer_id: string | null } | null)?.trainer_id;

  // A client sees: gym-wide announcements from any trainer, plus their own trainer's
  // posts that are either for all their clients or for a group this client is in.
  // Self-guided members have no trainer, so they get the gym-wide ones only.
  const { data: myGroups } = await supabase
    .from("group_members").select("group_id").eq("user_id", user.id);
  const myGroupIds = (myGroups ?? []).map(g => g.group_id);

  const [{ data: gymPosts }, { data: trainerPosts }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, content, created_at")
      .eq("post_type", "announcement")
      .eq("gym_wide", true)
      .order("created_at", { ascending: false })
      .limit(3),
    trainerId
      ? supabase
          .from("posts")
          .select("id, content, created_at")
          .eq("post_type", "announcement")
          .eq("author_id", trainerId)
          .eq("gym_wide", false)
          .or(myGroupIds.length > 0 ? `group_id.is.null,group_id.in.(${myGroupIds.join(",")})` : "group_id.is.null")
          .order("created_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] }),
  ]);

  const announcements = [...(gymPosts ?? []), ...(trainerPosts ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const { count: completedSessionsCount } = await supabase
    .from("training_sessions")
    .select("*", { count: "exact", head: true })
    .eq("client_id", user.id)
    .eq("status", "completed");

  const sessionsPurchased = (profile as unknown as { sessions_purchased: number } | null)?.sessions_purchased ?? 0;
  const sessionsRemaining = sessionsPurchased - (completedSessionsCount ?? 0);

  const prog = cp?.programs as unknown as { name: string; workouts: { id: string; name: string }[] } | null;
  const programWorkouts = prog?.workouts ?? [];

  // Workouts individually assigned to this client (one-offs and on-demand)
  const { data: assignedRows } = await supabase
    .from("client_workout_assignments")
    .select("workouts(id, name)")
    .eq("client_id", user.id)
    .order("assigned_at", { ascending: false });
  const assignedWorkouts = ((assignedRows ?? []) as unknown as { workouts: { id: string; name: string } | { id: string; name: string }[] }[])
    .map(r => (Array.isArray(r.workouts) ? r.workouts[0] : r.workouts))
    .filter(Boolean) as { id: string; name: string }[];

  const seen = new Set<string>();
  const pickable = [...assignedWorkouts, ...programWorkouts].filter(w => {
    if (!w || seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });

  // What they already finished today, so the list can show it
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const { data: doneToday } = await supabase
    .from("workout_logs")
    .select("workout_id")
    .eq("client_id", user.id)
    .not("completed_at", "is", null)
    .gte("completed_at", todayStart.toISOString());
  const doneIds = new Set((doneToday ?? []).map(r => r.workout_id as string));

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a href="/client/profile" style={{ textDecoration: "none" }}>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>Let's get it 💪</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>{profile?.full_name ?? "Athlete"}</div>
          </a>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <Image src="/logo.png" alt="PDX Fitness" width={100} height={40} style={{ objectFit: "contain" }} />
            <LogoutButton />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        <NotificationBanner />

        {/* Sessions remaining */}
        {sessionsPurchased > 0 && (
          <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, border: sessionsRemaining <= 2 ? "1.5px solid #EF4444" : "1px solid #E2EAF0" }}>
            <div>
              <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Sessions Remaining</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: sessionsRemaining <= 2 ? "#EF4444" : "#0D1827", marginTop: 2 }}>
                {sessionsRemaining}
                <span style={{ fontSize: 14, fontWeight: 400, color: "#6B7A8D", marginLeft: 6 }}>/ {sessionsPurchased}</span>
              </div>
              {sessionsRemaining <= 2 && sessionsRemaining > 0 && (
                <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 600, marginTop: 2 }}>Time to renew soon!</div>
              )}
              {sessionsRemaining <= 0 && (
                <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 600, marginTop: 2 }}>Contact your trainer to renew</div>
              )}
            </div>
            <div style={{ fontSize: 32 }}>🎟️</div>
          </div>
        )}

        {/* Pick today's workout — nothing is tied to a day of the week */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0D1827", marginBottom: 2 }}>
            What do you want to do today?
          </div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 12 }}>
            {pickable.length > 0 ? "Pick a workout to get started." : ""}
          </div>

          {pickable.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pickable.slice(0, 5).map(w => {
                const done = doneIds.has(w.id);
                return (
                  <a
                    key={w.id}
                    href={`/client/workouts/${w.id}`}
                    style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, textDecoration: "none", border: done ? "1px solid #A7F3D0" : "1px solid #E2EAF0", padding: "14px 16px" }}
                  >
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: done ? "#D1FAE5" : "#EBF9F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {done ? "✓" : "🏋️"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "#0D1827" }}>{w.name}</div>
                      <div style={{ fontSize: 13, color: done ? "#059669" : "#2DC4B8", fontWeight: 600, marginTop: 2 }}>
                        {done ? "Done today — go again?" : "Tap to start →"}
                      </div>
                    </div>
                  </a>
                );
              })}
              {pickable.length > 5 && (
                <a href="/client/workouts" style={{ fontSize: 13, color: "#2DC4B8", fontWeight: 700, textDecoration: "none", padding: "4px 2px" }}>
                  See all {pickable.length} workouts →
                </a>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚡</div>
              <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No workouts yet</div>
              <div style={{ fontSize: 13, color: "#6B7A8D", textAlign: "center" }}>
                Your trainer hasn&apos;t assigned anything yet
              </div>
            </div>
          )}
        </div>

        {/* Announcements */}
        {announcements && announcements.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📢 From your trainer</div>
            {(announcements as { id: string; content: string; created_at: string }[]).map(a => (
              <div key={a.id} style={{ background: "linear-gradient(135deg, #1B68B4 0%, #2DC4B8 100%)", borderRadius: 16, padding: "18px 20px", marginBottom: 8, boxShadow: "0 4px 16px rgba(27,104,180,0.25)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📢</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>
                      {new Date(a.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", lineHeight: 1.55 }}>{a.content}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Nutrition shortcut */}
        <div style={{ marginBottom: 16 }}>
          <a href="/client/nutrition" style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
            <div style={{ fontSize: 32 }}>🥗</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0D1827" }}>Nutrition</div>
              <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>Meal plan · Log food · Track macros</div>
            </div>
            <div style={{ color: "#9CA3AF", fontSize: 20 }}>›</div>
          </a>
        </div>

        {/* Sessions shortcuts */}
        <div style={{ marginBottom: 16, display: "flex", gap: 10 }}>
          <a href="/client/book" style={{ ...cardStyle, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", textDecoration: "none", padding: "16px 12px", border: "2px solid #1B68B4" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📆</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1B68B4" }}>Book Session</div>
          </a>
          <a href="/client/sessions" style={{ ...cardStyle, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", textDecoration: "none", padding: "16px 12px" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🤝</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0D1827" }}>My Sessions</div>
          </a>
        </div>

        {/* Community / Habits row */}
        <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          <a href="/client/checkin" style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", textDecoration: "none", padding: "14px 8px" }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#1B68B4" }}>Check-in</div>
          </a>
          <a href="/client/feed" style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", textDecoration: "none", padding: "14px 8px" }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>🔥</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#0D1827" }}>Feed</div>
          </a>
          <a href="/client/habits" style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", textDecoration: "none", padding: "14px 8px" }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#0D1827" }}>Habits</div>
          </a>
          <a href="/client/challenges" style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", textDecoration: "none", padding: "14px 8px" }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>🏆</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#0D1827" }}>Challenges</div>
          </a>
        </div>

        {/* Calendar quick link */}
        <a href="/client/workouts?view=calendar" style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827" }}>📅 Workout Calendar</div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>See what you&apos;ve done · Sync to Apple/Google</div>
          </div>
          <div style={{ color: "#1B68B4", fontSize: 18 }}>›</div>
        </a>

        {/* Progress Grid */}
        <a href="/client/progress" style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 12, display: "block", textDecoration: "none" }}>My Progress →</a>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <a href="/client/progress" style={{ ...cardStyle, minHeight: 80, textDecoration: "none" }}>
            <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 500, marginBottom: 8 }}>Body Weight</div>
            {latestWeight != null
              ? <div style={{ fontSize: 20, fontWeight: 800, color: "#0D1827" }}>{latestWeight} <span style={{ fontSize: 13, fontWeight: 400, color: "#6B7A8D" }}>lbs</span></div>
              : <div style={{ color: "#9CA3AF", fontSize: 13 }}>—</div>}
          </a>
          <a href="/client/progress" style={{ ...cardStyle, minHeight: 80, textDecoration: "none" }}>
            <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 500, marginBottom: 8 }}>Body Fat</div>
            {latestBf != null
              ? <div style={{ fontSize: 20, fontWeight: 800, color: "#0D1827" }}>{latestBf}<span style={{ fontSize: 13, fontWeight: 400, color: "#6B7A8D" }}>%</span></div>
              : <div style={{ color: "#9CA3AF", fontSize: 13 }}>—</div>}
          </a>
        </div>

        <ClientBottomNav />
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
