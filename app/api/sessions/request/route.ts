import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { session_id } = await req.json();

  const service = createServiceClient();

  const { data: session } = await service
    .from("training_sessions")
    .select("trainer_id, scheduled_at, client_id, profiles!client_id(full_name)")
    .eq("id", session_id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const clientName =
    (session.profiles as unknown as { full_name: string } | null)?.full_name || "A client";

  const scheduledAt = new Date(session.scheduled_at);
  const dateStr = scheduledAt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = scheduledAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  await sendPushToUser(session.trainer_id, {
    title: "New Session Request 📅",
    body: `${clientName} wants to book ${dateStr} at ${timeStr}`,
    url: "/trainer/calendar",
  });

  return NextResponse.json({ ok: true });
}
