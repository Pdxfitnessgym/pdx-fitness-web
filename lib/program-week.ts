import { gymToday } from "@/lib/time";

// Shared by the server action, the trainer editor and the client view, so it
// can't be a "use client" module.
export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type ScheduleRow = { day: string; workout: string; details: string };

export type WeekGuide = {
  week_number: number;
  phase: string | null;
  title: string | null;
  focus: string | null;
  glance: string | null;
  schedule: ScheduleRow[];
  goal: string | null;
  tip: string | null;
  milestone: string | null;
};

// A guide row exists as soon as it's saved, but a week that was saved blank
// isn't worth linking to.
export function hasGuideContent(g: Partial<WeekGuide> | null | undefined): boolean {
  if (!g) return false;
  return Boolean(
    g.title || g.focus || g.glance || g.goal || g.tip || g.milestone || g.phase ||
    (g.schedule?.length ?? 0) > 0,
  );
}

// Which week of their program a client is in right now, counted from its start
// date and clamped to the program's length. Both dates are plain gym-local
// day strings compared as UTC midnight, so the week ticks over at midnight in
// Portland rather than 5pm the day before.
export function currentProgramWeek(
  startDate: string | null | undefined,
  durationWeeks: number,
  today: string = gymToday(),
): number {
  if (!startDate) return 1;
  const days = Math.floor(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)) / 86400000,
  );
  if (!Number.isFinite(days)) return 1;
  return Math.min(Math.max(Math.floor(days / 7) + 1, 1), Math.max(durationWeeks, 1));
}

// The week whose workouts a client should actually be shown. Normally that's
// the week they're in — but a program whose phases are written once (week 1,
// then week 5) has empty weeks in between, so fall back to the most recent week
// that was built out.
export function activeWeekFor(weeksWithWorkouts: number[], currentWeek: number): number | null {
  if (weeksWithWorkouts.length === 0) return null;
  if (weeksWithWorkouts.includes(currentWeek)) return currentWeek;
  const earlier = weeksWithWorkouts.filter(w => w < currentWeek);
  return earlier.length ? Math.max(...earlier) : Math.min(...weeksWithWorkouts);
}
