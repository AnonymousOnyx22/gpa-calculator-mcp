import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { bandForPercent, neededOnFinal, weighted, gpa, targetGpaPlanner } from "../src/grades.js";

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
    expect(r.currentGrade).toBe(76); // (17 + 21) / 50
    expect(r.worstFinish).toBe(38);
    expect(r.bestFinish).toBe(88);
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
  it("explains impossible targets", async () => {
    const r = await call("needed_on_final", { current_percent: 50, final_weight_percent: 10, target_percent: 90 });
    expect(r.text).toContain("out of reach");
  });
  it("lists the scales", async () => {
    const r = await call("list_scales");
    expect(r.text).toContain("ontario-college");
  });
});
