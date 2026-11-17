# Concordium Trusted Agents — Checkpoint 1 (due 22 Nov 2026)

## Project name
**Verified Deal Room** by Ayon AI

## One-liner
AI procurement agents that only negotiate with verified counterparties, settle on their own over x402, and leave an audit-grade record of every decision.

## The problem
Businesses are starting to let AI agents source suppliers, negotiate prices and pay invoices. On the other side of the deal, a supplier has no way to tell whether an accountable company stands behind the agent it's talking to. Neither side can later prove what the agent decided or why. Without that, no finance or compliance team will let an agent spend real money.

## The idea
We're bringing an agent we already run. **Sourcio** is Ayon AI's agentic B2B sourcing system: a Claude-powered buyer agent negotiates wholesale deals within a hard budget cap, and settlement only accepts the hash of the agreed terms. It is live today on NEAR testnet. In this hackathon we make it trusted on Concordium:

1. **Verified by Concordium badge.** Both the buyer agent (Ayon) and the seller agent carry a badge showing that a verified business stands behind them, without revealing who.
2. **Agent Registry + ERC-8004 Agent Card.** Each agent is registered and linked to the address it already uses.
3. **Badge check before any deal.** Each agent checks the other's badge over Concordium's hosted MCP server before negotiating. An unverified agent is refused, and the demo shows this.
4. **x402 settlement with sponsored fees.** The agreed price is paid agent-to-agent on Concordium testnet, so end users never hold tokens.
5. **Decision log.** Every step (badge checks, offers, counter-offers, the budget cap, the final terms and the payment) is written to a tamper-evident log anchored to the agent's Registry entry. It can be exported as a record-keeping bundle for the EU AI Act.

## Concordium components used
Verified by Concordium badge · Agent Registry · ERC-8004 Agent Card · x402 with sponsored fees · hosted MCP server · Concordium testnet

## Who it's for / path to production
Mid-market buyers and suppliers in B2B wholesale. They are Sourcio's target users, and their procurement and compliance teams need accountability before letting agents transact. Path to mainnet: Sourcio's marketplace onboards verified suppliers first, then turns on agent-to-agent settlement for repeat orders under a set value limit.

## Team
- **Sathyamoorthy Venkatesan**, Founder, Ayon AI (Toronto, Canada). Lead: product and engineering. Sathya@ayonai.com
- _[Add other team members' names and roles here, or delete this line if submitting solo]_

**Ayon AI** is a Canadian AI software studio. Its products include Cyla AI (agency operating system), AUBO (revenue attribution) and Sourcio (agentic B2B commerce).

## Links
- Existing agent (NEAR testnet version): https://github.com/Sathyagithub1/sourcio-near
- Concordium build repo: _to be added once created_
