"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// A workout a client builds for themselves. created_by marks it as theirs, and
// is_private keeps it out of the gym library — only they ever see it.
export async function createOwnWorkout(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  if (!name) redirect("/client/workouts/browse");

  const { data: profile } = await supabase
    .from("profiles").select("trainer_id").eq("id", user.id).single();

  const { data: workout, error } = await supabase
    .from("workouts")
    .insert({
      name,
      created_by: user.id,
      trainer_id: profile?.trainer_id ?? null,
      program_id: null,
      is_standalone: true,
      is_private: true,
      day_of_week: 0,
      week_number: 0,
    })
    .select("id")
    .single();

  if (error || !workout) redirect("/client/workouts/browse?error=create_failed");

  // Assign to themselves so it appears alongside their other workouts
  await supabase
    .from("client_workout_assignments")
    .insert({ client_id: user.id, workout_id: workout.id, assigned_by: user.id });

  revalidatePath("/client/workouts");
  redirect(`/client/workouts/${workout.id}`);
}

// Pull one of the gym's shared workouts onto their own list.
export async function addOwnWorkout(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workout_id = formData.get("workout_id") as string;

  const { data: existing } = await supabase
    .from("client_workout_assignments")
    .select("id").eq("client_id", user.id).eq("workout_id", workout_id).maybeSingle();

  if (!existing) {
    await supabase
      .from("client_workout_assignments")
      .insert({ client_id: user.id, workout_id, assigned_by: user.id });
  }

  revalidatePath("/client/workouts");
  redirect("/client/workouts/browse?added=1");
}
