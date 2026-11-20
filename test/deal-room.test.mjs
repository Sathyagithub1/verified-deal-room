import { test } from "node:test";
import assert from "node:assert/strict";
import { runDealRoom } from "../src/deal-room.mjs";
import { DecisionLog, verifyChain } from "../src/log/decision-log.mjs";
import { totalMicro, toMicro } from "../src/amounts.mjs";

const buyer = { role: "buyer", badge: "badge-buyer" };
const seller = { role: "seller", badge: "badge-seller" };
const clock = () => "2026-11-20T00:00:00.000Z";
const allow = async () => ({ allowed: true, reason: "verified" });

const dealTranscript = [
  { role: "seller", action: "offer", unit_price: "0.3", quantity: 10, lead_time_days: 5, message: "list" },
  { role: "buyer", action: "offer", unit_price: "0.25", quantity: 10, lead_time_days: 5, message: "counter" },
  { role: "seller", action: "accept", unit_price: "0.25", quantity: 10, lead_time_days: 5, message: "ok" },
];
const dealTerms = { unit_price: "0.25", quantity: 10, lead_time_days: 5 };

function spies() {
  const calls = { negotiate: 0, pay: [], anchor: [] };
  return {
    calls,
    pay: async (terms, amount) => { calls.pay.push({ terms, amount }); return { txHash: "pay-tx" }; },
    anchor: async (head) => { calls.anchor.push(head); return { hash: "anchor-tx", explorerUrl: "x" }; },
  };
}

test("an unbadged counterparty is refused before any negotiation", async () => {
  const s = spies();
  const gate = async (badge) => (badge === seller.badge ? { allowed: false, reason: "badge not recognised" } : { allowed: true, reason: "verified" });
  const log = new DecisionLog({ clock });
  const r = await runDealRoom({ buyer, seller, gate, negotiate: async () => { s.calls.negotiate++; return { outcome: "deal" }; }, pay: s.pay, anchor: s.anchor, log, capMicro: toMicro("10") });
  assert.equal(r.outcome, "refused");
  assert.equal(s.calls.negotiate, 0);
  assert.equal(s.calls.pay.length, 0);
  const refusal = r.log.entries.find((e) => e.type === "badge_check" && e.data.allowed === false);
  assert.equal(refusal.data.counterparty, seller.badge);
});

test("verified parties that agree negotiate, pay the agreed total, and anchor the log", async () => {
  const s = spies();
  const log = new DecisionLog({ clock });
  const r = await runDealRoom({ buyer, seller, gate: allow, negotiate: async () => ({ outcome: "deal", terms: dealTerms, transcript: dealTranscript }), pay: s.pay, anchor: s.anchor, log, capMicro: toMicro("10") });
  assert.equal(r.outcome, "deal");
  assert.deepEqual(r.log.entries.map((e) => e.type), ["badge_check", "badge_check", "offer", "offer", "accept", "payment", "anchor"]);
  assert.equal(s.calls.pay[0].amount, totalMicro(dealTerms));
  assert.equal(r.log.entries.find((e) => e.type === "payment").data.amountMicro, totalMicro(dealTerms).toString());
  assert.equal(r.log.anchor.tx, "anchor-tx");
  assert.equal(verifyChain(r.log.entries).ok, true);
});

test("the anchored head covers everything up to and including the payment", async () => {
  const s = spies();
  const log = new DecisionLog({ clock });
  const r = await runDealRoom({ buyer, seller, gate: allow, negotiate: async () => ({ outcome: "deal", terms: dealTerms, transcript: dealTranscript }), pay: s.pay, anchor: s.anchor, log, capMicro: toMicro("10") });
  const payment = r.log.entries.find((e) => e.type === "payment");
  assert.equal(s.calls.anchor[0], payment.hash);
});

test("a deal over the budget cap is never paid", async () => {
  const s = spies();
  const log = new DecisionLog({ clock });
  const r = await runDealRoom({ buyer, seller, gate: allow, negotiate: async () => ({ outcome: "deal", terms: dealTerms, transcript: dealTranscript }), pay: s.pay, anchor: s.anchor, log, capMicro: toMicro("2") });
  assert.equal(r.outcome, "no_deal");
  assert.match(r.reason, /budget cap/);
  assert.equal(s.calls.pay.length, 0);
  assert.equal(s.calls.anchor.length, 0);
});

test("no agreement means no payment and no anchor", async () => {
  const s = spies();
  const log = new DecisionLog({ clock });
  const transcript = [{ role: "seller", action: "walk_away", unit_price: "1", quantity: 1, lead_time_days: 1, message: "no" }];
  const r = await runDealRoom({ buyer, seller, gate: allow, negotiate: async () => ({ outcome: "no_deal", reason: "seller walked away", transcript }), pay: s.pay, anchor: s.anchor, log, capMicro: toMicro("10") });
  assert.equal(r.outcome, "no_deal");
  assert.equal(s.calls.pay.length, 0);
  assert.equal(r.log.entries.at(-1).type, "walk_away");
});
