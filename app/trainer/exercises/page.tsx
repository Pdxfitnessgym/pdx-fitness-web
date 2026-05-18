import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ExerciseLibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: exercises } = await supabase
    .from("exercise_library")
    .select("*")
    .or(`trainer_id.eq.${user.id},trainer_id.is.null`)
    .order("name");

  const master = exercises?.filter(e => e.trainer_id === null) ?? [];
  const mine = exercises?.filter(e => e.trainer_id === user.id) ?? [];

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Link href="/trainer" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Dashboard</Link>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Exercise Library</div>
            <div style={{ fontSize: 13, color: "#6B7A8D" }}>{master.length} master · {mine.length} personal</div>
          </div>
          <Link href="/trainer/exercises/new" style={btnStyle}>+ Add Exercise</Link>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Master Library */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1B68B4", textTransform: "uppercase", letterSpacing: 1 }}>Master Library</div>
            <div style={{ fontSize: 11, fontWeight: 700, background: "#EBF4FF", color: "#1B68B4", padding: "2px 8px", borderRadius: 20 }}>{master.length}</div>
          </div>
          {master.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "24px", color: "#9CA3AF", fontSize: 14 }}>
              No master exercises yet. Admin can add global exercises.
            </div>
          ) : (
            <ExerciseList exercises={master} showMasterBadge={false} />
          )}
        </div>

        {/* My Exercises */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 1 }}>My Exercises</div>
            <div style={{ fontSize: 11, fontWeight: 700, background: "#F4F7FA", color: "#6B7A8D", padding: "2px 8px", borderRadius: 20 }}>{mine.length}</div>
          </div>
          {mine.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: "32px 24px" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏋️</div>
              <div style={{ fontWeight: 600, color: "#0D1827", marginBottom: 4 }}>No personal exercises yet</div>
              <div style={{ color: "#6B7A8D", fontSize: 14, marginBottom: 16 }}>Add your own exercises alongside the master library</div>
              <Link href="/trainer/exercises/new" style={btnStyle}>+ Add Exercise</Link>
            </div>
          ) : (
            <ExerciseList exercises={mine} showMasterBadge={false} />
          )}
        </div>
      </div>
    </div>
  );
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

type Ex = { id: string; name: string; muscle_group: string | null; equipment: string | null; instructions: string | null; video_url: string | null; youtube_url: string | null; trainer_id: string | null };

function ExerciseList({ exercises }: { exercises: Ex[]; showMasterBadge: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {exercises.map(ex => (
        <Link key={ex.id} href={`/trainer/exercises/${ex.id}`} style={{ ...cardStyle, display: "flex", gap: 14, alignItems: "center", textDecoration: "none" }}>
          {ex.video_url ? (
            <div style={{ width: 72, height: 72, borderRadius: 10, background: "#000", overflow: "hidden", flexShrink: 0 }}>
              <video src={ex.video_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline preload="metadata" />
            </div>
          ) : ex.youtube_url && getYouTubeId(ex.youtube_url) ? (
            <div style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative" }}>
              <img src={`https://img.youtube.com/vi/${getYouTubeId(ex.youtube_url)}/mqdefault.jpg`} alt={ex.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>▶</div>
              </div>
            </div>
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 10, background: "#F4F7FA", border: "1px solid #E2EAF0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 28 }}>💪</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{ex.name}</div>
            <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
              {[ex.muscle_group, ex.equipment].filter(Boolean).join(" · ")}
            </div>
            {ex.instructions && (
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                {ex.instructions}
              </div>
            )}
          </div>
          <div style={{ color: "#9CA3AF", fontSize: 18, flexShrink: 0 }}>›</div>
        </Link>
      ))}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #E2EAF0" };
const btnStyle: React.CSSProperties = { padding: "10px 18px", borderRadius: 10, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", display: "inline-block" };
