// Concordium testnet access: gRPC client, key-file accounts, submit-and-wait.
// Host/port default to the public testnet node and can be overridden with
// CCD_GRPC_HOST / CCD_GRPC_PORT.
import { readFileSync } from "node:fs";
import { ConcordiumGRPCNodeClient, credentials } from "@concordium/web-sdk/nodejs";
import { parseWallet, buildAccountSigner, AccountAddress, TransactionHash, Transaction } from "@concordium/web-sdk";

export const TESTNET_HOST = "grpc.testnet.concordium.com";
export const TESTNET_PORT = 20000;

export function client({ host = process.env.CCD_GRPC_HOST ?? TESTNET_HOST, port = Number(process.env.CCD_GRPC_PORT ?? TESTNET_PORT) } = {}) {
  return new ConcordiumGRPCNodeClient(host, port, credentials.createSsl(), { timeout: 15_000 });
}

/** Load a wallet export (`.export` file). Returns the address and a signer; keys stay in memory. */
export function loadAccount(keyFile) {
  const wallet = parseWallet(readFileSync(keyFile, "utf8"));
  return { address: AccountAddress.fromBase58(wallet.value.address), signer: buildAccountSigner(wallet) };
}

export async function nextNonce(c, address) {
  return (await c.getNextAccountNonce(address)).nonce;
}

/** Sign a built (Signable) transaction, submit it, and wait for finalization. */
export async function signSubmitAndWait(c, signable, signer, { timeoutMs = 120_000 } = {}) {
  const finalized = await Transaction.signAndFinalize(signable, signer);
  const hash = await c.sendTransaction(finalized);
  const outcome = await c.waitForTransactionFinalization(hash, timeoutMs);
  return { hash: TransactionHash.toHexString(hash), outcome };
}

export const explorer = (hash) => `https://ccdexplorer.io/testnet/transaction/${hash}`;
