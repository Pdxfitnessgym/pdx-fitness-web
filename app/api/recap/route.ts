import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { findPersonalRecords, totalVolumeLbs } from "@/lib/workout-utils";
import { GYM_TZ } from "@/lib/time";

// Drafts a monthly recap for one client. The trainer reads, edits and sends it
// — nothing is delivered from here.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await req.json().catch(() => ({}));
  if (!client_id) return NextResponse.json({ error: "Missing client" }, { status: 400 });

  const { data: client } = await supabase
    .from("profiles").select("full_name").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: logs } = await supabase
    .from("workout_logs")
    .select("id, completed_at, rpe, workouts(name)")
    .eq("client_id", client_id)
    .not("completed_at", "is", null)
    .gte("completed_at", since.toISOString())
    .order("completed_at");

  const sessions = logs ?? [];
  if (sessions.length === 0) {
    return NextResponse.json({
      stats: { sessions: 0 },
      draft: `${client.full_name?.split(" ")[0] ?? "They"} hasn't logged a workout in the last 30 days — probably worth a message before a recap.`,
    });
  }

  const { data: sets } = await supabase
    .from("set_logs")
    .select("workout_log_id, exercise_id, reps_completed, weight_lbs, exercises(name)")
    .in("workout_log_id", sessions.map(s => s.id));

  const all = sets ?? [];
  const volume = totalVolumeLbs(all.map(s => ({ reps: s.reps_completed, weight: s.weight_lbs })));

  // PRs across the window, against everything logged before it
  const { data: older } = await supabase
    .from("set_logs")
    .select("exercise_id, reps_completed, weight_lbs")
    .eq("client_id", client_id)
    .not("weight_lbs", "is", null)
    .lt("created_at", since.toISOString());

  const records = findPersonalRecords(
    all.map(s => ({
      exerciseId: s.exercise_id,
      exerciseName: (s.exercises as unknown as { name: string } | null)?.name ?? "Exercise",
      reps: s.reps_completed,
      weight: s.weight_lbs,
    })),
    older ?? [],
  );

  const rated = sessions.filter(s => s.rpe != null);
  const avgRpe = rated.length
    ? Math.round((rated.reduce((a, s) => a + (s.rpe as number), 0) / rated.length) * 10) / 10
    : null;

  const names = [...new Set(sessions.map(s => (s.workouts as unknown as { name: string } | null)?.name).filter(Boolean))];
  const stats = {
    sessions: sessions.length,
    sets: all.length,
    volume,
    prs: records.length,
    topPrs: records.slice(0, 3).map(p => `${p.exerciseName} ${p.weight}lb × ${p.reps} (up ${p.weight - p.previousWeight}lb)`),
    avgRpe,
    workouts: names,
    first: sessions[0].completed_at,
    last: sessions[sessions.length - 1].completed_at,
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ stats, draft: "", error: "AI drafting isn't configured — the numbers above are still accurate." });
  }

  const ai = new Anthropic();
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: GYM_TZ, month: "short", day: "numeric" });

  try {
    const res = await ai.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      system:
        "You draft short monthly progress notes that a personal trainer will read, edit and send to their client. " +
        "Write as the trainer, to the client, by first name. Warm and specific, never gushing. " +
        "Three short paragraphs at most, under 150 words. Use the numbers given and invent nothing. " +
        "If the numbers are modest, say something honest and encouraging rather than inflating them. " +
        "End with one concrete thing to aim at next month. No sign-off, no subject line.",
      messages: [{
        role: "user",
        content:
          `Client: ${client.full_name}\n` +
          `Window: ${fmt(stats.first as string)} to ${fmt(stats.last as string)}\n` +
          `Sessions completed: ${stats.sessions}\n` +
          `Sets logged: ${stats.sets}\n` +
          `Total weight moved: ${stats.volume.toLocaleString()} lbs\n` +
          `Personal bests: ${stats.prs}${stats.topPrs.length ? ` — ${stats.topPrs.join("; ")}` : ""}\n` +
          (stats.avgRpe ? `Average effort rating: ${stats.avgRpe}/10\n` : "") +
          `Workouts trained: ${stats.workouts.join(", ")}`,
      }],
    });

    const draft = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text).join("").trim();

    return NextResponse.json({ stats, draft });
  } catch (err) {
    // Surface what actually went wrong — a silent "couldn't draft" is
    // impossible to act on.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      stats,
      draft: "",
      error: `Couldn't draft the note: ${detail.slice(0, 300)}`,
    });
  }
}
