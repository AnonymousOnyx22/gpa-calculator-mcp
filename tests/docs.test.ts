import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { tools } from "../src/tools.js";
import { SCALES } from "../src/grades.js";

const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
const glama = JSON.parse(readFileSync(new URL("../glama.json", import.meta.url), "utf8")) as {
  description: string;
  version: string;
  tools: {
    name: string;
    description: string;
    parameters: {
      name: string;
      type: string | string[];
      required: boolean;
      description: string;
      enum?: string[];
      default?: string;
      items?: { properties: Record<string, { type: string | string[] }>; required: string[] };
    }[];
    example: { name: string; arguments: Record<string, unknown> };
    output: string;
  }[];
  gradeScales: { id: string; name: string; bands: { letter: string; min: number; max: number; points: number }[] }[];
};

const CLAIM = "Works offline, no account.";

interface LlmsTool {
  name: string;
  description: string;
  parametersLine: string;
  blocks: { name: string; text: string; fields: string[] }[];
  example: { name: string; arguments: Record<string, unknown> };
  output: string;
}

/** The tool sections of llms.txt, from the "## Tools" heading down. */
function parseLlmsTools(text: string): LlmsTool[] {
  const section = text.slice(text.indexOf("## Tools"));
  return section
    .split(/^### /m)
    .slice(1)
    .map((raw) => {
      const all = raw.split("\n");
      const nextHeading = all.findIndex((l) => /^## /.test(l));
      const lines = nextHeading === -1 ? all : all.slice(0, nextHeading);
      const part = lines.join("\n");
      const name = lines[0].trim();
      const exampleText = /^Example call: `(.*)`$/m.exec(part)?.[1];
      if (!exampleText) throw new Error(`llms.txt: no example call for ${name}`);
      const blocks: LlmsTool["blocks"] = [];
      let current: (typeof blocks)[number] | undefined;
      for (const line of lines) {
        const top = /^-\ (\w+)/.exec(line);
        const nested = /^\s+- (\w+)/.exec(line);
        if (top) {
          current = { name: top[1], text: line.trim(), fields: [] };
          blocks.push(current);
        } else if (nested && current) {
          current.fields.push(nested[1]);
        }
      }
      return {
        name,
        description: lines[1].trim(),
        parametersLine: /^Parameters: (.*)$/m.exec(part)?.[1] ?? "",
        blocks,
        example: JSON.parse(exampleText),
        output: /^Output: (.*)$/m.exec(part)?.[1] ?? "",
      };
    });
}

/** The scale tables of llms.txt, one entry per scale id. */
function parseScaleTables(text: string): Map<string, string[]> {
  const section = text.slice(text.indexOf("## Grade conversion tables"), text.indexOf("## Tools"));
  const tables = new Map<string, string[]>();
  for (const part of section.split(/^### /m).slice(1)) {
    const lines = part.split("\n");
    tables.set(lines[0].trim().split(" ")[0], lines.filter((l) => l.startsWith("- ")).map((l) => l.trim()));
  }
  return tables;
}

/** The property names a tool requires, the same list the JSON schema gives a client. */
function requiredNames(tool: (typeof tools)[number]): string[] {
  const schema = z.toJSONSchema(z.object(tool.inputSchema), { io: "input" }) as { required?: string[] };
  return schema.required ?? [];
}

/** The types a JSON schema allows, as a sorted list. */
function schemaTypes(schema: unknown): string[] {
  const s = schema as { type?: string | string[]; anyOf?: unknown[] };
  if (Array.isArray(s.type)) return [...s.type].sort();
  if (s.type) return [s.type];
  if (Array.isArray(s.anyOf)) return s.anyOf.flatMap(schemaTypes).sort();
  return [];
}

const llmsTools = parseLlmsTools(llms);
const scaleTables = parseScaleTables(llms);

describe("llms.txt and glama.json list every tool", () => {
  it("lists every tool from src/tools.ts in llms.txt, once and in the same order", () => {
    expect(llmsTools.map((t) => t.name)).toEqual(tools.map((t) => t.name));
  });

  it("lists every tool from src/tools.ts in glama.json, once and in the same order", () => {
    expect(glama.tools.map((t) => t.name)).toEqual(tools.map((t) => t.name));
  });

  it("uses the tool descriptions from src/tools.ts in llms.txt", () => {
    for (const tool of tools) {
      const listed = llmsTools.find((t) => t.name === tool.name)!;
      expect(listed.description, `llms.txt description for ${tool.name}`).toBe(tool.description);
    }
  });

  it("uses the tool descriptions from src/tools.ts in glama.json", () => {
    for (const tool of tools) {
      const listed = glama.tools.find((t) => t.name === tool.name)!;
      expect(listed.description, `glama.json description for ${tool.name}`).toBe(tool.description);
    }
  });
});

describe("every tool has its parameters and an example", () => {
  for (const tool of tools) {
    it(`llms.txt documents ${tool.name} with its parameters and a valid example call`, () => {
      const doc = llmsTools.find((t) => t.name === tool.name)!;
      const props = Object.keys(tool.inputSchema);
      expect(doc.blocks.map((b) => b.name), `${tool.name} parameters in llms.txt`).toEqual(props);
      if (!props.length) expect(doc.parametersLine.trim().toLowerCase(), tool.name).toBe("none.");
      for (const p of props) {
        const schema = z.toJSONSchema(tool.inputSchema[p], { io: "input" }) as Record<string, unknown>;
        const block = doc.blocks.find((b) => b.name === p)!;
        expect(block.text, `${tool.name}.${p} in llms.txt`).toContain(schema.description as string);
        const itemProperties = Object.keys((schema.items as { properties: object })?.properties ?? {});
        expect(block.fields.sort(), `${tool.name}.${p} fields in llms.txt`).toEqual([...itemProperties].sort());
      }
      expect(doc.example.name).toBe(tool.name);
      expect(z.object(tool.inputSchema).safeParse(doc.example.arguments).success, `${tool.name} example`).toBe(true);
      expect(doc.output.length, `${tool.name} output`).toBeGreaterThan(0);
    });

    it(`glama.json documents ${tool.name} with its parameters and a valid example call`, () => {
      const doc = glama.tools.find((t) => t.name === tool.name)!;
      const props = Object.keys(tool.inputSchema);
      expect(doc.parameters.map((p) => p.name), `${tool.name} parameter names`).toEqual(props);
      for (const p of doc.parameters) {
        const schema = z.toJSONSchema(tool.inputSchema[p.name], { io: "input" }) as Record<string, unknown>;
        expect(p.required, `${tool.name}.${p.name} required flag`).toBe(requiredNames(tool).includes(p.name));
        expect(p.description, `${tool.name}.${p.name} description`).toBe(schema.description);
        expect(schemaTypes({ type: p.type }), `${tool.name}.${p.name} type`).toEqual(schemaTypes(schema));
        if (schema.enum) expect(p.enum, `${tool.name}.${p.name} choices`).toEqual(schema.enum);
        if (schema.default !== undefined) expect(p.default, `${tool.name}.${p.name} default`).toBe(schema.default);
        const items = schema.items as { properties: Record<string, unknown>; required?: string[] } | undefined;
        if (items?.properties) {
          expect(Object.keys(p.items!.properties).sort(), `${tool.name}.${p.name} fields`).toEqual(
            Object.keys(items.properties).sort(),
          );
          expect([...p.items!.required].sort(), `${tool.name}.${p.name} required fields`).toEqual([...(items.required ?? [])].sort());
          for (const [key, prop] of Object.entries(p.items!.properties)) {
            expect(schemaTypes(prop), `${tool.name}.${p.name}.${key} type`).toEqual(schemaTypes(items.properties[key]));
          }
        }
      }
      expect(doc.example.name).toBe(tool.name);
      expect(z.object(tool.inputSchema).safeParse(doc.example.arguments).success, `${tool.name} example`).toBe(true);
      expect(doc.output.length, `${tool.name} output`).toBeGreaterThan(0);
    });

    it(`llms.txt and glama.json give ${tool.name} the same example call`, () => {
      const inLlms = llmsTools.find((t) => t.name === tool.name)!.example;
      const inGlama = glama.tools.find((t) => t.name === tool.name)!.example;
      expect(inGlama).toEqual(inLlms);
    });
  }
});

describe("the grade conversion tables are the ones in the code", () => {
  it("prints every scale of src/grades.ts in llms.txt", () => {
    expect([...scaleTables.keys()]).toEqual(Object.keys(SCALES));
    for (const [id, scale] of Object.entries(SCALES)) {
      const expected = scale.bands.map((b) => `- ${b.letter}: ${b.min} to ${b.max}, ${b.points.toFixed(1)} grade points`);
      expect(scaleTables.get(id), `llms.txt table for ${id}`).toEqual(expected);
    }
  });

  it("lists every scale of src/grades.ts in glama.json", () => {
    expect(glama.gradeScales.map((s) => s.id)).toEqual(Object.keys(SCALES));
    for (const [id, scale] of Object.entries(SCALES)) {
      const listed = glama.gradeScales.find((s) => s.id === id)!;
      expect(listed.name, `glama.json name for ${id}`).toBe(scale.name);
      expect(listed.bands, `glama.json bands for ${id}`).toEqual(
        scale.bands.map((b) => ({ letter: b.letter, min: b.min, max: b.max, points: b.points })),
      );
    }
  });

  it("names every scale in llms.txt and glama.json", () => {
    for (const id of Object.keys(SCALES)) {
      expect(llms, `llms.txt mentions ${id}`).toContain(id);
      expect(JSON.stringify(glama), `glama.json mentions ${id}`).toContain(id);
    }
  });
});

describe("the offline and no account claim", () => {
  it("appears word for word in llms.txt and glama.json", () => {
    expect(llms).toContain(CLAIM);
    expect(glama.description).toContain(CLAIM);
  });
});
