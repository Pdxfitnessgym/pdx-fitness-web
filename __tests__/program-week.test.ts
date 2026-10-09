import { currentProgramWeek, activeWeekFor } from "@/lib/program-week";

describe("currentProgramWeek", () => {
  it("is week 1 on the start date", () => {
    expect(currentProgramWeek("2026-10-09", 12, "2026-10-09")).toBe(1);
  });

  it("stays in week 1 for the first seven days", () => {
    expect(currentProgramWeek("2026-10-09", 12, "2026-10-15")).toBe(1);
  });

  it("rolls over on day eight", () => {
    expect(currentProgramWeek("2026-10-09", 12, "2026-10-16")).toBe(2);
  });

  it("clamps to the program's length", () => {
    expect(currentProgramWeek("2026-10-09", 12, "2027-10-09")).toBe(12);
  });

  it("never goes below 1 for a future start date", () => {
    expect(currentProgramWeek("2026-11-09", 12, "2026-10-09")).toBe(1);
  });

  it("falls back to week 1 without a start date", () => {
    expect(currentProgramWeek(null, 12, "2026-10-09")).toBe(1);
  });
});

describe("activeWeekFor", () => {
  it("uses the current week when it has workouts", () => {
    expect(activeWeekFor([1, 2, 3, 4], 3)).toBe(3);
  });

  it("falls back to the last built-out week for a sparse program", () => {
    // Phases written once: week 1 and week 5 only
    expect(activeWeekFor([1, 5], 3)).toBe(1);
    expect(activeWeekFor([1, 5], 7)).toBe(5);
  });

  it("uses the first week when the program starts later than week 1", () => {
    expect(activeWeekFor([4, 5], 2)).toBe(4);
  });

  it("is null when nothing is built", () => {
    expect(activeWeekFor([], 3)).toBeNull();
  });
});
