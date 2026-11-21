// Register the buyer and seller agents in the CIS-8004 Agent Registry, in phases, because
// each agent card must be published (pushed to the public repo) between steps:
//   node src/cli/register.mjs cards    -> write cards/<role>.json (pre-mint)       then publish
//   node src/cli/register.mjs register -> verify hosted hash, mint both agents, add badges -> publish
//   node src/cli/register.mjs pin      -> verify hosted hash, pin it on-chain, check both badges
// State and every transaction link are kept in runs/registry.json.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { client, loadAccount } from "../concordium/chain.mjs";
import { tools, submitBuilt, assertServedHash } from "../concordium/registry.mjs";

const CARD_BASE_URL = process.env.CARD_BASE_URL ?? "https://raw.githubusercontent.com/Sathyagithub1/verified-deal-room/main/cards";
const STATE = "runs/registry.json";
const PROVIDER = { organization: "Ayon AI Inc.", url: "https://github.com/Sathyagithub1/verified-deal-room" };

const AGENTS = {
  buyer: {
    keyFile: process.env.BUYER_KEY_FILE ?? ".secrets/buyer.export",
    name: "Ayon Deal Room — Buyer Agent",
    description: "Procurement agent for Ayon AI's Verified Deal Room. Negotiates wholesale purchases within a hard budget cap, deals only with badge-verified counterparties, and pays over x402.",
    skills: [{ id: "negotiate-purchase", name: "Negotiate purchase", description: "Negotiates unit price, quantity and lead time within a buyer's budget cap.", tags: ["procurement", "negotiation"] }],
  },
  seller: {
    keyFile: process.env.SELLER_KEY_FILE ?? ".secrets/seller.export",
    name: "Ayon Deal Room — Seller Agent",
    description: "Supplier agent for Ayon AI's Verified Deal Room. Quotes and negotiates wholesale orders above a price floor, deals only with badge-verified counterparties, and accepts x402 payment.",
    skills: [{ id: "negotiate-sale", name: "Negotiate sale", description: "Quotes and negotiates unit price, quantity and lead time above a seller's floor.", tags: ["sales", "negotiation"] }],
  },
};

const load = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { agents: {} });
const save = (s) => { mkdirSync("runs", { recursive: true }); writeFileSync(STATE, `${JSON.stringify(s, null, 2)}\n`); };
const writeCard = (role, json) => { mkdirSync("cards", { recursive: true }); writeFileSync(`cards/${role}.json`, json); };
const say = (msg) => process.stdout.write(`${msg}\n`);

async function phaseCards(state) {
  for (const [role, a] of Object.entries(AGENTS)) {
    const owner = loadAccount(a.keyFile).address.address;
    const agentUri = `${CARD_BASE_URL}/${role}.json`;
    const card = await tools.buildCard({ name: a.name, description: a.description, agent_uri: agentUri, owner_account: owner, skills: a.skills, provider: PROVIDER });
    writeCard(role, card.agent_card_json);
    state.agents[role] = { owner, agentUri, preMintHash: card.metadata_hash_hex };
    say(`${role}: card written (sha256 ${card.metadata_hash_hex})`);
  }
  save(state);
}

async function tokenIdFor(owner, agentUri) {
  const listed = await tools.agentsByOwner(owner);
  const agents = Array.isArray(listed) ? listed : listed.agents ?? [];
  const mine = agents.filter((x) => (x.agent_uri ?? x.uri) === agentUri);
  return mine.length ? String(mine.at(-1).token_id ?? mine.at(-1).tokenId) : null;
}

async function phaseRegister(state, c) {
  for (const [role, a] of Object.entries(AGENTS)) {
    const s = state.agents[role];
    const account = loadAccount(a.keyFile);
    await assertServedHash(s.agentUri, s.preMintHash);
    s.tokenId = s.tokenId ?? (await tokenIdFor(s.owner, s.agentUri));
    if (!s.tokenId) {
      const built = await tools.buildRegister({ sender: s.owner, agent_uri: s.agentUri, metadata_hash_hex: s.preMintHash });
      const tx = await submitBuilt(c, account, built);
      s.registerTx = { hash: tx.hash, explorerUrl: tx.explorerUrl };
      s.tokenId = await tokenIdFor(s.owner, s.agentUri);
      if (!s.tokenId) throw new Error(`${role}: registered (${tx.hash}) but the indexer has not listed the agent yet; rerun "register"`);
    }
    const badged = await tools.buildBadge({ card_url: s.agentUri, owner_account: s.owner, token_id: s.tokenId });
    const cardJson = badged.agent_card_json ?? badged.card_json;
    writeCard(role, cardJson);
    s.tokenAddress = cardJson.match(/"tokenAddress":\s*"ccd:[0-9a-f]+\/cis-2:([1-9A-HJ-NP-Za-km-z]+)"/)?.[1] ?? null;
    s.badgedHash = badged.metadata_hash_hex ?? badged.sha256;
    say(`${role}: token ${s.tokenId}, badged card written (sha256 ${s.badgedHash})`);
    save(state);
  }
}

async function phasePin(state, c) {
  for (const [role, a] of Object.entries(AGENTS)) {
    const s = state.agents[role];
    await assertServedHash(s.agentUri, s.badgedHash);
    if (!s.pinTx) {
      const built = await tools.buildSetUri({ token_id: s.tokenId, agent_uri: s.agentUri, metadata_hash_hex: s.badgedHash, sender: s.owner });
      const tx = await submitBuilt(c, loadAccount(a.keyFile), built);
      s.pinTx = { hash: tx.hash, explorerUrl: tx.explorerUrl };
    }
    const verdict = await tools.checkBadge(s.tokenAddress ?? s.owner);
    s.lastCheck = verdict;
    save(state);
    say(`${role}: pinned (${s.pinTx.hash})`);
  }
}

const phase = process.argv[2];
const phases = { cards: phaseCards, register: phaseRegister, pin: phasePin };
if (!phases[phase]) throw new Error(`usage: register.mjs <${Object.keys(phases).join("|")}>`);
await phases[phase](load(), client());
