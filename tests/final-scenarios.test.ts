import { describe, it, expect } from "vitest";
import { finalScenarios, neededOnFinal } from "../src/grades.js";

describe("finalScenarios", () => {
  it("returns the final score needed for A, B and C", () => {
    const r = finalScenarios("us4", 80, 40);
    expect(r.map((s) => s.letter)).toEqual(["A", "B", "C"]);
    expect(r.map((s) => s.targetPercent)).toEqual([93, 83, 73]);
    expect(r[0].needed).toBe(112.5);
    expect(r[0].possible).toBe(false);
    expect(r[1].needed).toBe(87.5);
    expect(r[2]).toMatchObject({ needed: 62.5, possible: true, alreadyThere: false });
  });

  it("matches neededOnFinal for the same cutoff", () => {
    const b = finalScenarios("ontario-college", 74, 30).find((s) => s.letter === "B")!;
    expect(b.needed).toBe(neededOnFinal(74, 30, 70).needed);
  });

  it("flags a letter that is already secured", () => {
    expect(finalScenarios("us4", 95, 20)[2].alreadyThere).toBe(true);
  });

  it("skips letters the scale does not have", () => {
    expect(finalScenarios("uk-classification", 60, 50)).toEqual([]);
    expect(finalScenarios("australia-hd", 60, 50).map((s) => s.letter)).toEqual(["C"]);
  });

  it("rejects bad input", () => {
    expect(() => finalScenarios("nope", 80, 40)).toThrow();
    expect(() => finalScenarios("us4", 80, 0)).toThrow();
  });
});
