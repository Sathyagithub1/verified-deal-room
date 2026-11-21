# Submission pack — Concordium Trusted Agents Hackathon (Encode)

Drafted for the owner to paste into the Encode project page. Nothing here has been submitted.

- **Final deadline:** Wednesday 9 December 2026, 23:59 UTC.
- **Project:** Verified Deal Room by Ayon AI.
- **Challenge:** Make your Agents Accountable with Concordium.
- **Repo:** https://github.com/Sathyagithub1/verified-deal-room

## Short description (one line)

AI procurement agents that only negotiate with Concordium-verified counterparties, settle on their own over x402 with sponsored fees, and anchor an audit-grade record of every decision on-chain.

## Description

Businesses are starting to let AI agents source suppliers, negotiate and pay. A supplier can't tell whether an accountable company stands behind the agent it's talking to, and afterwards nobody can prove what the agent decided. Verified Deal Room fixes both on Concordium.

Before any message is exchanged, each agent checks the other's **Verified by Concordium badge** through the hosted Agent Registry MCP server. An unverified agent is refused. In our live demo, a well-formed badge for an agent that was never registered gets turned away. Verified agents then negotiate price, quantity and lead time. Claude plays both sides inside a hard budget cap. The buyer pays the agreed total over **x402**, and a facilitator **sponsors the fee**, so the buyer never needs gas. Every step goes into a hash-chained decision log whose head is **anchored on-chain** and read back, so any later edit is detectable. The log exports as an EU AI Act record-keeping bundle.

All of it runs on Concordium testnet today, with explorer links for every step in the README.

## How it works / what we built

- **Two agents registered in the CIS-8004 Agent Registry** (tokens 1368 and 1369). Their badged cards are pinned on-chain with `setAgentURI`, and `check_badge` returns `badge_valid: true` for both.
- **Fail-closed badge gate.** It allows a counterparty only if the agent is registered and active, the card is reachable, the card hash matches the on-chain hash and the badge is well-formed.
- **x402 settlement with sponsored V1 transactions** (`@x402/concordium`). The buyer refuses any 402 whose amount, recipient, network, asset or cap doesn't match the agreed terms.
- **Decision log anchored with RegisterData** and verified by read-back.
- **EU AI Act record export.**
- **72 unit tests.** The scripted replay runs without an API key.

## Concordium components used (with proof)

- Verified by Concordium badge + hosted MCP server: [buyer badge check](https://agent-registry-mcp.concordium.com/v1/check-badge/JyP9VYjovVVVqtRQyBhPf), [seller badge check](https://agent-registry-mcp.concordium.com/v1/check-badge/JyP9VZqHrWzRg1f9swboB)
- CIS-8004 Agent Registry `<12802,0>`:
  - buyer: [register](https://ccdexplorer.io/testnet/transaction/a47251e4e06d8be9e807f9bf48b2bd90b45886be95a30cd4ca6f45ca4c1476a2), [pin](https://ccdexplorer.io/testnet/transaction/bd9bc1de23dc7994decf75404b9e47d10fdd7bd4314c89c1b3674b314eea5f1b)
  - seller: [register](https://ccdexplorer.io/testnet/transaction/9a908985e71bcd0219f1b72c91cba2138ecb47e05388ace6487c228f74ba6568), [pin](https://ccdexplorer.io/testnet/transaction/d6d2dfd4141d41950b924ee98454ef8f44c075fa495e03d412600aa0cfdb42c6)
- x402 with sponsored fees: [Claude-negotiated 8 CCD payment](https://ccdexplorer.io/testnet/transaction/30b55af306ef1f45fb08ce3dcc5e4b77a24606c929c6dece8eb5d8f33627cf23)
- On-chain decision-log anchor: [anchor](https://ccdexplorer.io/testnet/transaction/b3d2fcc83ed5d00294878ea79cee1a2d9778729005cd25c59aeff9856ae1baad)

## Honest notes

- **Identity:** both agents are backed by one verified person, the founder, through the **Concordium testnet identity provider** (no real KYC on testnet). Mainnet uses a real identity provider.
- **Pre-existing work:** the negotiation engine is ported from Ayon AI's earlier Sourcio agent. Everything Concordium was built from the 19 November build window. Commit history shows the dates.
- **Cut from scope:** A2A transport between the agents. They run in one process, and the badge check is the trust boundary.
- **Fees:** sponsored transfers cost about 4.7–4.9 test CCD each, paid by the facilitator.

## Go-live plan (summary)

Sourcio onboards suppliers whose agents carry a mainnet badge. Agent-to-agent settlement turns on first for repeat orders under a set value limit, then moves to USDR/EURR stablecoins through a hosted facilitator that sponsors fees. Full plan: `GO_LIVE.md`.

## Team

Sathyamoorthy Venkatesan, Founder, Ayon AI Inc. (Toronto, Canada). Solo builder covering product and engineering.

## Video script (≤ 3 min, screen recording + AI voiceover)

| Time | Screen | Voiceover |
|---|---|---|
| 0:00–0:20 | Title card, then a supplier inbox full of "AI agent" requests | "AI agents are starting to buy and sell for businesses. But when an agent asks for a quote, who stands behind it? And afterwards, who can prove what it decided?" |
| 0:20–0:45 | README diagram | "Verified Deal Room puts a Concordium check in front of every deal. Each agent carries a Verified by Concordium badge, registered in the Agent Registry and backed by a verified identity, without revealing who." |
| 0:45–1:10 | Terminal: Scene 1 (rogue refused) | "Here a rogue agent shows up with a badge that looks valid. The deal room asks the registry over MCP: no agent was ever registered for it. Refused, before a single message." |
| 1:10–1:55 | Terminal: Scene 2 offers scrolling (Claude run) | "Now two verified agents. Both badges check out: active, and the card hash matches what's pinned on-chain. Claude negotiates for both sides. The seller opens at 0.12, the buyer counters at 0.065, and seven moves later they agree at 0.08: eight CCD, inside the buyer's ten-CCD cap." |
| 1:55–2:25 | x402 payment, then explorer page for the transfer | "The seller answers 402 Payment Required. The buyer checks the amount matches the deal to the micro-CCD, signs, and a facilitator sponsors the fee. Settled on Concordium in seconds." |
| 2:25–2:50 | Scene 3 tamper check + explorer page of the anchor | "Every step went into a hash-chained log, and its head is anchored on-chain. Change one number afterwards and the chain breaks. The record exports for EU AI Act audits." |
| 2:50–3:00 | Repo URL + Ayon AI | "Verified Deal Room by Ayon AI. Agents you can trust, deals you can prove." |

Recording tips:
- Run `npm run replay` for a deterministic take. The Claude run's output is in `runs/` for the negotiation lines.
- Keep the explorer tabs ready: payment `30b55af3…`, anchor `b3d2fcc8…`.
