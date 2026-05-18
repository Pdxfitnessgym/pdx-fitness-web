import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const { data: ex } = await supabase
    .from("exercise_library")
    .select("*")
    .eq("id", id)
    .single();

  if (!ex || (ex.trainer_id !== user.id && !ex.is_system)) redirect("/trainer/exercises");

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer/exercises" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Exercise Library</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>{ex.name}</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
            {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {ex.video_url ? (
          <div style={{ borderRadius: 14, overflow: "hidden", background: "#000", border: "1px solid #E2EAF0" }}>
            <video
              src={ex.video_url}
              controls
              playsInline
              style={{ width: "100%", maxHeight: 360, display: "block" }}
            />
          </div>
        ) : (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎥</div>
            <div style={{ color: "#6B7A8D", fontSize: 14 }}>No video demo uploaded</div>
          </div>
        )}

        {ex.instructions && (
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Instructions</div>
            <div style={{ fontSize: 15, color: "#0D1827", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{ex.instructions}</div>
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: "#6B7A8D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Muscle Group", value: ex.muscle_group ?? "—" },
              { label: "Equipment", value: ex.equipment ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{value}</div>
              </div>
            ))}
          </div>
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
