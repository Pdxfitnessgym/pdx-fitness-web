import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TrainerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (profile && profile.role !== "trainer") redirect("/client");

  const { count: clientCount } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("trainer_id", user.id);
  const { count: programCount } = await supabase.from("programs").select("*", { count: "exact", head: true }).eq("trainer_id", user.id);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>Welcome back</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>{profile?.full_name ?? "Trainer"}</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#1B68B4", letterSpacing: 2 }}>PDX</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 500, marginBottom: 6 }}>Active Clients</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#1B68B4" }}>{clientCount ?? 0}</div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 500, marginBottom: 6 }}>Programs</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#1B68B4" }}>{programCount ?? 0}</div>
          </div>
        </div>

        {/* Build section */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Build</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Link href="/trainer/programs/new" style={{ ...buildCard, background: "#1B68B4" }}>
            <span style={{ fontSize: 28, marginBottom: 6 }}>📋</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>New Program</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Create a training plan</span>
          </Link>
          <Link href="/trainer/exercises/new" style={{ ...buildCard, background: "#2DC4B8" }}>
            <span style={{ fontSize: 28, marginBottom: 6 }}>🎥</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Add Exercise</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Upload video demo</span>
          </Link>
          <Link href="/trainer/programs" style={{ ...buildCard, background: "#fff", gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 24, marginBottom: 4 }}>🏗️</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#1B68B4" }}>Build Workouts</span>
            <span style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>Open a program → add workouts &amp; exercises</span>
          </Link>
        </div>

        {/* Nav */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Navigate</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {[
            { label: "Home", href: "/trainer", icon: "🏠" },
            { label: "Clients", href: "/trainer/clients", icon: "👥" },
            { label: "Programs", href: "/trainer/programs", icon: "📋" },
            { label: "Exercises", href: "/trainer/exercises", icon: "🏋️" },
            { label: "Profile", href: "/trainer/profile", icon: "👤" },
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

const buildCard: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px 12px",
  borderRadius: 14,
  textDecoration: "none",
  border: "1px solid #E2EAF0",
  textAlign: "center",
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
