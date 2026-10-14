import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { SCALES, bandFor, gpa, neededOnFinal, targetGpaPlanner, weighted, type ScaleId } from "./grades.js";

type Api = null;

const scale = z
  .enum(["us4", "us4plus", "ontario-college"])
  .default("us4")
  .describe("Grade scale. Use list_scales to see the tables. Ask the student which one their school uses if unsure.");
const grade = z.union([z.string(), z.number()]).describe('A letter like "B+" or a percentage like 87 or "87%".');

export const tools: ToolDef<Api>[] = [
  {
    name: "calculate_gpa",
    title: "Calculate GPA",
    description:
      "Work out a GPA from a list of courses with credits and grades. Optionally combine with an earlier GPA and credit total to get a cumulative GPA.",
    inputSchema: {
      courses: z.array(z.object({ name: z.string().optional(), credits: z.number(), grade })).min(1).describe("The courses to include."),
      scale,
      prior_gpa: z.number().min(0).max(5).optional().describe("GPA from earlier terms, if combining."),
      prior_credits: z.number().min(0).optional().describe("Credits from earlier terms, if combining."),
    },
    run: async (a) => {
      const prior = a.prior_gpa !== undefined && a.prior_credits !== undefined ? { gpa: a.prior_gpa, credits: a.prior_credits } : undefined;
      const r = gpa(a.courses, a.scale as ScaleId, prior);
      const lines = r.rows.map((c) => `${c.name}: ${c.letter}, ${c.points.toFixed(1)} points x ${c.credits} credits`);
      let out = `${bullets(lines)}\n\nGPA for these courses: ${r.term.toFixed(2)} across ${r.credits} credits (${SCALES[a.scale as ScaleId].name}).`;
      if (r.cumulative !== undefined) out += `\nCumulative GPA with earlier work: ${r.cumulative.toFixed(2)} across ${r.cumulativeCredits} credits.`;
      return out;
    },
  },
  {
    name: "convert_grade",
    title: "Convert a grade",
    description: "Convert a letter or percentage into the matching letter, percentage range and grade points on a scale.",
    inputSchema: { grade, scale },
    run: async (a) => {
      const b = bandFor(a.scale as ScaleId, a.grade);
      return `${a.grade} is ${b.letter} on the ${SCALES[a.scale as ScaleId].name}. That letter covers ${b.min} to ${b.max} percent and is worth ${b.points.toFixed(1)} grade points.`;
    },
  },
  {
    name: "needed_on_final",
    title: "What do I need on the final",
    description:
      "Find the score needed on a final exam or last assignment to reach a target course grade. The current grade is the average on all the other work, which counts for the rest of the course.",
    inputSchema: {
      current_percent: z.number().min(0).max(100).describe("Current grade on the work already done, as a percentage."),
      final_weight_percent: z.number().gt(0).max(100).describe("How much the final is worth, as a percentage of the whole course."),
      target_percent: z.number().min(0).max(100).describe("The course grade you want, as a percentage."),
    },
    run: async (a) => {
      const r = neededOnFinal(a.current_percent, a.final_weight_percent, a.target_percent);
      if (r.alreadyThere) return `You already have the ${a.target_percent}% locked in. Even a 0 on the final keeps you at or above it.`;
      if (!r.possible) return `You would need ${r.needed}% on the final, which is more than 100%. ${a.target_percent}% is out of reach with this weighting.`;
      return `You need ${r.needed}% on the final (worth ${a.final_weight_percent}%) to finish with ${a.target_percent}%, starting from ${a.current_percent}% on the rest.`;
    },
  },
  {
    name: "weighted_grade",
    title: "Weighted grade",
    description:
      "Grade so far, plus the best and worst possible finish, from weighted course parts. Leave the score out for parts that are not marked yet.",
    inputSchema: {
      parts: z.array(z.object({ name: z.string(), weight: z.number().gt(0), score: z.number().min(0).max(100).nullable().optional() })).min(1),
    },
    run: async (a) => {
      const r = weighted(a.parts);
      const lines = a.parts.map((p: any) => `${p.name}: weight ${p.weight}%, ${p.score == null ? "not marked yet" : `${p.score}%`}`);
      const now = r.currentGrade === null ? "Nothing is marked yet." : `Grade so far: ${r.currentGrade}% on the ${r.doneWeight}% of the course that is marked.`;
      return `${bullets(lines)}\n\n${now}\nIf you score 0 on everything left you finish at ${r.worstFinish}%. If you score 100 on everything left you finish at ${r.bestFinish}%. ${r.remainingWeight}% of the course is still to come.`;
    },
  },
  {
    name: "target_gpa_planner",
    title: "Target GPA planner",
    description: "Find the GPA you need on upcoming credits to reach a target cumulative GPA.",
    inputSchema: {
      current_gpa: z.number().min(0).max(5),
      credits_completed: z.number().min(0),
      target_gpa: z.number().min(0).max(5),
      upcoming_credits: z.number().gt(0),
      scale,
    },
    run: async (a) => {
      const max = Math.max(...SCALES[a.scale as ScaleId].bands.map((b) => b.points));
      const r = targetGpaPlanner(a.current_gpa, a.credits_completed, a.target_gpa, a.upcoming_credits, max);
      if (r.alreadyThere) return `You are already above ${a.target_gpa}. Even a 0.0 over the next ${a.upcoming_credits} credits keeps you at or above it.`;
      if (!r.possible) return `You would need ${r.needed} on the next ${a.upcoming_credits} credits, but the top of this scale is ${max.toFixed(1)}. Reaching ${a.target_gpa} would take more than one term.`;
      return `You need a ${r.needed.toFixed(2)} GPA on the next ${a.upcoming_credits} credits to reach a cumulative ${a.target_gpa} (from ${a.current_gpa} over ${a.credits_completed} credits).`;
    },
  },
  {
    name: "list_scales",
    title: "List grade scales",
    description: "Show the built in grade scales with their letters, percentage ranges and grade points.",
    inputSchema: {},
    run: async () =>
      (Object.keys(SCALES) as ScaleId[])
        .map((id) => `${id}, ${SCALES[id].name}\n${SCALES[id].bands.map((b) => `  ${b.letter}  ${b.min}-${b.max}%  ${b.points.toFixed(1)}`).join("\n")}`)
        .join("\n\n") + ``,
  },
];
