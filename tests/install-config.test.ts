import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { name: string };

const PACKAGE = "gpa-calculator-mcp";
const SERVER = "gpa";

/** The apps the README gives an install config for. */
const APPS = ["Claude Desktop", "Claude Code", "ChatGPT", "Cursor", "VS Code Copilot"];

/** The README from the Install heading down to the next heading of the same level. */
function installSection(): string {
  const start = readme.indexOf("## Install");
  if (start === -1) throw new Error("README.md has no Install section");
  const end = readme.indexOf("\n## ", start + 1);
  return readme.slice(start, end === -1 ? readme.length : end);
}

/** The part of the install section under one heading, up to the next heading. */
function part(heading: string): string {
  const lines = installSection().split("\n");
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`);
  if (start === -1) throw new Error(`README.md has no ${heading} part in the install section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("### "));
  return rest.slice(0, end === -1 ? rest.length : end).join("\n");
}

/** The fenced code blocks of one language in a piece of text. */
function blocks(text: string, language: string): string[] {
  const pattern = new RegExp("```" + language + "\\r?\\n([\\s\\S]*?)```", "g");
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

/** The GitHub anchor of a heading. */
function anchor(heading: string): string {
  return heading.toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/ /g, "-");
}

/** The server entry inside a config file, with the key the file uses for it. */
function serverIn(config: string): { key: string; entry: { command?: string; args?: string[]; type?: string } } {
  const parsed = JSON.parse(config) as Record<string, Record<string, { command?: string; args?: string[]; type?: string }>>;
  const key = Object.keys(parsed)[0];
  return { key, entry: parsed[key][SERVER] };
}

describe("the install section of the README", () => {
  it("has a part for every app", () => {
    const headings = installSection()
      .split("\n")
      .map((line) => line.trim());
    for (const app of APPS) {
      expect(headings, `the README has a ${app} part`).toContain(`### ${app}`);
    }
  });

  it("links every part from the list of apps", () => {
    const links = installSection()
      .split("\n")
      .map((line) => line.trim());
    for (const app of APPS) {
      expect(links, `the README links the ${app} part`).toContain(`- [${app}](#${anchor(app)})`);
    }
  });

  it("names the package that is on npm", () => {
    expect(pkg.name, "the package name in package.json").toBe(PACKAGE);
  });
});

describe("every config in the README starts the same server", () => {
  it("runs the server with npx and the package name", () => {
    const configs = blocks(installSection(), "json");
    expect(configs.length, "the number of json configs").toBeGreaterThan(0);
    for (const config of configs) {
      const { entry } = serverIn(config);
      expect(entry, `the ${SERVER} server in a config`).toBeTruthy();
      expect(entry.command, `the command for ${SERVER}`).toBe("npx");
      expect(entry.args, `the arguments for ${SERVER}`).toEqual(["-y", PACKAGE]);
    }
  });

  it("uses the key each app reads", () => {
    expect(serverIn(blocks(part("Claude Desktop"), "json")[0]).key).toBe("mcpServers");
    expect(serverIn(blocks(part("Cursor"), "json")[0]).key).toBe("mcpServers");
    expect(serverIn(blocks(part("VS Code Copilot"), "json")[0]).key).toBe("servers");
    expect(serverIn(blocks(part("VS Code Copilot"), "json")[1]).key).toBe("mcpServers");
  });
});

describe("each app is told where its config goes", () => {
  it("names the Claude Desktop config file and the Claude Code command", () => {
    expect(part("Claude Desktop")).toContain("claude_desktop_config.json");
    expect(part("Claude Code")).toContain(`claude mcp add ${SERVER} -- npx -y ${PACKAGE}`);
  });

  it("names the ChatGPT desktop app and the config file it reads", () => {
    const chatgpt = part("ChatGPT");
    expect(chatgpt).toContain("ChatGPT desktop app");
    expect(chatgpt).toContain("~/.codex/config.toml");
    const toml = blocks(chatgpt, "toml");
    expect(toml.length, "the number of toml configs").toBe(1);
    expect(toml[0]).toContain(`[mcp_servers.${SERVER}]`);
    expect(toml[0]).toContain('command = "npx"');
    expect(toml[0]).toContain(`args = ["-y", "${PACKAGE}"]`);
  });

  it("names the Cursor config files", () => {
    const cursor = part("Cursor");
    expect(cursor).toContain(".cursor/mcp.json");
    expect(cursor).toContain("~/.cursor/mcp.json");
  });

  it("names the VS Code config files", () => {
    const vscode = part("VS Code Copilot");
    expect(vscode).toContain(".vscode/mcp.json");
    expect(vscode).toContain(".mcp.json");
  });
});
