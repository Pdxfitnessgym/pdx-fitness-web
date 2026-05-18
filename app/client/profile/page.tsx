import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import Link from "next/link";

export default async function ClientProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, created_at, trainer_id")
    .eq("id", user.id)
    .single();

  if (profile && profile.role !== "client") redirect("/trainer");

  const { data: trainerProfile } = profile?.trainer_id
    ? await supabase.from("profiles").select("full_name, email").eq("id", profile.trainer_id).single()
    : { data: null };

  const { data: cp } = await supabase
    .from("client_programs")
    .select("start_date, programs(name, duration_weeks)")
    .eq("client_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const { count: logCount } = await supabase
    .from("workout_logs")
    .select("*", { count: "exact", head: true })
    .eq("client_id", user.id);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  const program = cp?.programs as unknown as { name: string; duration_weeks: number } | null;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Home</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Profile</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Avatar + name */}
        <div style={{ background: "#2DC4B8", borderRadius: 16, padding: "28px 24px", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {(profile?.full_name ?? "C")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{profile?.full_name ?? "Athlete"}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{profile?.email}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>Member since {memberSince}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1B68B4" }}>{logCount ?? 0}</div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 4, fontWeight: 500 }}>Workouts Logged</div>
          </div>
          <div style={{ background: "#fff", borderRadius: 14, padding: "16px", border: "1px solid #E2EAF0", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#1B68B4" }}>
              {cp ? `Wk ${Math.floor((new Date().getTime() - new Date(cp.start_date).getTime()) / 604800000) + 1}` : "—"}
            </div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 4, fontWeight: 500 }}>Current Week</div>
          </div>
        </div>

        {/* Active program */}
        {program && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Active Program</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0D1827" }}>{program.name}</div>
            <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 4 }}>
              {program.duration_weeks} weeks · started {new Date(cp!.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
            <Link href="/client/workouts" style={{ display: "inline-block", marginTop: 12, fontSize: 14, fontWeight: 700, color: "#2DC4B8", textDecoration: "none" }}>
              Go to workouts →
            </Link>
          </div>
        )}

        {/* Trainer */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>My Trainer</div>
          {trainerProfile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#1B68B4" }}>
                {trainerProfile.full_name[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#0D1827" }}>{trainerProfile.full_name}</div>
                <div style={{ fontSize: 13, color: "#6B7A8D" }}>{trainerProfile.email}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#9CA3AF" }}>No trainer assigned yet</div>
          )}
        </div>

        {/* Nav links */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
          {[
            { label: "My Workouts", href: "/client/workouts", icon: "🏋️" },
            { label: "My Progress", href: "/client/progress", icon: "📈" },
          ].map((item, i, arr) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", textDecoration: "none", borderBottom: i < arr.length - 1 ? "1px solid #F4F7FA" : "none" }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{item.label}</span>
              <span style={{ color: "#9CA3AF", fontSize: 18 }}>›</span>
            </Link>
          ))}
        </div>

        {/* Logout */}
        <form action={logout}>
          <button
            type="submit"
            style={{ width: "100%", padding: "15px", borderRadius: 14, background: "#fff", color: "#DC2626", fontWeight: 700, fontSize: 16, border: "1.5px solid #FEE2E2", cursor: "pointer" }}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
