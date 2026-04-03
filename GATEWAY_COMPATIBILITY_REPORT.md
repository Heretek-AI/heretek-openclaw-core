# Gateway Compatibility Report — Heretek OpenClaw Core

**Author:** Steward  
**Date:** 2026-04-03  
**Status:** ANALYSIS COMPLETE — PORTING IN PROGRESS

---

## Executive Summary

The `heretek-openclaw-core` repository contains two categories of modules that must be evaluated for npm gateway compatibility:

1. **Modules that target the archived JS gateway** — require full port
2. **Modules that use Redis directly** — require adapter layer only

**No modules can run as-is against the npm OpenClaw gateway.**

---

## Protocol Layer Comparison

### NPM Gateway Protocol (ACP — Agent Client Protocol)

The running gateway at port 18789 uses the **ACP (Agent Client Protocol)** via `@agentclientprotocol/sdk`, embedded in the npm `openclaw` package. Key characteristics:

- **Auth:** Nonce-challenge HMAC handshake on WebSocket connect (`connect.challenge` event)
- **Protocol:** JSON-RPC 2.0 over WebSocket with typed message schemas
- **Registry:** SQLite (`agents.db`) + Redis for pub/sub
- **A2A prefix (Redis):** `openclaw:a2a:` (same prefix the JS gateway used — compatible ✅)
- **WS paths:** `/a2a` (primary A2A), `/ws`, `/gateway`
- **SDK:** `@agentclientprotocol/sdk` (bundled in npm openclaw package)
- **Connection token:** `9b54947854ee05186fb5363d0ea113685794d08d4ab45f80`

### JS Gateway Protocol (Archived)

- **Auth:** None
- **Protocol:** Plain JSON `{type: register|message|broadcast|status}`
- **Registry:** In-memory `Map`
- **A2A prefix (Redis):** `openclaw:a2a:` — **compatible ✅**
- **WS path:** `/a2a`

---

## Module Compatibility Matrix

| Module | File | Target | Compatible? | Port Effort |
|---|---|---|---|---|
| **A2A Message Send** | `skills/a2a-message-send/a2a-redis.js` | Redis directly | ✅ Yes | **Low — adapter only** |
| **A2A Agent Register** | `skills/a2a-agent-register/SKILL.md` | LiteLLM proxy REST | ⚠️ Different endpoint | Medium — rewrite SKILL.md |
| **Event Mesh** | `modules/a2a-protocol/event-mesh.js` | Redis directly | ✅ Yes | **Low — rename prefix** |
| **Redis WS Bridge** | `modules/communication/redis-websocket-bridge.js` | JS gateway WS | ❌ No | **High — abandon** |
| **BFT Consensus** | `modules/consensus/bft-consensus.js` | Redis pub/sub | ✅ Yes | **Low — works as-is** |
| **Reputation Store** | `modules/consensus/reputation-store.postgres.js` | Postgres | ✅ Yes | **Low** |
| **Reputation Voting** | `modules/consensus/reputation-voting.js` | Postgres | ✅ Yes | **Low** |
| **Curiosity Engine** | `modules/curiosity-engine.js` | File system | ✅ Yes | **Low** |
| **Curiosity Engine v2** | `modules/curiosity-engine-v2.js` | File system | ✅ Yes | **Low** |
| **Heavy Swarm** | `modules/heavy-swarm.js` | CLI/subagent | ⚠️ Partial | Medium |
| **Lineage Tracking** | `modules/lineage-tracking.js` | Postgres | ✅ Yes | **Low** |
| **Tiered Context** | `modules/memory/tiered-context.js` | Postgres | ✅ Yes | **Low** |
| **Dashboard Sync** | `modules/observability/dashboard-sync.js` | REST API | ⚠️ Different endpoints | Medium |
| **Gateway Instrumentation** | `modules/observability/gateway-instrumentation.js` | WS connect | ⚠️ Different protocol | Medium |
| **Langfuse Client** | `modules/observability/langfuse-client.js` | HTTP | ✅ Yes | **Low** |
| **LiteLLM Integration** | `modules/observability/litellm-integration.js` | LiteLLM proxy | ✅ Yes | **Low** |
| **Metrics Exporter** | `modules/observability/metrics-exporter.js` | Prometheus | ✅ Yes | **Low** |
| **Trace Context** | `modules/observability/trace-context.js` | Langfuse | ✅ Yes | **Low** |
| **Swarm Memory** | `modules/swarm-memory/heretek-swarm-memory.js` | Postgres | ✅ Yes | **Low** |
| **Task State Machine** | `modules/task-state-machine.js` | Postgres | ✅ Yes | **Low** |
| **Agent Client Lib** | `agents/lib/agent-client.js` | JS gateway WS | ❌ No | **High — abandon** |
| **Model Config** | `agents/lib/agent-model-config.js` | Config | ✅ Yes | **Low** |
| **Model Router** | `agents/lib/agent-model-router.js` | LiteLLM proxy | ✅ Yes | **Low** |

---

## Porting Priorities

### Phase 1: Redis-First Modules (Low effort, high value)

These modules use Redis directly and are already compatible with the npm gateway's Redis key space.

#### 1.1 — `skills/a2a-message-send/a2a-redis.js` ⭐ START HERE
- **Why:** Simplest module, no WS dependency, directly usable
- **What:** Adapter that routes to npm gateway's ACP SDK or falls back to direct Redis
- **Redis keys used:** `openclaw:a2a:inbox:*`, `openclaw:a2a:agents`, `openclaw:a2a:broadcast`
- **Effort:** ~2 hours

#### 1.2 — `modules/a2a-protocol/event-mesh.js`
- **Why:** Complementary pub/sub layer; uses different prefix `heretek:event:`
- **What:** Either rename prefix to `openclaw:a2a:` or add bridging to both
- **Effort:** ~1 hour

#### 1.3 — `modules/consensus/bft-consensus.js`
- **Why:** Self-contained PBFT implementation using Redis pub/sub on `bft:consensus` channel
- **What:** Works as-is with Redis; needs adapter to publish results to npm gateway
- **Effort:** ~1 hour

### Phase 2: ACP SDK Adapter Layer (Medium effort)

#### 2.1 — ACP Adapter Library
- **What:** `modules/adapters/acp-adapter.js`
- **Provides:** 
  - Authenticated WebSocket connection to npm gateway
  - HMAC nonce signing
  - Typed message sending/receiving
  - Subscribe to agent events
- **Uses:** `@agentclientprotocol/sdk` (already bundled in npm openclaw)
- **Effort:** ~4 hours

#### 2.2 — Port `agents/lib/agent-client.js`
- **What:** Rewrite to use ACP adapter instead of JS gateway WS protocol
- **Effort:** ~3 hours

### Phase 3: Skills Rewrite

#### 3.1 — Rewrite `skills/a2a-agent-register/SKILL.md`
- **Current:** Targets LiteLLM proxy REST API (`/key/generate`)
- **Actual npm gateway:** No REST agent registration — agents register via A2A WebSocket
- **What:** Rewrite SKILL.md to use `openclaw agents add` CLI or ACP SDK
- **Effort:** ~2 hours

### Phase 4: Observability Adapters

#### 4.1 — `modules/observability/gateway-instrumentation.js`
- **What:** Rewrite to use ACP SDK event subscriptions instead of JS gateway WS
- **Effort:** ~3 hours

#### 4.2 — `modules/observability/dashboard-sync.js`
- **What:** Update REST endpoints to match dashboard API (`/api/health`, `/api/memory/graph`)
- **Effort:** ~2 hours

---

## Abandon (Do Not Port)

| Module | Reason |
|---|---|
| `modules/communication/redis-websocket-bridge.js` | Designed for JS gateway WS; npm gateway is already a WS endpoint |
| `agents/lib/agent-client.js` (original) | Incompatible protocol; replace with ACP version |
| `skills/gateway-pulse/` (entire skill) | Designed for JS gateway monitoring |

---

## Redis Key Space (Pre-existing, DO NOT REUSE)

The npm gateway and JS gateway share the same Redis prefix:

```
openclaw:a2a:inbox:{agentId}     # Message queues (list)
openclaw:a2a:agents               # Registered agent IDs (set)
openclaw:a2a:agent:{agentId}      # Agent metadata (hash)
openclaw:a2a:broadcast            # Broadcast pub/sub channel
```

**These keys are already populated. Modules using these keys are immediately compatible.**

Heretek-specific keys (different prefix, active):

```
heretek:event:{topic}            # EventMesh pub/sub (event-mesh.js)
bft:consensus                    # BFT consensus channel (bft-consensus.js)
bft:prepare:{view}:{seq}:{digest} # BFT prepare quorum tracking
bft:commit:{view}:{seq}:{digest}  # BFT commit quorum tracking
bft:view-change:{view}           # BFT view change tracking
```

---

## ACP SDK Reference

The npm gateway includes `@agentclientprotocol/sdk` at:

```
/usr/lib/node_modules/openclaw/node_modules/@agentclientprotocol/sdk/dist/
```

Key exports:
- `AgentSideConnection` — agent-side ACP connection
- `ClientSideConnection` — client-side connection  
- JSON-RPC 2.0 typed schemas via Zod
- Stream-based message framing (`ndJsonStream`)

Agent registration with npm gateway uses A2A WebSocket, not REST.

---

## Test Compatibility

The `tests/integration/` directory has tests that reference the JS gateway:

- `tests/integration/gateway-rpc.test.ts` — needs rewrite for ACP SDK
- `tests/integration/a2a-communication.test.ts` — Redis parts usable, WS parts need adapter
- `tests/integration/websocket-bridge.test.ts` — abandon (targets archived bridge)
- `tests/integration/agent-deliberation.test.ts` — depends on gateway-rpc

---

## Next Steps

1. ✅ **Done** — Archive `gateway/openclaw-gateway.js`
2. 🔄 **IN PROGRESS** — Port `skills/a2a-message-send/a2a-redis.js` (Phase 1.1)
3. ⬜ — Port `modules/a2a-protocol/event-mesh.js` (Phase 1.2)
4. ⬜ — Port `modules/consensus/bft-consensus.js` (Phase 1.3)
5. ⬜ — Build `modules/adapters/acp-adapter.js` (Phase 2.1)
6. ⬜ — Rewrite `agents/lib/agent-client.js` (Phase 2.2)
7. ⬜ — Rewrite `skills/a2a-agent-register/SKILL.md` (Phase 3.1)
8. ⬜ — Port observability modules (Phase 4)
9. ⬜ — Update integration tests

---

*🦞 Steward — Gateway Compatibility Report v1.0*
