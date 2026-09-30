// Plain module, deliberately not "use client": server components render these
// too, and anything exported from a client module becomes a client reference
// that throws when a server render calls it.
export const RPE_LABEL: Record<number, string> = {
  1: "very easy", 2: "easy", 3: "light", 4: "fairly light", 5: "moderate",
  6: "somewhat hard", 7: "hard", 8: "very hard", 9: "extremely hard", 10: "max effort",
};

export function rpeColor(v: number) {
  if (v <= 3) return "#10B981";
  if (v <= 6) return "#F59E0B";
  if (v <= 8) return "#F97316";
  return "#EF4444";
}
