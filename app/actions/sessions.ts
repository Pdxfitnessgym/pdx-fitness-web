"use server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendPushToUser } from "@/lib/push";

export async function updateSessionsPurchased(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const client_id = formData.get("client_id") as string;
  const sessions_purchased = parseInt(formData.get("sessions_purchased") as string);

  const svc = createServiceClient();
  await svc.from("profiles").update({ sessions_purchased }).eq("id", client_id);

  revalidatePath(`/trainer/clients/${client_id}`);
}

export async function scheduleSession(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const client_id = formData.get("client_id") as string;
  const scheduled_at = formData.get("scheduled_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  await supabase.from("training_sessions").insert({
    client_id,
    trainer_id: user.id,
    scheduled_at,
    status: "scheduled",
    notes,
  });

  // notify client
  sendPushToUser(client_id, {
    title: "Session Scheduled 📅",
    body: `A training session has been booked for ${new Date(scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
    url: "/client",
  }).catch(() => {});

  revalidatePath(`/trainer/clients/${client_id}`);
}

export async function updateSessionStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session_id = formData.get("session_id") as string;
  const client_id = formData.get("client_id") as string;
  const status = formData.get("status") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

  await supabase.from("training_sessions")
    .update({ status, notes })
    .eq("id", session_id)
    .eq("trainer_id", user.id);

  // check if sessions running low after marking complete
  if (status === "completed") {
    const svc = createServiceClient();
    const [{ data: profile }, { count: completedCount }] = await Promise.all([
      svc.from("profiles").select("sessions_purchased, full_name").eq("id", client_id).single(),
      svc.from("training_sessions").select("*", { count: "exact", head: true })
        .eq("client_id", client_id)
        .eq("trainer_id", user.id)
        .eq("status", "completed"),
    ]);

    const remaining = (profile?.sessions_purchased ?? 0) - (completedCount ?? 0);
    if (remaining === 2) {
      sendPushToUser(user.id, {
        title: "Sessions Running Low ⚠️",
        body: `${profile?.full_name ?? "A client"} has only 2 sessions remaining`,
        url: `/trainer/clients/${client_id}`,
      }).catch(() => {});
    }
  }

  revalidatePath(`/trainer/clients/${client_id}`);
}
