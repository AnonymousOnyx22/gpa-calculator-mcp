import { describe, it, expect } from "vitest";
import { parseTranscriptCsv } from "../src/grades.js";

describe("parseTranscriptCsv", () => {
  it("reads rows with a header, in any column order", () => {
    const rows = parseTranscriptCsv("Grade,Course,Credits\nA,Calculus,4\nB+,History,3\n");
    expect(rows).toEqual([
      { name: "Calculus", credits: 4, grade: "A" },
      { name: "History", credits: 3, grade: "B+" },
    ]);
  });

  it("reads rows with no header as name, credits, grade", () => {
    expect(parseTranscriptCsv("Calculus,4,A\nHistory,3,B+")).toEqual([
      { name: "Calculus", credits: 4, grade: "A" },
      { name: "History", credits: 3, grade: "B+" },
    ]);
  });

  it("knows the other names a school gives the columns", () => {
    const rows = parseTranscriptCsv("Subject,Units,Mark\nPhysics,5,87");
    expect(rows).toEqual([{ name: "Physics", credits: 5, grade: "87" }]);
  });

  it("keeps commas and quotes inside quoted fields", () => {
    const rows = parseTranscriptCsv('course,credits,grade\n"Art, Music and ""Design""",3,A-');
    expect(rows[0].name).toBe('Art, Music and "Design"');
    expect(rows[0].grade).toBe("A-");
  });

  it("copes with Windows line endings and blank lines", () => {
    const rows = parseTranscriptCsv("course,credits,grade\r\nMath,3,A\r\n\r\nBio,4,B\r\n");
    expect(rows.map((r) => r.name)).toEqual(["Math", "Bio"]);
  });

  it("reads an optional credit multiplier column", () => {
    const rows = parseTranscriptCsv("course,credits,grade,multiplier\nAP Calculus,4,A,1.5\nArt,2,B,");
    expect(rows[0].creditMultiplier).toBe(1.5);
    expect(rows[1].creditMultiplier).toBeUndefined();
  });

  it("gives back nothing for empty text", () => {
    expect(parseTranscriptCsv("")).toEqual([]);
    expect(parseTranscriptCsv("course,credits,grade\n")).toEqual([]);
  });

  it("names the bad value when the credits are not a number", () => {
    expect(() => parseTranscriptCsv("course,credits,grade\nMath,three,A")).toThrow(/Invalid credits: three/);
  });

  it("names a credit multiplier that is not a number above zero instead of quietly ignoring it", () => {
    expect(() => parseTranscriptCsv("course,credits,grade,multiplier\nMath,3,A,high")).toThrow(/Invalid credit multiplier: high/);
    expect(() => parseTranscriptCsv("course,credits,grade,multiplier\nArt,3,B,0")).toThrow(/Invalid credit multiplier: 0/);
    expect(() => parseTranscriptCsv("course,credits,grade,multiplier\nBio,3,C,-1")).toThrow(/Invalid credit multiplier: -1/);
  });

  it("treats an empty multiplier cell as no multiplier", () => {
    const rows = parseTranscriptCsv("course,credits,grade,multiplier\nMath,3,A,\nArt,2,B,1.5");
    expect(rows[0].creditMultiplier).toBeUndefined();
    expect(rows[1].creditMultiplier).toBe(1.5);
  });

  it("marks P, NP and W as grades that do not count towards the GPA", () => {
    const rows = parseTranscriptCsv("course,credits,grade\nWriting,3,P\nLab,1,NP\nArt,3,W\nMath,4,A");
    expect(rows.map((r) => r.countsTowardGpa)).toEqual([false, false, false, undefined]);
    expect(rows.map((r) => r.grade)).toEqual(["P", "NP", "W", "A"]);
  });
});
