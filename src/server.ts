import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "./core/tools.js";
import { tools } from "./tools.js";

export const VERSION = "0.1.7";

export function createServer(): McpServer {
  const server = new McpServer({ name: "gpa-calculator-mcp", version: VERSION });
  registerTools(server, tools, null);
  return server;
}
