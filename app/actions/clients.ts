"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/push";

export async function addClientByEmail(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = (formData.get("email") as string).trim().toLowerCase();

  const { data: clientProfile, error } = await supabase
    .from("profiles")
    .select("id, trainer_id, role")
    .eq("email", email)
    .single();

  if (error || !clientProfile) {
    redirect("/trainer/clients?error=not_found");
  }
  if (clientProfile.role !== "client") {
    redirect("/trainer/clients?error=not_client");
  }
  if (clientProfile.trainer_id) {
    redirect("/trainer/clients?error=has_trainer");
  }

  await supabase.from("profiles").update({ trainer_id: user.id }).eq("id", clientProfile.id);
  redirect("/trainer/clients?success=1");
}

export async function assignProgram(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const client_id = formData.get("client_id") as string;
  const program_id = formData.get("program_id") as string;
  const start_date = formData.get("start_date") as string;

  // deactivate existing
  await supabase.from("client_programs").update({ is_active: false }).eq("client_id", client_id).eq("is_active", true);

  await supabase.from("client_programs").insert({
    client_id,
    program_id,
    start_date,
    is_active: true,
  });

  const { data: program } = await supabase.from("programs").select("name").eq("id", program_id).single();
  sendPushToUser(client_id, {
    title: "New Program Assigned 🏋️",
    body: `Your trainer assigned you "${program?.name ?? "a new program"}"`,
    url: "/client/workouts",
  }).catch(() => {});

  revalidatePath(`/trainer/clients/${client_id}`);
  redirect(`/trainer/clients/${client_id}?assigned=1`);
}

export async function logSet(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workout_id = formData.get("workout_id") as string;
  const exercise_id = formData.get("exercise_id") as string;
  const set_number = parseInt(formData.get("set_number") as string);
  const reps_completed = formData.get("reps_completed") ? parseInt(formData.get("reps_completed") as string) : null;
  const weight_lbs = formData.get("weight_lbs") ? parseFloat(formData.get("weight_lbs") as string) : null;
  const notes = formData.get("notes") as string || null;

  // get or create today's workout_log
  const today = new Date().toISOString().split("T")[0];
  let { data: log } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("client_id", user.id)
    .eq("workout_id", workout_id)
    .gte("created_at", today)
    .maybeSingle();

  if (!log) {
    const { data: newLog } = await supabase.from("workout_logs").insert({
      client_id: user.id,
      workout_id,
      completed_at: new Date().toISOString(),
    }).select("id").single();
    log = newLog;
  }

  if (!log) return;

  // upsert the set
  await supabase.from("set_logs").upsert({
    client_id: user.id,
    workout_log_id: log.id,
    exercise_id,
    set_number,
    reps_completed,
    weight_lbs,
    notes,
  }, { onConflict: "workout_log_id,exercise_id,set_number" });

  revalidatePath(`/client/workouts/${workout_id}`);
}

export async function completeWorkout(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workout_id = formData.get("workout_id") as string;
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("workout_logs")
    .select("id")
    .eq("client_id", user.id)
    .eq("workout_id", workout_id)
    .gte("created_at", today)
    .maybeSingle();

  if (!existing) {
    await supabase.from("workout_logs").insert({
      client_id: user.id,
      workout_id,
      completed_at: new Date().toISOString(),
    });
  } else {
    await supabase.from("workout_logs").update({ completed_at: new Date().toISOString() }).eq("id", existing.id);
  }

  redirect("/client?completed=1");
}
