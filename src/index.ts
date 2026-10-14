#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, VERSION } from "./server.js";

function usage(): void {
  console.log(`gpa-calculator-mcp ${VERSION}

GPA, grade conversion and final exam math for AI apps (MCP). Works offline.

Add it to your AI app's MCP config with command "npx" and args ["-y", "gpa-calculator-mcp"].

  --help, --version`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "--help" || cmd === "-h") return usage();
  if (cmd === "--version" || cmd === "-v") return console.log(VERSION);
  await createServer().connect(new StdioServerTransport());
  console.error(`gpa-calculator-mcp ${VERSION} running`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
