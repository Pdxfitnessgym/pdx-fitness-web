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

export function parseRepsInput(raw: string): string {
  return raw.replace(/[^0-9/]/g, "");
}

export function parseWeightInput(raw: string): string {
  return raw.replace(/[^0-9.]/g, "");
}

export function repsToNumber(value: string): number | null {
  return value ? parseInt(value, 10) : null;
}

export function weightToNumber(value: string): number | null {
  return value ? parseFloat(value) : null;
}

export function isValidSide(value: string): value is Side {
  return value === "both" || value === "left" || value === "right";
}
