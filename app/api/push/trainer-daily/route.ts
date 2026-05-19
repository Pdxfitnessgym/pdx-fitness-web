import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("trainer_id, scheduled_at, profiles!client_id(full_name)")
    .eq("status", "scheduled")
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString())
    .order("scheduled_at");

  if (!sessions?.length) return NextResponse.json({ sent: 0 });

  // group by trainer
  const byTrainer: Record<string, { name: string; time: string }[]> = {};
  for (const s of sessions) {
    const clientName = (s.profiles as unknown as { full_name: string } | null)?.full_name ?? "Client";
    const time = new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (!byTrainer[s.trainer_id]) byTrainer[s.trainer_id] = [];
    byTrainer[s.trainer_id].push({ name: clientName, time });
  }

  let sent = 0;
  await Promise.allSettled(
    Object.entries(byTrainer).map(async ([trainerId, clientSessions]) => {
      const count = clientSessions.length;
      const preview = clientSessions.slice(0, 2).map(s => `${s.name} @ ${s.time}`).join(", ");
      const body = count === 1
        ? `${preview} today`
        : `${count} sessions today — ${preview}${count > 2 ? "…" : ""}`;

      await sendPushToUser(trainerId, {
        title: "Today's Sessions 📋",
        body,
        url: "/trainer/calendar",
      });
      sent++;
    })
  );

  return NextResponse.json({ sent });
}
