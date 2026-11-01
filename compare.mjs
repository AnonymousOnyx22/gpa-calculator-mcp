import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./build/src/server.js";

const glama = JSON.parse(readFileSync("./glama.json", "utf8"));
const server = createServer();
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: "compare", version: "0.0.0" });
await server.connect(serverTransport);
await client.connect(clientTransport);
const { tools } = await client.listTools();
await client.close();
await server.close();

const norm = (v) => JSON.stringify(v);

for (const tool of tools) {
  const g = glama.tools.find((t) => t.name === tool.name);
  if (!g) { console.log(`MISSING in glama: ${tool.name}`); continue; }
  if (g.description !== tool.description) console.log(`DESC differs: ${tool.name}`);
  const gParams = new Map((g.parameters ?? []).map((p) => [p.name, p]));
  const sParams = tool.inputSchema?.properties ?? {};
  const sReq = new Set(tool.inputSchema?.required ?? []);
  for (const [name, schema] of Object.entries(sParams)) {
    const gp = gParams.get(name);
    if (!gp) { console.log(`PARAM missing in glama: ${tool.name}.${name}`); continue; }
    gParams.delete(name);
    if (gp.description !== schema.description) console.log(`PARAM desc differs: ${tool.name}.${name}\n  glama: ${gp.description}\n  code : ${schema.description}`);
    const gt = Array.isArray(gp.type) ? gp.type : [gp.type];
    const st = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
    if (norm(gt) !== norm(st)) console.log(`PARAM type differs: ${tool.name}.${name} glama=${norm(gt)} code=${norm(st)}`);
    if ((gp.required ?? false) !== sReq.has(name)) console.log(`PARAM required differs: ${tool.name}.${name} glama=${gp.required} code=${sReq.has(name)}`);
    if (norm(gp.enum) !== norm(schema.enum)) console.log(`PARAM enum differs: ${tool.name}.${name} glama=${norm(gp.enum)} code=${norm(schema.enum)}`);
    if (norm(gp.default) !== norm(schema.default)) console.log(`PARAM default differs: ${tool.name}.${name} glama=${norm(gp.default)} code=${norm(schema.default)}`);
    if (gp.items && schema.items) {
      const gi = gp.items.properties ?? {};
      const si = schema.items.properties ?? {};
      for (const [n, s] of Object.entries(si)) {
        if (!gi[n]) console.log(`ITEM param missing in glama: ${tool.name}.${name}.${n}`);
        else if (gi[n].description !== s.description) console.log(`ITEM param desc differs: ${tool.name}.${name}.${n}\n  glama: ${gi[n].description}\n  code : ${s.description}`);
        if (gi[n] && norm(gi[n].type) !== norm(s.type)) console.log(`ITEM param type differs: ${tool.name}.${name}.${n} glama=${norm(gi[n].type)} code=${norm(s.type)}`);
      }
      for (const n of Object.keys(gi)) if (!si[n]) console.log(`ITEM param extra in glama: ${tool.name}.${name}.${n}`);
      const gr = new Set(gp.items.required ?? []);
      const sr = new Set(schema.items.required ?? []);
      for (const n of sr) if (!gr.has(n)) console.log(`ITEM required missing in glama: ${tool.name}.${name}.${n}`);
      for (const n of gr) if (!sr.has(n)) console.log(`ITEM required extra in glama: ${tool.name}.${name}.${n}`);
    }
  }
  for (const name of gParams.keys()) console.log(`PARAM extra in glama: ${tool.name}.${name}`);
  if (tool.inputSchema && Object.keys(sParams).length === 0 && (g.parameters ?? []).length !== 0) console.log(`PARAM should be empty: ${tool.name}`);
}
for (const g of glama.tools) if (!tools.find((t) => t.name === g.name)) console.log(`EXTRA in glama: ${g.name}`);
