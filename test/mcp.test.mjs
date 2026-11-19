import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHttpResponse, extractJsonRpc, unwrapToolResult } from "../src/concordium/mcp.mjs";
import { decide } from "../src/trust/badge-gate.mjs";

const raw = readFileSync(new URL("./fixtures/mcp-raw.check_badge.txt", import.meta.url), "latin1");
const body = (s) => `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n${s}`;
const chunked = (parts) =>
  `HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n` +
  parts.map((p) => `${Buffer.byteLength(p).toString(16)}\r\n${p}\r\n`).join("") + "0\r\n\r\n";

test("real server reply (claims chunked, sends raw JSON) parses to a badge verdict the gate accepts", () => {
  const verdict = unwrapToolResult(extractJsonRpc(raw).result);
  assert.equal(verdict.token_address, "JyP9UhTu6PeHXpm6LAhSy");
  assert.equal(decide(verdict).allowed, true);
});

test("properly chunked body is dechunked by declared sizes", () => {
  const msg = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { hash: "a1b2c3d4e5f60718293a4b5c6d7e8f90" } });
  const r = parseHttpResponse(chunked([msg.slice(0, 20), msg.slice(20)]));
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.body).result.hash, "a1b2c3d4e5f60718293a4b5c6d7e8f90");
});

test("an all-hex chunk payload survives (no line-dropping heuristics)", () => {
  const msg = '{"jsonrpc":"2.0","id":1,"result":"' + "ab".repeat(16) + '"}';
  const r = extractJsonRpc(chunked([msg.slice(0, 34), msg.slice(34, 50), msg.slice(50)]));
  assert.equal(r.result, "ab".repeat(16));
});

test("SSE framing is unwrapped", () => {
  const r = extractJsonRpc(body('event: message\r\ndata: {"jsonrpc":"2.0","id":2,"result":[1]}\r\n\r\n'));
  assert.deepEqual(r.result, [1]);
});

test("JSON-RPC error and non-200 status throw with context", () => {
  assert.throws(() => extractJsonRpc(body('{"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"bad args"}}')), /bad args/);
  assert.throws(() => extractJsonRpc("HTTP/1.1 429 Too Many Requests\r\n\r\nslow down"), /429/);
});

test("tool text that isn't JSON is returned as text", () => {
  assert.equal(unwrapToolResult({ content: [{ type: "text", text: "plain" }] }), "plain");
});

test("badge verdict uses MCP first and falls back to REST only on transport failure", async () => {
  const { fetchBadgeVerdict } = await import("../src/concordium/mcp.mjs");
  const ok = await fetchBadgeVerdict("B", { mcp: async () => ({ v: "mcp" }), rest: async () => ({ v: "rest" }) });
  assert.deepEqual([ok.via, ok.verdict.v], ["mcp", "mcp"]);
  const fb = await fetchBadgeVerdict("B", { mcp: async () => { throw new Error("socket hang up"); }, rest: async () => ({ v: "rest" }) });
  assert.deepEqual([fb.via, fb.verdict.v, fb.mcpError], ["rest", "rest", "socket hang up"]);
});
