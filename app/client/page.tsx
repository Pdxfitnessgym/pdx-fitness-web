import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function ClientDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (profile && profile.role !== "client") redirect("/trainer");

  const todayDow = new Date().getDay();

  const { data: cp } = await supabase
    .from("client_programs")
    .select("start_date, program_id, programs(id, name, duration_weeks, workouts(id, name, day_of_week, week_number))")
    .eq("client_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  let todayWorkout: { id: string; name: string } | null = null;
  if (cp) {
    const start = new Date(cp.start_date);
    const diffDays = Math.floor((new Date().getTime() - start.getTime()) / 86400000);
    const currentWeek = Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), (cp.programs as { duration_weeks: number } | null)?.duration_weeks ?? 99);
    const workouts = (cp.programs as { workouts: { id: string; name: string; day_of_week: number; week_number: number }[] } | null)?.workouts ?? [];
    todayWorkout = workouts.find(w => w.day_of_week === todayDow && w.week_number === currentWeek) ?? null;
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>Let's get it 💪</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>{profile?.full_name ?? "Athlete"}</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#1B68B4", letterSpacing: 2 }}>PDX</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
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

        {/* Progress Grid */}
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 12 }}>My Progress</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {["Body Weight", "Body Fat", "Caloric Intake", "Photos"].map(label => (
            <div key={label} style={{ ...cardStyle, minHeight: 80 }}>
              <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 500, marginBottom: 8 }}>{label}</div>
              <div style={{ color: "#9CA3AF", fontSize: 13 }}>—</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { label: "Home", href: "/client", icon: "🏠" },
            { label: "Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "Progress", href: "/client/progress", icon: "📈" },
            { label: "Profile", href: "/client/profile", icon: "👤" },
          ].map(item => (
            <a key={item.href} href={item.href} style={navItem}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 11, color: "#6B7A8D", marginTop: 4 }}>{item.label}</span>
            </a>
          ))}
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

const navItem: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #E2EAF0",
  padding: "12px 8px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textDecoration: "none",
};
