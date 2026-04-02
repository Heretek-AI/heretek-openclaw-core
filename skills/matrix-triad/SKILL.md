---
name: matrix-triad
description: Matrix server communication for agent collective. Use when connecting to a Matrix server, sending/receiving messages, creating rooms, or managing Matrix communication for the collective.
---

# Matrix Triad — Agent Communication via Matrix

**Updated:** 2026-03-26

## Definitive Naming

| Role | Agent ID | Matrix ID | Notes |
|------|----------|-----------|-------|
| **Orchestrator** | `steward` | `@steward:<matrix-server>` | Runs the collective. Does NOT deliberate. |
| **Triad Node 1** | `tabula-alpha` | `@alpha:<matrix-server>` | Deliberates and votes. |
| **Triad Node 2** | `tabula-beta` | `@beta:<matrix-server>` | Deliberates and votes. |
| **Triad Node 3** | `tabula-charlie` | `@charlie:<matrix-server>` | Deliberates and votes. |
| Sentinel | `sentinel` | `@sentinel:<matrix-server>` | Safety reviewer. |
| Oracle | `oracle` | `@oracle:<matrix-server>` | External intelligence. |
| Examiner | `examiner` | `@examiner:<matrix-server>` | Questions ratified decisions. |
| Coder | `coder` | `@tabcoder:<matrix-server>` | Implementation engine. |

## Rooms

| Room | ID | Purpose |
|------|-----|---------|
| Triad General | `!<room-id>:<matrix-server>` | Primary deliberation — all agents |
| Deliberation | `!<room-id>:<matrix-server>` | Proposal review |
| Consensus | `!<room-id>:<matrix-server>` | Ratified decisions |
| Alerts | `!<room-id>:<matrix-server>` | System alerts |

**Operator:** `@operator:<matrix-server>` — in all rooms ✅

## Bot-to-Bot Communication

All bots use `allowBots: true` + `requireMention: false` in the room config:

```json
{
  "allowBots": true,
  "groups": {
    "!<room-id>:<matrix-server>": {
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
@steward:<matrix-server>  — Orchestrator (NOT in triad-general deliberation loop)
@alpha:<matrix-server>    — Tabula Alpha — TRIAD
@beta:<matrix-server>     — Tabula Beta — TRIAD
@charlie:<matrix-server>  — Tabula Charlie — TRIAD
@sentinel:<matrix-server> — Safety reviewer (cron-driven)
@oracle:<matrix-server>   — Intel gatherer (cron-driven)
@examiner:<matrix-server> — Questions ratified (cron-driven)
@tabcoder:<matrix-server> — Coder (task-driven)
@operator:<matrix-server> — Operator (monitoring)
```

🦞
