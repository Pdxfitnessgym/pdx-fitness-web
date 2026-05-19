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

  const { session_id, action } = await req.json();

  const service = createServiceClient();

  const { data: session } = await service
    .from("training_sessions")
    .select("client_id, trainer_id, scheduled_at, availability_id")
    .eq("id", session_id)
    .eq("trainer_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

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

  if (action === "confirm") {
    await service
      .from("training_sessions")
      .update({ status: "scheduled" })
      .eq("id", session_id);

    await sendPushToUser(session.client_id, {
      title: "Session Confirmed! 🎉",
      body: `Your session is confirmed for ${dateStr} at ${timeStr}.`,
      url: "/client/calendar",
    });
  } else if (action === "decline") {
    await service
      .from("training_sessions")
      .update({ status: "cancelled" })
      .eq("id", session_id);

    if (session.availability_id) {
      await service
        .from("trainer_availability")
        .update({ is_booked: false })
        .eq("id", session.availability_id);
    }

    await sendPushToUser(session.client_id, {
      title: "Session Request Declined",
      body: "Your trainer couldn't confirm that slot. Try another time.",
      url: "/client/book",
    });
  }

  return NextResponse.json({ ok: true });
}
