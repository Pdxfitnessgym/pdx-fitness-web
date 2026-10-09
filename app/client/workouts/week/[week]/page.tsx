import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientBottomNav } from "@/app/components/ClientBottomNav";
import { WeekGuideView } from "@/app/components/WeekGuide";
import { hasGuideContent, type WeekGuide } from "@/lib/program-week";

export default async function ClientWeekGuidePage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const weekNumber = parseInt(week);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cp } = await supabase
    .from("client_programs")
    .select("start_date, programs(id, name, duration_weeks)")
    .eq("client_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const program = cp?.programs as unknown as { id: string; name: string; duration_weeks: number } | null;
  if (!program) redirect("/client/workouts");

  const { data: weeks } = await supabase
    .from("program_weeks")
    .select("*")
    .eq("program_id", program.id)
    .order("week_number") as { data: WeekGuide[] | null };

  const withContent = (weeks ?? []).filter(hasGuideContent);
  const guide = withContent.find(w => w.week_number === weekNumber);

  const idx = withContent.findIndex(w => w.week_number === weekNumber);
  const prev = idx > 0 ? withContent[idx - 1] : null;
  const next = idx >= 0 && idx < withContent.length - 1 ? withContent[idx + 1] : null;

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA", paddingBottom: 90 }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "16px 20px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Link href="/client/workouts" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Workouts</Link>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>{program.name}</div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
        {guide ? (
          <>
            <WeekGuideView guide={guide} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
              {prev ? (
                <Link href={`/client/workouts/week/${prev.week_number}`} style={pager}>← Week {prev.week_number}</Link>
              ) : <span />}
              {next && (
                <Link href={`/client/workouts/week/${next.week_number}`} style={{ ...pager, marginLeft: "auto" }}>Week {next.week_number} →</Link>
              )}
            </div>
          </>
        ) : (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 700, color: "#0D1827", marginBottom: 4 }}>No guide for week {weekNumber} yet</div>
            <div style={{ fontSize: 14, color: "#6B7A8D" }}>Your trainer hasn&apos;t written this one up yet.</div>
          </div>
        )}

        {withContent.length > 1 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>All weeks</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {withContent.map(w => (
                <Link
                  key={w.week_number}
                  href={`/client/workouts/week/${w.week_number}`}
                  style={{
                    padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, textDecoration: "none",
                    background: w.week_number === weekNumber ? "#1B68B4" : "#fff",
                    color: w.week_number === weekNumber ? "#fff" : "#6B7A8D",
                    border: "1px solid #E2EAF0",
                  }}
                >
                  {w.week_number}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      <ClientBottomNav />
    </div>
  );
}

const pager: React.CSSProperties = {
  padding: "11px 16px", borderRadius: 12, background: "#fff", border: "1px solid #E2EAF0",
  fontSize: 14, fontWeight: 700, color: "#1B68B4", textDecoration: "none",
};
