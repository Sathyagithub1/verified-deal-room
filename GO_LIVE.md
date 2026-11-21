# Going live on mainnet

The deal room runs on Concordium testnet today. These are the steps from here to agents settling real B2B orders.

## 1. Verified identities, for real

- On testnet both agents are backed by the testnet identity provider, which does no real KYC. On mainnet, each business that deploys an agent creates its owner account from a real Concordium identity provider. The badge then attests that a verified business stands behind the agent, without revealing who.
- Re-register the buyer and seller agents in the mainnet CIS-8004 registry, and host their cards on infrastructure that never rewrites bytes. The badge only stays valid while the served card hashes to the pinned value.

## 2. Onboard verified suppliers first

- Sourcio, Ayon AI's agentic B2B sourcing marketplace, lists suppliers whose agents carry a valid badge. Unbadged agents can browse but can't transact.
- Buyers keep their own badge and budget policy. The deal room refuses any counterparty whose badge fails, every time, before negotiating.

## 3. Turn on agent-to-agent settlement in steps

- Start with **repeat orders under a set value limit** per order and per day, configured by the buyer's finance team. Larger or first-time orders go to a human for approval.
- Move from CCD to a regulated stablecoin (USDR/EURR as Concordium protocol-level tokens) so invoices settle in the currency businesses book. `@x402/concordium` already supports these tokens. The buyer's `assertPayable` guard extends to check the token id.

## 4. Run a hosted facilitator

- Replace the in-process facilitator with a hosted one that sponsors fees. The cost is folded into the platform fee, so buyers never hold gas.
- Monitor sponsorship spend with a daily cap, and alert on anomalies.

## 5. Make the audit trail a product

- Anchor every deal's decision log, and keep the exported record with the order. It shows which verified agents dealt, what each offered, the human-set limits, the payment, and the anchor transaction.
- The record is evidence for internal audit and AI-governance reviews, such as record-keeping under the EU AI Act. It is not a legal determination by itself.

## Open questions before mainnet

- Which identity providers each target market's businesses will use.
- Facilitator economics at volume: observed testnet fees were about 4.7–4.9 CCD per sponsored transfer.
- Card hosting with guaranteed byte stability, such as content-addressed storage or a pinned CDN path.
