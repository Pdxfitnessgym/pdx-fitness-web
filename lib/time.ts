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

// A gym-local wall-clock time as the UTC instant it actually happens at.
// Applied twice so a time near a DST switch resolves with the right offset.
function gymWallToUtc(year: number, monthIdx: number, day: number): Date {
  const asIfUtc = Date.UTC(year, monthIdx, day);
  const firstPass = asIfUtc - gymOffsetMs(new Date(asIfUtc));
  return new Date(asIfUtc - gymOffsetMs(new Date(firstPass)));
}

// A gym calendar month as the pair of UTC instants bounding it, for querying
// timestamptz. Built from the server's own clock, an evening workout on the
// last of the month lands in the next month's window — it is already "tomorrow"
// in UTC — while its day number still reads as the 30th, so it shows up a month
// late on the wrong square.
export function gymMonthRange(year: number, monthIdx: number): { start: string; end: string } {
  return {
    start: gymWallToUtc(year, monthIdx, 1).toISOString(),
    end: gymWallToUtc(year, monthIdx + 1, 1).toISOString(),
  };
}

// Year and month index (0-11) of the gym's current day.
export function gymYearMonth(now: Date = new Date()): { year: number; monthIdx: number } {
  const [y, m] = gymToday(now).split("-").map(Number);
  return { year: y, monthIdx: m - 1 };
}

// Day of the month for the gym's day containing `iso`.
export function gymDayOfMonth(iso: string | Date): number {
  return parseInt(gymToday(new Date(iso)).slice(-2), 10);
}
