import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trainerId } = await req.json();
  if (!trainerId) return NextResponse.json({ ok: true });

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const clientName = profile?.full_name ?? "A client";

  await sendPushToUser(trainerId, {
    title: "New Weekly Check-in 📋",
    body: `${clientName} submitted their weekly check-in.`,
    url: "/trainer/checkins",
  });

  return NextResponse.json({ ok: true });
}
