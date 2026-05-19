import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("calendar_token")
    .eq("id", user.id)
    .single();

  if (!profile?.calendar_token) {
    // generate one
    const svc = createServiceClient();
    const { data: updated } = await svc
      .from("profiles")
      .update({ calendar_token: crypto.randomUUID() })
      .eq("id", user.id)
      .select("calendar_token")
      .single();
    return NextResponse.json({ token: updated?.calendar_token });
  }

  return NextResponse.json({ token: profile.calendar_token });
}
