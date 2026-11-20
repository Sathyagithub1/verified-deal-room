// Anchor a decision-log head hash on Concordium (RegisterData) and read it back.
import { Transaction, DataBlob, TransactionHash } from "@concordium/web-sdk";
import { nextNonce, signSubmitAndWait, explorer } from "./chain.mjs";

const HEX32 = /^[0-9a-f]{64}$/i;

function assertHead(headHex, label) {
  if (typeof headHex !== "string" || !HEX32.test(headHex)) throw new Error(`${label}: must be a 32-byte hex string`);
}

/** Write `headHex` (32 bytes) to the chain from `account`. Returns the tx hash and explorer URL. */
export async function anchorHead(c, account, headHex) {
  assertHead(headHex, "anchor head");
  const bytes = Buffer.from(headHex, "hex");
  const data = new DataBlob(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const nonce = await nextNonce(c, account.address);
  const signable = Transaction.registerData({ data }).addMetadata({ sender: account.address, nonce }).build();
  const { hash, outcome } = await signSubmitAndWait(c, signable, account.signer);
  const onChain = extractRegisteredData({ status: "finalized", outcome });
  if (onChain?.toLowerCase() !== headHex.toLowerCase()) {
    throw new Error(`anchor ${hash}: finalized but registered data does not match (got ${onChain ?? "none"})`);
  }
  return { hash, explorerUrl: explorer(hash) };
}

/** Pull the registered data hex out of a block item status; null unless finalized RegisterData. */
export function extractRegisteredData(status) {
  if (status?.status !== "finalized") return null;
  const summary = status.outcome?.summary;
  if (summary?.transactionType !== "registerData") return null;
  return summary.dataRegistered?.data ?? null;
}

/** Re-read an anchor transaction and check it carries `expectedHeadHex`. Fails closed. */
export async function verifyAnchor(c, txHashHex, expectedHeadHex) {
  assertHead(expectedHeadHex, "expected head");
  const status = await c.getBlockItemStatus(TransactionHash.fromHexString(txHashHex));
  const onChain = extractRegisteredData(status);
  return { ok: onChain !== null && onChain.toLowerCase() === expectedHeadHex.toLowerCase(), onChain };
}
