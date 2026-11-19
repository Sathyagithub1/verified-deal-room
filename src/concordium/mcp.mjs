// Client for Concordium's hosted Agent Registry MCP server. Its replies declare
// "Transfer-Encoding: chunked" but often send the body unframed, which breaks fetch/curl,
// so we read the raw TLS socket and dechunk only when the framing actually adds up.
import tls from "node:tls";

export const HOST = "agent-registry-mcp.concordium.com";

export function parseHttpResponse(raw) {
  const split = raw.indexOf("\r\n\r\n");
  if (split < 0) throw new Error("MCP: malformed HTTP response");
  const head = raw.slice(0, split);
  const status = Number(head.match(/^HTTP\/1\.[01] (\d{3})/)?.[1]);
  const rest = raw.slice(split + 4);
  const isChunked = /^transfer-encoding:\s*chunked/im.test(head);
  return { status, body: isChunked ? dechunk(rest) ?? rest : rest };
}

/** Strict dechunk by declared sizes; returns null when the framing is not real chunking. */
function dechunk(s) {
  const buf = Buffer.from(s, "latin1");
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const eol = buf.indexOf("\r\n", i, "latin1");
    if (eol < 0) return null;
    const sizeLine = buf.toString("latin1", i, eol).split(";")[0].trim();
    if (!/^[0-9a-fA-F]+$/.test(sizeLine)) return null;
    const size = parseInt(sizeLine, 16);
    if (size === 0) return Buffer.concat(out).toString("utf8");
    const start = eol + 2;
    if (start + size > buf.length) return null;
    out.push(buf.subarray(start, start + size));
    i = start + size + 2;
  }
  return null;
}

function stripSse(body) {
  if (!/^(event|data):/m.test(body)) return body;
  return body.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
}

export function extractJsonRpc(raw) {
  const { status, body } = parseHttpResponse(raw);
  if (status !== 200) throw new Error(`MCP: HTTP ${status}: ${body.slice(0, 200)}`);
  const text = stripSse(Buffer.from(body, "latin1").toString("utf8")).trim();
  const msg = JSON.parse(text.slice(text.indexOf("{")));
  if (msg.error) throw new Error(`MCP error ${msg.error.code}: ${msg.error.message}`);
  return msg;
}

/** MCP tool results arrive as {content:[{type:"text",text:"<json>"}]}. */
export function unwrapToolResult(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (text === undefined) return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let nextId = 1;

export function callTool(name, args, { timeoutMs = 20_000 } = {}) {
  const payload = JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } });
  const request =
    `POST /mcp HTTP/1.1\r\nHost: ${HOST}\r\nContent-Type: application/json\r\n` +
    `Accept: application/json, text/event-stream\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n` +
    `Connection: close\r\n\r\n${payload}`;
  return new Promise((resolve, reject) => {
    const sock = tls.connect(443, HOST, { servername: HOST }, () => sock.write(request));
    const chunks = [];
    sock.setTimeout(timeoutMs, () => sock.destroy(new Error(`MCP ${name} timed out after ${timeoutMs} ms`)));
    sock.on("data", (d) => chunks.push(d));
    sock.on("error", reject);
    sock.on("close", () => {
      try {
        resolve(unwrapToolResult(extractJsonRpc(Buffer.concat(chunks).toString("latin1")).result));
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** Badge verdict: MCP first (as the hackathon brief suggests), REST only if the MCP transport fails. */
export async function fetchBadgeVerdict(badge, { mcp = callTool, rest = restCheckBadge } = {}) {
  try {
    return { via: "mcp", verdict: await mcp("check_badge", { id: badge }) };
  } catch (err) {
    return { via: "rest", verdict: await rest(badge), mcpError: err.message };
  }
}

async function restCheckBadge(badge) {
  const r = await fetch(`https://${HOST}/v1/check-badge/${encodeURIComponent(badge)}`, { signal: AbortSignal.timeout(20_000) });
  return r.json();
}
