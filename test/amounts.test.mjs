import { test } from "node:test";
import assert from "node:assert/strict";
import { toMicro, fromMicro, totalMicro } from "../src/amounts.mjs";

test("toMicro parses up to 6 decimals exactly", () => {
  assert.equal(toMicro("1"), 1_000_000n);
  assert.equal(toMicro("0.000001"), 1n);
  assert.equal(toMicro("12.5"), 12_500_000n);
});
test("toMicro rejects >6 decimals, negatives, junk", () => {
  for (const bad of ["1.0000001", "-1", "1e3", "", "abc"]) assert.throws(() => toMicro(bad));
});
test("fromMicro round-trips", () => {
  assert.equal(fromMicro(12_500_000n), "12.5");
  assert.equal(fromMicro(1n), "0.000001");
  assert.equal(fromMicro(3_000_000n), "3");
});
test("totalMicro multiplies unit price by quantity", () => {
  assert.equal(totalMicro({ unit_price: "0.25", quantity: 40 }), 10_000_000n);
});
