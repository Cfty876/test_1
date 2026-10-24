import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const secretsPath = path.join(projectRoot, ".env.design-tools.local");
const key =
  process.env.API_KEY_21ST ||
  (fs.existsSync(secretsPath)
    ? parse(fs.readFileSync(secretsPath)).API_KEY_21ST
    : "");
if (!key)
  throw new Error(
    "Set API_KEY_21ST in the ignored .env.design-tools.local file.",
  );

async function rpc(method, params, id = 1) {
  const response = await fetch("https://21st.dev/api/mcp", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "x-api-key": key,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!response.ok)
    throw new Error(
      `21st returned HTTP ${response.status}. Credentials were not logged.`,
    );
  const raw = await response.text();
  let data;
  if (raw.trimStart().startsWith("{")) data = JSON.parse(raw);
  else {
    const messages = raw
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5)));
    data = messages.find((item) => item.id === id);
  }
  if (!data) throw new Error("21st returned no JSON-RPC result.");
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

await rpc("initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "pervik-design-tools", version: "1.0.0" },
});
const [tool = "--list", json = "{}"] = process.argv.slice(2);
const args = json.startsWith("@")
  ? JSON.parse(fs.readFileSync(json.slice(1), "utf8"))
  : JSON.parse(json);
const result =
  tool === "--list"
    ? await rpc("tools/list", {}, 2)
    : await rpc("tools/call", { name: tool, arguments: args }, 2);
console.log(JSON.stringify(result, null, 2));
