"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/push";

async function requireTrainerOf(clientId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: client } = await supabase
    .from("profiles").select("id, trainer_id").eq("id", clientId).single();
  if (!client || client.trainer_id !== user.id) redirect("/trainer/clients");
  return supabase;
}

export async function addGoalForClient(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const supabase = await requireTrainerOf(clientId);

  const type = (formData.get("type") as string) || "custom";
  const title = (formData.get("title") as string)?.trim();
  const targetRaw = (formData.get("target_value") as string)?.trim();
  const exerciseName = (formData.get("exercise_name") as string)?.trim() || null;
  const targetDate = (formData.get("target_date") as string) || null;

  if (!title) redirect(`/trainer/clients/${clientId}?tab=goals&error=no_title`);

  const { error } = await supabase.from("goals").insert({
    client_id: clientId,
    type,
    title,
    target_value: targetRaw ? Number(targetRaw) : null,
    exercise_name: type === "strength" ? exerciseName : null,
    target_date: targetDate || null,
    completed: false,
  });
  if (error) redirect(`/trainer/clients/${clientId}?tab=goals&error=save_failed`);

  sendPushToUser(clientId, {
    title: "New Goal 🎯",
    body: title,
    url: "/client/progress?tab=goals",
  }).catch(() => {});

  revalidatePath(`/trainer/clients/${clientId}`);
  redirect(`/trainer/clients/${clientId}?tab=goals&added=1`);
}

export async function deleteGoalForClient(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const supabase = await requireTrainerOf(clientId);
  await supabase.from("goals").delete().eq("id", formData.get("goal_id") as string);
  revalidatePath(`/trainer/clients/${clientId}`);
  redirect(`/trainer/clients/${clientId}?tab=goals`);
}

export async function toggleGoalComplete(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const supabase = await requireTrainerOf(clientId);
  await supabase
    .from("goals")
    .update({ completed: formData.get("completed") === "true" })
    .eq("id", formData.get("goal_id") as string);
  revalidatePath(`/trainer/clients/${clientId}`);
  redirect(`/trainer/clients/${clientId}?tab=goals`);
}

export async function addHabitForClient(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const supabase = await requireTrainerOf(clientId);

  const name = (formData.get("name") as string)?.trim();
  const emoji = (formData.get("emoji") as string)?.trim() || "✅";
  if (!name) redirect(`/trainer/clients/${clientId}?tab=habits&error=no_name`);

  const { error } = await supabase.from("habits").insert({
    client_id: clientId,
    name,
    emoji,
    is_active: true,
  });
  if (error) redirect(`/trainer/clients/${clientId}?tab=habits&error=save_failed`);

  sendPushToUser(clientId, {
    title: "New Habit ✅",
    body: `${emoji} ${name}`,
    url: "/client/habits",
  }).catch(() => {});

  revalidatePath(`/trainer/clients/${clientId}`);
  redirect(`/trainer/clients/${clientId}?tab=habits&added=1`);
}

export async function removeHabitForClient(formData: FormData) {
  const clientId = formData.get("client_id") as string;
  const supabase = await requireTrainerOf(clientId);
  // Deactivate rather than delete so the client's logged history survives
  await supabase
    .from("habits")
    .update({ is_active: false })
    .eq("id", formData.get("habit_id") as string);
  revalidatePath(`/trainer/clients/${clientId}`);
  redirect(`/trainer/clients/${clientId}?tab=habits`);
}
