# A2A Protocol Modules

This directory contains agent-to-agent communication layers for Heretek OpenClaw.

## Modules

### `event-mesh.js` — Legacy Redis Pub/Sub

**Purpose:** Solace-inspired event mesh using Redis pub/sub for local/fast agent communication.

**Prefix:** `heretek:event:{topic}`

**Features:**
- Subscribe / publish on Redis-backed topics
- Request/response pattern with auto-generated reply topics
- Wildcard subscriptions (`*`, `>`)
- Automatic reconnection

**Redis Namespace:**
```
heretek:event:tasks.urgent      → Redis Pub/Sub channel
heretek:event:system.heartbeat  → Redis Pub/Sub channel
```

**Usage:**
```javascript
const EventMesh = require('./event-mesh');

const mesh = new EventMesh({ agentId: 'alpha', host: 'localhost', port: 6379 });
await mesh.connect();

mesh.subscribe('tasks.urgent', (msg) => console.log('Got:', msg));
await mesh.publish('tasks.urgent', { task: 'Deploy production' });

await mesh.disconnect();
```

**API:**
| Method | Description |
|--------|-------------|
| `connect()` | Connect to Redis |
| `disconnect()` | Disconnect from Redis |
| `subscribe(topic, cb)` | Subscribe to a topic |
| `unsubscribe(topic, cb?)` | Unsubscribe from a topic |
| `publish(topic, event)` | Publish event to a topic |
| `request(topic, data, timeout?)` | Request-response (5s default) |
| `respond(request, data)` | Respond to a request |
| `isConnected()` | Check connection status |
| `getStats()` | Get subscription statistics |

---

### `event-mesh-acp.js` — ACP Bridge Layer (npm Gateway Integration)

**Purpose:** Bridges the EventMesh Redis pub/sub layer to the npm OpenClaw gateway via the ACP (Agent Client Protocol) adapter. Enables EventMesh subscribers to communicate with agents on the npm gateway.

**Extends:** `EventMesh` — fully backwards-compatible, all existing EventMesh API is preserved.

**Prefixes (independent namespaces):**
```
heretek:event:{topic}    → EventMesh Redis pub/sub  (local subscribers)
openclaw:a2a:{channel}   → npm OpenClaw gateway      (npm gateway agents)
```

**Architecture:**
```
┌─────────────────────┐
│  Heretek Module     │   EventMesh publish(topic, event)
└──────────┬──────────┘
           │
           ├──→ heretek:event:{topic}  (Redis) ─→ Local EventMesh subscribers
           │                                           ↑
           └──→ ACP broadcast ─→ npm gateway ─→ npm gateway agents
                                          ↑             │
                                          └─────────────┘
                                       (if acpSubscribeLocal=true)
```

**Usage:**
```javascript
const EventMeshACP = require('./event-mesh-acp');

const mesh = new EventMeshACP({
  agentId: 'alpha',
  // EventMesh Redis options (same as event-mesh.js)
  host: 'localhost',
  port: 6379,
  // ACP bridge options
  acpBridgeTopics: ['tasks.*', 'system.*'],  // topics to forward to ACP
  acpAutoBridge: true,                         // auto-bridge all publish()
  acpSubscribeLocal: true,                     // route ACP → EventMesh subscribers
});

await mesh.connect();                          // Redis
await mesh.connectACP({ token: '...' });       // npm gateway (optional)

// Normal EventMesh API — unchanged
mesh.subscribe('tasks.urgent', (msg) => console.log(msg));
await mesh.publish('tasks.urgent', { task: 'Deploy' });

await mesh.disconnect();   // closes ACP + Redis
```

**ACP Bridge Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `acpBridgeTopics` | `['*']` | Topics to forward to ACP gateway |
| `acpAutoBridge` | `true` | Auto-bridge `publish()` calls to ACP |
| `acpSubscribeLocal` | `true` | Route ACP broadcasts → EventMesh subscribers |
| `acpGatewayUrl` | `ws://localhost:18789/a2a` | ACP gateway WebSocket URL |
| `acpToken` | env `OPENCLAW_GATEWAY_TOKEN` | ACP auth token |
| `acpTimeout` | `10000` | ACP connection timeout ms |

**ACP API:**
| Method | Description |
|--------|-------------|
| `connectACP(opts?)` | Connect to npm OpenClaw ACP gateway |
| `disconnectACP()` | Disconnect from ACP gateway |
| `isACPConnected()` | Check ACP connection status |
| `getStatus()` | Combined EventMesh + ACP status |
| `request(topic, data, opts?)` | Request with ACP fallback |

**Bridged Message Envelope:**
Messages forwarded to ACP are tagged:
```json
{
  "type": "eventmesh.bridge",
  "source": "eventmesh",
  "agentId": "alpha",
  "topic": "tasks.urgent",
  "event": { "task": "Deploy" },
  "timestamp": "2026-04-02T..."
}
```

---

## Coexistence

- **`event-mesh.js`**: Works standalone, requires only Redis. Use for pure Redis pub/sub (legacy Heretek modules, internal services).
- **`event-mesh-acp.js`**: Bridges to npm OpenClaw. Use when agents need to reach both Redis subscribers AND npm gateway agents.
- The `heretek:event:` and `openclaw:a2a:` Redis prefixes are **completely independent** — EventMesh subscribers on `heretek:event:` do not automatically receive npm gateway messages.
- ACP bridging is **opt-in** via `connectACP()` and topic filters — existing EventMesh behavior is unchanged.
