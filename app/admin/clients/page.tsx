import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HomeLink } from "@/app/components/HomeLink";

type Person = {
  id: string;
  full_name: string | null;
  email: string;
  trainer_id: string | null;
  membership: string;
  is_placeholder: boolean;
};

// Gym-owner view: every client in the gym, grouped by which trainer coaches them.
// Trainers only ever see their own roster; this page is for the admin account.
export default async function AdminClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles").select("role, is_admin").eq("id", user.id).single();
  if (!me?.is_admin) redirect("/trainer");

  const [{ data: people }, { data: trainers }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, trainer_id, membership, is_placeholder")
      .eq("role", "client")
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "trainer")
      .order("full_name"),
  ]);

  const all = (people ?? []) as Person[];
  const selfGuided = all.filter(p => p.membership === "self_guided");
  const coached = all.filter(p => p.membership !== "self_guided");
  const unassigned = coached.filter(p => !p.trainer_id);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link><HomeLink role="trainer" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Everyone</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
            {all.length} {all.length === 1 ? "person" : "people"} across the gym
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
        {(trainers ?? []).map(t => {
          const roster = coached.filter(p => p.trainer_id === t.id);
          return (
            <div key={t.id}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0D1827" }}>{t.full_name ?? t.email}</div>
                <div style={{ fontSize: 12, color: "#6B7A8D" }}>{roster.length} client{roster.length !== 1 ? "s" : ""}</div>
              </div>
              {roster.length === 0 ? (
                <div style={{ ...card, color: "#9CA3AF", fontSize: 14 }}>No clients yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {roster.map(p => <PersonRow key={p.id} p={p} />)}
                </div>
              )}
            </div>
          );
        })}

        {unassigned.length > 0 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#92400E", marginBottom: 10 }}>
              Unassigned ({unassigned.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {unassigned.map(p => <PersonRow key={p.id} p={p} />)}
            </div>
          </div>
        )}

        {selfGuided.length > 0 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0F766E", marginBottom: 2 }}>
              Self-Guided Members ({selfGuided.length})
            </div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginBottom: 10 }}>On a gym program, no 1:1 trainer</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selfGuided.map(p => <PersonRow key={p.id} p={p} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PersonRow({ p }: { p: Person }) {
  return (
    <Link href={`/trainer/clients/${p.id}`} style={{ ...card, textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#EBF4FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#1B68B4", flexShrink: 0 }}>
        {(p.full_name ?? "?")[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>{p.full_name ?? "—"}</div>
        {p.is_placeholder ? (
          <div style={{ fontSize: 11, fontWeight: 700, color: "#B45309" }}>Not invited yet</div>
        ) : (
          <div style={{ fontSize: 12, color: "#6B7A8D", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
        )}
      </div>
      <div style={{ color: "#2DC4B8", fontSize: 18 }}>›</div>
    </Link>
  );
}

const card: React.CSSProperties = {
  background: "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #E2EAF0",
};
