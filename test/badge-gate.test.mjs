import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decide } from "../src/trust/badge-gate.mjs";

const fx = (f) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));

test("real valid badge => allowed, warnings carried through", () => {
  const r = decide(fx("check-badge.valid.json"));
  assert.equal(r.allowed, true);
  assert.equal(r.tokenAddress, "JyP9UhTu6PeHXpm6LAhSy");
  assert.deepEqual(r.warnings.sort(), ["embedding", "verify"]);
});

test("real badge whose card is missing => refused with the service's error fields", () => {
  const r = decide(fx("check-badge.invalid-card.json"));
  assert.equal(r.allowed, false);
  assert.match(r.reason, /card_fetch/);
});

test("unknown badge (bad_request) => refused", () => {
  const r = decide(fx("check-badge.unknown.json"));
  assert.equal(r.allowed, false);
  assert.match(r.reason, /bad_request|not recognised/);
});

test("revoked agent (status not active) => refused even if badge_valid were true", () => {
  const v = fx("check-badge.valid.json");
  v.checks.status_active = false;
  assert.equal(decide(v).allowed, false);
});

test("badge_valid true but an error-severity issue => refused", () => {
  const v = fx("check-badge.valid.json");
  v.issues.push({ severity: "error", field: "chain", message: "x" });
  assert.equal(decide(v).allowed, false);
});

test("account-level response (many agents) is not accepted as one badge", () => {
  assert.equal(decide({ account: "3abc", agents: [fx("check-badge.valid.json")] }).allowed, false);
});

test("missing / garbage verdicts fail closed", () => {
  for (const v of [null, undefined, {}, "ok", { badge_valid: true }]) assert.equal(decide(v).allowed, false);
});

test("a plain-text registry error is refused and quoted in the reason", () => {
  const r = decide("config error: `JyP9VZZZZZZZZZZZZZZZZ` is neither a CIS-8004 badge token address nor a Concordium account address");
  assert.equal(r.allowed, false);
  assert.match(r.reason, /^badge not recognised by the registry: config error/);
});
