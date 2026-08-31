import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("calendar_token", token)
    .eq("role", "trainer")
    .single();

  if (!profile) return new NextResponse("Not found", { status: 404 });

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, scheduled_at, status, notes, profiles!client_id(full_name)")
    .eq("trainer_id", profile.id)
    // Cancelled and no-show sessions shouldn't sit on the calendar as if they're on
    .not("status", "in", '("no_show","cancelled")')
    .order("scheduled_at");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PDX Fitness//Trainer//EN",
    `X-WR-CALNAME:PDX Fitness - ${profile.full_name ?? "Trainer"} Sessions`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // Tell subscribers how often to re-poll, so the feed updates on its own
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];

  for (const s of sessions ?? []) {
    const start = new Date(s.scheduled_at);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const clientName = (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "Client";
    const summary = `Session - ${clientName}`;
    const desc = s.notes ? s.notes.replace(/\n/g, "\\n") : "";

    lines.push(
      "BEGIN:VEVENT",
      `UID:pdxfit-session-${s.id}@pdx-fitness`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${summary}`,
      ...(desc ? [`DESCRIPTION:${desc}`] : []),
      // A booked session is a real commitment — TENTATIVE renders it as unconfirmed
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=pdx-fitness-sessions.ics",
      "Cache-Control": "no-cache",
    },
  });
}
