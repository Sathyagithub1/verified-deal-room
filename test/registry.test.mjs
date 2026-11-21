import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { contractUpdateFrom, assertServedHash, REGISTRY } from "../src/concordium/registry.mjs";

const built = {
  network: "testnet",
  contract_address: { index: 12802, subindex: 0 },
  receive_name: "CIS-8004.register",
  parameter_hex: "0100",
  suggested_energy: 30000,
};

test("a builder payload becomes a zero-amount update to the registry contract", () => {
  const p = contractUpdateFrom(built);
  assert.equal(p.payload.address.index, 12802n);
  assert.equal(p.payload.address.subindex, 0n);
  assert.equal(p.payload.receiveName.value, "CIS-8004.register");
  assert.equal(p.payload.amount.microCcdAmount, 0n);
  assert.equal(Buffer.from(p.payload.message.buffer).toString("hex"), "0100");
  assert.equal(p.energy.value, 30000n);
});

test("a payload for any contract other than the registry is refused", () => {
  assert.throws(() => contractUpdateFrom({ ...built, contract_address: { index: 1, subindex: 0 } }), /registry contract/);
});

test("a payload for a non-registry entrypoint is refused", () => {
  assert.throws(() => contractUpdateFrom({ ...built, receive_name: "cis2_multi.transfer" }), /entrypoint/);
});

test("a payload for another network is refused", () => {
  assert.throws(() => contractUpdateFrom({ ...built, network: "mainnet" }), /network/);
});

test("absurd energy is refused", () => {
  assert.throws(() => contractUpdateFrom({ ...built, suggested_energy: 10_000_000 }), /energy/);
});

test("assertServedHash passes when the served bytes hash to the expected value", async () => {
  const body = '{"name":"x"}';
  const sha = createHash("sha256").update(body).digest("hex");
  const fetcher = async () => new Response(body, { status: 200 });
  await assert.doesNotReject(() => assertServedHash("https://example.test/card.json", sha, { fetcher }));
});

test("assertServedHash fails when the served bytes differ", async () => {
  const fetcher = async () => new Response('{"name":"y"}', { status: 200 });
  await assert.rejects(() => assertServedHash("https://example.test/card.json", "0".repeat(64), { fetcher, attempts: 1 }), /does not match/);
});

test("the registry constant points at the testnet CIS-8004 contract", () => {
  assert.deepEqual(REGISTRY, { index: 12802n, subindex: 0n });
});
