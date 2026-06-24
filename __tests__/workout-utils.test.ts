import {
  buildSetKey,
  calcTotalSets,
  isExerciseDone,
  parseRepsInput,
  parseWeightInput,
  repsToText,
  weightToNumber,
  isValidSide,
} from "@/lib/workout-utils";

// ── buildSetKey ────────────────────────────────────────────────────────────────

describe("buildSetKey", () => {
  it("builds a bilateral key", () => {
    expect(buildSetKey("ex-1", 1, "both")).toBe("ex-1-1-both");
  });

  it("builds a left-side key", () => {
    expect(buildSetKey("ex-1", 3, "left")).toBe("ex-1-3-left");
  });

  it("builds a right-side key", () => {
    expect(buildSetKey("ex-1", 2, "right")).toBe("ex-1-2-right");
  });

  it("includes set number in the key", () => {
    const k1 = buildSetKey("ex-abc", 1, "both");
    const k2 = buildSetKey("ex-abc", 2, "both");
    expect(k1).not.toBe(k2);
  });
});

// ── calcTotalSets ──────────────────────────────────────────────────────────────

describe("calcTotalSets", () => {
  it("returns 0 for empty list", () => {
    expect(calcTotalSets([])).toBe(0);
  });

  it("counts bilateral exercises normally", () => {
    const exercises = [
      { sets: 3, is_unilateral: false },
      { sets: 4, is_unilateral: false },
    ];
    expect(calcTotalSets(exercises)).toBe(7);
  });

  it("doubles sets for unilateral exercises", () => {
    const exercises = [{ sets: 3, is_unilateral: true }];
    expect(calcTotalSets(exercises)).toBe(6);
  });

  it("mixes bilateral and unilateral correctly", () => {
    const exercises = [
      { sets: 3, is_unilateral: false },  // 3
      { sets: 3, is_unilateral: true },   // 6
      { sets: 2, is_unilateral: false },  // 2
    ];
    expect(calcTotalSets(exercises)).toBe(11);
  });

  it("handles single-set unilateral exercise", () => {
    expect(calcTotalSets([{ sets: 1, is_unilateral: true }])).toBe(2);
  });
});

// ── isExerciseDone ─────────────────────────────────────────────────────────────

describe("isExerciseDone", () => {
  const EX = "ex-123";

  it("returns false when no sets logged", () => {
    expect(isExerciseDone({}, EX, 3, false)).toBe(false);
  });

  it("returns false when partial sets logged (bilateral)", () => {
    const logged = {
      [`${EX}-1-both`]: {},
      [`${EX}-2-both`]: {},
    };
    expect(isExerciseDone(logged, EX, 3, false)).toBe(false);
  });

  it("returns true when all bilateral sets logged", () => {
    const logged = {
      [`${EX}-1-both`]: {},
      [`${EX}-2-both`]: {},
      [`${EX}-3-both`]: {},
    };
    expect(isExerciseDone(logged, EX, 3, false)).toBe(true);
  });

  it("returns false when only one side logged for unilateral", () => {
    const logged = {
      [`${EX}-1-left`]: {},
      [`${EX}-2-left`]: {},
      [`${EX}-3-left`]: {},
    };
    expect(isExerciseDone(logged, EX, 3, true)).toBe(false);
  });

  it("returns true when both sides logged for all sets (unilateral)", () => {
    const logged = {
      [`${EX}-1-left`]: {},
      [`${EX}-1-right`]: {},
      [`${EX}-2-left`]: {},
      [`${EX}-2-right`]: {},
      [`${EX}-3-left`]: {},
      [`${EX}-3-right`]: {},
    };
    expect(isExerciseDone(logged, EX, 3, true)).toBe(true);
  });

  it("does not count keys from a different exercise", () => {
    const logged = {
      [`other-1-both`]: {},
      [`other-2-both`]: {},
      [`other-3-both`]: {},
    };
    expect(isExerciseDone(logged, EX, 3, false)).toBe(false);
  });
});

// ── parseRepsInput ─────────────────────────────────────────────────────────────

describe("parseRepsInput", () => {
  it("passes through numeric string", () => {
    expect(parseRepsInput("8")).toBe("8");
  });

  it("strips non-numeric characters", () => {
    expect(parseRepsInput("8abc")).toBe("8");
    expect(parseRepsInput("a8b")).toBe("8");
  });

  it("strips decimal points (reps must be whole numbers)", () => {
    expect(parseRepsInput("8.5")).toBe("85");
  });

  it("returns empty string for empty input", () => {
    expect(parseRepsInput("")).toBe("");
  });

  it("strips special characters and spaces", () => {
    expect(parseRepsInput(" 10 ")).toBe("10");
    expect(parseRepsInput("10/12")).toBe("1012");
  });
});

// ── parseWeightInput ───────────────────────────────────────────────────────────

describe("parseWeightInput", () => {
  it("passes through integer weight", () => {
    expect(parseWeightInput("135")).toBe("135");
  });

  it("passes through decimal weight", () => {
    expect(parseWeightInput("52.5")).toBe("52.5");
  });

  it("strips non-numeric characters except decimal", () => {
    expect(parseWeightInput("135lbs")).toBe("135");
    expect(parseWeightInput("135 lbs")).toBe("135");
  });

  it("returns empty string for empty input", () => {
    expect(parseWeightInput("")).toBe("");
  });

  it("strips negative signs (no negative weight)", () => {
    expect(parseWeightInput("-10")).toBe("10");
  });
});

// ── repsToText ───────────────────────────────────────────────────────────────

describe("repsToText", () => {
  it("parses a valid reps string", () => {
    expect(repsToText("8")).toBe(8);
  });

  it("returns null for empty string", () => {
    expect(repsToText("")).toBeNull();
  });

  it("truncates decimals (parseInt behaviour)", () => {
    expect(repsToText("8.9")).toBe(8);
  });
});

// ── weightToNumber ─────────────────────────────────────────────────────────────

describe("weightToNumber", () => {
  it("parses a valid weight string", () => {
    expect(weightToNumber("135")).toBe(135);
  });

  it("parses decimal weight", () => {
    expect(weightToNumber("52.5")).toBe(52.5);
  });

  it("returns null for empty string", () => {
    expect(weightToNumber("")).toBeNull();
  });
});

// ── isValidSide ────────────────────────────────────────────────────────────────

describe("isValidSide", () => {
  it("accepts both", () => {
    expect(isValidSide("both")).toBe(true);
  });

  it("accepts left", () => {
    expect(isValidSide("left")).toBe(true);
  });

  it("accepts right", () => {
    expect(isValidSide("right")).toBe(true);
  });

  it("rejects arbitrary strings", () => {
    expect(isValidSide("center")).toBe(false);
    expect(isValidSide("")).toBe(false);
    expect(isValidSide("LEFT")).toBe(false);
  });
});
