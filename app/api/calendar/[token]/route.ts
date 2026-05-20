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

function toICSDateOnly(d: Date): string {
  // Format UTC date as YYYYMMDD for all-day events
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

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
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  if (cp) {
    const program = cp.programs as unknown as { name: string; duration_weeks: number; workouts: { id: string; name: string; day_of_week: number; week_number: number; exercises: { count: number }[] }[] } | null;
    if (program) {
      for (const w of program.workouts) {
        const d = workoutDate(cp.start_date, w.week_number, w.day_of_week);
        // Next day for exclusive DTEND on all-day events
        const dNext = new Date(d);
        dNext.setUTCDate(dNext.getUTCDate() + 1);
        const exCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
        lines.push(
          "BEGIN:VEVENT",
          `UID:pdxfit-${w.id}@pdx-fitness`,
          `DTSTAMP:${toICSDate(new Date())}`,
          `DTSTART;VALUE=DATE:${toICSDateOnly(d)}`,
          `DTEND;VALUE=DATE:${toICSDateOnly(dNext)}`,
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
