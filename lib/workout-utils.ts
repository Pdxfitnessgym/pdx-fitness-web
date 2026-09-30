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
export function volumeComparison(lbs: number): string | null {
  const things: [number, string, string][] = [
    [25000, "school bus", "school buses"],
    [12000, "elephant", "elephants"],
    [3000, "small car", "small cars"],
    [1000, "horse", "horses"],
    [800, "grand piano", "grand pianos"],
  ];
  for (const [w, one, many] of things) {
    const n = Math.floor(lbs / w);
    if (n >= 1) return `about ${n} ${n === 1 ? one : many}`;
  }
  return null;
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
