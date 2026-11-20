import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPayable } from "../src/pay/x402.mjs";

const SELLER = "4PrHYANQoqNYtMAgnh8Jev6vhqaJ7Rjnmfe2SaTB91acFEKChZ";
const terms = { unit_price: "0.25", quantity: 2 }; // 0.5 CCD = 500000 micro
const base = { network: "ccd:4221332d34e1694168c2a0c0b3fd0f27", scheme: "exact", payTo: SELLER, amount: "500000", asset: "CCD" };

test("an exact match on amount, recipient, network and asset is payable", () => {
  assert.doesNotThrow(() => assertPayable({ required: base, terms, capMicro: 10_000_000n, payTo: SELLER }));
});

test("an amount different from the agreed total is refused", () => {
  assert.throws(() => assertPayable({ required: { ...base, amount: "500001" }, terms, capMicro: 10_000_000n, payTo: SELLER }), /does not match the agreed total/);
});

test("an amount over the budget cap is refused even if it matches the terms", () => {
  assert.throws(() => assertPayable({ required: base, terms, capMicro: 400_000n, payTo: SELLER }), /exceeds the budget cap/);
});

test("a different recipient is refused", () => {
  assert.throws(() => assertPayable({ required: { ...base, payTo: "4Bbiw5dh6rKkPrTujo98E52kXxf1XEU2JupFfrsnnZ4xrgHYu4" }, terms, capMicro: 10_000_000n, payTo: SELLER }), /recipient/);
});

test("a different network is refused", () => {
  assert.throws(() => assertPayable({ required: { ...base, network: "ccd:9dd9ca4d19e9393877d2c44b70f89acb" }, terms, capMicro: 10_000_000n, payTo: SELLER }), /network/);
});

test("a non-CCD asset is refused", () => {
  assert.throws(() => assertPayable({ required: { ...base, asset: "EURR" }, terms, capMicro: 10_000_000n, payTo: SELLER }), /asset/);
});

test("a non-integer amount string is refused", () => {
  assert.throws(() => assertPayable({ required: { ...base, amount: "0.5" }, terms, capMicro: 10_000_000n, payTo: SELLER }), /amount/);
});
