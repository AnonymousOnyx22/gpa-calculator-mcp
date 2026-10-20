import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

const PHRASE = "gpa calculator mcp";

describe("npm search metadata", () => {
  it("leads the description and keywords with the phrase gpa calculator mcp", () => {
    const pkg = readJson("package.json");
    expect(pkg.description.toLowerCase()).toContain(PHRASE);
    expect(pkg.keywords[0].toLowerCase()).toBe(PHRASE);
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
