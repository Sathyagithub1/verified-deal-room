// CIS-8004 Agent Registry: turn the hosted MCP's sign-ready payloads into contract updates,
// sign them with our own keys, and check that hosted agent cards match their pinned hash.
// The MCP holds no keys; we never send it anything secret.
import { createHash } from "node:crypto";
import { Transaction, ContractAddress, ReceiveName, Parameter, Energy, CcdAmount } from "@concordium/web-sdk";
import { callTool } from "./mcp.mjs";
import { nextNonce, signSubmitAndWait, explorer } from "./chain.mjs";

export const REGISTRY = Object.freeze({ index: 12802n, subindex: 0n });
const ENTRYPOINTS = new Set(["CIS-8004.register", "CIS-8004.setAgentURI"]);
const MAX_ENERGY = 200_000;

/** Validate a builder payload and map it to an updateContract payload + energy. Fails closed. */
export function contractUpdateFrom(built, { network = "testnet" } = {}) {
  if (built.network !== network) throw new Error(`registry payload is for network ${built.network}, expected ${network}`);
  const { index, subindex } = built.contract_address ?? {};
  if (BigInt(index) !== REGISTRY.index || BigInt(subindex) !== REGISTRY.subindex) throw new Error(`payload targets <${index},${subindex}>, not the registry contract`);
  if (!ENTRYPOINTS.has(built.receive_name)) throw new Error(`unexpected registry entrypoint ${built.receive_name}`);
  const energy = Number(built.suggested_energy);
  if (!Number.isInteger(energy) || energy <= 0 || energy > MAX_ENERGY) throw new Error(`unreasonable energy ${built.suggested_energy}`);
  return {
    payload: {
      amount: CcdAmount.zero(),
      address: ContractAddress.create(REGISTRY.index, REGISTRY.subindex),
      receiveName: ReceiveName.fromString(built.receive_name),
      message: Parameter.fromHexString(built.parameter_hex),
    },
    energy: Energy.create(energy),
  };
}

/** Sign and submit a builder payload from `account`. Returns { hash, explorerUrl, outcome }. */
export async function submitBuilt(c, account, built) {
  const { payload, energy } = contractUpdateFrom(built);
  const nonce = await nextNonce(c, account.address);
  const signable = Transaction.updateContract(payload, energy).addMetadata({ sender: account.address, nonce }).build();
  const { hash, outcome } = await signSubmitAndWait(c, signable, account.signer);
  if (outcome.summary?.transactionType === "failed") throw new Error(`registry tx ${hash} rejected: ${JSON.stringify(outcome.summary.rejectReason)}`);
  return { hash, explorerUrl: explorer(hash), outcome };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fetch `url` and require its bytes to hash to `expectedSha` (retries for CDN propagation). */
export async function assertServedHash(url, expectedSha, { fetcher = fetch, attempts = 12, delayMs = 30_000 } = {}) {
  let got = null;
  for (let i = 1; i <= attempts; i++) {
    const res = await fetcher(`${url}${url.includes("?") ? "&" : "?"}nocache=${Date.now()}`, { cache: "no-store" });
    if (res.status === 200) {
      got = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
      if (got === expectedSha.toLowerCase()) return;
    }
    if (i < attempts) await sleep(delayMs);
  }
  throw new Error(`served card at ${url} hashes to ${got ?? "nothing"}, which does not match ${expectedSha}`);
}

export const tools = {
  buildCard: (args) => callTool("build_agent_card", { network: "testnet", ...args }),
  buildRegister: (args) => callTool("build_register", { network: "testnet", ...args }),
  buildBadge: (args) => callTool("build_agent_badge", { network: "testnet", ...args }),
  buildSetUri: (args) => callTool("build_set_agent_uri", { network: "testnet", ...args }),
  agentsByOwner: (owner) => callTool("agents_by_owner", { network: "testnet", owner_account: owner }),
  checkBadge: (id) => callTool("check_badge", { network: "testnet", id }),
};
