import { z } from "zod";
import { type ToolDef, bullets } from "./core/tools.js";
import { SCALES, bandFor, convertGpaScale, gpa, hasGradePoints, maxPoints, neededOnFinal, neededOnRemaining, parseTranscriptCsv, planCourseTargets, resolvePrior, resolveTarget, targetGpaPlanner, weighted, type ScaleId, type TranscriptCsvRow, isScaleId, assertScale } from "./grades.js";

type Api = null;

// The six scale ids, taken from the tables so the schema and the code cannot drift apart.
const SCALE_IDS = Object.keys(SCALES) as [ScaleId, ...ScaleId[]];

const scale = z
  .enum(SCALE_IDS)
  .default("us4")
  .describe(
    'Grade scale id: "us4", "us4plus", "ontario-college", "uk-classification", "australia-hd" or "weighted-5.0". ' +
      'Defaults to "us4". Ask the student which one their school uses if unsure.',
  );
const grade = z.union([z.string(), z.number()]).describe('A letter like "B+" or a percentage like 87 or "87%".');

// The shapes of the fields the tools return. Every tool has one, so a client that reads
// JSON gets the numbers without taking them out of the sentence.
const gpaCourseFields = z.object({
  name: z.string().describe("Name of the course."),
  credits: z.number().describe("Credits for the course."),
  letter: z.string().describe("The letter the course counts as on the scale."),
  points: z.number().describe("Grade points the letter is worth on the scale."),
  quality_points: z.number().describe("Grade points times credits, what the course adds to the total."),
  credit_multiplier: z.number().optional().describe("The credit multiplier of the course, when one other than 1 was passed."),
  weighted_credits: z.number().optional().describe("Credits times the credit multiplier, when a multiplier other than 1 was passed."),
  weighted_quality_points: z.number().optional().describe("Grade points times the weighted credits, when a multiplier other than 1 was passed."),
});

const partFields = z.object({
  name: z.string().describe("Name of the course part."),
  weight: z.number().describe("Weight of the part as a percentage of the whole course."),
  score: z.number().nullable().describe("Score on the part, or null when the part is not marked yet."),
});

const bandFields = z.object({
  letter: z.string().describe("The letter of the band."),
  min_percent: z.number().describe("The lowest percentage in the band."),
  max_percent: z.number().describe("The highest percentage in the band."),
  points: z.number().describe("Grade points the band is worth."),
});

export const tools: ToolDef<Api>[] = [
  {
    name: "calculate_gpa",
    title: "Calculate GPA",
    description:
      "Calculate a GPA from a list of courses with credits and grades, optionally weighted with a credit multiplier on each course, and optionally combined with an earlier GPA and credit total. " +
      "The GPA for the courses you pass is the term GPA, and adding earlier work with prior_gpa and prior_credits gives the cumulative GPA. " +
      "Inputs: courses (each with credits greater than 0, a grade that is a letter like \"B+\" or a percentage like 87, and an optional credit_multiplier greater than 0 such as 1.1 for an AP class), a scale id, and optional prior_gpa and prior_credits to fold in earlier terms. " +
      "A credit_multiplier above 1 gives a course more weight in the weighted GPA, and when any course has one other than 1 the tool also returns weighted_gpa and weighted_credits. The term GPA still uses the plain credits. " +
      "Pass drop_lowest to leave the lowest graded courses out of the GPA, as schools do that drop the lowest course; the dropped courses are named in dropped_courses. " +
      "Pass prior_gpa and prior_credits together, or leave both out. Passing only one of the two is an error, so the tool says which one is missing. " +
      "Alternatively, pass transcript_csv as a CSV string with columns for course name, credits, grade and optional credit multiplier; a header row is optional, the columns can be in any order, and header names like Course Title, Final Grade and Credit Hours are read as the name, grade and credits columns. " +
      "When courses is not given, transcript_csv is parsed and used as the course list. " +
      "In transcript_csv, a P is read as pass, NP as not pass and W as withdrawn. Those rows are left out of the GPA and named in the answer, except where the scale gives the letter points, such as P on australia-hd. " +
      'Example prompt: "What\'s my GPA if I got an A in 3 credits, a B+ in 4 credits and a C in 3 credits?"',
    inputSchema: {
      courses: z
        .array(
          z.object({
            name: z.string().optional(),
            credits: z.number(),
            grade: grade.optional(),
            credit_multiplier: z
              .number()
              .gt(0)
              .optional()
              .describe("Optional multiplier on the credits for a weighted GPA, greater than 0, like 1.1 for an AP class. Defaults to 1."),
          }),
        )
        .min(1)
        .optional()
        .describe(
          "The courses to include. Each needs credits (greater than 0) and a grade (a letter like \"B+\" or a percentage like 87). name is optional, and so is credit_multiplier (greater than 0), which gives a course more weight in the weighted GPA. Required when transcript_csv is not given.",
        ),
      transcript_csv: z
        .string()
        .optional()
        .describe(
          "A CSV string with columns for course name, credits, grade and optional credit multiplier. A header row is optional, the columns can be in any order, and header names like Course Title, Final Grade and Credit Hours are read as the name, grade and credits columns. P, NP and W grades are left out of the GPA. When courses is not given, this is parsed and used as the course list. Example: \"Course,Credits,Grade\\nCalculus,4,A\\nHistory,3,B+\"",
        ),
      scale,
      prior_gpa: z.number().min(0).max(7).optional().describe("GPA from earlier terms, 0 to 7. Pass this together with prior_credits to get a cumulative GPA. Passing only one of the two is an error."),
      prior_credits: z.number().min(0).optional().describe("Credits from earlier terms, 0 or more. Pass this together with prior_gpa to get a cumulative GPA. Passing only one of the two is an error."),
      drop_lowest: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Number of courses with the lowest grade points to leave out of the GPA, 0 or more, for schools that drop the lowest course. It must be less than the number of graded courses. Ties go to the course listed first. Defaults to 0."),
    },
    outputSchema: {
      scale: z.string().describe("The scale id the courses were marked on."),
      scale_name: z.string().describe("The name of the scale the courses were marked on."),
      courses: z.array(gpaCourseFields).describe("One entry per graded course, in the order they were passed."),
      credits: z.number().describe("The credits of the graded courses in this call."),
      term_gpa: z.number().describe("The GPA for these courses alone."),
      gpa_credits: z.number().describe("The credits that count in the GPA, the same graded credits the term GPA is divided by. Excluded courses add nothing here."),
      excluded_courses: z
        .array(
          z.object({
            name: z.string().describe("Name of the course left out of the GPA."),
            credits: z.number().describe("Credits of the course left out."),
            grade: z.string().describe("The grade that kept the course out of the GPA, such as P, NP or W."),
          }),
        )
        .describe("Courses left out of the GPA because they are not graded, such as P, NP and W rows in transcript_csv. Empty when none were left out."),
      dropped_courses: z
        .array(
          z.object({
            name: z.string().describe("Name of the course dropped."),
            credits: z.number().describe("Credits of the course dropped."),
            grade: z.string().describe("The letter the dropped course counted as on the scale."),
          }),
        )
        .describe("Courses left out because of drop_lowest. Empty when drop_lowest is 0 or not passed."),
      weighted_gpa: z.number().optional().describe("The GPA with each course's credits multiplied by its credit_multiplier, when at least one multiplier other than 1 was passed. It covers the courses in this call, not the earlier terms."),
      weighted_credits: z.number().optional().describe("The credits after the credit multipliers are applied, when at least one multiplier other than 1 was passed."),
      cumulative_gpa: z.number().optional().describe("The GPA with the earlier terms folded in, when prior_gpa and prior_credits were both passed."),
      cumulative_credits: z.number().optional().describe("The credits of these courses and the earlier terms together, when prior_gpa and prior_credits were both passed."),
    },
    run: async (a) => {
      const prior = resolvePrior(a.prior_gpa, a.prior_credits);
      const scaleId = assertScale(a.scale);
      let courses = a.courses;
      const notCounted: TranscriptCsvRow[] = [];
      if (!courses && a.transcript_csv) {
        const parsed = parseTranscriptCsv(a.transcript_csv);
        const counted = parsed.filter((c) => {
          // P, NP and W are left out of the GPA unless the scale lists the letter, as australia-hd does for P
          if (c.countsTowardGpa !== false || hasGradePoints(scaleId, c.grade)) return true;
          notCounted.push(c);
          return false;
        });
        courses = counted.map((c) => ({
          name: c.name,
          credits: c.credits,
          grade: c.grade,
          credit_multiplier: c.creditMultiplier,
        }));
      }
      if (notCounted.length > 0 && (!courses || courses.length === 0)) {
        const found = notCounted.map((c) => `${c.name ?? "Course"} (${c.grade})`).join(", ");
        throw new Error(
          `This transcript has no graded courses. All ${notCounted.length} row${notCounted.length === 1 ? " is" : "s are"} P, NP or W, which are left out of the GPA: ${found}. ` +
            "Pass courses with a letter or percentage grade, or use a transcript_csv that includes graded rows.",
        );
      }
      if (!courses || courses.length === 0) {
        throw new Error("Pass courses or transcript_csv with at least one course.");
      }
      const dropped: { name: string; credits: number; grade: string }[] = [];
      const dropCount = a.drop_lowest ?? 0;
      if (dropCount > 0) {
        if (dropCount >= courses.length) {
          throw new Error(`drop_lowest is ${dropCount} but only ${courses.length} graded course${courses.length === 1 ? "" : "s"} were passed. Pass a smaller number so at least one course is left.`);
        }
        const ranked: { i: number; band: ReturnType<typeof bandFor> }[] = courses.map((c: any, i: number) => ({ i, band: bandFor(scaleId, c.grade) }));
        ranked.sort((x, y) => x.band.points - y.band.points || x.i - y.i);
        const dropIdx = new Set(ranked.slice(0, dropCount).map((x) => x.i));
        courses.forEach((c: any, i: number) => {
          if (dropIdx.has(i)) dropped.push({ name: c.name ?? `Course ${i + 1}`, credits: c.credits, grade: ranked.find((x) => x.i === i)!.band.letter });
        });
        courses = courses.filter((_: any, i: number) => !dropIdx.has(i));
      }
      const r = gpa(
        courses.map((c: any) => ({
          name: c.name,
          credits: c.credits,
          grade: c.grade,
          creditMultiplier: c.credit_multiplier,
        })),
        scaleId,
        prior,
      );
      const lines = r.rows.map((c) => {
        const base = `${c.name}: ${c.letter}, ${c.points.toFixed(1)} points x ${c.credits} credits`;
        return c.creditMultiplier === 1 ? base : `${base} x ${c.creditMultiplier} multiplier`;
      });
      let out = `${bullets(lines)}\n\nGPA for these courses: ${r.term.toFixed(2)} across ${r.credits} credits (${SCALES[scaleId].name}).`;
      if (r.weightedGpa !== undefined && r.weightedCredits !== undefined) {
        out += `\nWeighted GPA with the credit multipliers: ${r.weightedGpa.toFixed(2)} across ${r.weightedCredits} weighted credits.`;
      }
      if (r.cumulative !== undefined) out += `\nCumulative GPA with earlier work: ${r.cumulative.toFixed(2)} across ${r.cumulativeCredits} credits.`;
      if (dropped.length > 0) {
        out += `\nDropped as the lowest: ${dropped.map((c) => `${c.name} (${c.grade}, ${c.credits} credits)`).join(", ")}.`;
      }
      if (notCounted.length > 0) {
        const skipped = notCounted.map((c) => `${c.name ?? "Course"} (${c.grade}, ${c.credits} credits)`).join(", ");
        out += `\nNot counted in the GPA: ${skipped}.`;
      }
      const structured: Record<string, unknown> = {
        scale: scaleId,
        scale_name: SCALES[scaleId].name,
        courses: r.rows.map((c) => {
          const row: Record<string, unknown> = {
            name: c.name,
            credits: c.credits,
            letter: c.letter,
            points: c.points,
            quality_points: c.quality,
          };
          if (c.creditMultiplier !== 1) {
            row.credit_multiplier = c.creditMultiplier;
            row.weighted_credits = Math.round(c.credits * c.creditMultiplier * 100) / 100;
            row.weighted_quality_points = Math.round(c.quality * c.creditMultiplier * 100) / 100;
          }
          return row;
        }),
        credits: r.credits,
        term_gpa: r.term,
        gpa_credits: r.credits,
        excluded_courses: notCounted.map((c) => ({ name: c.name ?? "Course", credits: c.credits, grade: String(c.grade) })),
        dropped_courses: dropped,
      };
      if (r.weightedGpa !== undefined && r.weightedCredits !== undefined) {
        structured.weighted_gpa = r.weightedGpa;
        structured.weighted_credits = r.weightedCredits;
      }
      if (r.cumulative !== undefined && r.cumulativeCredits !== undefined) {
        structured.cumulative_gpa = r.cumulative;
        structured.cumulative_credits = r.cumulativeCredits;
      }
      return { text: out, structured };
    },
  },
  {
    name: "convert_grade",
    title: "Convert a grade",
    description:
      "Convert a letter or percentage into the matching letter, percentage range and grade points on a grade scale. " +
      "Inputs: grade (a letter like \"B+\" or a percentage like 87 or \"87%\") and a scale id. " +
      "If the letter is not on the chosen scale, the error lists the valid letters for that scale. " +
      'Example prompt: "Convert 78 percent to a letter grade on the Ontario college scale."',
    inputSchema: {
      grade,
      scale,
    },
    outputSchema: {
      scale: z.string().describe("The scale id the grade was converted on."),
      scale_name: z.string().describe("The name of the scale the grade was converted on."),
      letter: z.string().describe("The letter the grade matches on the scale."),
      min_percent: z.number().describe("The lowest percentage the letter covers."),
      max_percent: z.number().describe("The highest percentage the letter covers."),
      points: z.number().describe("Grade points the letter is worth on the scale."),
    },
    run: async (a) => {
      const scaleId = assertScale(a.scale);
      const b = bandFor(scaleId, a.grade);
      return {
        text: `${a.grade} is ${b.letter} on the ${SCALES[scaleId].name}. That letter covers ${b.min} to ${b.max} percent and is worth ${b.points.toFixed(1)} grade points.`,
        structured: {
          scale: scaleId,
          scale_name: SCALES[scaleId].name,
          letter: b.letter,
          min_percent: b.min,
          max_percent: b.max,
          points: b.points,
        },
      };
    },
  },
  {
    name: "convert_gpa_scale",
    title: "Convert a GPA to another scale",
    description:
      "Convert a GPA on one grade scale to the nearest band on another, so a GPA from one country can be read as a UK class or an Australian grade. " +
      "Inputs: gpa (the GPA to convert, 0 to 7 and at or below the top of from_scale), from_scale (the scale the GPA is on, default us4) and optional to_scale (the scale to convert to; leave it out to convert to both the uk-classification and australia-hd scales). " +
      "The GPA is read as a share of the top grade point on its own scale, then the nearest band on the target scale is returned with its percentage range and grade points. " +
      "This is a common comparison, not an official conversion, so check the target school's table. " +
      'Example prompt: "I have a 3.5 GPA on the US 4.0 scale. What is that in the UK?"',
    inputSchema: {
      gpa: z.number().min(0).max(7).describe("The GPA to convert, between 0 and 7. It must be at or below the top grade point of from_scale."),
      from_scale: z
        .enum(SCALE_IDS)
        .default("us4")
        .describe('Grade scale id the GPA is on: "us4", "us4plus", "ontario-college", "uk-classification", "australia-hd" or "weighted-5.0". Defaults to "us4".'),
      to_scale: z
        .enum(SCALE_IDS)
        .optional()
        .describe('Grade scale id to convert to: "us4", "us4plus", "ontario-college", "uk-classification", "australia-hd" or "weighted-5.0". Leave it out to convert to both the uk-classification and australia-hd scales.'),
    },
    outputSchema: {
      gpa: z.number().describe("The GPA that was converted."),
      from_scale: z.string().describe("The scale id the GPA was on."),
      from_scale_name: z.string().describe("The name of the scale the GPA was on."),
      from_max_points: z.number().describe("The top grade point of the scale the GPA was on."),
      conversions: z
        .array(
          z.object({
            scale: z.string().describe("The scale id the GPA was converted to."),
            scale_name: z.string().describe("The name of the scale the GPA was converted to."),
            letter: z.string().describe("The nearest band on the target scale."),
            min_percent: z.number().describe("The lowest percentage the band covers on the target scale."),
            max_percent: z.number().describe("The highest percentage the band covers on the target scale."),
            points: z.number().describe("The grade points the band is worth on the target scale."),
          }),
        )
        .describe("One entry per target scale, in the order they were converted."),
    },
    run: async (a) => {
      const fromId = assertScale(a.from_scale);
      const targets: ScaleId[] = a.to_scale ? [assertScale(a.to_scale)] : ["uk-classification", "australia-hd"];
      const converted = convertGpaScale(a.gpa, fromId, targets);
      const lines = converted.map(
        ({ scale, band }) =>
          `${band.letter} on the ${SCALES[scale].name}, covering ${band.min} to ${band.max} percent and worth ${band.points.toFixed(1)} grade points`,
      );
      const text = `A ${a.gpa} GPA on the ${SCALES[fromId].name} is:\n\n${bullets(lines)}\n\nThis is a common comparison, not an official conversion, so check the target school's table.`;
      return {
        text,
        structured: {
          gpa: a.gpa,
          from_scale: fromId,
          from_scale_name: SCALES[fromId].name,
          from_max_points: maxPoints(fromId),
          conversions: converted.map(({ scale, band }) => ({
            scale,
            scale_name: SCALES[scale].name,
            letter: band.letter,
            min_percent: band.min,
            max_percent: band.max,
            points: band.points,
          })),
        },
      };
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
    outputSchema: {
      scale: z.string().describe("The scale id the target was read from."),
      scale_name: z.string().describe("The name of the scale the target was read from."),
      current_percent: z.number().describe("The grade on the work already done."),
      final_weight_percent: z.number().describe("How much the final is worth, as a percentage of the whole course."),
      target_percent: z.number().describe("The course grade to finish with, as a percentage."),
      target_letter: z.string().optional().describe("The letter target that was asked for, when one was given."),
      letter_min_percent: z.number().optional().describe("The lowest percentage the letter target covers, when a letter target was given."),
      needed_percent: z.number().describe("The score needed on the final. It is below 0 when the target is already reached, and above 100 when the target is out of reach."),
      possible: z.boolean().describe("True when the target can be reached with this weighting."),
      already_there: z.boolean().describe("True when the target is already reached, so a 0 on the final keeps it."),
    },
    run: async (a) => {
      const scaleId = assertScale(a.scale);
      const target = resolveTarget(scaleId, { percent: a.target_percent, letter: a.target_letter });
      const r = neededOnFinal(a.current_percent, a.final_weight_percent, target.percent);
      const band = target.band;
      const scaleName = SCALES[scaleId].name;
      const structured: Record<string, unknown> = {
        scale: scaleId,
        scale_name: scaleName,
        current_percent: a.current_percent,
        final_weight_percent: a.final_weight_percent,
        target_percent: target.percent,
        needed_percent: r.needed,
        possible: r.possible,
        already_there: r.alreadyThere,
      };
      if (band) {
        structured.target_letter = band.letter;
        structured.letter_min_percent = band.min;
      }
      let text: string;
      if (!band) {
        if (r.alreadyThere) text = `You already have the ${target.percent}% locked in. Even a 0 on the final keeps you at or above it.`;
        else if (!r.possible) text = `You would need ${r.needed}% on the final, which is more than 100%. ${target.percent}% is out of reach with this weighting.`;
        else text = `You need ${r.needed}% on the final (worth ${a.final_weight_percent}%) to finish with ${target.percent}%, starting from ${a.current_percent}% on the rest.`;
      } else if (target.percent > band.min) {
        // The letter cutoff is the goal, unless the student also asked for a higher percent.
        const note = `${band.letter} starts at ${band.min}% on the ${scaleName}`;
        if (r.alreadyThere) text = `You already have ${target.percent}% locked in (${note}). Even a 0 on the final keeps you at or above it.`;
        else if (!r.possible) text = `You would need ${r.needed}% on the final, which is more than 100%. ${target.percent}% (${note}) is out of reach with this weighting.`;
        else text = `You need ${r.needed}% on the final (worth ${a.final_weight_percent}%) to finish with ${target.percent}% (${note}), starting from ${a.current_percent}% on the rest.`;
      } else {
        const goal = `the grade ${band.letter}`;
        if (r.alreadyThere) text = `You already have ${goal} locked in. It starts at ${band.min}% on the ${scaleName}, and even a 0 on the final keeps you at or above it.`;
        else if (!r.possible) text = `You would need ${r.needed}% on the final, which is more than 100%. The grade ${band.letter} starts at ${band.min}% on the ${scaleName}, so it is out of reach with this weighting.`;
        else text = `You need ${r.needed}% on the final (worth ${a.final_weight_percent}%) to finish with ${goal}, which starts at ${band.min}% on the ${scaleName}. You have ${a.current_percent}% on the rest of the course.`;
      }
      return { text, structured };
    },
  },
  {
    name: "weighted_grade",
    title: "Weighted grade",
    description:
      "Combine weighted course parts into the grade so far, plus the worst and best possible finish. " +
       "Inputs: parts (each with a name, a weight that is a percentage of the whole course greater than 0, and an optional score between 0 and 100; leave the score out for parts that are not marked yet). " +
       "Optional target_percent sets a course grade to work out the average needed on the unmarked parts. " +
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
       target_percent: z.number().min(0).max(100).optional().describe("Optional target course grade in percent. When given, works out the average needed on the unmarked parts."),
     },
    outputSchema: {
      parts: z.array(partFields).describe("One entry per part, in the order they were passed."),
      total_weight: z.number().describe("The weights of the parts added together, as a percentage of the whole course."),
      done_weight: z.number().describe("The weight of the marked parts, as a percentage of the whole course."),
      remaining_weight: z.number().describe("The weight of the course that is still to come, as a percentage of the whole course."),
      current_grade: z.number().nullable().describe("The average on the marked work, or null when nothing is marked yet."),
      earned_points: z.number().describe("The points already banked out of the 100 the whole course is worth."),
      worst_finish: z.number().describe("The course grade if every remaining part scores 0."),
      best_finish: z.number().describe("The course grade if every remaining part scores 100."),
      needed_percent: z.number().nullable().optional().describe("When a target_percent is given, the average needed on the unmarked parts. Below 0 when already there, above 100 when out of reach."),
      possible: z.boolean().optional().describe("When a target_percent is given, true when the target can be reached."),
      already_there: z.boolean().optional().describe("When a target_percent is given, true when the target is already reached."),
    },
    run: async (a) => {
       const r = weighted(a.parts);
       let targetText = "";
       let needed: ReturnType<typeof neededOnRemaining> | null = null;
       if (a.target_percent != null) {
         needed = neededOnRemaining(r.earnedPoints, r.remainingWeight, a.target_percent);
         if (needed.alreadyThere) targetText = ` You already have ${a.target_percent}% locked in.`;
         else if (!needed.possible) targetText = ` You would need ${needed.needed}% on the rest, which is more than 100%.`;
         else targetText = ` You need ${needed.needed}% on the rest to finish with ${a.target_percent}%.`;
       }
       const lines = a.parts.map((p: any) => `${p.name}: weight ${p.weight}%, ${p.score == null ? "not marked yet" : `${p.score}%`}`);
       let now = "Nothing is marked yet.";
       if (r.currentGrade !== null) {
         now = `Grade so far: ${r.currentGrade}% on the ${r.doneWeight}% of the course that is marked.`;
         if (r.doneWeight < 100) now += ` That banks ${r.earnedPoints} of the 100 points the course is worth.`;
       }
       const text = `${bullets(lines)}\\n\\n${now}\\nIf you score 0 on everything left you finish at ${r.worstFinish}%. If you score 100 on everything left you finish at ${r.bestFinish}%. ${r.remainingWeight}% of the course is still to come.${targetText}`;
       return {
         text,
         structured: {
           parts: a.parts.map((p: any) => ({ name: p.name, weight: p.weight, score: p.score ?? null })),
           total_weight: r.totalWeight,
           done_weight: r.doneWeight,
           remaining_weight: r.remainingWeight,
           current_grade: r.currentGrade,
           earned_points: r.earnedPoints,
           worst_finish: r.worstFinish,
           best_finish: r.bestFinish,
           ...(needed ? {
             needed_percent: needed.needed ?? null,
             possible: needed.possible,
             already_there: needed.alreadyThere,
           } : {}),
         },
       };
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
    outputSchema: {
      scale: z.string().describe("The scale id the plan was made on."),
      scale_name: z.string().describe("The name of the scale the plan was made on."),
      current_gpa: z.number().describe("The cumulative GPA so far."),
      credits_completed: z.number().describe("The credits already completed."),
      target_gpa: z.number().describe("The cumulative GPA to reach."),
      upcoming_credits: z.number().describe("The credits you will take next."),
      needed_gpa: z.number().describe("The GPA needed on the upcoming credits. It is below 0 when the target is already reached, and above the top of the scale when the target takes more than one term."),
      max_points: z.number().describe("The top grade point the scale allows."),
      possible: z.boolean().describe("True when the target can be reached in one term on this scale."),
      already_there: z.boolean().describe("True when the target is already reached, so a 0.0 on the upcoming credits keeps it."),
    },
    run: async (a) => {
      const scaleId = assertScale(a.scale);
      const max = Math.max(...SCALES[scaleId].bands.map((b) => b.points));
      const r = targetGpaPlanner(a.current_gpa, a.credits_completed, a.target_gpa, a.upcoming_credits, max);
      let text: string;
      if (r.alreadyThere) text = `You are already above ${a.target_gpa}. Even a 0.0 over the next ${a.upcoming_credits} credits keeps you at or above it.`;
      else if (!r.possible) text = `You would need ${r.needed} on the next ${a.upcoming_credits} credits, but the top of this scale is ${max.toFixed(1)}. Reaching ${a.target_gpa} would take more than one term.`;
      else text = `You need a ${r.needed.toFixed(2)} GPA on the next ${a.upcoming_credits} credits to reach a cumulative ${a.target_gpa} (from ${a.current_gpa} over ${a.credits_completed} credits).`;
      return {
        text,
        structured: {
          scale: scaleId,
          scale_name: SCALES[scaleId].name,
          current_gpa: a.current_gpa,
          credits_completed: a.credits_completed,
          target_gpa: a.target_gpa,
          upcoming_credits: a.upcoming_credits,
          needed_gpa: r.needed,
          max_points: max,
          possible: r.possible,
          already_there: r.alreadyThere,
        },
      };
    },
  },
  {
    name: "plan_courses",
    title: "Plan grades for upcoming courses",
    description:
      "Plan the grade needed in each upcoming course to reach a target cumulative GPA. " +
      "Inputs: current_gpa (0 to 7), credits_completed (0 or more), target_gpa (0 to 7), courses (each with an optional name and credits greater than 0) and a scale id, which sets the top grade point the scale allows. " +
      "It works out the GPA the upcoming credits need, then gives the lowest letter in each course that keeps the plan on track, assuming the other courses meet the same target. " +
      "Says so when the target is already reached or would take more than one term. " +
      'Example prompt: "I have a 3.4 GPA over 60 credits. What do I need in each of my four classes next semester to reach 3.5?"',
    inputSchema: {
      current_gpa: z.number().min(0).max(7).describe("Your cumulative GPA so far, between 0 and 7."),
      credits_completed: z.number().min(0).describe("Credits already completed, 0 or more."),
      target_gpa: z.number().min(0).max(7).describe("The cumulative GPA you want to reach, between 0 and 7."),
      courses: z
        .array(
          z.object({
            name: z.string().optional().describe("Course name."),
            credits: z.number().gt(0).describe("Credits for the course, must be greater than 0."),
          }),
        )
        .min(1)
        .describe("The upcoming courses to plan for. Each needs credits greater than 0, and name is optional."),
      scale,
    },
    outputSchema: {
      scale: z.string().describe("The scale id the plan was made on."),
      scale_name: z.string().describe("The name of the scale the plan was made on."),
      current_gpa: z.number().describe("The cumulative GPA so far."),
      credits_completed: z.number().describe("The credits already completed."),
      target_gpa: z.number().describe("The cumulative GPA to reach."),
      upcoming_credits: z.number().describe("The credits of the courses to plan for."),
      needed_gpa: z.number().describe("The GPA needed on the upcoming credits. It is below 0 when the target is already reached, and above the top of the scale when the target takes more than one term."),
      max_points: z.number().describe("The top grade point the scale allows."),
      possible: z.boolean().describe("True when the target can be reached with these courses on this scale."),
      already_there: z.boolean().describe("True when the target is already reached, so a 0.0 on the upcoming credits keeps it."),
      courses: z
        .array(
          z.object({
            name: z.string().describe("Name of the course."),
            credits: z.number().describe("Credits for the course."),
            target_letter: z.string().optional().describe("The lowest letter in the course that keeps the plan on track, when the target can be reached."),
            target_min_percent: z.number().optional().describe("The lowest percentage the target letter covers, when the target can be reached."),
            target_points: z.number().optional().describe("The grade points the target letter is worth, when the target can be reached."),
          }),
        )
        .describe("One entry per upcoming course, in the order they were passed."),
    },
    run: async (a) => {
      const scaleId = assertScale(a.scale);
      const max = Math.max(...SCALES[scaleId].bands.map((b) => b.points));
      const upcomingCredits = a.courses.reduce((s: number, c: any) => s + c.credits, 0);
      const r = targetGpaPlanner(a.current_gpa, a.credits_completed, a.target_gpa, upcomingCredits, max);
      const rows = planCourseTargets(a.courses, r.needed, scaleId);
      const lines = rows.map((c) =>
        c.band
          ? `${c.name}: ${c.band.letter} or better (${c.band.min}% and up, ${c.band.points.toFixed(1)} points)`
          : `${c.name}: no grade on this scale is enough`,
      );
      let text: string;
      if (r.alreadyThere) {
        text = `You are already at or above ${a.target_gpa}. Even a 0.0 over the next ${upcomingCredits} credits keeps you there, so any grade works.\n\n${bullets(lines)}`;
      } else if (!r.possible) {
        text = `You would need a ${r.needed.toFixed(2)} GPA over the next ${upcomingCredits} credits, but the top of this scale is ${max.toFixed(1)}. Reaching ${a.target_gpa} would take more than one term.\n\n${bullets(lines)}`;
      } else {
        text =
          `You need a ${r.needed.toFixed(2)} GPA over the next ${upcomingCredits} credits to reach a cumulative ${a.target_gpa} (from ${a.current_gpa} over ${a.credits_completed} credits). ` +
          `If every course meets or beats its target below, you reach it.\n\n${bullets(lines)}`;
      }
      return {
        text,
        structured: {
          scale: scaleId,
          scale_name: SCALES[scaleId].name,
          current_gpa: a.current_gpa,
          credits_completed: a.credits_completed,
          target_gpa: a.target_gpa,
          upcoming_credits: upcomingCredits,
          needed_gpa: r.needed,
          max_points: max,
          possible: r.possible,
          already_there: r.alreadyThere,
          courses: rows.map((c) => {
            const row: Record<string, unknown> = { name: c.name, credits: c.credits };
            if (c.band) {
              row.target_letter = c.band.letter;
              row.target_min_percent = c.band.min;
              row.target_points = c.band.points;
            }
            return row;
          }),
        },
      };
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
    outputSchema: {
      scales: z
        .array(
          z.object({
            id: z.string().describe("The scale id to pass to a tool that takes one."),
            name: z.string().describe("The name of the scale."),
            bands: z.array(bandFields).describe("The bands of the scale, from the highest grade down."),
          }),
        )
        .describe("Every built-in scale, with its letters, percentage ranges and grade points."),
    },
    run: async () => {
      const ids = Object.keys(SCALES) as ScaleId[];
      const text =
        ids
          .map((id) => `${id}, ${SCALES[id].name}\n${SCALES[id].bands.map((b) => `  ${b.letter}  ${b.min}-${b.max}%  ${b.points.toFixed(1)}`).join("\n")}`)
          .join("\n\n") + ``;
      return {
        text,
        structured: {
          scales: ids.map((id) => ({
            id,
            name: SCALES[id].name,
            bands: SCALES[id].bands.map((b) => ({ letter: b.letter, min_percent: b.min, max_percent: b.max, points: b.points })),
          })),
        },
      };
    },
  },
];
