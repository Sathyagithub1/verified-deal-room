// Map a decision-log bundle to a record-keeping JSON in the spirit of the EU AI Act's
// logging duties (automatic, timestamped event records that let a deployer trace what a
// system did). It is an evidence artefact, not a legal compliance determination.
import { verifyChain } from "./decision-log.mjs";

const explorer = (network, tx) => `https://ccdexplorer.io/${network}/transaction/${tx}`;

export function toEuAiActRecord({ bundle, agents, oversight, generatedAt = new Date().toISOString() }) {
  const check = verifyChain(bundle.entries);
  return {
    format: "ayon.euaia-record/v1",
    generatedAt,
    note: "Record-keeping evidence for an AI agent transaction. Not legal advice or a compliance determination.",
    system: {
      name: "Verified Deal Room",
      provider: "Ayon AI Inc.",
      network: bundle.anchor.network,
      agents: Object.entries(agents).map(([role, a]) => ({
        role,
        badge: a.tokenAddress,
        registryTokenId: a.tokenId,
        ownerAccount: a.owner,
        agentCard: a.agentUri,
        cardSha256: a.badgedHash,
      })),
    },
    humanOversight: {
      budgetCapMicro: oversight.capMicro.toString(),
      maxModelCalls: oversight.maxCalls,
      counterpartyRule: "deal only with agents whose Concordium badge verifies (active, card hash matches on-chain)",
    },
    events: bundle.entries.map((e) => ({ seq: e.seq, timestamp: e.ts, actor: e.actor, type: e.type, data: e.data, prevHash: e.prev, hash: e.hash })),
    integrity: {
      head: bundle.head,
      chainVerified: check.ok,
      ...(check.ok ? {} : { brokenAt: check.brokenAt }),
      anchor: bundle.anchor.tx ? { network: bundle.anchor.network, tx: bundle.anchor.tx, explorerUrl: explorer(bundle.anchor.network, bundle.anchor.tx) } : null,
    },
  };
}
