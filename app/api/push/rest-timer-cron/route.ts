import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: due } = await supabase
    .from("scheduled_push")
    .select("id, user_id, title, body")
    .eq("cancelled", false)
    .lte("fire_at", now);

  if (!due?.length) return NextResponse.json({ sent: 0 });

  await Promise.allSettled(
    due.map(row =>
      sendPushToUser(row.user_id, { title: row.title, body: row.body })
    )
  );

  await supabase.from("scheduled_push").delete().in("id", due.map(r => r.id));

  return NextResponse.json({ sent: due.length });
}
