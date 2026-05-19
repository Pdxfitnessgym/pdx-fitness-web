import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUser } from "@/lib/push";

const QUOTES = [
  "The only bad workout is the one that didn't happen.",
  "Push yourself, because no one else is going to do it for you.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Success starts with self-discipline.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Don't stop when you're tired. Stop when you're done.",
  "Believe in yourself and all that you are.",
  "Small steps every day lead to big results.",
  "You didn't come this far to only come this far.",
  "Every rep brings you closer to who you want to be.",
  "Consistency is what transforms average into excellence.",
  "Your future self is watching. Make them proud.",
];

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  // get all users with push subscriptions
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id");

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const userIds = [...new Set(subs.map(s => s.user_id))];

  let sent = 0;
  await Promise.allSettled(
    userIds.map(async (userId) => {
      // get their active goals
      const { data: goals } = await supabase
        .from("goals")
        .select("title, type, target_value, exercise_name, completed")
        .eq("client_id", userId)
        .eq("completed", false)
        .limit(1);

      // get their top PR
      const { data: topPR } = await supabase
        .from("set_logs")
        .select("weight_lbs, exercises(name)")
        .eq("client_id", userId)
        .not("weight_lbs", "is", null)
        .order("weight_lbs", { ascending: false })
        .limit(1)
        .maybeSingle();

      let body = quote;

      if (goals?.length) {
        const g = goals[0];
        const goalLine = g.type === "strength"
          ? `Goal: ${g.exercise_name} → ${g.target_value} lbs`
          : g.type === "weight"
          ? `Goal: Reach ${g.target_value} lbs`
          : g.type === "body_fat"
          ? `Goal: Reach ${g.target_value}% body fat`
          : `Goal: ${g.title}`;
        body = `${goalLine}\n\n"${quote}"`;
      } else if (topPR) {
        const exName = (topPR.exercises as unknown as { name: string } | null)?.name;
        if (exName) body = `PR: ${exName} — ${topPR.weight_lbs} lbs 🏆\n\n"${quote}"`;
      }

      await sendPushToUser(userId, {
        title: "Weekly Check-In 💪",
        body,
        url: "/client/progress",
      });
      sent++;
    })
  );

  return NextResponse.json({ sent });
}
