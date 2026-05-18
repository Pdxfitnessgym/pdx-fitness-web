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

        {/* Quick Actions */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 14 }}>Quick Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Link href="/trainer/programs/new" style={actionBtn}>+ Create New Program</Link>
            <Link href="/trainer/programs" style={{ ...actionBtn, background: "#fff", color: "#1B68B4", border: "1.5px solid #1B68B4" }}>View All Programs</Link>
          </div>
        </div>

        {/* Nav */}
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

const actionBtn: React.CSSProperties = {
  display: "block",
  padding: "13px 16px",
  borderRadius: 12,
  background: "#2DC4B8",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
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
