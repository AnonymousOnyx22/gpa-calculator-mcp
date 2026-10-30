import { describe, it, expect, beforeAll } from "vitest";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { tools } from "../src/tools.js";

let client: Client;
beforeAll(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  client = new Client({ name: "structured output test", version: "0.0.0" });
  await client.connect(b);
});

/** Calls a tool and returns the whole result, so the fields can be read. */
async function call(name: string, args: Record<string, unknown> = {}) {
  const r: any = await client.callTool({ name, arguments: args });
  return { text: r.content[0].text as string, structured: r.structuredContent as Record<string, unknown> | undefined, isError: !!r.isError };
}

/** The schema of a tool's output, so the fields can be checked against it. */
function outputSchemaOf(name: string) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`there is no tool called ${name}`);
  if (!tool.outputSchema) throw new Error(`${name} has no output schema`);
  return z.object(tool.outputSchema);
}

describe("the tools carry an output schema", () => {
  it("gives every tool an output schema in the code", () => {
    for (const tool of tools) {
      expect(Object.keys(tool.outputSchema ?? {}), `${tool.name} output schema`).not.toHaveLength(0);
    }
  });

  it("sends an output schema for every tool to the client", async () => {
    const listed = (await client.listTools()).tools;
    for (const tool of listed) {
      const schema = (tool as any).outputSchema as { type?: string; properties?: Record<string, unknown> } | undefined;
      expect(schema, `${tool.name} output schema in the tool list`).toBeTruthy();
      expect(schema!.type, `${tool.name} output schema type`).toBe("object");
      expect(Object.keys(schema!.properties ?? {}), `${tool.name} output fields`).toEqual(Object.keys(tools.find((t) => t.name === tool.name)!.outputSchema!));
    }
  });

  it("describes every field of every output schema", async () => {
    const listed = (await client.listTools()).tools;
    for (const tool of listed) {
      const schema = (tool as any).outputSchema as { properties?: Record<string, { description?: string }> } | undefined;
      for (const [key, def] of Object.entries(schema!.properties ?? {})) {
        expect(def.description, `${tool.name}.${key} should have a description`).toBeTruthy();
      }
    }
  });
});

describe("the tools return structured content", () => {
  it("returns fields that match the output schema for every tool", async () => {
    const calls: Record<string, Record<string, unknown>> = {
      calculate_gpa: { courses: [{ name: "Calculus", credits: 3, grade: "A" }] },
      convert_grade: { grade: 78, scale: "ontario-college" },
      convert_gpa_scale: { gpa: 3.5, from_scale: "us4" },
      needed_on_final: { current_percent: 85, final_weight_percent: 40, target_letter: "B+" },
      weighted_grade: { parts: [{ name: "Quizzes", weight: 20, score: 85 }] },
      target_gpa_planner: { current_gpa: 3.1, credits_completed: 60, target_gpa: 3.4, upcoming_credits: 15 },
      plan_courses: {
        current_gpa: 3.4,
        credits_completed: 60,
        target_gpa: 3.5,
        courses: [{ name: "Calculus", credits: 3 }, { name: "Physics", credits: 3 }],
      },
      list_scales: {},
    };
    for (const tool of tools) {
      const r = await call(tool.name, calls[tool.name]);
      expect(r.isError, `${tool.name} should not error`).toBe(false);
      expect(r.structured, `${tool.name} structured content`).toBeTruthy();
      const parsed = outputSchemaOf(tool.name).safeParse(r.structured);
      expect(parsed.success, `${tool.name} structured content against its output schema: ${parsed.error?.message}`).toBe(true);
    }
  });

  it("returns the text answer as well as the fields", async () => {
    const r = await call("calculate_gpa", { courses: [{ name: "Calculus", credits: 3, grade: "A" }] });
    expect(r.text).toContain("GPA for these courses: 4.00 across 3 credits");
    expect(r.structured).toBeTruthy();
  });

  it("returns no fields when the tool errors", async () => {
    const r = await call("convert_grade", { grade: "Z", scale: "us4" });
    expect(r.isError).toBe(true);
    expect(r.structured).toBeUndefined();
  });

  it("gives the term GPA and the credits of the courses", async () => {
    const r = await call("calculate_gpa", { courses: [{ name: "Calculus", credits: 3, grade: "A" }, { name: "Physics", credits: 4, grade: "B+" }], scale: "us4" });
    expect(r.structured!.scale).toBe("us4");
    expect(r.structured!.credits).toBe(7);
    expect(r.structured!.term_gpa).toBe(3.6);
    expect(r.structured!.courses).toEqual([
      { name: "Calculus", credits: 3, letter: "A", points: 4, quality_points: 12 },
      { name: "Physics", credits: 4, letter: "B+", points: 3.3, quality_points: 13.2 },
    ]);
  });

  it("gives the cumulative GPA when the earlier work comes as a pair", async () => {
    const r = await call("calculate_gpa", { courses: [{ name: "Calculus", credits: 3, grade: "A" }], prior_gpa: 3.2, prior_credits: 45 });
    expect(r.structured!.term_gpa).toBe(4);
    expect(r.structured!.cumulative_gpa).toBe(3.25);
    expect(r.structured!.cumulative_credits).toBe(48);
  });

  it("leaves the cumulative fields out when there is no earlier work", async () => {
    const r = await call("calculate_gpa", { courses: [{ name: "Calculus", credits: 3, grade: "A" }] });
    expect(r.structured).not.toHaveProperty("cumulative_gpa");
    expect(r.structured).not.toHaveProperty("cumulative_credits");
  });

  it("gives the weighted GPA when a credit multiplier is passed", async () => {
    const r = await call("calculate_gpa", {
      courses: [
        { name: "AP Calculus", credits: 3, grade: "A", credit_multiplier: 1.1 },
        { name: "History", credits: 3, grade: "C" },
      ],
    });
    expect(r.structured!.term_gpa).toBe(3);
    expect(r.structured!.weighted_gpa).toBe(3.05);
    expect(r.structured!.weighted_credits).toBe(6.3);
    expect(r.structured!.courses).toEqual([
      {
        name: "AP Calculus",
        credits: 3,
        letter: "A",
        points: 4,
        quality_points: 12,
        credit_multiplier: 1.1,
        weighted_credits: 3.3,
        weighted_quality_points: 13.2,
      },
      { name: "History", credits: 3, letter: "C", points: 2, quality_points: 6 },
    ]);
  });

  it("leaves the weighted fields out when no course has a multiplier", async () => {
    const r = await call("calculate_gpa", { courses: [{ name: "Calculus", credits: 3, grade: "A" }] });
    expect(r.structured).not.toHaveProperty("weighted_gpa");
    expect(r.structured).not.toHaveProperty("weighted_credits");
    expect(r.structured!.courses).toEqual([{ name: "Calculus", credits: 3, letter: "A", points: 4, quality_points: 12 }]);
  });

  it("gives the letter, the range and the points of a converted grade", async () => {
    const r = await call("convert_grade", { grade: 78, scale: "ontario-college" });
    expect(r.structured!.letter).toBe("B+");
    expect(r.structured!.min_percent).toBe(75);
    expect(r.structured!.max_percent).toBe(79);
    expect(r.structured!.points).toBe(3.5);
  });

  it("gives the nearest band on the target scales", async () => {
    const r = await call("convert_gpa_scale", { gpa: 3.5, from_scale: "us4" });
    expect(r.structured!.from_scale).toBe("us4");
    expect(r.structured!.from_scale_name).toBe("US 4.0 scale");
    expect(r.structured!.from_max_points).toBe(4);
    const conversions = r.structured!.conversions as { scale: string; letter: string; min_percent: number; max_percent: number; points: number }[];
    expect(conversions.map((c) => c.scale)).toEqual(["uk-classification", "australia-hd"]);
    expect(conversions[0].letter).toBe("2:1");
    expect(conversions[0].min_percent).toBe(60);
    expect(conversions[0].max_percent).toBe(69);
    expect(conversions[0].points).toBe(3.3);
    expect(conversions[1].letter).toBe("D");
  });

  it("converts to one target scale when one is passed", async () => {
    const r = await call("convert_gpa_scale", { gpa: 4, from_scale: "us4", to_scale: "australia-hd" });
    const conversions = r.structured!.conversions as { scale: string; letter: string; points: number }[];
    expect(conversions).toHaveLength(1);
    expect(conversions[0].scale).toBe("australia-hd");
    expect(conversions[0].letter).toBe("HD");
    expect(conversions[0].points).toBe(7);
  });

  it("gives the score needed on the final", async () => {
    const r = await call("needed_on_final", { current_percent: 85, final_weight_percent: 40, target_letter: "B+", scale: "us4" });
    expect(r.structured!.target_percent).toBe(87);
    expect(r.structured!.target_letter).toBe("B+");
    expect(r.structured!.letter_min_percent).toBe(87);
    expect(r.structured!.needed_percent).toBe(90);
    expect(r.structured!.possible).toBe(true);
    expect(r.structured!.already_there).toBe(false);
  });

  it("says in the fields that a target is out of reach", async () => {
    const r = await call("needed_on_final", { current_percent: 50, final_weight_percent: 10, target_percent: 90 });
    expect(r.structured!.needed_percent).toBeGreaterThan(100);
    expect(r.structured!.possible).toBe(false);
    expect(r.structured!.already_there).toBe(false);
  });

  it("says in the fields that a target is already reached", async () => {
    const r = await call("needed_on_final", { current_percent: 95, final_weight_percent: 20, target_percent: 60 });
    expect(r.structured!.already_there).toBe(true);
    expect(r.structured!.needed_percent).toBeLessThan(0);
  });

  it("gives the grade so far and the two finishes", async () => {
    const r = await call("weighted_grade", { parts: [{ name: "Quizzes", weight: 20, score: 85 }, { name: "Labs", weight: 30, score: 70 }] });
    expect(r.structured!.total_weight).toBe(50);
    expect(r.structured!.done_weight).toBe(50);
    expect(r.structured!.remaining_weight).toBe(50);
    expect(r.structured!.current_grade).toBe(76);
    expect(r.structured!.earned_points).toBe(38);
    expect(r.structured!.worst_finish).toBe(38);
    expect(r.structured!.best_finish).toBe(88);
    expect(r.structured!.parts).toEqual([
      { name: "Quizzes", weight: 20, score: 85 },
      { name: "Labs", weight: 30, score: 70 },
    ]);
  });

  it("leaves the grade so far empty when nothing is marked", async () => {
    const r = await call("weighted_grade", { parts: [{ name: "Exam", weight: 100 }] });
    expect(r.structured!.current_grade).toBeNull();
    expect(r.structured!.parts).toEqual([{ name: "Exam", weight: 100, score: null }]);
  });

  it("gives the GPA needed on the upcoming credits", async () => {
    const r = await call("target_gpa_planner", { current_gpa: 3.1, credits_completed: 60, target_gpa: 3.4, upcoming_credits: 15, scale: "us4" });
    expect(r.structured!.needed_gpa).toBe(4.6);
    expect(r.structured!.max_points).toBe(4);
    expect(r.structured!.possible).toBe(false);
    expect(r.structured!.already_there).toBe(false);
  });

  it("gives the grade each upcoming course needs", async () => {
    const r = await call("plan_courses", {
      current_gpa: 3.4,
      credits_completed: 60,
      target_gpa: 3.5,
      courses: [
        { name: "Calculus", credits: 3 },
        { name: "Physics", credits: 3 },
        { name: "History", credits: 3 },
        { name: "Spanish", credits: 3 },
      ],
      scale: "us4",
    });
    expect(r.structured!.upcoming_credits).toBe(12);
    expect(r.structured!.needed_gpa).toBe(4);
    expect(r.structured!.possible).toBe(true);
    expect(r.structured!.courses).toEqual([
      { name: "Calculus", credits: 3, target_letter: "A", target_min_percent: 93, target_points: 4 },
      { name: "Physics", credits: 3, target_letter: "A", target_min_percent: 93, target_points: 4 },
      { name: "History", credits: 3, target_letter: "A", target_min_percent: 93, target_points: 4 },
      { name: "Spanish", credits: 3, target_letter: "A", target_min_percent: 93, target_points: 4 },
    ]);
  });

  it("leaves the per course target out when the target is out of reach", async () => {
    const r = await call("plan_courses", {
      current_gpa: 3.1,
      credits_completed: 60,
      target_gpa: 3.5,
      courses: [{ name: "Calculus", credits: 3 }],
      scale: "us4",
    });
    expect(r.structured!.possible).toBe(false);
    expect(r.structured!.courses).toEqual([{ name: "Calculus", credits: 3 }]);
  });

  it("gives every scale with its bands", async () => {
    const r = await call("list_scales");
    const scales = r.structured!.scales as { id: string; name: string; bands: { letter: string; min_percent: number; max_percent: number; points: number }[] }[];
    expect(scales.map((s) => s.id)).toEqual(["us4", "us4plus", "ontario-college", "uk-classification", "australia-hd", "weighted-5.0"]);
    const us4 = scales[0];
    expect(us4.name).toBe("US 4.0 scale");
    expect(us4.bands[0]).toEqual({ letter: "A", min_percent: 93, max_percent: 100, points: 4 });
  });
});

describe("calculate_gpa excluded courses", () => {
  it("returns excluded_courses and gpa_credits for P and W rows", async () => {
    const r = await call("calculate_gpa", { transcript_csv: "Course,Credits,Grade\nCalculus,4,A\nYoga,2,P\nArt,3,W", scale: "us4" });
    expect(r.isError).toBe(false);
    expect(r.structured!.gpa_credits).toBe(4);
    expect(r.structured!.term_gpa).toBe(4);
    expect(r.structured!.excluded_courses).toEqual([
      { name: "Yoga", credits: 2, grade: "P" },
      { name: "Art", credits: 3, grade: "W" },
    ]);
    outputSchemaOf("calculate_gpa").parse(r.structured);
  });

  it("returns an empty excluded_courses when every course is graded", async () => {
    const r = await call("calculate_gpa", { courses: [{ name: "Calculus", credits: 3, grade: "A" }] });
    expect(r.structured!.excluded_courses).toEqual([]);
    expect(r.structured!.gpa_credits).toBe(3);
  });
});
