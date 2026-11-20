// The deal room: each agent checks the other's Concordium badge, they negotiate, the buyer
// pays the agreed total over x402, and the decision-log head is anchored on-chain.
// Every dependency is injected so the flow is testable without a network.
import { totalMicro } from "./amounts.mjs";

export async function runDealRoom({ buyer, seller, gate, negotiate, pay, anchor, log, capMicro, network = "testnet" }) {
  const finish = (outcome, reason, extra = {}) => ({
    outcome,
    reason,
    log: log.exportBundle({ anchorTx: extra.anchor?.hash ?? null, network }),
    ...extra,
  });

  for (const [self, other] of [[buyer, seller], [seller, buyer]]) {
    const verdict = await gate(other.badge);
    log.append(self.role, "badge_check", { counterparty: other.badge, allowed: verdict.allowed, reason: verdict.reason });
    if (!verdict.allowed) return finish("refused", verdict.reason);
  }

  const result = await negotiate();
  for (const turn of result.transcript) log.append(turn.role, turn.action, turn);
  if (result.outcome !== "deal") return finish("no_deal", result.reason);

  const amount = totalMicro(result.terms);
  if (amount > capMicro) return finish("no_deal", "agreed total exceeds budget cap");

  const payment = await pay(result.terms, amount);
  log.append(buyer.role, "payment", { amountMicro: amount.toString(), tx: payment.txHash });
  const anchored = await anchor(log.head());
  log.append("system", "anchor", { tx: anchored.hash, anchoredHead: log.entries().at(-1).hash });
  return finish("deal", "settled", { terms: result.terms, payment, anchor: anchored });
}
