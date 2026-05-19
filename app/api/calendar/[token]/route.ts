import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function workoutDate(startDate: string, weekNumber: number, dayOfWeek: number): Date {
  const start = new Date(startDate + "T12:00:00Z");
  const weekOffset = (weekNumber - 1) * 7;
  const startDow = start.getUTCDay();
  const dayOffset = (dayOfWeek - startDow + 7) % 7;
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + weekOffset + dayOffset);
  return d;
}

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function toICSDateLocal(d: Date): string {
  // Format as local floating time (YYYYMMDDTHHMMSS) for use with TZID
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const VTIMEZONE_LA = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Los_Angeles",
  "BEGIN:STANDARD",
  "DTSTART:19671029T020000",
  "RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0800",
  "TZNAME:PST",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:19870405T020000",
  "RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3",
  "TZOFFSETFROM:-0800",
  "TZOFFSETTO:-0700",
  "TZNAME:PDT",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("calendar_token", token)
    .single();

  if (!profile) return new NextResponse("Not found", { status: 404 });

  const { data: cp } = await supabase
    .from("client_programs")
    .select("start_date, programs(name, duration_weeks, workouts(id, name, day_of_week, week_number, exercises(count)))")
    .eq("client_id", profile.id)
    .eq("is_active", true)
    .maybeSingle();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PDX Fitness//EN",
    "X-WR-CALNAME:PDX Fitness Workouts",
    "X-WR-TIMEZONE:America/Los_Angeles",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE_LA,
  ];

  if (cp) {
    const program = cp.programs as unknown as { name: string; duration_weeks: number; workouts: { id: string; name: string; day_of_week: number; week_number: number; exercises: { count: number }[] }[] } | null;
    if (program) {
      for (const w of program.workouts) {
        const d = workoutDate(cp.start_date, w.week_number, w.day_of_week);
        const dtStart = toICSDate(d);
        const dtEnd = toICSDate(new Date(d.getTime() + 60 * 60 * 1000));
        const exCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
        lines.push(
          "BEGIN:VEVENT",
          `UID:pdxfit-${w.id}@pdx-fitness`,
          `DTSTAMP:${toICSDate(new Date())}`,
          `DTSTART;TZID=America/Los_Angeles:${toICSDateLocal(d)}`,
          `DTEND;TZID=America/Los_Angeles:${toICSDateLocal(new Date(d.getTime() + 60 * 60 * 1000))}`,
          `SUMMARY:${w.name.replace(/[,;\\]/g, "\\$&")}`,
          `DESCRIPTION:${program.name.replace(/[,;\\]/g, "\\$&")} - ${exCount} exercise${exCount !== 1 ? "s" : ""}`,
          "END:VEVENT",
        );
      }
    }
  }

  lines.push("END:VCALENDAR");

  const body = lines.join("\r\n") + "\r\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar",
      "Content-Disposition": "attachment; filename=\"pdx-fitness.ics\"",
      "Cache-Control": "no-store, no-cache",
      "Pragma": "no-cache",
    },
  });
}
