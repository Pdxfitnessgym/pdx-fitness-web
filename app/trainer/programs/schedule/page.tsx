import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HomeLink } from "@/app/components/HomeLink";
import { gymToday } from "@/lib/time";
import { currentProgramWeek } from "@/lib/program-week";

type Row = {
  clientId: string;
  client: string;
  program: string;
  programId: string;
  weeks: number;
  start: string;
  end: string;
  week: number;
  daysLeft: number;
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function pretty(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC", month: "short", day: "numeric",
    year: date.slice(0, 4) === String(new Date().getUTCFullYear()) ? undefined : "numeric",
  });
}

export default async function ProgramSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("client_programs")
    .select("client_id, start_date, programs(id, name, duration_weeks), profiles!client_id(full_name)")
    .eq("is_active", true);

  const today = gymToday();

  const rows: Row[] = ((data ?? []) as unknown as {
    client_id: string; start_date: string;
    programs: { id: string; name: string; duration_weeks: number } | null;
    profiles: { full_name: string } | null;
  }[])
    .filter(r => r.programs && r.start_date)
    .map(r => {
      const weeks = r.programs!.duration_weeks;
      const end = addDays(r.start_date, weeks * 7 - 1);
      return {
        clientId: r.client_id,
        client: r.profiles?.full_name ?? "Client",
        program: r.programs!.name.trim(),
        programId: r.programs!.id,
        weeks,
        start: r.start_date,
        end,
        week: currentProgramWeek(r.start_date, weeks, today),
        daysLeft: daysBetween(today, end),
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const notStarted = rows.filter(r => daysBetween(today, r.start) > 0);
  const running = rows.filter(r => daysBetween(today, r.start) <= 0);

  const overdue = running.filter(r => r.daysLeft < 0);
  const endingSoon = running.filter(r => r.daysLeft >= 0 && r.daysLeft <= 14);
  const onTrack = running.filter(r => r.daysLeft > 14);

  return (
    <div style={{ minHeight: "100dvh", background: "#F4F7FA" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2EAF0", padding: "20px 20px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/trainer/programs" style={{ fontSize: 13, color: "#6B7A8D", textDecoration: "none" }}>← Programs</Link>
            <HomeLink role="trainer" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1B68B4", marginTop: 4 }}>Schedule</div>
          <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>
            Who&apos;s on what, and when it runs out.
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 22 }}>
        {rows.length === 0 && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E2EAF0", padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗓️</div>
            <div style={{ fontWeight: 700, color: "#0D1827" }}>No active programs</div>
          </div>
        )}

        <Section title="Needs attention" rows={overdue} tone="#DC2626" bg="#FEE2E2" border="#FCA5A5"
          blurb="Past its end date and still assigned." />
        <Section title="Ending soon" rows={endingSoon} tone="#B45309" bg="#FFFBEB" border="#FDE68A"
          blurb="Within the next two weeks — time to plan what's next." />
        <Section title="On track" rows={onTrack} tone="#0F766E" bg="#fff" border="#E2EAF0" />
        <Section title="Starts later" rows={notStarted} tone="#1B68B4" bg="#fff" border="#E2EAF0" />
      </div>
    </div>
  );
}

function Section({ title, rows, tone, bg, border, blurb }: {
  title: string; rows: Row[]; tone: string; bg: string; border: string; blurb?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7A8D", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: tone }}>{rows.length}</div>
      </div>
      {blurb && <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>{blurb}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(r => {
          const pct = Math.min(100, Math.max(0, ((r.week - 1) / r.weeks) * 100));
          const notYet = r.week === 1 && r.daysLeft === r.weeks * 7 - 1;
          return (
            <Link
              key={`${r.clientId}-${r.programId}`}
              href={`/trainer/clients/${r.clientId}`}
              style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "13px 15px", textDecoration: "none", display: "block" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1827" }}>{r.client}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: tone, whiteSpace: "nowrap" }}>
                  {r.daysLeft < 0
                    ? `${Math.abs(r.daysLeft)}d over`
                    : notYet ? `starts ${pretty(r.start)}` : `${r.daysLeft}d left`}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#6B7A8D", marginTop: 2 }}>{r.program}</div>

              <div style={{ background: "#E2EAF0", borderRadius: 4, height: 6, marginTop: 9, overflow: "hidden" }}>
                <div style={{ background: tone, height: 6, width: `${pct}%` }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11, color: "#9CA3AF" }}>
                <span>{pretty(r.start)}</span>
                <span style={{ fontWeight: 700, color: "#6B7A8D" }}>Week {r.week} of {r.weeks}</span>
                <span>{pretty(r.end)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
