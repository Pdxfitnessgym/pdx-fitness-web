import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ProgramsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: programs } = await supabase
    .from("programs")
    .select("*, workouts(count)")
    .eq("trainer_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Programs</div>
          </div>
          <Link href="/trainer/programs/new" style={btnStyle}>+ New Program</Link>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        {!programs?.length ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 6 }}>No programs yet</div>
            <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 20 }}>Create your first program to assign to clients</div>
            <Link href="/trainer/programs/new" style={btnStyle}>+ Create Program</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {programs.map(p => (
              <Link key={p.id} href={`/trainer/programs/${p.id}`} style={{ ...cardStyle, textDecoration: "none", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 13, color: "#6B7A8D", marginBottom: 8 }}>{p.description}</div>}
                    <div style={{ fontSize: 12, color: "#6B7A8D" }}>
                      {p.duration_weeks} weeks · {(p.workouts as any)?.[0]?.count ?? 0} workouts
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: "#2DC4B8" }}>→</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0",
};
const btnStyle: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff",
  fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-block",
};
