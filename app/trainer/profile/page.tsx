import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import Link from "next/link";

export default async function TrainerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, created_at")
    .eq("id", user.id)
    .single();

  if (profile && profile.role !== "trainer") redirect("/client");

  const { count: clientCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("trainer_id", user.id);

  const { count: programCount } = await supabase
    .from("programs")
    .select("*", { count: "exact", head: true })
    .eq("trainer_id", user.id);

  const { count: exerciseCount } = await supabase
    .from("exercise_library")
    .select("*", { count: "exact", head: true })
    .eq("trainer_id", user.id);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "—";

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Profile</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Avatar + name */}
        <div style={{ background: "#1B68B4", borderRadius: 16, padding: "28px 24px", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
            {(profile?.full_name ?? "T")[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{profile?.full_name ?? "Trainer"}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>{profile?.email}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>Trainer · Member since {memberSince}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { label: "Clients", value: clientCount ?? 0, href: "/trainer/clients" },
            { label: "Programs", value: programCount ?? 0, href: "/trainer/programs" },
            { label: "Exercises", value: exerciseCount ?? 0, href: "/trainer/exercises" },
          ].map(s => (
            <Link key={s.label} href={s.href} style={{ background: "#fff", borderRadius: 14, padding: "16px 12px", border: "1px solid #E2EAF0", textDecoration: "none", textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1B68B4" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </Link>
          ))}
        </div>

        {/* Quick links */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", overflow: "hidden" }}>
          {[
            { label: "My Clients", href: "/trainer/clients", icon: "👥" },
            { label: "My Programs", href: "/trainer/programs", icon: "📋" },
            { label: "Exercise Library", href: "/trainer/exercises", icon: "🏋️" },
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
