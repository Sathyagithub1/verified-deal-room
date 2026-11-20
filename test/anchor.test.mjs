import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyAnchor, extractRegisteredData } from "../src/concordium/anchor.mjs";

const HEAD = "ab".repeat(32);

function finalizedWith(data) {
  return {
    status: "finalized",
    outcome: { blockHash: "x", summary: { type: "accountTransaction", transactionType: "registerData", dataRegistered: { tag: "DataRegistered", data } } },
  };
}

function fakeClient(status) {
  return { getBlockItemStatus: async () => status };
}

test("extractRegisteredData reads the data from a finalized summary", () => {
  assert.equal(extractRegisteredData(finalizedWith(HEAD)), HEAD);
});

test("extractRegisteredData returns null for a pending transaction", () => {
  assert.equal(extractRegisteredData({ status: "received" }), null);
});

test("extractRegisteredData returns null when the summary is not a data registration", () => {
  const status = { status: "finalized", outcome: { summary: { type: "accountTransaction", transactionType: "transfer" } } };
  assert.equal(extractRegisteredData(status), null);
});

test("verifyAnchor is ok when the on-chain data equals the expected head", async () => {
  const r = await verifyAnchor(fakeClient(finalizedWith(HEAD)), "aa".repeat(32), HEAD);
  assert.deepEqual(r, { ok: true, onChain: HEAD });
});

test("verifyAnchor compares case-insensitively", async () => {
  const r = await verifyAnchor(fakeClient(finalizedWith(HEAD.toUpperCase())), "aa".repeat(32), HEAD);
  assert.equal(r.ok, true);
});

test("verifyAnchor fails when the on-chain data differs", async () => {
  const r = await verifyAnchor(fakeClient(finalizedWith("cd".repeat(32))), "aa".repeat(32), HEAD);
  assert.equal(r.ok, false);
  assert.equal(r.onChain, "cd".repeat(32));
});

test("verifyAnchor fails closed when the transaction is not finalized", async () => {
  const r = await verifyAnchor(fakeClient({ status: "committed", outcomes: [] }), "aa".repeat(32), HEAD);
  assert.deepEqual(r, { ok: false, onChain: null });
});

test("verifyAnchor rejects a malformed expected head", async () => {
  await assert.rejects(() => verifyAnchor(fakeClient(finalizedWith(HEAD)), "aa".repeat(32), "not-hex"), /expected head/);
});
