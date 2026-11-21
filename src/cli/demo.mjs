// End-to-end demo on Concordium testnet, three scenes:
//   1. A rogue agent with an unregistered badge tries to deal -> refused before any negotiation.
//   2. Verified buyer and seller check each other's badge, negotiate, settle over x402
//      (fees sponsored), and anchor the decision log on-chain.
//   3. Tamper check: edit one log entry -> the hash chain breaks and no longer matches the anchor.
// `--replay` uses the scripted negotiation (no model calls, labelled SCRIPTED); the default uses
// Claude under a hard worst-case budget that is checked before any call.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { client, loadAccount } from "../concordium/chain.mjs";
import { anchorHead, verifyAnchor } from "../concordium/anchor.mjs";
import { fetchBadgeVerdict } from "../concordium/mcp.mjs";
import { decide } from "../trust/badge-gate.mjs";
import { negotiate, termsHash } from "../negotiation.mjs";
import { scriptedDecider } from "../scripted-agents.mjs";
import { DecisionLog, verifyChain } from "../log/decision-log.mjs";
import { createFacilitator, startSellerServer, buyerPay } from "../pay/x402.mjs";
import { runDealRoom } from "../deal-room.mjs";
import { toMicro } from "../amounts.mjs";

const replay = process.argv.includes("--replay");
const say = (msg) => process.stdout.write(`${msg}\n`);
const scenario = JSON.parse(readFileSync("scenario.json", "utf8"));
const registry = JSON.parse(readFileSync("runs/registry.json", "utf8"));
const capMicro = toMicro(scenario.capCcd);
const ROGUE_BADGE = "JyP9VZZZZZZZZZZZZZZZZ";

async function makeDecider() {
  if (replay) return scriptedDecider(JSON.parse(readFileSync("test/fixtures/negotiation.json", "utf8")));
  const { claudeDecider, worstCaseUsd, LIMITS } = await import("../claude-agents.mjs");
  const worst = worstCaseUsd();
  if (worst > 5) throw new Error(`worst-case model spend $${worst.toFixed(2)} exceeds the $5 cap; aborting before any call`);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set; use --replay for the scripted run");
  say(`Claude agents: at most ${LIMITS.maxCalls} calls, worst case $${worst.toFixed(2)}`);
  return claudeDecider({ scenario });
}

const gate = async (badge) => {
  const { verdict } = await fetchBadgeVerdict(badge).catch((e) => ({ verdict: { error: e.message } }));
  return decide(verdict);
};

const c = client();
const buyerAcct = loadAccount(process.env.BUYER_KEY_FILE ?? ".secrets/buyer.export");
const sellerAcct = loadAccount(process.env.SELLER_KEY_FILE ?? ".secrets/seller.export");
const facilitatorAcct = loadAccount(process.env.FACILITATOR_KEY_FILE ?? ".secrets/facilitator.export");
const buyer = { role: "buyer", badge: registry.agents.buyer.tokenAddress };
const seller = { role: "seller", badge: registry.agents.seller.tokenAddress };

say("\nScene 1: a rogue agent tries to deal");
const scene1 = await runDealRoom({
  buyer, seller: { role: "seller", badge: ROGUE_BADGE }, gate,
  negotiate: async () => { throw new Error("negotiation must not start with an unverified counterparty"); },
  pay: async () => { throw new Error("no payment expected"); },
  anchor: async () => { throw new Error("no anchor expected"); },
  log: new DecisionLog(), capMicro,
});
say(`  outcome: ${scene1.outcome} (${scene1.reason})`);

say("\nScene 2: verified buyer and seller deal");
const decider = await makeDecider();
let agreedHash = null;
let agreedAmount = null;
const sellerServer = await startSellerServer({
  facilitator: createFacilitator(facilitatorAcct),
  payTo: sellerAcct.address.address,
  dealAmountMicro: (h) => (h === agreedHash ? agreedAmount : null),
});
let scene2;
try {
  scene2 = await runDealRoom({
    buyer, seller, gate,
    negotiate: () => negotiate({ decide: decider.decide, maxCalls: 8 }),
    pay: async (terms, amount) => {
      agreedHash = termsHash(terms);
      agreedAmount = amount;
      return buyerPay({ url: `${sellerServer.url}/deals/${agreedHash}/settle`, account: buyerAcct, terms, capMicro, payTo: sellerAcct.address.address });
    },
    anchor: (head) => anchorHead(c, buyerAcct, head),
    log: new DecisionLog(), capMicro,
  });
} finally {
  await sellerServer.close();
}
say(`  agents: ${decider.model ?? "Claude"} | calls ${decider.usage.calls}, tokens in ${decider.usage.inputTokens} / out ${decider.usage.outputTokens}`);
say(`  outcome: ${scene2.outcome} (${scene2.reason})`);
if (scene2.outcome === "deal") {
  say(`  terms: ${scene2.terms.quantity} units @ ${scene2.terms.unit_price} CCD, ${scene2.terms.lead_time_days} days`);
  say(`  payment: https://ccdexplorer.io/testnet/transaction/${scene2.payment.txHash}`);
  say(`  anchor:  ${scene2.anchor.explorerUrl}`);
}

say("\nScene 3: tamper check");
let scene3 = { skipped: "no anchored deal in scene 2" };
if (scene2.outcome === "deal") {
  const entries = scene2.log.entries;
  const anchoredHead = entries.at(-1).data.anchoredHead;
  const intact = verifyChain(entries.slice(0, -1));
  const onChain = await verifyAnchor(c, scene2.anchor.hash, anchoredHead);
  const tampered = structuredClone(entries.slice(0, -1));
  const payIdx = tampered.findIndex((e) => e.type === "payment");
  tampered[payIdx] = { ...tampered[payIdx], data: { ...tampered[payIdx].data, amountMicro: "1" } };
  const broken = verifyChain(tampered);
  scene3 = { intactChain: intact, onChainMatchesLog: onChain.ok, tamperedChain: broken, editedEntry: payIdx };
  say(`  untouched log: chain ok=${intact.ok}, head matches the on-chain anchor=${onChain.ok && intact.head === anchoredHead}`);
  say(`  after editing the payment amount: chain ok=${broken.ok} (broken at entry ${broken.brokenAt})`);
}

const run = { mode: replay ? "SCRIPTED replay" : "Claude", at: new Date().toISOString(), scenario, scenes: { rogue: scene1, deal: scene2, tamper: scene3 }, registry: { buyer: registry.agents.buyer, seller: registry.agents.seller } };
mkdirSync("runs", { recursive: true });
const file = `runs/demo-${run.at.replace(/[:.]/g, "-")}.json`;
writeFileSync(file, `${JSON.stringify(run, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2)}\n`);
say(`\nSaved ${file}`);
const ok = scene1.outcome === "refused" && scene2.outcome === "deal" && scene3.onChainMatchesLog && scene3.tamperedChain?.ok === false;
if (!ok) process.exitCode = 1;
