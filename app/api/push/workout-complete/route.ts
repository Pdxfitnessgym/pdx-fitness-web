import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workoutId } = await req.json();

  const [{ data: profile }, { data: workout }] = await Promise.all([
    supabase.from("profiles").select("full_name, trainer_id").eq("id", user.id).single(),
    supabase.from("workouts").select("name").eq("id", workoutId).single(),
  ]);

  if (profile?.trainer_id) {
    await sendPushToUser(profile.trainer_id, {
      title: "Workout Completed 💪",
      body: `${profile.full_name ?? "Your client"} just finished ${workout?.name ?? "a workout"}`,
      url: `/trainer/clients/${user.id}`,
    });
  }

  return NextResponse.json({ ok: true });
}
