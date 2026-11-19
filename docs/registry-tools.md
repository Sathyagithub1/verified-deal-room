# Agent Registry MCP tools (captured 2026-11-19, tools/list, read-only)

Total tools: 41

## `agents_by_owner`

Return every CIS-8004 agent currently owned by the given Base58 AccountAddress. Requires the sibling Agent Registry indexer.

```json
{
  "type": "object",
  "properties": {
    "owner_account": {
      "type": "string",
      "description": "Base58 AccountAddress."
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 1000,
      "default": 500
    },
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "required": [
    "owner_account"
  ],
  "additionalProperties": false
}
```

## `build_agent_badge`

Add or upgrade the Concordium Badge on an EXISTING Agent Card without disturbing its other fields. Give it the card — either `card_json` (the served bytes as a string) or `card_url` (the service fetches it) — plus the owner account (and token_id once minted); it strips any legacy top-level `concordium` block, injects the current A2A extension badge into capabilities.extensions, refreshes the ERC-8004 registrations entry, and carries forward externalReference/services/agentWallet from a prior badge (contract refs re-encoded to CAIP-10). Returns the merged canonical JSON + its sha256. Host the returned JSON verbatim, then pin the new hash with build_set_agent_uri. Use build_agent_card for a brand-new card, or get_badge_json when you only want the badge block to paste yourself.

```json
{
  "type": "object",
  "properties": {
    "card_json": {
      "type": [
        "string",
        "null"
      ],
      "description": "The Agent Card JSON the agent currently serves (the bytes at agent_uri), as a string. Either this or card_url."
    },
    "card_url": {
      "type": [
        "string",
        "null"
      ],
      "format": "uri",
      "description": "Alternative to card_json: the URL the card is served at (usually the agent_uri). The service fetches it (HTTP 200 required) and uses the served bytes."
    },
    "owner_account": {
      "type": "string",
      "description": "Base58 Concordium account that owns the agent NFT."
    },
    "token_id": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^[0-9]+$"
        },
        {
          "type": "integer",
          "minimum": 0
        },
        {
          "type": "null"
        }
      ],
      "description": "On-chain token_id (decimal). When set, the badge carries the canonical tokenAddress + a registrations entry. Leave null pre-mint."
    },
    "agent_wallet": {
      "type": [
        "string",
        "null"
      ],
      "description": "Optional payment wallet override. Defaults to the prior badge's agentWallet, else owner_account."
    },
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "required": [
    "network",
    "owner_account"
  ],
  "additionalProperties": false
}
```

## `build_agent_card`

Compose a complete A2A AgentCard JSON with a Concordium extension block, given human-shaped identity input. The tool injects every on-chain identifier (CAIP-2 chain id, token_address, contract refs) that a human can't reliably hand-write, and returns the canonical JSON plus its sha256. Use this from a conversation: collect name, description, skills, owner_account, optional token_id from the user, call this tool, then hand the resulting JSON to the user to host at `agent_uri` and the resulting hash to `build_set_agent_uri` to pin on-chain.

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128
    },
    "description": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2048
    },
    "agent_uri": {
      "type": "string",
      "format": "uri",
      "description": "Public URL where the card JSON will be hosted. Echoed into `url` and used as the hashing identity."
    },
    "owner_account": {
      "type": "string",
      "description": "Base58 Concordium account that owns / will own the agent NFT."
    },
    "agent_wallet": {
      "type": [
        "string",
        "null"
      ],
      "description": "Optional separate wallet for routing payments. Defaults to owner_account."
    },
    "token_id": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^[0-9]+$"
        },
        {
          "type": "integer",
          "minimum": 0
        },
        {
          "type": "null"
        }
      ],
      "description": "If known, the on-chain token_id (decimal). When set, the tool computes the canonical token_address. Leave null pre-mint."
    },
    "version": {
      "type": "string",
      "default": "1.0.0"
    },
    "skills": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "name": {
            "type": "string",
            "minLength": 1
          },
          "description": {
            "type": "string"
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "default": []
          }
        },
        "required": [
          "id",
          "name",
          "description"
        ],
        "additionalProperties": false
      }
    },
    "provider": {
      "type": [
        "object",
        "null"
      ],
      "properties": {
        "organization": {
          "type": "string"
        },
        "url": {
          "type": "string",
          "format": "uri"
        }
      },
      "required": [
        "organization"
      ],
      "additionalProperties": false
    },
    "documentation_url": {
      "type": [
        "string",
        "null"
      ],
      "format": "uri"
    },
    "external_reference": {
      "type": [
        "object",
        "null"
      ],
      "description": "Optional external-key binding. Shape: { kind: 'Cis8', namespace, identifier } where identifier is the human-readable handle.",
      "properties": {
        "kind": {
          "type": "string",
          "enum": [
            "Cis8"
          ]
        },
        "namespace": {
          "type": "string",
          "minLength": 1
        },
        "identifier": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "kind",
        "namespace",
        "identifier"
      ],
      "additionalProperties": false
    },
    "services": {
      "type": [
        "object",
        "null"
      ],
      "description": "Free-form key/value map of service endpoints surfaced under concordium.services (e.g. { tippingMcp: 'https://...' }).",
      "additionalProperties": {
        "type": "string"
      }
    },
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "required": [
    "network",
    "name",
    "description",
    "agent_uri",
    "owner_account"
  ],
  "additionalProperties": false
}
```

## `build_register`

Build a sign-ready CIS-8004 `register` payload, which mints a new agent NFT to the signer. All fields except `sender` are optional. Pass `agent_uri` + `metadata_hash_hex` upfront if you've already materialised the agent card. The Cis10 external_reference variant currently rejects on the live DevNet/TestNet deployments — see the tool's source for details.

```json
{
  "type": "object",
  "properties": {
    "agent_uri": {
      "type": [
        "string",
        "null"
      ]
    },
    "metadata_hash_hex": {
      "type": [
        "string",
        "null"
      ],
      "pattern": "^[0-9a-fA-F]{64}$"
    },
    "external_reference": {
      "type": [
        "object",
        "null"
      ],
      "description": "Optional ExternalReference — see agent_by_external_reference for shape."
    },
    "initial_metadata": {
      "type": [
        "array",
        "null"
      ],
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "minLength": 1,
            "maxLength": 64
          },
          "value_hex": {
            "type": "string",
            "pattern": "^[0-9a-fA-F]*$"
          }
        },
        "required": [
          "key",
          "value_hex"
        ]
      }
    },
    "sender": {
      "type": "string"
    },
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "required": [
    "network",
    "sender"
  ],
  "additionalProperties": false
}
```

## `build_set_agent_uri`

Build a sign-ready `setAgentURI` payload. Returns both wire-hex and schema-typed JSON of the parameter. The caller's wallet signs + submits; this MCP holds no keys. Pass `agent_uri: null` (omit) to leave the URI unchanged, same for `metadata_hash_hex`. This is how a new card hash gets pinned after adding a badge (see get_badge_json). REST twin (keyed on the badge): GET /v1/build-set-agent-uri/{token_address}?metadata_hash_hex=&agent_uri=&sender=.

```json
{
  "type": "object",
  "properties": {
    "token_id": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^[0-9]+$"
        },
        {
          "type": "integer",
          "minimum": 0
        }
      ]
    },
    "agent_uri": {
      "type": [
        "string",
        "null"
      ]
    },
    "metadata_hash_hex": {
      "type": [
        "string",
        "null"
      ],
      "pattern": "^[0-9a-fA-F]{64}$",
      "description": "SHA-256 (64 hex chars) of the card bytes served at agent_uri."
    },
    "sender": {
      "type": "string",
      "description": "Account that will sign + submit."
    },
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "required": [
    "network",
    "token_id"
  ],
  "additionalProperties": false
}
```

## `check_badge`

Check a Concordium Badge. `id` is a badge token address (→ the verdict for that one badge: on-chain record, card fetch + SHA-256 match, badge well-formedness, extension-form conformance, verification block) or a Concordium account (→ every badge the account owns). The network is resolved from the badge; pass `network` only to override. Same engine as check_account_badges. REST twin: GET /v1/check-badge/{id} (alias: /v1/badge-check/{id}).

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Badge token address (base58) or Concordium account address (base58)."
    },
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

## `contract_info`

Snapshot of the CIS-8004 + CIS-8 deployments for a network: addresses, module references, admin accounts, and the standards each contract advertises via CIS-0. Useful for confirming you're talking to the expected instance before any other lookup.

```json
{
  "type": "object",
  "properties": {
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "additionalProperties": false
}
```

## `get_agent_wallet`

Return the agent's current payment-routing wallet address (CIS-8004 `getAgentWallet`). Returns null when unset — which is the post-transfer state until the new owner re-runs `setAgentWallet`.

```json
{
  "type": "object",
  "properties": {
    "token_id": {
      "anyOf": [
        {
          "type": "string",
          "pattern": "^[0-9]+$"
        },
        {
          "type": "integer",
          "minimum": 0
        }
      ]
    },
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "required": [
    "token_id"
  ],
  "additionalProperties": false
}
```

## `network_status`

Health-check a Concordium network. Returns the gRPC endpoint, latest finalised block height + hash, and (when an indexer URL is configured) the indexer's sync state and lag in blocks.

```json
{
  "type": "object",
  "properties": {
    "network": {
      "type": "string",
      "description": "Configured network id; defaults to the server default when omitted.",
      "enum": [
        "devnet",
        "testnet",
        "mainnet"
      ],
      "default": "mainnet"
    }
  },
  "additionalProperties": false
}
```


---

## Registration + badge flow (from the tool descriptions above)

1. `build_agent_card` → canonical card JSON + sha256. Host the bytes verbatim at `agent_uri`.
2. `build_register {network:"testnet", sender, agent_uri, metadata_hash_hex}` → sign-ready payload. Sign it with the owner key and submit → agent NFT minted (token_id / badge = CIS-2 token address).
3. `build_agent_badge {card_url|card_json, owner_account, token_id}` → merged card with the A2A-extension badge (current form, no legacy warning) + new sha256. Host it verbatim.
4. `build_set_agent_uri` → sign and submit, which pins the new hash on-chain.
5. `check_badge <token_address>` → must return `badge_valid: true` with no warnings.

**Who stands behind the badge:** the owner account. Every Concordium account comes from an identity issued by an Identity Provider. On testnet that is "Concordium testnet IP" (no real KYC); mainnet uses real IdPs. The README and video say this plainly (plan amendment A2).
