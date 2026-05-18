import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { addClientByEmail } from "@/app/actions/clients";
import Link from "next/link";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (profile && profile.role !== "trainer") redirect("/client");

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("trainer_id", user.id)
    .eq("role", "client")
    .order("full_name");

  const params = await searchParams;
  const error = params.error;
  const success = params.success;

  const errorMsg: Record<string, string> = {
    not_found: "No account found with that email.",
    not_client: "That user is not registered as a client.",
    has_trainer: "That client already has a trainer.",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>My Clients</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Add Client */}
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827", marginBottom: 14 }}>Add Client by Email</div>
          {success && (
            <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
              Client added successfully!
            </div>
          )}
          {error && (
            <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
              {errorMsg[error] ?? "Something went wrong."}
            </div>
          )}
          <form action={addClientByEmail} style={{ display: "flex", gap: 10 }}>
            <input
              name="email"
              type="email"
              required
              placeholder="client@email.com"
              style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 15, color: "#0D1827", outline: "none" }}
            />
            <button type="submit" style={{ padding: "12px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
              Add
            </button>
          </form>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 8 }}>
            The client must already have a PDX Fitness account (signed up as a client).
          </div>
        </div>

        {/* Client List */}
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>
          {clients && clients.length > 0 ? `${clients.length} Client${clients.length !== 1 ? "s" : ""}` : "No clients yet"}
        </div>

        {clients && clients.map(client => (
          <Link key={client.id} href={`/trainer/clients/${client.id}`} style={{ ...cardStyle, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, color: "#0D1827", fontSize: 16 }}>{client.full_name}</div>
              <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>{client.email}</div>
            </div>
            <div style={{ color: "#2DC4B8", fontSize: 20 }}>›</div>
          </Link>
        ))}
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
