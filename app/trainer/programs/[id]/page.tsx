import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HomeLink } from "@/app/components/HomeLink";
import { toggleProgramShared } from "@/app/actions/programs";
import { DeleteWorkoutButton } from "@/app/components/DeleteWorkoutButton";
import { ProgramDetailsEditor } from "@/app/components/ProgramDetailsEditor";
import { CopyWeek } from "@/app/components/CopyWeek";
import { hasGuideContent, type WeekGuide } from "@/lib/program-week";


export default async function ProgramDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: program } = await supabase.from("programs").select("*").eq("id", id).single();
  if (!program) redirect("/trainer/programs");

  const { data: workouts } = await supabase.from("workouts").select("*, exercises(count)").eq("program_id", id).order("week_number").order("day_of_week");

  const { data: weekGuides } = await supabase
    .from("program_weeks").select("*").eq("program_id", id) as { data: WeekGuide[] | null };
  const guidedWeeks = new Set((weekGuides ?? []).filter(hasGuideContent).map(g => g.week_number));

  const byWeek: Record<number, typeof workouts> = {};
  const weeksWithWorkouts = [...new Set((workouts ?? []).map(w => w.week_number as number))];
  for (let w = 1; w <= program.duration_weeks; w++) byWeek[w] = [];
  workouts?.forEach(wo => byWeek[wo.week_number]?.push(wo));

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/trainer/programs" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Programs</Link><HomeLink role="trainer" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4" }}>{program.name}</div>
              {program.description && <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>{program.description}</div>}
            </div>
            <div style={{ fontSize: 12, color: "#6B7A8D", textAlign: "right" }}>{program.duration_weeks} weeks</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        {sp.copied && (
          <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            ✓ Copied {sp.copied} workout{sp.copied === "1" ? "" : "s"} into the weeks you picked
          </div>
        )}
        {sp.guide && (
          <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            ✓ Week {sp.guide} guide saved
          </div>
        )}
        {sp.saved && (
          <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            ✓ Program updated
          </div>
        )}
        {sp.error === "not_yours" && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            Couldn&apos;t save — this program belongs to another trainer.
          </div>
        )}
        {sp.error === "invalid" && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            A name and a length of at least one week are required.
          </div>
        )}

        {program.trainer_id === user.id && (
          <ProgramDetailsEditor
            programId={program.id}
            name={program.name}
            description={program.description}
            durationWeeks={program.duration_weeks}
          />
        )}

        {/* Gym sharing — owner only */}
        {program.trainer_id === user.id ? (
          <div style={{ background: program.is_shared ? "#EBF9F8" : "#fff", border: `1px solid ${program.is_shared ? "#A7F3D0" : "#E2EAF0"}`, borderRadius: 14, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1827" }}>
                {program.is_shared ? "🏋️ Shared with the gym" : "Private to you"}
              </div>
              <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                {program.is_shared
                  ? "Any trainer can assign this, and members can enrol themselves."
                  : "Only you can see and assign this program."}
              </div>
            </div>
            <form action={toggleProgramShared}>
              <input type="hidden" name="program_id" value={id} />
              <input type="hidden" name="is_shared" value={program.is_shared ? "false" : "true"} />
              <button type="submit" style={{ padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", background: program.is_shared ? "#fff" : "#2DC4B8", color: program.is_shared ? "#6B7A8D" : "#fff", boxShadow: program.is_shared ? "inset 0 0 0 1px #A7F3D0" : "none" }}>
                {program.is_shared ? "Make Private" : "Share with Gym"}
              </button>
            </form>
          </div>
        ) : (
          <div style={{ background: "#EBF9F8", border: "1px solid #A7F3D0", borderRadius: 14, padding: 16, marginBottom: 20, fontSize: 13, color: "#0F766E" }}>
            🏋️ This is a shared gym program. You can assign it to your clients, but only its owner can edit it.
          </div>
        )}

        {Array.from({ length: program.duration_weeks }, (_, i) => i + 1).map(week => (
          <div key={week} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 1 }}>
                  Week {week}
                </div>
                {program.trainer_id === user.id && (
                  <Link
                    href={`/trainer/programs/${id}/weeks/${week}`}
                    style={{ fontSize: 12, fontWeight: 700, textDecoration: "none", color: guidedWeeks.has(week) ? "#0F766E" : "#6B7A8D" }}
                  >
                    {guidedWeeks.has(week) ? "📋 Guide ✓" : "📋 Add guide"}
                  </Link>
                )}
              </div>
              {program.trainer_id === user.id && (byWeek[week]?.length ?? 0) > 0 && program.duration_weeks > 1 && (
                <CopyWeek
                  programId={id}
                  fromWeek={week}
                  totalWeeks={program.duration_weeks}
                  weeksWithWorkouts={weeksWithWorkouts}
                />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {byWeek[week]?.map(wo => (
                <div key={wo.id} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                <Link href={`/trainer/programs/${id}/workouts/${wo.id}`} style={{ flex: 1, background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #E2EAF0", textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{wo.name}</div>
                    <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                      {(wo.exercises as any)?.[0]?.count ?? 0} exercises
                    </div>
                  </div>
                  <div style={{ color: "#2DC4B8", fontSize: 18 }}>→</div>
                </Link>
                {program.trainer_id === user.id && (
                  <DeleteWorkoutButton workoutId={wo.id} programId={id} name={wo.name} exerciseCount={(wo.exercises as any)?.[0]?.count ?? 0} />
                )}
                </div>
              ))}
              <Link
                href={`/trainer/programs/${id}/workouts/new?week=${week}`}
                style={{ background: "#F4F7FA", borderRadius: 12, padding: "12px 16px", border: "1.5px dashed #E2EAF0", textDecoration: "none", display: "block", textAlign: "center", fontSize: 14, color: "#6B7A8D" }}
              >
                + Add Workout
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
