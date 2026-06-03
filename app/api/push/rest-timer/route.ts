import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST  { delaySeconds, title, body } → schedules a push, returns { id }
// DELETE { id }                        → cancels it
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { delaySeconds, title, body } = await req.json();
  if (!delaySeconds || delaySeconds < 1) return NextResponse.json({ error: "Invalid delay" }, { status: 400 });

  const fireAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from("scheduled_push")
    .insert({ user_id: user.id, fire_at: fireAt, title, body })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await supabase.from("scheduled_push").update({ cancelled: true }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
