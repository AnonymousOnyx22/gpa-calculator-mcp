export type ScaleId = "us4" | "us4plus" | "ontario-college" | "uk-classification" | "australia-hd" | "weighted-5.0";

export interface Band {
  letter: string;
  min: number; // inclusive percentage
  max: number; // inclusive percentage, rounded to the last whole number in the band
  points: number;
}

const US: Band[] = [
  { letter: "A", min: 93, max: 100, points: 4.0 },
  { letter: "A-", min: 90, max: 92, points: 3.7 },
  { letter: "B+", min: 87, max: 89, points: 3.3 },
  { letter: "B", min: 83, max: 86, points: 3.0 },
  { letter: "B-", min: 80, max: 82, points: 2.7 },
  { letter: "C+", min: 77, max: 79, points: 2.3 },
  { letter: "C", min: 73, max: 76, points: 2.0 },
  { letter: "C-", min: 70, max: 72, points: 1.7 },
  { letter: "D+", min: 67, max: 69, points: 1.3 },
  { letter: "D", min: 63, max: 66, points: 1.0 },
  { letter: "D-", min: 60, max: 62, points: 0.7 },
  { letter: "F", min: 0, max: 59, points: 0.0 },
];

// UK honours degree boundaries. The grade points are a plain mapping so that
// GPA arithmetic works; a classification is not normally given grade points.
const UK: Band[] = [
  { letter: "1st", min: 70, max: 100, points: 4.0 },
  { letter: "2:1", min: 60, max: 69, points: 3.3 },
  { letter: "2:2", min: 50, max: 59, points: 2.7 },
  { letter: "3rd", min: 40, max: 49, points: 2.0 },
  { letter: "F", min: 0, max: 39, points: 0.0 },
];

// Australian letters on the common 7 point scale.
const AU: Band[] = [
  { letter: "HD", min: 80, max: 100, points: 7.0 },
  { letter: "D", min: 70, max: 79, points: 6.0 },
  { letter: "C", min: 60, max: 69, points: 5.0 },
  { letter: "P", min: 50, max: 59, points: 4.0 },
  { letter: "F", min: 0, max: 49, points: 0.0 },
];

// The us4 cutoffs with every letter above F worth one more point, so A lands on 5.0.
const WEIGHTED5: Band[] = [
  { letter: "A", min: 93, max: 100, points: 5.0 },
  { letter: "A-", min: 90, max: 92, points: 4.7 },
  { letter: "B+", min: 87, max: 89, points: 4.3 },
  { letter: "B", min: 83, max: 86, points: 4.0 },
  { letter: "B-", min: 80, max: 82, points: 3.7 },
  { letter: "C+", min: 77, max: 79, points: 3.3 },
  { letter: "C", min: 73, max: 76, points: 3.0 },
  { letter: "C-", min: 70, max: 72, points: 2.7 },
  { letter: "D+", min: 67, max: 69, points: 2.3 },
  { letter: "D", min: 63, max: 66, points: 2.0 },
  { letter: "D-", min: 60, max: 62, points: 1.7 },
  { letter: "F", min: 0, max: 59, points: 0.0 },
];

export const SCALES: Record<ScaleId, { name: string; bands: Band[] }> = {
  us4: { name: "US 4.0 scale", bands: US },
  us4plus: {
    name: "US 4.3 scale (A+ is 4.3)",
    bands: [{ letter: "A+", min: 97, max: 100, points: 4.3 }, { ...US[0], letter: "A", min: 93, max: 96 }, ...US.slice(1)],
  },
  "ontario-college": {
    name: "Ontario college 4.0 scale (common version, check your school's table)",
    bands: [
      { letter: "A+", min: 90, max: 100, points: 4.0 },
      { letter: "A", min: 80, max: 89, points: 4.0 },
      { letter: "B+", min: 75, max: 79, points: 3.5 },
      { letter: "B", min: 70, max: 74, points: 3.0 },
      { letter: "C+", min: 65, max: 69, points: 2.5 },
      { letter: "C", min: 60, max: 64, points: 2.0 },
      { letter: "D", min: 50, max: 59, points: 1.0 },
      { letter: "F", min: 0, max: 49, points: 0.0 },
    ],
  },
  "uk-classification": {
    name: "UK degree classification (standard boundaries, check your school's table)",
    bands: UK,
  },
  "australia-hd": {
    name: "Australian 7.0 scale (HD is 7, common version, check your school's table)",
    bands: AU,
  },
  "weighted-5.0": {
    name: "US weighted 5.0 scale (A is 5.0, one point above us4, check your school's table)",
    bands: WEIGHTED5,
  },
};

export function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Parses "A-", "b+", "87", "87%" or 87 into a letter or a percentage. */
export function parseGrade(input: string | number): { kind: "letter"; letter: string } | { kind: "percent"; percent: number } {
  if (typeof input === "number") return { kind: "percent", percent: input };
  const t = input.trim().replace(/%$/, "");
  if (/^\d+(\.\d+)?$/.test(t)) return { kind: "percent", percent: Number(t) };
  return { kind: "letter", letter: t.toUpperCase() };
}

export function isScaleId(value: unknown): value is ScaleId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SCALES, value);
}

export function assertScale(value: unknown): ScaleId {
  if (!isScaleId(value)) {
    throw new Error(
      `"${value}" is not a valid grade scale. Valid scale ids are ${Object.keys(SCALES).join(", ")} (ontario college).`,
    );
  }
  return value;
}

export function bandForPercent(scale: string, percent: number): Band {
  const id = assertScale(scale);
  if (percent < 0 || percent > 100) throw new Error(`A percentage must be between 0 and 100, got ${percent}. Accepted grade formats are 'B+', 87, '87%'.`);
  const bands = SCALES[id].bands;
  const whole = Math.floor(percent + 1e-9);
  return bands.find((b) => whole >= b.min && whole <= b.max) ?? bands[bands.length - 1];
}

export function bandForLetter(scale: string, letter: string): Band {
  const id = assertScale(scale);
  const wanted = letter.trim().toUpperCase();
  const found = SCALES[id].bands.find((b) => b.letter.toUpperCase() === wanted);
  if (!found) {
    const valid = SCALES[id].bands.map((b) => b.letter).join(", ");
    throw new Error(`"${letter}" is not a grade on the ${id} scale. Valid letters are ${valid}. Accepted grade formats are 'B+', 87, '87%'.`);
  }
  return found;
}

export function bandFor(scale: string, grade: string | number): Band {
  const g = parseGrade(grade);
  return g.kind === "percent" ? bandForPercent(scale, g.percent) : bandForLetter(scale, g.letter);
}

export interface CourseInput {
  name?: string;
  credits: number;
  grade: string | number;
  /** Multiplies the credits of the course for a weighted GPA. Defaults to 1. */
  creditMultiplier?: number;
}

/**
 * The earlier work has to come as a pair. A GPA with no credits behind it, or credits
 * with no GPA, cannot be folded in, so one half on its own is an error rather than a
 * request that is quietly dropped.
 */
export function resolvePrior(priorGpa?: number, priorCredits?: number): { gpa: number; credits: number } | undefined {
  if (priorGpa !== undefined && priorCredits !== undefined) return { gpa: priorGpa, credits: priorCredits };
  if (priorGpa !== undefined) {
    throw new Error(
      "Pass prior_credits as well, or leave both out. Earlier terms are only folded in when prior_gpa and prior_credits come together, so one on its own would be left out.",
    );
  }
  if (priorCredits !== undefined) {
    throw new Error(
      "Pass prior_gpa as well, or leave both out. Earlier terms are only folded in when prior_gpa and prior_credits come together, so one on its own would be left out.",
    );
  }
  return undefined;
}

export function gpa(courses: CourseInput[], scale: string, prior?: { gpa: number; credits: number }) {
  const id = assertScale(scale);
  if (courses.length === 0) throw new Error("Add at least one course.");
  const rows = courses.map((c, i) => {
    if (!(c.credits > 0)) throw new Error(`Course ${c.name ?? i + 1} needs credits greater than 0.`);
    const creditMultiplier = c.creditMultiplier ?? 1;
    if (!(creditMultiplier > 0)) throw new Error(`Course ${c.name ?? i + 1} needs a credit_multiplier greater than 0.`);
    const band = bandFor(id, c.grade);
    return {
      name: c.name ?? `Course ${i + 1}`,
      credits: c.credits,
      creditMultiplier,
      letter: band.letter,
      points: band.points,
      quality: band.points * c.credits,
    };
  });
  const credits = rows.reduce((s, r) => s + r.credits, 0);
  const quality = rows.reduce((s, r) => s + r.quality, 0);
  const term = quality / credits;
  // A credit multiplier changes how much a course counts towards the weighted GPA.
  // The term GPA keeps the plain credits, so its meaning does not change.
  const hasMultiplier = rows.some((r) => r.creditMultiplier !== 1);
  const weightedCredits = hasMultiplier ? rows.reduce((s, r) => s + r.credits * r.creditMultiplier, 0) : undefined;
  const weightedQuality = hasMultiplier ? rows.reduce((s, r) => s + r.quality * r.creditMultiplier, 0) : undefined;
  const weightedGpa = hasMultiplier ? round(weightedQuality! / weightedCredits!) : undefined;
  let cumulative: number | undefined;
  let cumulativeCredits: number | undefined;
  if (prior) {
    cumulativeCredits = prior.credits + credits;
    cumulative = (prior.gpa * prior.credits + quality) / cumulativeCredits;
  }
  return {
    rows,
    credits,
    term: round(term),
    weightedGpa,
    weightedCredits: weightedCredits === undefined ? undefined : round(weightedCredits),
    cumulative: cumulative === undefined ? undefined : round(cumulative),
    cumulativeCredits,
  };
}

export interface TargetGoal {
  percent?: number;
  letter?: string;
}

/**
 * Turns a goal into the percentage the student has to finish with. A letter is looked up in
 * the scale table, so a goal like B+ or 2:1 uses the cutoff that scale gives. When both a
 * percent and a letter are given, the higher of the two is the goal.
 */
export function resolveTarget(scale: string, goal: TargetGoal): { percent: number; band?: Band } {
  const id = assertScale(scale);
  const letter = goal.letter?.trim();
  const band = letter ? bandForLetter(id, letter) : undefined;
  const percent = goal.percent;
  if (percent !== undefined) {
    return band ? { percent: Math.max(percent, band.min), band } : { percent, band: undefined };
  }
  if (band) return { percent: band.min, band };
  throw new Error("Pass a target_percent, a target_letter, or both.");
}

export function neededOnFinal(current: number, finalWeight: number, target: number) {
  if (!(finalWeight > 0 && finalWeight <= 100)) throw new Error("The final's weight must be between 0 and 100 percent.");
  if (current < 0 || current > 100 || target < 0 || target > 100) throw new Error("Grades must be percentages between 0 and 100.");
  const keep = 100 - finalWeight;
  // current is the grade on the work already done, which makes up the other (100 - weight) percent
  const needed = (target - (current * keep) / 100) / (finalWeight / 100);
  return { needed: round(needed), possible: needed <= 100, alreadyThere: needed <= 0 };
}

export interface Part {
  name: string;
  weight: number;
  score?: number | null;
}

/** A course is graded out of 100 percent, so the weights of its parts add up to 100. */
const COURSE_PERCENT = 100;

/**
 * Works out the grade so far, plus the worst and best finish, from the parts of a course.
 * A weight is a percentage of the whole course, so the parts are never rescaled. Parts that
 * were left out still count as work to come, because the course is worth 100 percent.
 */
export function weighted(parts: Part[]) {
  const total = parts.reduce((s, p) => s + p.weight, 0);
  if (total <= 0) throw new Error("Weights need to add up to more than 0.");
  if (total > COURSE_PERCENT) {
    throw new Error(`The weights add up to ${round(total)} percent. A course is graded out of 100 percent, so the weights need to add up to 100 or less.`);
  }
  const done = parts.filter((p) => p.score !== undefined && p.score !== null);
  const doneWeight = done.reduce((s, p) => s + p.weight, 0);
  const earned = done.reduce((s, p) => s + (p.weight * (p.score as number)) / 100, 0);
  // Everything that is not marked yet is still to come, whether it was listed as a part or not.
  const remaining = COURSE_PERCENT - doneWeight;
  return {
    totalWeight: round(total),
    doneWeight: round(doneWeight),
    remainingWeight: round(remaining),
    // the grade so far is the average of the marked work, the way an LMS gradebook shows it
    currentGrade: doneWeight > 0 ? round((earned / doneWeight) * 100) : null,
    // points already banked out of the 100 the whole course is worth
    earnedPoints: round(earned),
    worstFinish: round(earned),
    bestFinish: round(earned + remaining),
  };
}

export function targetGpaPlanner(currentGpa: number, creditsDone: number, targetGpa: number, upcomingCredits: number, maxPoints: number) {
  if (!(upcomingCredits > 0)) throw new Error("Upcoming credits must be greater than 0.");
  const needed = (targetGpa * (creditsDone + upcomingCredits) - currentGpa * creditsDone) / upcomingCredits;
  return { needed: round(needed), possible: needed <= maxPoints, alreadyThere: needed <= 0 };
}
