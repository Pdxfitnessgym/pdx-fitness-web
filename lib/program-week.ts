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
