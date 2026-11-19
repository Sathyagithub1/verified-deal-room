import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { CallCapExceeded, LIMITS, worstCaseUsd, claudeDecider } from "../src/claude-agents.mjs";

const scenario = JSON.parse(readFileSync(new URL("../scenario.json", import.meta.url), "utf8"));
const offer = { action: "offer", unit_price: "0.1", quantity: 100, lead_time_days: 14, message: "x" };

test("worst-case cost of one run stays within the $5 cap", () => {
  assert.ok(LIMITS.maxCalls <= 8 && LIMITS.maxTokens <= 4000);
  assert.ok(worstCaseUsd() <= 5, `worst case $${worstCaseUsd()}`);
});

test("decider refuses to exceed its call cap and never calls the client again", async () => {
  let calls = 0;
  const client = { messages: { parse: async () => { calls += 1; return { stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, parsed_output: offer }; } } };
  const d = claudeDecider({ scenario, maxCalls: 2, client });
  await d.decide("seller", []);
  await d.decide("buyer", []);
  await assert.rejects(d.decide("seller", []), CallCapExceeded);
  assert.equal(calls, 2);
  assert.deepEqual(d.usage, { calls: 2, inputTokens: 20, outputTokens: 10 });
});

test("cannot be configured above the hard limits", () => {
  assert.throws(() => claudeDecider({ scenario, maxCalls: 50, client: {} }), /maxCalls/);
});

test("prompts carry the scenario currency and cap, never NEAR", async () => {
  let seen;
  const client = { messages: { parse: async (req) => { seen = req; return { stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, parsed_output: offer }; } } };
  await claudeDecider({ scenario, maxCalls: 1, client }).decide("buyer", []);
  assert.match(seen.system, /10 CCD/);
  assert.doesNotMatch(seen.system, /NEAR/);
  assert.equal(seen.max_tokens, LIMITS.maxTokens);
});

test("refusal or missing output throws", async () => {
  const mk = (resp) => ({ messages: { parse: async () => resp } });
  await assert.rejects(claudeDecider({ scenario, maxCalls: 1, client: mk({ stop_reason: "refusal", usage: { input_tokens: 1, output_tokens: 1 } }) }).decide("buyer", []), /refused/);
  await assert.rejects(claudeDecider({ scenario, maxCalls: 1, client: mk({ stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) }).decide("buyer", []), /no valid decision/);
});
