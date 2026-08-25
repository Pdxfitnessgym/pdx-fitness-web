import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { NotificationBanner } from "@/app/components/NotificationBanner";
import { LogoutButton } from "@/app/components/LogoutButton";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function ClientDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role, sessions_purchased, trainer_id").eq("id", user.id).single();
  if (profile && profile.role !== "client") redirect("/trainer");

  // Server runs UTC; use America/Chicago (Central) so US clients get the right day.
  const todayDow = localDayOfWeek("America/Chicago");

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

  // Announcements are either for everyone (group_id null) or for a group this client is in
  const { data: myGroups } = trainerId
    ? await supabase.from("group_members").select("group_id").eq("user_id", user.id)
    : { data: [] };
  const myGroupIds = (myGroups ?? []).map(g => g.group_id);

  const { data: announcements } = trainerId ? await supabase
    .from("posts")
    .select("id, content, created_at")
    .eq("post_type", "announcement")
    .eq("author_id", trainerId)
    .or(myGroupIds.length > 0 ? `group_id.is.null,group_id.in.(${myGroupIds.join(",")})` : "group_id.is.null")
    .order("created_at", { ascending: false })
    .limit(3) : { data: [] };

  const { count: completedSessionsCount } = await supabase
    .from("training_sessions")
    .select("*", { count: "exact", head: true })
    .eq("client_id", user.id)
    .eq("status", "completed");

  const sessionsPurchased = (profile as unknown as { sessions_purchased: number } | null)?.sessions_purchased ?? 0;
  const sessionsRemaining = sessionsPurchased - (completedSessionsCount ?? 0);

  let todayWorkout: { id: string; name: string } | null = null;
  if (cp) {
    const start = new Date(cp.start_date);
    const diffDays = Math.floor((new Date().getTime() - start.getTime()) / 86400000);
    const prog = cp.programs as unknown as { duration_weeks: number; workouts: { id: string; name: string; day_of_week: number; week_number: number }[] } | null;
    const currentWeek = Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), prog?.duration_weeks ?? 99);
    const workouts = prog?.workouts ?? [];
    todayWorkout = workouts.find(w => w.day_of_week === todayDow && w.week_number === currentWeek) ?? null;
  }

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

        {/* Today's Workout */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Today — {DAY_NAMES[todayDow]}
          </div>
          {todayWorkout ? (
            <a href={`/client/workouts/${todayWorkout.id}`} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", border: "2px solid #2DC4B8" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: "#0D1827" }}>{todayWorkout.name}</div>
                <div style={{ fontSize: 13, color: "#2DC4B8", fontWeight: 600, marginTop: 4 }}>Tap to start →</div>
              </div>
              <div style={{ fontSize: 36 }}>🏋️</div>
            </a>
          ) : (
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚡</div>
              <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>
                {cp ? "Rest day" : "No workout scheduled"}
              </div>
              <div style={{ fontSize: 13, color: "#6B7A8D", textAlign: "center" }}>
                {cp ? "No workout scheduled for today" : "Your trainer hasn't assigned a program yet"}
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
        <a href="/client/calendar" style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0D1827" }}>📅 Workout Calendar</div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>View schedule · Sync to Apple/Google</div>
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

function localDayOfWeek(tz: string): number {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(
    new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: tz })
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: 18,
  border: "1px solid #E2EAF0",
};

