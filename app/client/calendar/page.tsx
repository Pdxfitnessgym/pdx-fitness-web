import { redirect } from "next/navigation";

// The old month view placed workouts on dates derived from week_number/day_of_week.
// Workouts are an unscheduled pool now, so those dates were fabricated. The real
// calendar — what the client actually completed — lives on the workouts page.
export default function ClientCalendarPage() {
  redirect("/client/workouts?view=calendar");
}
