export type Side = "both" | "left" | "right";

export function buildSetKey(exerciseId: string, setNum: number, side: Side): string {
  return `${exerciseId}-${setNum}-${side}`;
}

export function calcTotalSets(exercises: { sets: number; is_unilateral: boolean }[]): number {
  return exercises.reduce((acc, ex) => acc + ex.sets * (ex.is_unilateral ? 2 : 1), 0);
}

export function isExerciseDone(
  logged: Record<string, unknown>,
  exerciseId: string,
  sets: number,
  isUnilateral: boolean
): boolean {
  const count = Object.keys(logged).filter(k => k.startsWith(exerciseId + "-")).length;
  return count >= sets * (isUnilateral ? 2 : 1);
}

// Digits, drop-set slashes and clock colons always. When the prescription is
// itself time- or text-based ("60 sec"), let letters and spaces through so the
// logged value can say what it means instead of collapsing to a bare number.
export function parseRepsInput(raw: string, spec?: string): string {
  const allowText = spec != null && repsInputMode(spec) === "text";
  return allowText
    ? raw.replace(/[^0-9a-zA-Z/:. ]/g, "").slice(0, 16)
    : raw.replace(/[^0-9/:]/g, "");
}

// Time-based reps specs ("0:30", "30 sec") need the full keyboard so ":" can be typed;
// plain rep counts keep the numeric keypad.
export function repsInputMode(spec: string): "numeric" | "text" {
  return /[^0-9\sx×/-]/.test(spec) ? "text" : "numeric";
}

export function parseWeightInput(raw: string): string {
  return raw.replace(/[^0-9.]/g, "");
}

export function repsToText(value: string): string | null {
  return value.trim() || null;
}

export function weightToNumber(value: string): number | null {
  return value ? parseFloat(value) : null;
}

export function isValidSide(value: string): value is Side {
  return value === "both" || value === "left" || value === "right";
}

// Volume = weight × reps. reps_completed is free text — plain counts, "2/2/2"
// drop sets, ":30" holds, and sometimes distance or seconds for cardio (real
// logs contain 400 and 60 alongside a weight). Anything above a plausible rep
// count is treated as not-reps so one rower entry can't dominate the total.
const MAX_PLAUSIBLE_REPS = 50;

export function repsForVolume(reps: string | null): number {
  if (!reps) return 0;
  const t = reps.trim();
  if (t.includes(":")) return 0; // timed hold
  if (/[a-z]/i.test(t)) return 0; // "60 sec", "400 m" — a duration or distance, not reps
  if (t.includes("/")) {
    const sum = t.split("/").map(p => parseInt(p)).filter(Number.isFinite).reduce((a, b) => a + b, 0);
    return sum > 0 && sum <= MAX_PLAUSIBLE_REPS ? sum : 0;
  }
  const n = parseInt(t);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n <= MAX_PLAUSIBLE_REPS ? n : 0;
}

export function totalVolumeLbs(sets: { reps: string | null; weight: number | null }[]): number {
  return Math.round(sets.reduce((sum, s) => sum + (s.weight ?? 0) * repsForVolume(s.reps), 0));
}

// A light, accurate size comparison — only once the number is big enough to mean something.
// Heaviest first, so the phrase lands on a small count of a big thing rather
// than "700 house cats". Weights are rough on purpose — the point is the image.
const THINGS: { lbs: number; emoji: string; one: string; many: string }[] = [
  { lbs: 80000, emoji: "🐋", one: "a humpback whale", many: "humpback whales" },
  { lbs: 40000, emoji: "🦕", one: "a brachiosaurus leg", many: "brachiosaurus legs" },
  { lbs: 25000, emoji: "🚌", one: "a school bus", many: "school buses" },
  { lbs: 16000, emoji: "🚚", one: "a delivery truck", many: "delivery trucks" },
  { lbs: 12000, emoji: "🐘", one: "an elephant", many: "elephants" },
  { lbs: 5000, emoji: "🦏", one: "a rhino", many: "rhinos" },
  { lbs: 3500, emoji: "🦛", one: "a hippo", many: "hippos" },
  { lbs: 2900, emoji: "🚗", one: "a small car", many: "small cars" },
  { lbs: 1600, emoji: "🐄", one: "a cow", many: "cows" },
  { lbs: 1200, emoji: "🐻‍❄️", one: "a polar bear", many: "polar bears" },
  { lbs: 1000, emoji: "🐴", one: "a horse", many: "horses" },
  { lbs: 800, emoji: "🎹", one: "a grand piano", many: "grand pianos" },
  { lbs: 600, emoji: "🐻", one: "a grizzly bear", many: "grizzly bears" },
  { lbs: 400, emoji: "🛵", one: "a scooter", many: "scooters" },
  { lbs: 250, emoji: "🦍", one: "a gorilla", many: "gorillas" },
  { lbs: 180, emoji: "🧍", one: "a fully grown human", many: "fully grown humans" },
  { lbs: 120, emoji: "🐧", one: "an emperor penguin huddle", many: "emperor penguin huddles" },
  { lbs: 90, emoji: "🐕", one: "a golden retriever", many: "golden retrievers" },
  { lbs: 40, emoji: "🐢", one: "a sea turtle", many: "sea turtles" },
  { lbs: 10, emoji: "🐈", one: "a house cat", many: "house cats" },
];

export type VolumeComparison = { emoji: string; phrase: string };

export function volumeAs(lbs: number): VolumeComparison | null {
  for (const t of THINGS) {
    // Must actually reach the thing's weight before claiming one of it
    if (lbs < t.lbs) continue;
    const n = Math.round(lbs / t.lbs);
    return { emoji: t.emoji, phrase: n === 1 ? t.one : `${n.toLocaleString()} ${t.many}` };
  }
  return null;
}

// Kept for the trainer's logging screen, which shows it inline.
export function volumeComparison(lbs: number): string | null {
  const c = volumeAs(lbs);
  return c ? `about ${c.phrase}` : null;
}

// A personal best is per exercise AND per rep count: 8 reps at 135 is a
// different achievement from 3 reps at 185. Only a genuine improvement over a
// previous best counts — a first-ever attempt isn't a "best", or every opening
// session would claim a dozen of them.
export type PersonalRecord = {
  exerciseName: string;
  reps: number;
  weight: number;
  previousWeight: number;
};

export function findPersonalRecords(
  current: { exerciseId: string; exerciseName: string; reps: string | null; weight: number | null }[],
  history: { exercise_id: string; reps_completed: string | null; weight_lbs: number | null }[],
): PersonalRecord[] {
  const repCount = (reps: string | null): number | null => {
    if (!reps) return null;
    const t = reps.trim();
    if (t.includes(":") || /[a-z]/i.test(t) || t.includes("/")) return null; // timed, distance, drop set
    const n = parseInt(t);
    return Number.isFinite(n) && n > 0 && n <= MAX_PLAUSIBLE_REPS ? n : null;
  };

  const best = (rows: { key: string; weight: number }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.key, Math.max(m.get(r.key) ?? 0, r.weight));
    return m;
  };

  const bestNow = best(current.flatMap(s => {
    const n = repCount(s.reps);
    return n && s.weight && s.weight > 0 ? [{ key: `${s.exerciseId}|${n}`, weight: s.weight }] : [];
  }));
  const bestBefore = best(history.flatMap(s => {
    const n = repCount(s.reps_completed);
    return n && s.weight_lbs && s.weight_lbs > 0 ? [{ key: `${s.exercise_id}|${n}`, weight: s.weight_lbs }] : [];
  }));

  const nameById = new Map(current.map(s => [s.exerciseId, s.exerciseName]));
  const out: PersonalRecord[] = [];
  for (const [key, weight] of bestNow) {
    const previous = bestBefore.get(key);
    if (previous == null || weight <= previous) continue;
    const [exerciseId, reps] = key.split("|");
    out.push({
      exerciseName: nameById.get(exerciseId) ?? "Exercise",
      reps: parseInt(reps),
      weight,
      previousWeight: previous,
    });
  }
  return out.sort((a, b) => (b.weight - b.previousWeight) - (a.weight - a.previousWeight));
}

// The greyed number shown in an empty reps box: the first figure of the
// prescription ("6-8" -> "6"). Logging falls back to exactly this, so tapping ✓
// records what the box was already showing instead of saving nothing.
export function repsPlaceholder(spec: string): string {
  return spec.split(/[-x×]/)[0].trim();
}

// Is the prescription a rep count you tally ("8", "6-8", "8/6/4/2"), or a
// description of the effort ("60 sec", "Down and back")? Counted reps must be
// typed in — there's a real number to record. Described ones can't be, so
// ticking the set is the only sensible way to say it's done.
export function isCountedReps(spec: string): boolean {
  return repsInputMode(spec) === "numeric";
}
