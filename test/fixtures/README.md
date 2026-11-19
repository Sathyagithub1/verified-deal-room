# Fixtures

| File | Source | Captured |
|---|---|---|
| `check-badge.valid.json` | `GET https://agent-registry-mcp.concordium.com/v1/check-badge/JyP9UhTu6PeHXpm6LAhSy` (a third-party testnet agent with a valid badge) | 2026-11-19 |
| `check-badge.invalid-card.json` | `GET …/v1/check-badge/JyP9TtQC3HCNrTYR3sc2T` (testnet agent whose card URL returns 404) | 2026-11-19 |
| `check-badge.unknown.json` | `GET …/v1/check-badge/NotARealBadge111` | 2026-11-19 |
| `negotiation.json` | Hand-written scripted negotiation in CCD (labelled SCRIPTED in demo output) | 2026-11-17 |

These are real responses from Concordium's hosted Agent Registry service, read-only. Tests derive the revoked case by flipping `checks.status_active` on a copy of the valid fixture.
