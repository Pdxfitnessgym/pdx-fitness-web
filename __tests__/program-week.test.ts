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

// ── gym calendar month boundaries ─────────────────────────────────────────────

import { gymMonthRange, gymDayOfMonth } from "@/lib/time";

describe("gymMonthRange", () => {
  it("starts at midnight Pacific, not midnight UTC", () => {
    // October 2026 is PDT (UTC-7), so the month starts at 07:00 UTC
    expect(gymMonthRange(2026, 9).start).toBe("2026-10-01T07:00:00.000Z");
    expect(gymMonthRange(2026, 9).end).toBe("2026-11-01T07:00:00.000Z");
  });

  it("handles the PDT to PST switch inside the month", () => {
    // November 2026 starts in PDT (-7) and December begins in PST (-8)
    expect(gymMonthRange(2026, 10).start).toBe("2026-11-01T07:00:00.000Z");
    expect(gymMonthRange(2026, 10).end).toBe("2026-12-01T08:00:00.000Z");
  });

  // The bug: an evening workout on the 30th is already the 1st in UTC, so a
  // UTC-built window pulled it into the next month while its day number still
  // read 30 — it appeared a month later on the wrong square.
  it("keeps a late-evening workout on the last of the month out of the next one", () => {
    const sept30Evening = "2026-10-01T01:13:22.021Z"; // 18:13 Pacific on Sept 30
    const oct = gymMonthRange(2026, 9);
    expect(sept30Evening >= oct.start).toBe(false);
    const sept = gymMonthRange(2026, 8);
    expect(sept30Evening >= sept.start && sept30Evening < sept.end).toBe(true);
    expect(gymDayOfMonth(sept30Evening)).toBe(30);
  });
});
