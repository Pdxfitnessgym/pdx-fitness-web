"use server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function approveTrainer(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== "pdxfitnessgym@gmail.com") redirect("/login");

  const trainerId = formData.get("trainer_id") as string;
  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: true })
    .eq("id", trainerId);

  if (error) throw new Error(error.message);
  redirect("/admin/trainers");
}

export async function rejectTrainer(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== "pdxfitnessgym@gmail.com") redirect("/login");

  const trainerId = formData.get("trainer_id") as string;
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", trainerId)
    .eq("role", "trainer");

  if (error) throw new Error(error.message);
  redirect("/admin/trainers");
}
