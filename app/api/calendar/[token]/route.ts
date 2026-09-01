import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function esc(s: string): string {
  return s.replace(/[,;\\]/g, "\\$&").replace(/\n/g, "\\n");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("calendar_token", token)
    .single();

  if (!profile) return new NextResponse("Not found", { status: 404 });

  // Training sessions are the client's only real appointments. Program workouts
  // deliberately have no schedule — clients pick whichever one they want each day —
  // so there is nothing dated to publish for them.
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, scheduled_at, status, notes, profiles!trainer_id(full_name)")
    .eq("client_id", profile.id)
    .not("status", "in", '("no_show","cancelled")')
    .order("scheduled_at");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PDX Fitness//EN",
    "X-WR-CALNAME:PDX Fitness Sessions",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const s of sessions ?? []) {
    const start = new Date(s.scheduled_at as string);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const trainerName = (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "Trainer";
    lines.push(
      "BEGIN:VEVENT",
      `UID:pdxfit-session-${s.id}@pdx-fitness`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${esc(`Training - ${trainerName}`)}`,
      ...(s.notes ? [`DESCRIPTION:${esc(s.notes as string)}`] : []),
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Must be inline: "attachment" makes Apple Calendar import a brand-new
      // calendar on every tap instead of refreshing the existing subscription.
      "Content-Disposition": "inline; filename=pdx-fitness.ics",
      "Cache-Control": "no-cache",
    },
  });
}
