// Live proof for Task 9: buyer pays the seller 0.5 CCD over x402; the facilitator sponsors
// the fee. Records the result (with before/after balances) in runs/x402-smoke.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { client, loadAccount, explorer } from "../concordium/chain.mjs";
import { createFacilitator, startSellerServer, buyerPay } from "../pay/x402.mjs";
import { totalMicro, toMicro } from "../amounts.mjs";
import { termsHash } from "../negotiation.mjs";

const keys = { buyer: ".secrets/buyer.export", seller: ".secrets/seller.export", facilitator: ".secrets/facilitator.export" };
const [buyer, seller, facilitatorAccount] = [keys.buyer, keys.seller, keys.facilitator].map(loadAccount);
const c = client();

const terms = { product: "smoke-test widget", unit_price: "0.25", quantity: 2, currency: "CCD" };
const hash = termsHash(terms);
const capMicro = toMicro("10");

async function balances() {
  const out = {};
  for (const [role, acct] of Object.entries({ buyer, seller, facilitator: facilitatorAccount })) {
    out[role] = (await c.getAccountInfo(acct.address)).accountAmount.microCcdAmount.toString();
  }
  return out;
}

const before = await balances();
const facilitator = createFacilitator(facilitatorAccount);
const sellerServer = await startSellerServer({
  facilitator,
  payTo: seller.address.address,
  dealAmountMicro: (h) => (h === hash ? totalMicro(terms) : null),
});

try {
  const { txHash, amount } = await buyerPay({ url: `${sellerServer.url}/deals/${hash}/settle`, account: buyer, terms, capMicro, payTo: seller.address.address });
  const after = await balances();
  const delta = Object.fromEntries(Object.keys(before).map((r) => [r, (BigInt(after[r]) - BigInt(before[r])).toString()]));
  const result = { terms, termsHash: hash, amountMicro: amount, txHash, explorerUrl: explorer(txHash), before, after, delta, at: new Date().toISOString() };
  mkdirSync("runs", { recursive: true });
  writeFileSync("runs/x402-smoke.json", `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await sellerServer.close();
}
