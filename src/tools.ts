import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { SCALES, bandFor, gpa, neededOnFinal, resolveTarget, targetGpaPlanner, weighted, type ScaleId, isScaleId, assertScale } from "./grades.js";

type Api = null;

const scale = z
  .string()
  .default("us4")
  .describe(
    'Grade scale id: "us4", "us4plus", "ontario-college", "uk-classification", "australia-hd" or "weighted-5.0". ' +
      'Defaults to "us4". Ask the student which one their school uses if unsure.',
  );
const grade = z.union([z.string(), z.number()]).describe('A letter like "B+" or a percentage like 87 or "87%".');

export const tools: ToolDef<Api>[] = [
  {
    name: "calculate_gpa",
    title: "Calculate GPA",
    description:
      "Calculate a GPA from a list of courses with credits and grades, optionally combined with an earlier GPA and credit total. " +
      "The GPA for the courses you pass is the term GPA, and adding earlier work with prior_gpa and prior_credits gives the cumulative GPA. " +
      "Inputs: courses (each with credits greater than 0 and a grade that is a letter like \"B+\" or a percentage like 87), a scale id, and optional prior_gpa and prior_credits to fold in earlier terms. " +
      'Example prompt: "What\'s my GPA if I got an A in 3 credits, a B+ in 4 credits and a C in 3 credits?"',
    inputSchema: {
      courses: z
        .array(z.object({ name: z.string().optional(), credits: z.number(), grade }))
        .min(1)
        .describe("The courses to include. Each needs credits (greater than 0) and a grade (a letter like \"B+\" or a percentage like 87). name is optional."),
      scale,
      prior_gpa: z.number().min(0).max(7).optional().describe("GPA from earlier terms, 0 to 7. Pass this together with prior_credits to get a cumulative GPA."),
      prior_credits: z.number().min(0).optional().describe("Credits from earlier terms, 0 or more. Pass this together with prior_gpa to get a cumulative GPA."),
    },
    run: async (a) => {
      const prior = a.prior_gpa !== undefined && a.prior_credits !== undefined ? { gpa: a.prior_gpa, credits: a.prior_credits } : undefined;
      const scaleId = assertScale(a.scale);
      const r = gpa(a.courses, scaleId, prior);
      const lines = r.rows.map((c) => `${c.name}: ${c.letter}, ${c.points.toFixed(1)} points x ${c.credits} credits`);
      let out = `${bullets(lines)}\n\nGPA for these courses: ${r.term.toFixed(2)} across ${r.credits} credits (${SCALES[scaleId].name}).`;
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
      const scaleId = assertScale(a.scale);
      const b = bandFor(scaleId, a.grade);
      return `${a.grade} is ${b.letter} on the ${SCALES[scaleId].name}. That letter covers ${b.min} to ${b.max} percent and is worth ${b.points.toFixed(1)} grade points.`;
    },
  },
  {
    name: "needed_on_final",
    title: "What do I need on the final",
    description:
      "Calculate the score needed on a final exam or last assignment to reach a target course grade. " +
      "Inputs: current_percent (the average on all the other work, 0 to 100), final_weight_percent (how much the final is worth, greater than 0 and at most 100) and a target. " +
      "Give the target as target_percent (the course grade you want, 0 to 100), as target_letter (a letter like \"B+\" or a class like \"2:1\", whose cutoff comes from the scale table), or as both. " +
      "The scale id sets the table the letter cutoff comes from. " +
      "Says so when the target is already locked in or out of reach. " +
      'Example prompt: "My grade is 85% and the final is worth 40% of the course. What do I need on the final to finish with a B+?"',
    inputSchema: {
      current_percent: z.number().min(0).max(100).describe("Current grade on the work already done, as a percentage between 0 and 100."),
      final_weight_percent: z.number().gt(0).max(100).describe("How much the final is worth, greater than 0 and at most 100, as a percentage of the whole course."),
      target_percent: z.number().min(0).max(100).optional().describe("The course grade you want to finish with, as a percentage between 0 and 100. Leave it out when you pass target_letter."),
      target_letter: z.string().optional().describe('The letter grade you want to finish with, like "B+" or "2:1", read from the scale table. Leave it out when you pass target_percent.'),
      scale,
    },
    run: async (a) => {
      const scaleId = assertScale(a.scale);
      const target = resolveTarget(scaleId, { percent: a.target_percent, letter: a.target_letter });
      const r = neededOnFinal(a.current_percent, a.final_weight_percent, target.percent);
      const band = target.band;
      const scaleName = SCALES[scaleId].name;
      if (!band) {
        if (r.alreadyThere) return `You already have the ${target.percent}% locked in. Even a 0 on the final keeps you at or above it.`;
        if (!r.possible) return `You would need ${r.needed}% on the final, which is more than 100%. ${target.percent}% is out of reach with this weighting.`;
        return `You need ${r.needed}% on the final (worth ${a.final_weight_percent}%) to finish with ${target.percent}%, starting from ${a.current_percent}% on the rest.`;
      }
      // The letter cutoff is the goal, unless the student also asked for a higher percent.
      if (target.percent > band.min) {
        const note = `${band.letter} starts at ${band.min}% on the ${scaleName}`;
        if (r.alreadyThere) return `You already have ${target.percent}% locked in (${note}). Even a 0 on the final keeps you at or above it.`;
        if (!r.possible) return `You would need ${r.needed}% on the final, which is more than 100%. ${target.percent}% (${note}) is out of reach with this weighting.`;
        return `You need ${r.needed}% on the final (worth ${a.final_weight_percent}%) to finish with ${target.percent}% (${note}), starting from ${a.current_percent}% on the rest.`;
      }
      const goal = `the grade ${band.letter}`;
      if (r.alreadyThere) return `You already have ${goal} locked in. It starts at ${band.min}% on the ${scaleName}, and even a 0 on the final keeps you at or above it.`;
      if (!r.possible) return `You would need ${r.needed}% on the final, which is more than 100%. The grade ${band.letter} starts at ${band.min}% on the ${scaleName}, so it is out of reach with this weighting.`;
      return `You need ${r.needed}% on the final (worth ${a.final_weight_percent}%) to finish with ${goal}, which starts at ${band.min}% on the ${scaleName}. You have ${a.current_percent}% on the rest of the course.`;
    },
  },
  {
    name: "weighted_grade",
    title: "Weighted grade",
    description:
      "Combine weighted course parts into the grade so far, plus the worst and best possible finish. " +
      "Inputs: parts (each with a name, a weight that is a percentage of the whole course greater than 0, and an optional score between 0 and 100; leave the score out for parts that are not marked yet). " +
      "A weight is a percentage of the whole course, so the parts are never rescaled. Parts that add up to less than 100 leave the rest of the course still to come, and weights that add up to more than 100 are an error. " +
      'Example prompt: "My course is 20% quizzes, 30% labs, 50% exam. I have 85 on quizzes and 70 on labs. What\'s my grade so far and what\'s the best I can finish with?"',
    inputSchema: {
      parts: z
        .array(
          z.object({
            name: z.string().describe("Name of the course part."),
            weight: z.number().gt(0).describe("Weight as a percentage of the whole course, greater than 0."),
            score: z.number().min(0).max(100).nullable().optional().describe("Score between 0 and 100 for marked parts, or leave out for unmarked parts."),
          }),
        )
        .min(1)
        .describe(
          'The weighted parts of the course. Each needs a name and a weight (a percentage of the whole course greater than 0); score is 0 to 100, or leave it out for parts that are not marked yet. ' +
            "Weights are percentages of the whole course, so parts that add up to less than 100 leave the rest of the course still to come.",
        ),
    },
    run: async (a) => {
      const r = weighted(a.parts);
      const lines = a.parts.map((p: any) => `${p.name}: weight ${p.weight}%, ${p.score == null ? "not marked yet" : `${p.score}%`}`);
      let now = "Nothing is marked yet.";
      if (r.currentGrade !== null) {
        now = `Grade so far: ${r.currentGrade}% on the ${r.doneWeight}% of the course that is marked.`;
        if (r.doneWeight < 100) now += ` That banks ${r.earnedPoints} of the 100 points the course is worth.`;
      }
      return `${bullets(lines)}\n\n${now}\nIf you score 0 on everything left you finish at ${r.worstFinish}%. If you score 100 on everything left you finish at ${r.bestFinish}%. ${r.remainingWeight}% of the course is still to come.`;
    },
  },
  {
    name: "target_gpa_planner",
    title: "Target GPA planner",
    description:
      "Plan the GPA needed on upcoming credits to reach a target cumulative GPA. " +
      "Inputs: current_gpa (0 to 7), credits_completed (0 or more), target_gpa (0 to 7), upcoming_credits (greater than 0) and a scale id, which sets the top grade point the scale allows. " +
      "Says so when the target is already reached or would take more than one term. " +
      'Example prompt: "I have a 3.1 GPA over 60 credits. What GPA do I need next semester to reach 3.4?"',
    inputSchema: {
      current_gpa: z.number().min(0).max(7).describe("Your cumulative GPA so far, between 0 and 7."),
      credits_completed: z.number().min(0).describe("Credits already completed, 0 or more."),
      target_gpa: z.number().min(0).max(7).describe("The cumulative GPA you want to reach, between 0 and 7."),
      upcoming_credits: z.number().gt(0).describe("Credits you will take next, greater than 0."),
      scale,
    },
    run: async (a) => {
      const scaleId = assertScale(a.scale);
      const max = Math.max(...SCALES[scaleId].bands.map((b) => b.points));
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
