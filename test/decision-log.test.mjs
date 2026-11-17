import { test } from "node:test";
import assert from "node:assert/strict";
import { DecisionLog, verifyChain } from "../src/log/decision-log.mjs";

const clock = () => "2026-11-20T00:00:00.000Z";

test("append links entries and moves the head", () => {
  const log = new DecisionLog({ clock });
  const a = log.append("buyer", "badge_check", { allowed: true });
  const b = log.append("seller", "offer", { unit_price: "0.3" });
  assert.equal(a.prev, "0".repeat(64));
  assert.equal(b.prev, a.hash);
  assert.equal(log.head(), b.hash);
});

test("entries are immutable once written", () => {
  const log = new DecisionLog({ clock });
  const e = log.append("buyer", "badge_check", { allowed: true });
  assert.throws(() => { e.actor = "rogue"; });
});

test("verifyChain accepts an untouched log and catches a tampered one", () => {
  const log = new DecisionLog({ clock });
  log.append("buyer", "badge_check", { allowed: true });
  log.append("seller", "offer", { unit_price: "0.3" });
  const entries = structuredClone(log.entries());
  assert.deepEqual(verifyChain(entries), { ok: true, head: log.head() });
  entries[0].data.allowed = false;
  assert.deepEqual(verifyChain(entries), { ok: false, brokenAt: 0 });
});

test("verifyChain catches a removed entry", () => {
  const log = new DecisionLog({ clock });
  log.append("buyer", "a", {});
  log.append("buyer", "b", {});
  log.append("buyer", "c", {});
  const entries = structuredClone(log.entries());
  entries.splice(1, 1);
  assert.equal(verifyChain(entries).ok, false);
});

test("hash ignores key order in data", () => {
  const a = new DecisionLog({ clock }).append("x", "t", { p: 1, q: 2 });
  const b = new DecisionLog({ clock }).append("x", "t", { q: 2, p: 1 });
  assert.equal(a.hash, b.hash);
});

test("export bundle carries head, anchor and every entry", () => {
  const log = new DecisionLog({ clock });
  log.append("buyer", "badge_check", { allowed: true });
  const b = log.exportBundle({ anchorTx: "abc", network: "testnet" });
  assert.equal(b.format, "ayon.decision-log/v1");
  assert.equal(b.head, log.head());
  assert.deepEqual(b.anchor, { network: "testnet", tx: "abc" });
  assert.equal(b.entries.length, 1);
});
