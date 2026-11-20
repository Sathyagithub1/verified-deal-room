// Live proof for Task 7: anchor a fresh hash from the buyer account, read it back,
// and record the result in runs/anchor-smoke.json.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { client, loadAccount } from "../concordium/chain.mjs";
import { anchorHead, verifyAnchor } from "../concordium/anchor.mjs";

const keyFile = process.env.BUYER_KEY_FILE ?? ".secrets/buyer.export";
const c = client();
const buyer = loadAccount(keyFile);
const label = `deal-room smoke ${new Date().toISOString()}`;
const head = createHash("sha256").update(label).digest("hex");

const { hash, explorerUrl } = await anchorHead(c, buyer, head);
const readBack = await verifyAnchor(c, hash, head);
const result = { label, head, sender: buyer.address.address, txHash: hash, explorerUrl, readBack, at: new Date().toISOString() };

mkdirSync("runs", { recursive: true });
writeFileSync("runs/anchor-smoke.json", `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!readBack.ok) process.exitCode = 1;
