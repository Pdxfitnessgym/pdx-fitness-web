import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { approveTrainer, rejectTrainer } from "@/app/actions/admin";

export default async function AdminTrainersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== "pdxfitnessgym@gmail.com") redirect("/login");

  const { data: pending } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "trainer")
    .eq("is_approved", false)
    .order("created_at", { ascending: false });

  const { data: approved } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("role", "trainer")
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>Trainer Approvals</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>PDX Fitness Admin</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Pending */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Pending Approval ({pending?.length ?? 0})
          </div>
          {pending && pending.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pending.map(t => (
                <div key={t.id} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #FEF3C7", padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#D97706", flexShrink: 0 }}>
                      {t.full_name?.[0]?.toUpperCase() ?? "T"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#0D1827", fontSize: 15 }}>{t.full_name}</div>
                      <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 1 }}>{t.email}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                        Applied {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <form action={approveTrainer} style={{ flex: 1 }}>
                      <input type="hidden" name="trainer_id" value={t.id} />
                      <button
                        type="submit"
                        style={{ width: "100%", padding: "11px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                      >
                        Approve
                      </button>
                    </form>
                    <form action={rejectTrainer}>
                      <input type="hidden" name="trainer_id" value={t.id} />
                      <button
                        type="submit"
                        style={{ padding: "11px 16px", borderRadius: 10, background: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              No pending requests
            </div>
          )}
        </div>

        {/* Approved */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Active Trainers ({approved?.length ?? 0})
          </div>
          {approved && approved.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {approved.map(t => (
                <div key={t.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#EBF9F8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#2DC4B8", flexShrink: 0 }}>
                    {t.full_name?.[0]?.toUpperCase() ?? "T"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#0D1827", fontSize: 14 }}>{t.full_name}</div>
                    <div style={{ fontSize: 13, color: "#6B7A8D" }}>{t.email}</div>
                  </div>
                  <div style={{ fontSize: 12, background: "#ECFDF5", color: "#059669", fontWeight: 700, padding: "4px 10px", borderRadius: 20, flexShrink: 0 }}>
                    Active
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "24px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              No approved trainers yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
