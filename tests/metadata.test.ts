import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

const PHRASE = "gpa calculator mcp";

// The search terms students actually type. Each one has to sit in the keyword list,
// so the package shows up when someone looks for a cumulative GPA, a semester GPA
// or the grade they need to finish with.
const SEARCH_TERMS = ["cgpa", "sgpa", "target grade calculator"];

describe("npm search metadata", () => {
  it("leads the description and keywords with the phrase gpa calculator mcp", () => {
    const pkg = readJson("package.json");
    expect(pkg.description.toLowerCase()).toContain(PHRASE);
    expect(pkg.keywords[0].toLowerCase()).toBe(PHRASE);
  });
  it("keeps the student search terms in the keywords", () => {
    const pkg = readJson("package.json");
    const keywords = pkg.keywords.map((k: string) => k.toLowerCase());
    for (const term of SEARCH_TERMS) {
      expect(keywords, `a keyword for ${term}`).toContain(term);
    }
  });
  it("keeps the server.json description under the registry limit and on phrase", () => {
    const server = readJson("server.json");
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.description.toLowerCase()).toContain(PHRASE);
  });
  it("keeps glama.json and llms.txt on phrase", () => {
    expect(readJson("glama.json").description.toLowerCase()).toContain(PHRASE);
    const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8").toLowerCase();
    expect(llms).toContain(PHRASE);
  });
});
