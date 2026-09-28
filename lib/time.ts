// The gym is in Portland, but server code (server actions, API routes, cron)
// runs in UTC. Anything formatted there has to name the timezone explicitly or
// a 3pm session goes out in a push notification as 10pm.
export const GYM_TZ = "America/Los_Angeles";

const DATE_OPTS = { weekday: "short", month: "short", day: "numeric" } as const;
const TIME_OPTS = { hour: "numeric", minute: "2-digit" } as const;

export function formatGymDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: GYM_TZ, ...DATE_OPTS });
}

export function formatGymTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: GYM_TZ, ...TIME_OPTS });
}

export function formatGymDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: GYM_TZ, ...DATE_OPTS, ...TIME_OPTS });
}

// "YYYY-MM-DD" for the gym's current day, not the server's.
export function gymToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: GYM_TZ });
}

// How far the gym's wall clock sits from UTC at this instant, in ms.
// Negative for Pacific (-7h in summer, -8h in winter), so DST is handled.
function gymOffsetMs(at: Date): number {
  const wall = at.toLocaleString("sv-SE", { timeZone: GYM_TZ }); // "2026-09-28 12:00:00"
  return Date.parse(wall.replace(" ", "T") + "Z") - at.getTime();
}

// The gym's current day as a pair of UTC instants, for querying timestamptz.
export function gymDayRange(now: Date = new Date()): { start: string; end: string } {
  const day = gymToday(now);
  const offset = gymOffsetMs(now);
  return {
    start: new Date(Date.parse(`${day}T00:00:00Z`) - offset).toISOString(),
    end: new Date(Date.parse(`${day}T23:59:59.999Z`) - offset).toISOString(),
  };
}

// Whole days from the gym's today to the gym's day containing `iso`.
// 0 = today, 1 = tomorrow.
export function gymDaysUntil(iso: string | Date, now: Date = new Date()): number {
  return Math.round(
    (Date.parse(gymToday(new Date(iso))) - Date.parse(gymToday(now))) / 86400000,
  );
}
