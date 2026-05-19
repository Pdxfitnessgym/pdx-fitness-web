import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";

function workoutDate(startDate: string, weekNumber: number, dayOfWeek: number): string {
  const start = new Date(startDate + "T12:00:00Z");
  const weekOffset = (weekNumber - 1) * 7;
  const startDow = start.getUTCDay();
  const dayOffset = (dayOfWeek - startDow + 7) % 7;
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + weekOffset + dayOffset);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: programs } = await supabase
    .from("client_programs")
    .select("client_id, start_date, programs(name, workouts(name, day_of_week, week_number))")
    .eq("is_active", true);

  if (!programs?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  await Promise.allSettled(
    programs.map(async (cp) => {
      const program = cp.programs as unknown as { name: string; workouts: { name: string; day_of_week: number; week_number: number }[] } | null;
      if (!program) return;

      const todayWorkout = program.workouts.find(
        w => workoutDate(cp.start_date, w.week_number, w.day_of_week) === today
      );

      if (!todayWorkout) return;

      await sendPushToUser(cp.client_id, {
        title: "Workout Day 💪",
        body: `${todayWorkout.name} is on your schedule today. Let's get it!`,
        url: "/client/workouts",
      });
      sent++;
    })
  );

  return NextResponse.json({ sent });
}
