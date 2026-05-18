"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function createProgram(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const duration_weeks = parseInt(formData.get("duration_weeks") as string);

  const { data, error } = await supabase.from("programs").insert({
    trainer_id: user.id,
    name,
    description: description || null,
    duration_weeks,
  }).select().single();

  if (error) throw new Error(error.message);
  redirect(`/trainer/programs/${data.id}`);
}

export async function createWorkout(formData: FormData) {
  const supabase = await createClient();
  const program_id = formData.get("program_id") as string;
  const name = formData.get("name") as string;
  const day_of_week = parseInt(formData.get("day_of_week") as string);
  const week_number = parseInt(formData.get("week_number") as string);

  const { data, error } = await supabase.from("workouts").insert({
    program_id, name, day_of_week, week_number,
  }).select().single();

  if (error) throw new Error(error.message);
  redirect(`/trainer/programs/${program_id}/workouts/${data.id}`);
}

export async function addExercise(formData: FormData) {
  const supabase = await createClient();
  const workout_id = formData.get("workout_id") as string;
  const program_id = formData.get("program_id") as string;
  const name = formData.get("name") as string;
  const sets = parseInt(formData.get("sets") as string);
  const reps = formData.get("reps") as string;
  const rest_seconds = parseInt(formData.get("rest_seconds") as string) || 60;
  const notes = formData.get("notes") as string;

  const { count } = await supabase.from("exercises").select("*", { count: "exact", head: true }).eq("workout_id", workout_id);

  await supabase.from("exercises").insert({
    workout_id, name, sets, reps, rest_seconds,
    notes: notes || null,
    order: count ?? 0,
  });

  redirect(`/trainer/programs/${program_id}/workouts/${workout_id}`);
}

export async function deleteExercise(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const workout_id = formData.get("workout_id") as string;
  const program_id = formData.get("program_id") as string;

  await supabase.from("exercises").delete().eq("id", id);
  redirect(`/trainer/programs/${program_id}/workouts/${workout_id}`);
}
