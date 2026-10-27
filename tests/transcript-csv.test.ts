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

  it("ignores a credit multiplier that is not a positive number", () => {
    const rows = parseTranscriptCsv("course,credits,grade,multiplier\nMath,3,A,high\nArt,3,B,0\nBio,3,C,-1");
    expect(rows[0].creditMultiplier).toBeUndefined();
    expect(rows[1].creditMultiplier).toBeUndefined();
    expect(rows[2].creditMultiplier).toBeUndefined();
  });
});
