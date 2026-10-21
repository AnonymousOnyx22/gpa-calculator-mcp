import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tools } from "../src/tools.js";
import { SCALES, type ScaleId } from "../src/grades.js";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

/** The README from one heading down to the next heading of the same level. */
function section(heading: string): string {
  const start = readme.indexOf(heading);
  if (start === -1) throw new Error(`README.md has no ${heading} section`);
  const end = readme.indexOf("\n## ", start + heading.length);
  return readme.slice(start, end === -1 ? readme.length : end);
}

/** The sentences of a piece of text, with the line breaks removed. */
function sentences(text: string): string[] {
  return text.split("\n").flatMap((line) => line.split(/(?<=\.)\s+/));
}

/** The rows of a markdown table, without the separator line. */
function tableRows(markdown: string): string[][] {
  return markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()))
    .filter((cells) => !cells.every((cell) => /^-+$/.test(cell)));
}

/** The names in backticks inside a piece of text. */
function backticked(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

/** A number in words, so a count in the README can be read against a count in the code. */
const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

/** The rows of the tool table, with the tool name, its parameters and what it does. */
function toolRows(): { name: string; parameters: string; body: string }[] {
  return tableRows(section("## Tools"))
    .filter((cells) => cells[0] !== "Tool")
    .map((cells) => ({ name: cells[0].replace(/`/g, ""), parameters: cells[1] ?? "", body: cells[2] ?? "" }));
}

/** The rows of the scale table, with the scale id and what the README says about it. */
function scaleRows(): { id: string; body: string }[] {
  return tableRows(section("## Grade scales"))
    .filter((cells) => cells[0] !== "Scale id")
    .map((cells) => ({ id: cells[0].replace(/`/g, ""), body: cells[1] ?? "" }));
}

/** The example prompt a tool description ends with. */
function examplePrompt(description: string): string | undefined {
  return /Example prompt: "([^"]+)"/.exec(description)?.[1];
}

/** The tool that carries an example prompt. */
function toolFor(prompt: string) {
  return tools.find((tool) => examplePrompt(tool.description) === prompt);
}

interface Featured {
  title: string;
  prompt: string;
  body: string;
}

/** The example prompts the README puts in the foreground, with the text that explains them. */
function featuredPrompts(): Featured[] {
  const text = section("## Try these three prompts");
  const end = text.indexOf("More things you can ask");
  const items: Featured[] = [];
  let current: Featured | undefined;
  for (const line of (end === -1 ? text : text.slice(0, end)).split("\n")) {
    const trimmed = line.trim();
    const title = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (title) {
      current = { title: title[2], prompt: "", body: "" };
      items.push(current);
      continue;
    }
    const quote = /^>\s*"(.*)"$/.exec(trimmed);
    if (quote && current) {
      current.prompt = quote[1];
      continue;
    }
    if (current) current.body += `${trimmed}\n`;
  }
  return items;
}

/** The README item that shows the example prompt of a tool. */
function featuredFor(name: string): Featured {
  const item = featuredPrompts().find((entry) => toolFor(entry.prompt)?.name === name);
  if (!item) throw new Error(`the README has no example prompt for ${name}`);
  return item;
}

/** The text a tool returns for some arguments. */
async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`there is no tool called ${name}`);
  return (await tool.run(args, null)).text;
}

/** The words the README uses for a UK class. */
const CLASS_WORDS: Record<string, string> = { first: "1st", second: "2:1", third: "3rd" };

/** The grade point claims of a piece of text, such as "A is 4.0" or "a first is worth 4.0". */
function pointClaims(text: string): { letter: string; points: number }[] {
  return [...text.matchAll(/([A-Za-z][A-Za-z0-9:+-]*)\s+is(?:\s+worth)?\s+(\d+(?:\.\d+)?)/g)].map((match) => ({
    letter: CLASS_WORDS[match[1].toLowerCase()] ?? match[1],
    points: Number(match[2]),
  }));
}

/** The scale a sentence talks about, by the scale id it names. */
function scaleIn(text: string): ScaleId | undefined {
  return (Object.keys(SCALES) as ScaleId[]).find((id) => new RegExp(`\\b${id.replace(/\./g, "\\.")}\\b`).test(text));
}

describe("the tool table in the README", () => {
  it("lists every tool from src/tools.ts, once and in the same order", () => {
    expect(toolRows().map((row) => row.name)).toEqual(tools.map((tool) => tool.name));
  });

  it("names the parameters of every tool in the order the tool has them", () => {
    for (const tool of tools) {
      const row = toolRows().find((entry) => entry.name === tool.name);
      expect(row, `the README row for ${tool.name}`).toBeTruthy();
      expect(backticked(row!.parameters), `the parameters of ${tool.name} in the README`).toEqual(Object.keys(tool.inputSchema));
    }
  });

  it("says none for a tool that takes no parameters", () => {
    for (const tool of tools) {
      if (Object.keys(tool.inputSchema).length) continue;
      const row = toolRows().find((entry) => entry.name === tool.name)!;
      expect(row.parameters.toLowerCase(), `the parameters of ${tool.name} in the README`).toBe("none");
    }
  });

  it("says how many tools there are", () => {
    expect(section("## Tools")).toMatch(new RegExp(`\\b${countWord(tools.length)} tools\\b`, "i"));
  });
});

describe("the example prompts in the README", () => {
  it("gives every tool an example prompt to end with", () => {
    for (const tool of tools) {
      const prompt = examplePrompt(tool.description);
      expect(prompt, `the example prompt of ${tool.name}`).toBeTruthy();
      expect(tool.description.endsWith(`"${prompt}"`), `the example prompt at the end of ${tool.name}`).toBe(true);
    }
  });

  it("uses three of the example prompts the tools carry", () => {
    const items = featuredPrompts();
    expect(items.length, "the number of example prompts in the README").toBe(3);
    for (const item of items) {
      expect(toolFor(item.prompt), `a tool that carries the prompt "${item.prompt}"`).toBeTruthy();
    }
  });

  it("gives each prompt to the tool that carries it", () => {
    const items = featuredPrompts();
    const owners = items.map((item) => toolFor(item.prompt));
    for (const owner of owners) {
      expect(owner, "the tool that carries a prompt in the README").toBeTruthy();
    }
    expect(new Set(owners.map((tool) => tool!.name)).size, "the number of tools the prompts belong to").toBe(3);
    for (const item of items) {
      const owner = toolFor(item.prompt)!;
      expect(item.body, `the text under "${item.title}"`).toContain(`\`${owner.name}\``);
    }
  });

  it("says how many prompts there are in the heading", () => {
    expect(section("## Try these three prompts")).toMatch(new RegExp(`\\b${countWord(3)} prompts\\b`, "i"));
  });
});

describe("the numbers the README takes from the tools", () => {
  it("gives the GPA that the GPA example promises", async () => {
    const out = await runTool("calculate_gpa", {
      courses: [
        { credits: 3, grade: "A" },
        { credits: 4, grade: "B+" },
        { credits: 3, grade: "C" },
      ],
      scale: "us4",
    });
    expect(out).toContain("3.12");
    expect(out).toContain("10 credits");
    const body = featuredFor("calculate_gpa").body;
    expect(body).toContain("3.12");
    expect(body).toContain("10 credits");
  });

  it("gives the score on the final that the README promises", async () => {
    const letter = await runTool("needed_on_final", {
      current_percent: 85,
      final_weight_percent: 40,
      target_letter: "B+",
      scale: "us4",
    });
    expect(letter).toContain("90%");
    expect(letter).toContain("87%");
    const percent = await runTool("needed_on_final", {
      current_percent: 74,
      final_weight_percent: 40,
      target_percent: 80,
      scale: "us4",
    });
    expect(percent).toContain("89%");
    expect(percent).toContain("80%");
    const body = featuredFor("needed_on_final").body;
    for (const claim of ["90%", "87%", "89%", "80%"]) {
      expect(body, "the score on the final in the README").toContain(claim);
    }
  });

  it("gives the weighted grade that the FAQ promises", async () => {
    const out = await runTool("weighted_grade", {
      parts: [
        { name: "Quizzes", weight: 20, score: 85 },
        { name: "Labs", weight: 30, score: 70 },
      ],
    });
    const gradeSoFar = /Grade so far: (\d+(?:\.\d+)?)%/.exec(out)?.[1];
    expect(gradeSoFar, "the grade so far the tool reports").toBe("76");
    const faq = section("## FAQ");
    expect(/grade so far[^0-9]{0,40}(\d+(?:\.\d+)?)/i.exec(faq)?.[1], "the grade so far the README gives").toBe(gradeSoFar);
    const finishes = [...out.matchAll(/finish at (\d+(?:\.\d+)?)%/g)].map((match) => match[1]);
    expect([...faq.matchAll(/finish at (\d+(?:\.\d+)?)/g)].map((match) => match[1]), "the finishes the README gives").toEqual(finishes);
  });
});

describe("the grade scales in the README", () => {
  it("lists every scale from src/grades.ts, once and in the same order", () => {
    expect(scaleRows().map((row) => row.id)).toEqual(Object.keys(SCALES));
  });

  it("gives the top grade point of every scale", () => {
    for (const [id, scale] of Object.entries(SCALES)) {
      const row = scaleRows().find((entry) => entry.id === id);
      expect(row, `the README row for ${id}`).toBeTruthy();
      const top = Math.max(...scale.bands.map((band) => band.points));
      expect(row!.body, `the top grade point of ${id} in the README`).toContain(top.toFixed(1));
    }
  });

  it("gives the points of the letters it names", () => {
    for (const [id, scale] of Object.entries(SCALES)) {
      const row = scaleRows().find((entry) => entry.id === id)!;
      for (const claim of pointClaims(row.body)) {
        const band = scale.bands.find((b) => b.letter.toLowerCase() === claim.letter.toLowerCase());
        if (!band) continue;
        expect(band.points, `the points for ${claim.letter} on ${id}`).toBe(claim.points);
      }
    }
  });

  it("gives the points of the letters it names in the text around the table", () => {
    for (const claim of pointClaims(section("## Grade scales"))) {
      const points = (Object.keys(SCALES) as ScaleId[])
        .filter((id) => SCALES[id].bands.some((band) => band.letter.toLowerCase() === claim.letter.toLowerCase()))
        .map((id) => SCALES[id].bands.find((band) => band.letter.toLowerCase() === claim.letter.toLowerCase())!.points);
      expect(points, `the points for ${claim.letter} in the README`).toContain(claim.points);
    }
  });
});

describe("the band ranges the README gives", () => {
  it("does not claim a range the code does not have", () => {
    const checked: string[] = [];
    for (const sentence of sentences(readme)) {
      const claim = /(\w+) covers (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?) percent/.exec(sentence);
      if (!claim) continue;
      const [, letter, min, max] = claim;
      const id = scaleIn(sentence);
      expect(id, `the scale named in "${sentence}"`).toBeTruthy();
      const band = SCALES[id!].bands.find((b) => b.letter === letter);
      expect(band, `the ${letter} band on ${id}`).toBeTruthy();
      expect(band!.min, `the lowest percent of ${letter} on ${id}`).toBe(Number(min));
      expect(band!.max, `the highest percent of ${letter} on ${id}`).toBe(Number(max));
      checked.push(`${letter} on ${id}`);
    }
    expect(checked.length, "the band ranges the README gives").toBeGreaterThan(0);
  });
});
