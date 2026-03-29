---
name: matrix-triad
description: Matrix server communication for agent collective. Use when connecting to a Matrix server, sending/receiving messages, creating rooms, or managing Matrix communication for the collective.
---

# Matrix Triad — Agent Communication via Matrix

**Updated:** 2026-03-26

## Definitive Naming

| Role | Agent ID | Matrix ID | Notes |
|------|----------|-----------|-------|
| **Orchestrator** | `steward` | `@steward:node.heretek.one` | Runs the collective. Does NOT deliberate. |
| **Triad Node 1** | `tabula-alpha` | `@alpha:node.heretek.one` | Deliberates and votes. |
| **Triad Node 2** | `tabula-beta` | `@beta:node.heretek.one` | Deliberates and votes. |
| **Triad Node 3** | `tabula-charlie` | `@charlie:node.heretek.one` | Deliberates and votes. |
| Sentinel | `sentinel` | `@sentinel:node.heretek.one` | Safety reviewer. |
| Oracle | `oracle` | `@oracle:node.heretek.one` | External intelligence. |
| Examiner | `examiner` | `@examiner:node.heretek.one` | Questions ratified decisions. |
| Coder | `coder` | `@tabcoder:node.heretek.one` | Implementation engine. |

## Rooms

| Room | ID | Purpose |
|------|-----|---------|
| Triad General | `!uTDHYFOFoQCvkistkY:node.heretek.one` | Primary deliberation — all agents |
| Deliberation | `!XHLSKgiMcbPjqAgckF:node.heretek.one` | Proposal review |
| Consensus | `!aMRZHmnwFBRNYVGXxf:node.heretek.one` | Ratified decisions |
| Alerts | `!XaRwDslNQGvCNHhTnQ:node.heretek.one` | System alerts |

**lorebeard:** `@lorebeard:node.heretek.one` — in all rooms ✅

## Bot-to-Bot Communication

All bots use `allowBots: true` + `requireMention: false` in the room config:

```json
{
  "allowBots": true,
  "groups": {
    "!uTDHYFOFoQCvkistkY:node.heretek.one": {
      "allow": true,
      "allowBots": true,
      "requireMention": false
    }
  }
}
```

## sessions_send

```javascript
// Triad nodes
sessions_send({ sessionKey: "agent:tabula-alpha:default", message: "..." })
sessions_send({ sessionKey: "agent:tabula-beta:default", message: "..." })
sessions_send({ sessionKey: "agent:tabula-charlie:default", message: "..." })

// Contributors
sessions_send({ sessionKey: "agent:sentinel:default", message: "..." })
sessions_send({ sessionKey: "agent:oracle:default", message: "..." })
sessions_send({ sessionKey: "agent:examiner:default", message: "..." })
sessions_send({ sessionKey: "agent:coder:default", message: "..." })
```

## Architecture

```
@steward:node.heretek.one  — Orchestrator (NOT in triad-general deliberation loop)
@alpha:node.heretek.one    — Tabula Alpha — TRIAD
@beta:node.heretek.one     — Tabula Beta — TRIAD
@charlie:node.heretek.one  — Tabula Charlie — TRIAD
@sentinel:node.heretek.one — Safety reviewer (cron-driven)
@oracle:node.heretek.one   — Intel gatherer (cron-driven)
@examiner:node.heretek.one — Questions ratified (cron-driven)
@tabcoder:node.heretek.one — Coder (task-driven)
@lorebeard:node.heretek.one — Operator (monitoring)
```

🦞
