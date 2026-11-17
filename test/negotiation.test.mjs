import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { negotiate, termsHash } from "../src/negotiation.mjs";
import { scriptedDecider } from "../src/scripted-agents.mjs";
import { totalMicro } from "../src/amounts.mjs";

// Scripted stand-in for the model so these tests make zero paid calls.
const scripted = (moves) => {
  let i = 0;
  return async () => moves[i++];
};
const offer = (p, msg = "offer") => ({ action: "offer", unit_price: p, quantity: 100, lead_time_days: 14, message: msg });
const accept = { action: "accept", unit_price: "0", quantity: 1, lead_time_days: 1, message: "deal" };

test("accept locks in the other side's latest offer, not the accepter's echo", async () => {
  const r = await negotiate({ decide: scripted([offer("1.5"), offer("0.7"), offer("1.0"), accept]), maxCalls: 8 });
  assert.equal(r.outcome, "deal");
  assert.equal(r.acceptedBy, "buyer");
  assert.equal(r.terms.unit_price, "1.0");
  assert.equal(r.calls, 4);
});

test("stops at the call cap even if agents never agree", async () => {
  const r = await negotiate({ decide: async () => offer("1.2"), maxCalls: 5 });
  assert.equal(r.outcome, "no_deal");
  assert.equal(r.transcript.length, 5);
});

test("accepting before any counter-offer is not a deal", async () => {
  const r = await negotiate({ decide: scripted([accept]), maxCalls: 8 });
  assert.equal(r.outcome, "no_deal");
});

test("walk away ends the negotiation", async () => {
  const r = await negotiate({ decide: scripted([offer("1.5"), { ...offer("0"), action: "walk_away" }]), maxCalls: 8 });
  assert.equal(r.outcome, "no_deal");
  assert.match(r.reason, /buyer walked away/);
});

test("malformed model output is rejected", async () => {
  await assert.rejects(negotiate({ decide: scripted([{ action: "offer", unit_price: "cheap" }]), maxCalls: 8 }));
});

test("terms hash is stable regardless of key order", () => {
  const a = termsHash({ b: 1, a: 2 });
  assert.equal(a, termsHash({ a: 2, b: 1 }));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("scripted fixture reaches a deal inside the demo budget", async () => {
  const moves = JSON.parse(readFileSync(new URL("./fixtures/negotiation.json", import.meta.url), "utf8"));
  const r = await negotiate({ decide: scriptedDecider(moves).decide, maxCalls: 8 });
  assert.equal(r.outcome, "deal");
  assert.equal(r.terms.unit_price, "0.09");
  assert.ok(totalMicro(r.terms) <= 10_000_000n, "fits the 10 CCD demo cap");
});

test("scripted decider rejects a move for the wrong role", async () => {
  const d = scriptedDecider([{ role: "buyer", ...offer("1") }]);
  await assert.rejects(d.decide("seller"), /is for buyer/);
});
