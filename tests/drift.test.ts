import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
const glama = JSON.parse(readFileSync(new URL("../glama.json", import.meta.url), "utf8")) as {
  tools: { name: string }[];
};

/** The tool headings under "## Tools" in llms.txt, in file order. */
function llmsToolNames(text: string): string[] {
  return text
    .slice(text.indexOf("## Tools"))
    .split(/^### /m)
    .slice(1)
    .map((part) => part.split("\n")[0].trim())
    .filter((name) => name !== "");
}

/** The tool names a client gets from the running server, over an in memory link. */
async function servedToolNames(): Promise<string[]> {
  const server = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "tool list drift test", version: "0.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    return tools.map((t) => t.name);
  } finally {
    await client.close();
    await server.close();
  }
}

let served: string[];
beforeAll(async () => {
  served = await servedToolNames();
});

// The docs test compares src/tools.ts with the docs. This one goes through the
// server handshake, so a tool that is added, dropped or renamed while the
// server is wired up shows up here too.
describe("every tool the server serves appears in the docs", () => {
  it("lists every tool the server serves in llms.txt, once and in the same order", () => {
    expect(served.length, "tools the server serves").toBeGreaterThan(0);
    expect(llmsToolNames(llms)).toEqual(served);
  });

  it("lists every tool the server serves in glama.json, once and in the same order", () => {
    expect(glama.tools.map((t) => t.name)).toEqual(served);
  });
});
