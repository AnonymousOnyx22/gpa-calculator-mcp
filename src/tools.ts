import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { SCALES, bandFor, gpa, neededOnFinal, targetGpaPlanner, weighted, type ScaleId } from "./grades.js";

type Api = null;

const scale = z
  .enum(["us4", "us4plus", "ontario-college"])
  .default("us4")
  .describe('Grade scale id: "us4", "us4plus" or "ontario-college". Defaults to "us4". Ask the student which one their school uses if unsure.');
const grade = z.union([z.string(), z.number()]).describe('A letter like "B+" or a percentage like 87 or "87%".');

export const tools: ToolDef<Api>[] = [
  {
    name: "calculate_gpa",
    title: "Calculate GPA",
    description:
      "Calculate a GPA from a list of courses with credits and grades, optionally combined with an earlier GPA and credit total. " +
      "Inputs: courses (each with credits greater than 0 and a grade that is a letter like \"B+\" or a percentage like 87), a scale id, and optional prior_gpa and prior_credits to fold in earlier terms. " +
      'Example prompt: "What\'s my GPA if I got an A in 3 credits, a B+ in 4 credits and a C in 3 credits?"',
    inputSchema: {
      courses: z
        .array(z.object({ name: z.string().optional(), credits: z.number(), grade }))
        .min(1)
        .describe("The courses to include. Each needs credits (greater than 0) and a grade (a letter like \"B+\" or a percentage like 87). name is optional."),
      scale,
      prior_gpa: z.number().min(0).max(5).optional().describe("GPA from earlier terms, 0 to 5. Pass this together with prior_credits to get a cumulative GPA."),
      prior_credits: z.number().min(0).optional().describe("Credits from earlier terms, 0 or more. Pass this together with prior_gpa to get a cumulative GPA."),
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
    description:
      "Convert a letter or percentage into the matching letter, percentage range and grade points on a grade scale. " +
      "Inputs: grade (a letter like \"B+\" or a percentage like 87 or \"87%\") and a scale id. " +
      'Example prompt: "Convert 78 percent to a letter grade on the Ontario college scale."',
    inputSchema: {
      grade,
      scale,
    },
    run: async (a) => {
      const b = bandFor(a.scale as ScaleId, a.grade);
      return `${a.grade} is ${b.letter} on the ${SCALES[a.scale as ScaleId].name}. That letter covers ${b.min} to ${b.max} percent and is worth ${b.points.toFixed(1)} grade points.`;
    },
  },
  {
    name: "needed_on_final",
    title: "What do I need on the final",
    description:
      "Calculate the score needed on a final exam or last assignment to reach a target course grade. " +
      "Inputs: current_percent (the average on all the other work, 0 to 100), final_weight_percent (how much the final is worth, greater than 0 and at most 100) and target_percent (the course grade you want, 0 to 100). " +
      "Says so when the target is already locked in or out of reach. " +
      'Example prompt: "My grade is 74% and the final is worth 40% of the course. What do I need on the final to finish with 80%?"',
    inputSchema: {
      current_percent: z.number().min(0).max(100).describe("Current grade on the work already done, as a percentage between 0 and 100."),
      final_weight_percent: z.number().gt(0).max(100).describe("How much the final is worth, greater than 0 and at most 100, as a percentage of the whole course."),
      target_percent: z.number().min(0).max(100).describe("The course grade you want to finish with, as a percentage between 0 and 100."),
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
      "Combine weighted course parts into the grade so far, plus the worst and best possible finish. " +
      "Inputs: parts (each with a name, a weight that is a percentage greater than 0, and an optional score between 0 and 100; leave the score out for parts that are not marked yet). " +
      'Example prompt: "My course is 20% quizzes, 30% labs, 50% exam. I have 85 on quizzes and 70 on labs. What\'s my grade so far and what\'s the best I can finish with?"',
    inputSchema: {
      parts: z
        .array(z.object({ name: z.string(), weight: z.number().gt(0), score: z.number().min(0).max(100).nullable().optional() }))
        .min(1)
        .describe('The weighted parts of the course. Each needs a name and a weight (a percentage greater than 0); score is 0 to 100, or leave it out for parts that are not marked yet.'),
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
    description:
      "Plan the GPA needed on upcoming credits to reach a target cumulative GPA. " +
      "Inputs: current_gpa (0 to 5), credits_completed (0 or more), target_gpa (0 to 5), upcoming_credits (greater than 0) and a scale id, which sets the top grade point the scale allows. " +
      "Says so when the target is already reached or would take more than one term. " +
      'Example prompt: "I have a 3.1 GPA over 60 credits. What GPA do I need next semester to reach 3.4?"',
    inputSchema: {
      current_gpa: z.number().min(0).max(5).describe("Your cumulative GPA so far, between 0 and 5."),
      credits_completed: z.number().min(0).describe("Credits already completed, 0 or more."),
      target_gpa: z.number().min(0).max(5).describe("The cumulative GPA you want to reach, between 0 and 5."),
      upcoming_credits: z.number().gt(0).describe("Credits you will take next, greater than 0."),
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
    description:
      "List the built-in grade scales with their letters, percentage ranges and grade points. " +
      "Inputs: none. " +
      'Example prompt: "Show me the grade scales you have built in."',
    inputSchema: {},
    run: async () =>
      (Object.keys(SCALES) as ScaleId[])
        .map((id) => `${id}, ${SCALES[id].name}\n${SCALES[id].bands.map((b) => `  ${b.letter}  ${b.min}-${b.max}%  ${b.points.toFixed(1)}`).join("\n")}`)
        .join("\n\n") + ``,
  },
];
