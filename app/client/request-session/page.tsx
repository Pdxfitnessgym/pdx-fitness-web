import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Clients don't book their own slots — the dashboard's "Request Session" card
// lands here, which drops them straight into the chat with their trainer
// rather than the booking calendar.
export default async function RequestSessionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("trainer_id").eq("id", user.id).single();

  // No trainer yet — the messages list explains what to do
  if (!profile?.trainer_id) redirect("/client/messages");
  const trainerId = profile.trainer_id as string;

  const { data: mine } = await supabase
    .from("conversation_members").select("conversation_id").eq("user_id", user.id);
  const myIds = (mine ?? []).map(m => m.conversation_id);

  // Reuse the existing one-to-one chat so they don't pile up duplicates
  if (myIds.length) {
    const [{ data: oneToOnes }, { data: trainerIn }] = await Promise.all([
      supabase.from("conversations").select("id").in("id", myIds).eq("is_group", false),
      supabase.from("conversation_members").select("conversation_id")
        .eq("user_id", trainerId).in("conversation_id", myIds),
    ]);
    const solo = new Set((oneToOnes ?? []).map(c => c.id));
    const existing = (trainerIn ?? []).find(t => solo.has(t.conversation_id));
    if (existing) redirect(`/client/messages/${existing.conversation_id}`);
  }

  const { data: convo } = await supabase
    .from("conversations")
    .insert({ is_group: false, name: null, created_by: user.id })
    .select("id").single();
  if (!convo) redirect("/client/messages");

  await supabase.from("conversation_members").insert([
    { conversation_id: convo.id, user_id: user.id },
    { conversation_id: convo.id, user_id: trainerId },
  ]);

  redirect(`/client/messages/${convo.id}`);
}
