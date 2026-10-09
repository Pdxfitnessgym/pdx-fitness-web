import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HomeLink } from "@/app/components/HomeLink";
import { saveWeekGuide } from "@/app/actions/programs";
import { WEEK_DAYS, type ScheduleRow, type WeekGuide } from "@/lib/program-week";

export default async function WeekGuideEditorPage({ params }: { params: Promise<{ id: string; week: string }> }) {
  const { id, week } = await params;
  const weekNumber = parseInt(week);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: program } = await supabase.from("programs").select("id, name, trainer_id, duration_weeks").eq("id", id).single();
  if (!program) redirect("/trainer/programs");
  if (program.trainer_id !== user.id) redirect(`/trainer/programs/${id}`);

  const { data: guide } = await supabase
    .from("program_weeks")
    .select("*")
    .eq("program_id", id)
    .eq("week_number", weekNumber)
    .maybeSingle() as { data: WeekGuide | null };

  // Previous week's phase is nearly always the same one, so offer it as the default
  const { data: prev } = await supabase
    .from("program_weeks")
    .select("phase")
    .eq("program_id", id)
    .lt("week_number", weekNumber)
    .order("week_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const rows = new Map<string, ScheduleRow>((guide?.schedule ?? []).map(r => [r.day, r]));

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href={`/trainer/programs/${id}`} style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← {program.name}</Link><HomeLink role="trainer" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Week {weekNumber} Guide</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>The one-pager your client reads before the week starts.</div>
        </div>
      </div>

      <form action={saveWeekGuide} style={{ maxWidth: 640, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <input type="hidden" name="program_id" value={id} />
        <input type="hidden" name="week_number" value={weekNumber} />

        <div style={card}>
          <label style={label}>Phase</label>
          <input name="phase" defaultValue={guide?.phase ?? prev?.phase ?? ""} placeholder="Phase 1 — Build Your Base" style={input} />

          <label style={{ ...label, marginTop: 14 }}>Week Title</label>
          <input name="title" defaultValue={guide?.title ?? ""} placeholder="Build Your Routine" style={input} />

          <label style={{ ...label, marginTop: 14 }}>Focus</label>
          <input name="focus" defaultValue={guide?.focus ?? ""} placeholder="Build consistency and establish your hiking foundation" style={input} />
        </div>

        <div style={card}>
          <label style={label}>This Week at a Glance</label>
          <div style={hint}>One per line, e.g. “💪 Strength: 2 sessions”</div>
          <textarea
            name="glance"
            defaultValue={guide?.glance ?? ""}
            rows={4}
            placeholder={"💪 Strength: 2 sessions\n🚶 Walks: 2 sessions\n🥾 Long hike: 60 min\n🧘 Recovery: 2 sessions"}
            style={{ ...input, resize: "vertical" }}
          />
        </div>

        <div style={card}>
          <label style={label}>The Week</label>
          <div style={hint}>Leave a day blank to drop it from the table.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {WEEK_DAYS.map(day => (
              <div key={day} style={{ display: "grid", gridTemplateColumns: "88px 1fr 1fr", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7A8D" }}>{day}</div>
                <input name={`workout_${day}`} defaultValue={rows.get(day)?.workout ?? ""} placeholder="Workout" style={{ ...input, padding: "9px 10px" }} />
                <input name={`details_${day}`} defaultValue={rows.get(day)?.details ?? ""} placeholder="Details" style={{ ...input, padding: "9px 10px" }} />
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <label style={label}>🎯 This Week&apos;s Goal</label>
          <textarea name="goal" defaultValue={guide?.goal ?? ""} rows={2} placeholder="Complete all workouts at an easy, conversational pace." style={{ ...input, resize: "vertical" }} />

          <label style={{ ...label, marginTop: 14 }}>💡 Tip</label>
          <textarea name="tip" defaultValue={guide?.tip ?? ""} rows={2} placeholder="Wear the hiking shoes you plan to use in Peru on your Saturday walk." style={{ ...input, resize: "vertical" }} />

          <label style={{ ...label, marginTop: 14 }}>⭐ Milestone</label>
          <textarea name="milestone" defaultValue={guide?.milestone ?? ""} rows={2} placeholder="Complete a 60-minute walk without feeling exhausted." style={{ ...input, resize: "vertical" }} />
        </div>

        <button type="submit" style={{ padding: 14, borderRadius: 12, background: "#2DC4B8", color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: "pointer" }}>
          Save Week {weekNumber} Guide
        </button>

        {weekNumber < program.duration_weeks && (
          <Link href={`/trainer/programs/${id}/weeks/${weekNumber + 1}`} style={{ textAlign: "center", fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>
            Week {weekNumber + 1} guide →
          </Link>
        )}
      </form>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: 18, border: "1px solid #E2EAF0" };
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0D1827", marginBottom: 8 };
const hint: React.CSSProperties = { fontSize: 12, color: "#6B7A8D", marginTop: -4, marginBottom: 8 };
const input: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid #E2EAF0", background: "#F4F7FA", fontSize: 14, color: "#0D1827", outline: "none" };
