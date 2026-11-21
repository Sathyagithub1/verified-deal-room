// Decides whether our agent may deal with a counterparty, from the verdict returned by
// Concordium's Agent Registry badge check for ONE badge. Anything unexpected refuses.

const REQUIRED_CHECKS = [
  "on_chain_agent_found",
  "status_active",
  "card_fetched",
  "hash_matches_on_chain",
  "badge_present",
  "badge_well_formed",
];

const refuse = (reason) => ({ allowed: false, reason, warnings: [] });

export function decide(verdict) {
  if (typeof verdict === "string" && verdict.trim()) return refuse(`badge not recognised by the registry: ${verdict.trim().slice(0, 200)}`);
  if (!verdict || typeof verdict !== "object") return refuse("no badge verdict");
  if (verdict.error) return refuse(`badge not recognised (${verdict.error})`);
  if (Array.isArray(verdict.agents)) return refuse("account-level verdict; a single badge is required");
  if (!verdict.checks || typeof verdict.checks !== "object") return refuse("verdict has no checks");

  const failed = REQUIRED_CHECKS.filter((c) => verdict.checks[c] !== true);
  if (failed.length) return refuse(`failed checks: ${failed.join(", ")}`);

  const issues = Array.isArray(verdict.issues) ? verdict.issues : [];
  const errors = issues.filter((i) => i?.severity === "error").map((i) => i.field);
  if (errors.length) return refuse(`error issues: ${errors.join(", ")}`);
  if (verdict.badge_valid !== true) return refuse("registry did not mark the badge valid");

  return {
    allowed: true,
    reason: "verified: active agent, card hash matches on-chain, badge well-formed",
    tokenAddress: verdict.token_address,
    owner: verdict.on_chain?.owner_account,
    warnings: issues.filter((i) => i?.severity === "warning").map((i) => i.field),
  };
}
