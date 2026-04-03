# ⚠️ ARCHIVED — JS Gateway (openclaw-gateway.js)

**Archived:** 2026-04-03  
**Reason:** Parallel, incompatible implementation — never deployed in production

---

## What was here

`/gateway/openclaw-gateway.js` — A standalone Node.js WebSocket gateway implementing a simple JSON protocol for agent-to-agent communication, using `ioredis` for pub/sub and message queuing.

## Why it was archived

The JS gateway was a **design prototype** that was never connected to the actual OpenClaw system. Two fundamentally different gateways existed side by side:

| | JS Gateway (this file) | NPM Gateway (actual) |
|---|---|---|
| **Source** | `heretek-openclaw-core/gateway/` | npm package `openclaw` |
| **Protocol** | Simple JSON `{type: register\|message\|broadcast\|status}` | ACP (Agent Client Protocol) over WebSocket |
| **Auth** | None | Nonce-challenge HMAC |
| **Registry** | In-memory Map | SQLite + Redis |
| **Port** | Default 18789 (conflicted) | 18789 (running) |
| **Protocol version** | 1.0.0 (proprietary) | ACP 1.x via `@agentclientprotocol/sdk` |
| **Deploy status** | Never deployed | Running since 2026-03-31 |

The JS gateway was incompatible with the actual npm gateway at every layer — protocol, auth, registry, and message format.

## What still works (from the JS gateway design)

The following concepts from this prototype are worth preserving for the npm gateway port:

- ✅ Agent registration with capabilities advertisement
- ✅ Message routing via Redis pub/sub
- ✅ Message queuing for offline agents (`openclaw:a2a:inbox:{agentId}`)
- ✅ Broadcast to all connected agents
- ✅ Redis key structure: `openclaw:a2a:agents`, `openclaw:a2a:agent:{id}`, `openclaw:a2a:broadcast`
- ✅ Heartbeat interval tracking (`heartbeatInterval * 2` for offline detection)
- ✅ `GET /health` and `GET /agents` HTTP endpoints
- ✅ Ping/pong keepalive protocol

## Compatible Redis key prefix

Both the JS gateway and the `skills/a2a-message-send/a2a-redis.js` use the same Redis prefix:

```
openclaw:a2a:
```

This shared prefix means **no data migration is needed** — the Redis structures are already compatible.

## See also

- `GATEWAY_COMPATIBILITY_REPORT.md` — Full analysis and porting roadmap
- `../modules/communication/redis-websocket-bridge.js` — Standalone Redis↔WebSocket bridge (also archived)
- `../skills/a2a-message-send/a2a-redis.js` — Still active; uses same Redis keys
- `../modules/a2a-protocol/event-mesh.js` — Still active; uses different Redis prefix `heretek:event:`
