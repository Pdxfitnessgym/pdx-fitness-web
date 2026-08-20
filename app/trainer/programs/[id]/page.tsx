import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";


export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: program } = await supabase.from("programs").select("*").eq("id", id).eq("trainer_id", user.id).single();
  if (!program) redirect("/trainer/programs");

  const { data: workouts } = await supabase.from("workouts").select("*, exercises(count)").eq("program_id", id).order("week_number").order("day_of_week");

  const byWeek: Record<number, typeof workouts> = {};
  for (let w = 1; w <= program.duration_weeks; w++) byWeek[w] = [];
  workouts?.forEach(wo => byWeek[wo.week_number]?.push(wo));

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/trainer/programs" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Programs</Link>
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
        {Array.from({ length: program.duration_weeks }, (_, i) => i + 1).map(week => (
          <div key={week} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6B7A8D", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              Week {week}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {byWeek[week]?.map(wo => (
                <Link key={wo.id} href={`/trainer/programs/${id}/workouts/${wo.id}`} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #E2EAF0", textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1827" }}>{wo.name}</div>
                    <div style={{ fontSize: 12, color: "#6B7A8D", marginTop: 2 }}>
                      {(wo.exercises as any)?.[0]?.count ?? 0} exercises
                    </div>
                  </div>
                  <div style={{ color: "#2DC4B8", fontSize: 18 }}>→</div>
                </Link>
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
