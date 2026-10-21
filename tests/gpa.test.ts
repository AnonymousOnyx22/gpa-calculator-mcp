import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { bandForPercent, bandForLetter, neededOnFinal, weighted, gpa, targetGpaPlanner } from "../src/grades.js";

let client: Client;
beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  client = new Client({ name: "test", version: "0" });
  await client.connect(b);
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const r: any = await client.callTool({ name, arguments: args });
  return { text: r.content[0].text as string, isError: !!r.isError };
}

describe("grade math", () => {
  it("maps percentages to bands on each scale", () => {
    expect(bandForPercent("us4", 93).letter).toBe("A");
    expect(bandForPercent("us4", 92.9).letter).toBe("A-");
    expect(bandForPercent("us4plus", 98).points).toBe(4.3);
    expect(bandForPercent("ontario-college", 82).letter).toBe("A");
    expect(bandForPercent("ontario-college", 77).points).toBe(3.5);
    expect(bandForPercent("ontario-college", 49.9).letter).toBe("F");
  });
  it("maps percentages and classes on the UK classification scale", () => {
    expect(bandForPercent("uk-classification", 70).letter).toBe("1st");
    expect(bandForPercent("uk-classification", 69.9).letter).toBe("2:1");
    expect(bandForPercent("uk-classification", 60).points).toBe(3.3);
    expect(bandForPercent("uk-classification", 55).letter).toBe("2:2");
    expect(bandForPercent("uk-classification", 41).letter).toBe("3rd");
    expect(bandForPercent("uk-classification", 39).letter).toBe("F");
    expect(bandForLetter("uk-classification", "2:1").points).toBe(3.3);
    expect(bandForLetter("uk-classification", "1ST").letter).toBe("1st");
  });
  it("weights a UK degree classification", () => {
    const r = gpa([{ credits: 120, grade: "2:1" }, { credits: 120, grade: "1st" }], "uk-classification");
    expect(r.term).toBe(3.65); // (3.3 * 120 + 4.0 * 120) / 240
  });
  it("maps letters to the Australian 7.0 scale", () => {
    expect(bandForPercent("australia-hd", 85).letter).toBe("HD");
    expect(bandForPercent("australia-hd", 85).points).toBe(7.0);
    expect(bandForPercent("australia-hd", 75).points).toBe(6.0);
    expect(bandForPercent("australia-hd", 65).points).toBe(5.0);
    expect(bandForPercent("australia-hd", 50).points).toBe(4.0);
    expect(bandForPercent("australia-hd", 45).letter).toBe("F");
    expect(bandForLetter("australia-hd", "hd").letter).toBe("HD");
  });
  it("computes a weighted GPA on the 5.0 scale", () => {
    expect(bandForLetter("weighted-5.0", "A").points).toBe(5.0);
    expect(bandForPercent("weighted-5.0", 91).points).toBe(4.7);
    expect(bandForPercent("weighted-5.0", 0).points).toBe(0.0);
    const r = gpa([{ credits: 1, grade: "A" }, { credits: 1, grade: "B" }], "weighted-5.0");
    expect(r.term).toBe(4.5); // (5.0 + 4.0) / 2
  });
  it("computes a credit weighted GPA and a cumulative one", () => {
    const r = gpa([{ credits: 3, grade: "A" }, { credits: 4, grade: "B+" }, { credits: 3, grade: "C" }], "us4", { gpa: 3.0, credits: 30 });
    expect(r.term).toBe(3.12); // (12 + 13.2 + 6) / 10
    expect(r.cumulative).toBe(3.03); // (90 + 31.2) / 40
  });
  it("solves the final exam question", () => {
    expect(neededOnFinal(74, 40, 80).needed).toBe(89); // 80 = 74*.6 + x*.4 so x = 35.6 / .4
    expect(neededOnFinal(95, 20, 60).alreadyThere).toBe(true);
    expect(neededOnFinal(50, 10, 90).possible).toBe(false);
  });
  it("handles weighted parts with unmarked work", () => {
    const r = weighted([{ name: "Quizzes", weight: 20, score: 85 }, { name: "Labs", weight: 30, score: 70 }, { name: "Exam", weight: 50 }]);
    expect(r.currentGrade).toBe(76); // (17 + 21) / 50, the average of the marked work
    expect(r.earnedPoints).toBe(38); // 17 + 21 points out of a course worth 100
    expect(r.worstFinish).toBe(38);
    expect(r.bestFinish).toBe(88);
  });
  it("does not rescale parts that do not add up to 100", () => {
    const r = weighted([{ name: "Quizzes", weight: 20, score: 85 }, { name: "Labs", weight: 30, score: 70 }]);
    expect(r.totalWeight).toBe(50);
    expect(r.doneWeight).toBe(50);
    expect(r.remainingWeight).toBe(50); // the exam that was not listed is still to come
    expect(r.currentGrade).toBe(76);
    expect(r.earnedPoints).toBe(38);
    expect(r.worstFinish).toBe(38); // not 76, the weights are percentages of the course
    expect(r.bestFinish).toBe(88);
  });
  it("counts nothing as marked when no part has a score", () => {
    const r = weighted([{ name: "Quizzes", weight: 20 }, { name: "Exam", weight: 80 }]);
    expect(r.currentGrade).toBe(null);
    expect(r.earnedPoints).toBe(0);
    expect(r.worstFinish).toBe(0);
    expect(r.bestFinish).toBe(100);
  });
  it("rejects weights that add up to more than 100", () => {
    expect(() => weighted([{ name: "Quizzes", weight: 60, score: 85 }, { name: "Exam", weight: 60 }])).toThrow(/add up to 120 percent/);
  });
  it("plans a target GPA", () => {
    expect(targetGpaPlanner(3.1, 60, 3.4, 15, 4).needed).toBe(4.6);
    expect(targetGpaPlanner(3.1, 60, 3.4, 15, 4).possible).toBe(false);
  });
});

describe("MCP tools", () => {
  it("lists six read only tools", async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual(["calculate_gpa", "convert_grade", "list_scales", "needed_on_final", "target_gpa_planner", "weighted_grade"]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });
  it("names every parameter and gives an example prompt in each description", async () => {
    const tools = (await client.listTools()).tools;
    for (const t of tools) {
      const description = t.description ?? "";
      const props = Object.keys(((t.inputSchema as any).properties ?? {}) as Record<string, unknown>);
      for (const p of props) expect(description, `${t.name} description should mention ${p}`).toContain(p);
      expect(description, `${t.name} description should include an example prompt`).toMatch(/Example prompt: "/);
      expect(description.endsWith('"'), `${t.name} description should end with the example prompt`).toBe(true);
    }
  });
  it("describes every parameter", async () => {
    const tools = (await client.listTools()).tools;
    for (const t of tools) {
      const props = ((t.inputSchema as any).properties ?? {}) as Record<string, { description?: string }>;
      for (const [key, def] of Object.entries(props)) expect(def.description, `${t.name}.${key} should have a description`).toBeTruthy();
    }
  });
  it("answers the final exam question in words", async () => {
    const r = await call("needed_on_final", { current_percent: 74, final_weight_percent: 40, target_percent: 80 });
    expect(r.text).toContain("89%");
  });
  it("calculates GPA and accepts percentages and letters together", async () => {
    const r = await call("calculate_gpa", { courses: [{ name: "Net", credits: 3, grade: "A" }, { name: "Scripting", credits: 3, grade: 78 }], scale: "ontario-college" });
    expect(r.text).toContain("GPA for these courses: 3.75");
  });
  it("gives a friendly error for a bad letter", async () => {
    const r = await call("convert_grade", { grade: "Z", scale: "us4" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Valid letters");
  });
  it("gives a friendly error for a bad scale", async () => {
    const r = await call("convert_grade", { grade: "A", scale: "ontario" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Valid scale ids");
    expect(r.text).toContain("ontario-college");
  });
  it("gives a friendly error for a bad grade format", async () => {
    const r = await call("convert_grade", { grade: "A++", scale: "us4" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Accepted grade formats");
    expect(r.text).toContain("'B+', 87, '87%'");
  });
  it("explains impossible targets", async () => {
    const r = await call("needed_on_final", { current_percent: 50, final_weight_percent: 10, target_percent: 90 });
    expect(r.text).toContain("out of reach");
  });
  it("keeps the worst finish honest when only some parts are known", async () => {
    const r = await call("weighted_grade", { parts: [{ name: "Quizzes", weight: 20, score: 85 }, { name: "Labs", weight: 30, score: 70 }] });
    expect(r.text).toContain("Grade so far: 76% on the 50% of the course that is marked");
    expect(r.text).toContain("That banks 38 of the 100 points the course is worth");
    expect(r.text).toContain("you finish at 38%");
    expect(r.text).toContain("you finish at 88%");
    expect(r.text).not.toContain("finish at 76%");
  });
  it("gives a friendly error when the weights add up to more than 100", async () => {
    const r = await call("weighted_grade", { parts: [{ name: "Quizzes", weight: 60, score: 85 }, { name: "Exam", weight: 60 }] });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("100 percent");
  });
  it("lists the scales", async () => {
    const r = await call("list_scales");
    expect(r.text).toContain("ontario-college");
    expect(r.text).toContain("uk-classification");
    expect(r.text).toContain("australia-hd");
    expect(r.text).toContain("weighted-5.0");
  });
  it("converts a UK classification", async () => {
    const r = await call("convert_grade", { grade: 68, scale: "uk-classification" });
    expect(r.text).toContain("2:1");
    expect(r.text).toContain("3.3 grade points");
  });
  it("calculates a GPA on the Australian 7.0 scale", async () => {
    const r = await call("calculate_gpa", { courses: [{ name: "Networks", credits: 6, grade: "HD" }, { name: "Scripting", credits: 6, grade: 75 }], scale: "australia-hd" });
    expect(r.text).toContain("GPA for these courses: 6.50");
  });
  it("plans a target GPA on the 5.0 scale", async () => {
    const r = await call("target_gpa_planner", { current_gpa: 4.0, credits_completed: 30, target_gpa: 4.5, upcoming_credits: 15, scale: "weighted-5.0" });
    expect(r.text).toContain("5.5 on the next 15 credits");
    expect(r.text).toContain("top of this scale is 5.0");
  });
});
