import { test } from "node:test";
import assert from "node:assert/strict";
import { toEuAiActRecord } from "../src/log/export-euaia.mjs";
import { DecisionLog } from "../src/log/decision-log.mjs";

function bundle() {
  const log = new DecisionLog({ clock: () => "2026-11-21T00:00:00.000Z" });
  log.append("buyer", "badge_check", { counterparty: "S", allowed: true, reason: "verified" });
  log.append("seller", "badge_check", { counterparty: "B", allowed: true, reason: "verified" });
  log.append("seller", "offer", { role: "seller", action: "offer", unit_price: "0.12", quantity: 100, lead_time_days: 14, message: "list" });
  log.append("buyer", "accept", { role: "buyer", action: "accept", unit_price: "0.12", quantity: 100, lead_time_days: 14, message: "ok" });
  log.append("buyer", "payment", { amountMicro: "12000000", tx: "pay-tx" });
  const head = log.head();
  log.append("system", "anchor", { tx: "anchor-tx", anchoredHead: head });
  return log.exportBundle({ anchorTx: "anchor-tx", network: "testnet" });
}

const agents = {
  buyer: { tokenId: "1368", tokenAddress: "JyP9VYjovVVVqtRQyBhPf", owner: "4Bbi", agentUri: "https://x/buyer.json", badgedHash: "aa" },
  seller: { tokenId: "1369", tokenAddress: "JyP9VZqHrWzRg1f9swboB", owner: "4PrH", agentUri: "https://x/seller.json", badgedHash: "bb" },
};
const oversight = { capMicro: 10_000_000n, maxCalls: 8 };

test("the record contains every log entry in order", () => {
  const b = bundle();
  const r = toEuAiActRecord({ bundle: b, agents, oversight });
  assert.deepEqual(r.events.map((e) => e.hash), b.entries.map((e) => e.hash));
  assert.deepEqual(r.events.map((e) => e.type), ["badge_check", "badge_check", "offer", "accept", "payment", "anchor"]);
});

test("the record carries the anchor transaction and an explorer link", () => {
  const r = toEuAiActRecord({ bundle: bundle(), agents, oversight });
  assert.equal(r.integrity.anchor.tx, "anchor-tx");
  assert.equal(r.integrity.anchor.explorerUrl, "https://ccdexplorer.io/testnet/transaction/anchor-tx");
  assert.equal(r.integrity.chainVerified, true);
});

test("the record identifies both agents by badge and pinned card hash", () => {
  const r = toEuAiActRecord({ bundle: bundle(), agents, oversight });
  assert.deepEqual(r.system.agents.map((a) => [a.role, a.badge, a.cardSha256]), [["buyer", "JyP9VYjovVVVqtRQyBhPf", "aa"], ["seller", "JyP9VZqHrWzRg1f9swboB", "bb"]]);
});

test("the record lists the human-set limits as oversight points", () => {
  const r = toEuAiActRecord({ bundle: bundle(), agents, oversight });
  assert.equal(r.humanOversight.budgetCapMicro, "10000000");
  assert.equal(r.humanOversight.maxModelCalls, 8);
});

test("a tampered bundle is exported but flagged as not verified", () => {
  const b = bundle();
  const tampered = { ...b, entries: b.entries.map((e, i) => (i === 4 ? { ...e, data: { ...e.data, amountMicro: "1" } } : e)) };
  const r = toEuAiActRecord({ bundle: tampered, agents, oversight });
  assert.equal(r.integrity.chainVerified, false);
  assert.equal(r.integrity.brokenAt, 4);
});
