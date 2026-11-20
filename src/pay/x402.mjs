// x402 settlement on Concordium with sponsored fees.
// Seller: a small HTTP paywall that answers 402 with the agreed amount and settles through
// an in-process facilitator. Facilitator: sponsors (pays) the fees. Buyer: pays only after
// assertPayable() confirms the 402 matches the agreed terms and the budget cap.
import http from "node:http";
import { x402Client } from "@x402/core/client";
import { x402HTTPClient, encodePaymentRequiredHeader, decodePaymentSignatureHeader, encodePaymentResponseHeader } from "@x402/core/http";
import { x402ResourceServer } from "@x402/core/server";
import { x402Facilitator } from "@x402/core/facilitator";
import { CONCORDIUM_TESTNET_CAIP2, toConcordiumFacilitatorSigner } from "@x402/concordium";
import { ExactConcordiumScheme as ClientScheme } from "@x402/concordium/exact/client";
import { ExactConcordiumScheme as ServerScheme } from "@x402/concordium/exact/server";
import { ExactConcordiumScheme as FacilitatorScheme } from "@x402/concordium/exact/facilitator";
import { totalMicro } from "../amounts.mjs";
import { TESTNET_HOST, TESTNET_PORT } from "../concordium/chain.mjs";

export const NETWORK = CONCORDIUM_TESTNET_CAIP2;
const INT = /^\d+$/;
const isCcd = (asset) => asset === undefined || asset === "" || asset.toUpperCase() === "CCD";

/** Pure guard the buyer runs before signing anything. Throws on any mismatch. */
export function assertPayable({ required, terms, capMicro, payTo, network = NETWORK }) {
  if (required.network !== network) throw new Error(`refusing to pay: network ${required.network} is not ${network}`);
  if (!isCcd(required.asset)) throw new Error(`refusing to pay: asset ${required.asset} is not CCD`);
  if (required.payTo !== payTo) throw new Error(`refusing to pay: recipient ${required.payTo} is not the seller ${payTo}`);
  if (typeof required.amount !== "string" || !INT.test(required.amount)) throw new Error(`refusing to pay: amount "${required.amount}" is not an integer micro-CCD value`);
  const amount = BigInt(required.amount);
  const agreed = totalMicro(terms);
  if (amount !== agreed) throw new Error(`refusing to pay: ${amount} micro-CCD does not match the agreed total ${agreed}`);
  if (amount > capMicro) throw new Error(`refusing to pay: ${amount} micro-CCD exceeds the budget cap ${capMicro}`);
}

const grpc = { host: process.env.CCD_GRPC_HOST ?? TESTNET_HOST, port: Number(process.env.CCD_GRPC_PORT ?? TESTNET_PORT), useTls: true };

/** In-process facilitator that sponsors fees from `account` ({ address, signer }). */
export function createFacilitator(account) {
  const signer = toConcordiumFacilitatorSigner(account.address.address, account.signer, { ...grpc, network: NETWORK });
  const facilitator = new x402Facilitator().register(NETWORK, new FacilitatorScheme({ signer }));
  return {
    verify: (payload, requirements) => facilitator.verify(payload, requirements),
    settle: (payload, requirements) => facilitator.settle(payload, requirements),
    getSupported: async () => facilitator.getSupported(),
  };
}

function send(res, status, headers, body) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

async function handleSettle(req, res, { resourceServer, requirementsFor }) {
  const match = req.url?.match(/^\/deals\/([0-9a-f]{64})\/settle$/);
  if (req.method !== "POST" || !match) return send(res, 404, {}, { error: "not found" });
  const requirements = await requirementsFor(match[1]);
  if (!requirements) return send(res, 404, {}, { error: "unknown deal" });
  const header = req.headers["payment-signature"];
  if (typeof header !== "string") {
    const paymentRequired = await resourceServer.createPaymentRequiredResponse(requirements, { url: req.url, description: `Settle deal ${match[1]}`, mimeType: "application/json" });
    return send(res, 402, { "payment-required": encodePaymentRequiredHeader(paymentRequired) }, paymentRequired);
  }
  const payload = decodePaymentSignatureHeader(header);
  const chosen = resourceServer.findMatchingRequirements(requirements, payload);
  if (!chosen) return send(res, 402, {}, { error: "payment does not match the requirements" });
  const verified = await resourceServer.verifyPayment(payload, chosen);
  if (!verified.isValid) return send(res, 402, {}, { error: `verification failed: ${verified.invalidReason ?? "unknown"}` });
  const settled = await resourceServer.settlePayment(payload, chosen);
  if (!settled.success) return send(res, 402, {}, { error: `settlement failed: ${settled.errorReason ?? "unknown"}` });
  return send(res, 200, { "payment-response": encodePaymentResponseHeader(settled) }, { txHash: settled.transaction });
}

/**
 * Seller paywall. `dealAmountMicro(termsHash)` returns the agreed amount (bigint) for a known
 * deal, or null. Resolves to { url, close }.
 */
export async function startSellerServer({ facilitator, payTo, dealAmountMicro, port = 0 }) {
  const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ServerScheme());
  await resourceServer.initialize();
  const requirementsFor = async (termsHash) => {
    const amount = dealAmountMicro(termsHash);
    if (amount === null) return null;
    return resourceServer.buildPaymentRequirements({ scheme: "exact", network: NETWORK, payTo, price: { amount: amount.toString(), asset: "CCD" } });
  };
  const server = http.createServer((req, res) => {
    handleSettle(req, res, { resourceServer, requirementsFor }).catch((e) => send(res, 500, {}, { error: e.message }));
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const { port: bound } = server.address();
  return { url: `http://127.0.0.1:${bound}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** Buyer: request the 402, check it with assertPayable, sign, and settle. Returns { txHash, amount }. */
export async function buyerPay({ url, account, terms, capMicro, payTo }) {
  const core = x402Client.fromConfig({
    schemes: [{ network: NETWORK, client: new ClientScheme({ accountAddress: account.address, signer: account.signer }, { grpcUrl: `${grpc.host}:${grpc.port}`, useTls: true }) }],
    spendControls: false, // our own assertPayable is the spend control: exact amount, seller, cap
  });
  const client = new x402HTTPClient(core);
  const first = await fetch(url, { method: "POST" });
  if (first.status !== 402) throw new Error(`expected 402 from the seller, got ${first.status}`);
  const paymentRequired = client.getPaymentRequiredResponse((n) => first.headers.get(n), await first.json());
  const required = paymentRequired.accepts?.[0];
  if (!required) throw new Error("seller sent no payment requirements");
  assertPayable({ required, terms, capMicro, payTo });
  const payload = await core.createPaymentPayload(paymentRequired);
  const paid = await fetch(url, { method: "POST", headers: client.encodePaymentSignatureHeader(payload) });
  const body = await paid.json();
  if (paid.status !== 200) throw new Error(`settlement rejected (${paid.status}): ${body.error ?? "unknown"}`);
  return { txHash: body.txHash, amount: required.amount };
}
