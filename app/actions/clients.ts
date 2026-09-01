"use server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendPushToUser } from "@/lib/push";

export async function assignClientToMe(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clientId = formData.get("client_id") as string;
  const svc = createServiceClient();
  await svc.from("profiles").update({ trainer_id: user.id }).eq("id", clientId);
  revalidatePath("/trainer/clients");
  redirect("/trainer/clients?success=1");
}

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

  const svc = createServiceClient();
  await svc.from("profiles").update({ trainer_id: user.id }).eq("id", clientProfile.id);
  redirect("/trainer/clients?success=1");
}

// Creates a client the trainer can build programs for before the client has access.
// admin.createUser() never sends email (unlike inviteUserByEmail), and the address
// uses the reserved .invalid TLD so nothing can be delivered to it by accident.
export async function createPlaceholderClient(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = (formData.get("full_name") as string).trim();
  if (!fullName) redirect("/trainer/clients?error=no_name");

  const svc = createServiceClient();
  const placeholderEmail = `placeholder-${crypto.randomUUID()}@placeholder.invalid`;

  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email: placeholderEmail,
    email_confirm: true,
    password: crypto.randomUUID() + crypto.randomUUID(),
    user_metadata: { full_name: fullName, role: "client" },
  });
  if (createErr || !created?.user) redirect("/trainer/clients?error=create_failed");

  // The on_auth_user_created trigger already inserted the profile row, so upsert
  // to fill in the trainer link and placeholder flag it doesn't know about.
  const { error: profileErr } = await svc.from("profiles").upsert({
    id: created.user.id,
    email: placeholderEmail,
    full_name: fullName,
    role: "client",
    trainer_id: user.id,
    is_placeholder: true,
    is_approved: true,
  }, { onConflict: "id" });
  if (profileErr) {
    // Don't leave an orphaned auth user behind if the profile insert fails
    await svc.auth.admin.deleteUser(created.user.id);
    redirect("/trainer/clients?error=create_failed");
  }

  revalidatePath("/trainer/clients");
  redirect(`/trainer/clients/${created.user.id}`);
}

// Swaps the placeholder address for the client's real one and emails them an
// invite link. This is the first moment the client hears from the app.
export async function inviteClient(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clientId = formData.get("client_id") as string;
  const email = (formData.get("email") as string).trim().toLowerCase();

  const svc = createServiceClient();
  const { data: client } = await svc
    .from("profiles")
    .select("id, trainer_id, is_placeholder")
    .eq("id", clientId)
    .single();

  if (!client || client.trainer_id !== user.id || !client.is_placeholder) {
    redirect(`/trainer/clients/${clientId}?error=not_invitable`);
  }

  // Refuse if that address is already attached to another account
  const { data: taken } = await svc.from("profiles").select("id").eq("email", email).maybeSingle();
  if (taken && taken.id !== clientId) {
    redirect(`/trainer/clients/${clientId}?error=email_taken`);
  }

  const { error: updateErr } = await svc.auth.admin.updateUserById(clientId, {
    email,
    email_confirm: true,
  });
  if (updateErr) redirect(`/trainer/clients/${clientId}?error=invite_failed`);

  await svc.from("profiles").update({ email, is_placeholder: false }).eq("id", clientId);

  // Password-recovery link doubles as "set your password" for a first-time login
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pdx-fitness-web.vercel.app";
  const { error: linkErr } = await svc.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?type=recovery`,
  });

  revalidatePath(`/trainer/clients/${clientId}`);
  redirect(`/trainer/clients/${clientId}?invited=${linkErr ? "nomail" : "1"}`);
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

// Give a client a single on-demand workout without assigning a whole program.
export async function assignWorkoutToClient(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const client_id = formData.get("client_id") as string;
  const workout_id = formData.get("workout_id") as string;
  if (!workout_id) redirect(`/trainer/clients/${client_id}`);

  const { data: existing } = await supabase
    .from("client_workout_assignments")
    .select("id")
    .eq("client_id", client_id)
    .eq("workout_id", workout_id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("client_workout_assignments")
      .insert({ client_id, workout_id, assigned_by: user.id });
    if (error) redirect(`/trainer/clients/${client_id}?error=assign_failed`);

    sendPushToUser(client_id, {
      title: "New Workout 💪",
      body: "Your trainer added a workout for you.",
      url: "/client/workouts",
    }).catch(() => {});
  }

  revalidatePath(`/trainer/clients/${client_id}`);
  redirect(`/trainer/clients/${client_id}?workout_assigned=1`);
}

export async function unassignWorkoutFromClient(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const client_id = formData.get("client_id") as string;
  const workout_id = formData.get("workout_id") as string;

  await supabase
    .from("client_workout_assignments")
    .delete()
    .eq("client_id", client_id)
    .eq("workout_id", workout_id);

  revalidatePath(`/trainer/clients/${client_id}`);
  redirect(`/trainer/clients/${client_id}`);
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
